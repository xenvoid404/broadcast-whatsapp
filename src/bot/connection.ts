import { envConfig } from '@/config';
import { sessionQ } from '@/db/queries';
import { logger } from '@/lib/logger';
import { useSqliteAuthState } from '@/lib/session';
import { sleep } from '@/lib/utils';
import makeWASocket, { Browsers, DisconnectReason, GroupMetadata, proto } from '@whiskeysockets/baileys';
import pino from 'pino';
import { handleMessage } from './handlers';
import { startCrons } from './scheduler';

const groupCache = new Map<string, GroupMetadata>();

export async function connect(retries: number = 0): Promise<void> {
    const { state, saveCreds } = await useSqliteAuthState();
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }) as any,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        printQRInTerminal: false,
        cachedGroupMetadata: async (jid) => groupCache.get(jid),
        syncFullHistory: false,
        shouldSyncHistoryMessage: (msg) => {
            if (msg.syncType === proto.HistorySync.HistorySyncType.RECENT || msg.syncType === proto.HistorySync.HistorySyncType.FULL) {
                logger.warn('Membatalkan unduhan riwayat chat untuk meringankan CPU.');
                return false;
            }
            return true;
        },
    });
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(envConfig.app.number);
                logger.info(`👨‍💻 Kode Pairing: ${code}`);
            } catch (err) {
                logger.error({ err }, '❌ Gagal mendapatkan kode pairing');
            }
        }, 3000);
    }
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            logger.info(`✅ WhatsApp terhubung! (${sock.user?.id?.split(':')[0]})`);
            startCrons(sock);
        }
        if (connection === 'close') {
            const code = (lastDisconnect?.error as any)?.output?.statusCode;
            const loggedOut = code === DisconnectReason.loggedOut;
            if (loggedOut) {
                logger.warn('🚫 Logged out. Hapus data sesi di SQLite (tabel session) untuk pair ulang.');
                sessionQ.clearAll();
                return;
            }
            const delay = Math.min(5000 * (retries + 1), 30000);
            logger.warn({ code, retries }, `Koneksi terputus. Reconnect dalam ${delay / 1000}s...`);
            await sleep(delay);
            await connect(retries + 1);
        }
    });
    sock.ev.on('groups.upsert', (groups) => {
        for (const group of groups) {
            groupCache.set(group.id, group);
        }
    });
    sock.ev.on('groups.update', (updates) => {
        for (const update of updates) {
            if (update.id) {
                const cachedGroup = groupCache.get(update.id);
                if (cachedGroup) groupCache.set(update.id, { ...cachedGroup, ...update });
            }
        }
    });
    sock.ev.on('group-participants.update', (update) => {
        const botId = sock.user?.id?.split(':')[0] || '';
        if (update.action === 'remove') {
            const isBotRemoved = update.participants.some((p: any) => {
                const participantJid = typeof p === 'string' ? p : p.id;
                return participantJid?.includes(botId);
            });
            if (isBotRemoved) {
                groupCache.delete(update.id);
                logger.info(`Keluar dari grup ${update.id}, cache dihapus.`);
            }
        }
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            try {
                await handleMessage(sock, msg);
            } catch (err) {
                logger.error({ err }, 'Error handle message');
            }
        }
    });
}
