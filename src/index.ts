import { envConfig } from '@/config.js';
import { db } from '@/db/index.js';
import * as schema from '@/db/schema.js';
import { logger } from '@/lib/logger.js';
import { sessionManager } from '@/lib/session.js';
import makeWASocket, { Browsers, DisconnectReason, type GroupMetadata, type WASocket } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { handleMessage } from './bot/handlers.js';
import { startCron } from './bot/scheduler.js';

const groupCache = new Map<string, GroupMetadata>();

export async function bootstrap(retries: number = 0): Promise<void> {
    try {
        const { state, saveCreds } = sessionManager();

        const sock: WASocket = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: false,
            printQRInTerminal: false,
            cachedGroupMetadata: async (jid) => groupCache.get(jid),
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
            getMessage: async () => ({ conversation: '' }),
        });

        if (envConfig.app.method === 'pairing' && !sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    logger.info({ number: envConfig.app.number }, 'Meminta kode pairing...');
                    const code = await sock.requestPairingCode(envConfig.app.number);
                    logger.info(`Kode pairing: ${code}`);
                } catch (err) {
                    logger.error({ err }, 'Gagal mendapatkan kode pairing dari server');
                }
            }, 3000);
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            if (envConfig.app.method === 'qr' && qr) {
                const qrStr = await QRCode.toString(qr, { type: 'terminal', small: true });
                console.log('\nScan QR Code berikut:\n');
                console.log(qrStr);
            }

            if (connection === 'open') {
                logger.info({ number: sock.user?.id?.split(':')[0] }, 'WhatsApp terhubung');
                startCron(sock);
            }

            if (connection === 'close') {
                const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
                const loggedOut = code === DisconnectReason.loggedOut;

                if (loggedOut) {
                    logger.warn('Logged out — hapus tabel sessions untuk pair ulang');
                    db.delete(schema.sessions).run();
                    return;
                }

                const delay = Math.min(5000 * (retries + 1), 30000);
                logger.warn({ statusCode: code, retries, delayMs: delay }, 'Koneksi terputus, reconnect...');
                await new Promise((r) => setTimeout(r, delay));
                await bootstrap(retries + 1);
            }
        });

        sock.ev.on('groups.upsert', (groups) => {
            for (const group of groups) groupCache.set(group.id, group);
        });

        sock.ev.on('groups.update', (updates) => {
            for (const update of updates) {
                if (!update.id) continue;
                const cached = groupCache.get(update.id);
                if (cached) groupCache.set(update.id, { ...cached, ...update });
            }
        });

        sock.ev.on('group-participants.update', ({ id, action, participants }) => {
            if (action !== 'remove') return;
            const botNumber = sock.user?.id?.split(':')[0] ?? '';
            const removed = participants.some((p) => {
                const jid = typeof p === 'string' ? p : (p as { id: string }).id;
                return jid?.includes(botNumber);
            });
            if (removed) {
                groupCache.delete(id);
                logger.info({ groupJid: id }, 'Bot dikeluarkan dari grup, cache dihapus');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                try {
                    await handleMessage(sock, msg);
                } catch (err) {
                    logger.error({ err }, 'Error memproses pesan');
                }
            }
        });
    } catch (err) {
        logger.fatal({ err }, 'Fatal error - proses dihentikan');
        process.exit(1);
    }
}

bootstrap();
