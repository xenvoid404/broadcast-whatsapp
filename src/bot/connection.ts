import { config } from '@/config';
import { sessionQ } from '@/db/queries';
import { logger } from '@/lib/logger';
import { useSqliteAuthState } from '@/lib/session';
import { sleep } from '@/lib/utils';
import makeWASocket, { DisconnectReason, type GroupMetadata, type WASocket } from '@whiskeysockets/baileys';
import pino from 'pino';
import { handleMessage } from './handlers';
import { startCrons } from './scheduler';

const groupCache = new Map<string, GroupMetadata>();

export async function connect(retries = 0): Promise<void> {
    const { state, saveCreds } = useSqliteAuthState();
    const sock: WASocket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false,
        printQRInTerminal: false,
        cachedGroupMetadata: async (jid) => groupCache.get(jid),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
    });
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(config.phoneNumber);
                logger.info(`👨‍💻 Kode pairing: ${code}`);
            } catch (err) {
                logger.error({ err }, 'Gagal mendapatkan kode pairing');
            }
        }, 3_000);
    }
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            const number = sock.user?.id?.split(':')[0];
            logger.info({ number }, '✅ WhatsApp berhasil terhubung');
            startCrons(sock);
        }
        if (connection === 'close') {
            const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
            const loggedOut = code === DisconnectReason.loggedOut;
            if (loggedOut) {
                logger.warn('Sesi tidak valid (logged out). Hapus tabel sessions untuk pair ulang');
                sessionQ.clearAll();
                return;
            }
            const delay = Math.min(5_000 * (retries + 1), 30_000);
            logger.warn({ statusCode: code, retries, delayMs: delay }, 'Koneksi terputus, mencoba reconnect...');
            await sleep(delay);
            await connect(retries + 1);
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
        const botRemoved = participants.some((p) => {
            const jid = typeof p === 'string' ? p : (p as { id: string }).id;
            return jid?.includes(botNumber);
        });
        if (botRemoved) {
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
                logger.error({ err }, 'Error saat memproses pesan masuk');
            }
        }
    });
}
