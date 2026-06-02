import { configQ, messageQ, scheduleQ } from '@/db/queries';
import { logger } from '@/lib/logger';
import { isTimeReached, now, randomTime, today } from '@/lib/utils'; // Tambahkan today()
import type { WASocket } from '@whiskeysockets/baileys';
import fs from 'fs';

export async function generateDailySchedules(sock: WASocket): Promise<void> {
    const cfg = configQ.get() as { start: number; end: number; link_threshold: number } | undefined;
    if (!cfg) return;
    let groups: Record<string, any> = {};
    try {
        groups = await sock.groupFetchAllParticipating();
    } catch (err) {
        logger.error({ err }, 'Gagal fetch grup');
        return;
    }
    const groupList = Object.values(groups);
    if (!groupList.length) {
        logger.info('Tidak ada grup yang diikuti');
        return;
    }
    const rows: { group_jid: string; scheduled_time: string; scheduled_date: string }[] = [];
    for (const g of groupList) {
        if (scheduleQ.todayByGroup(g.id)) continue;
        rows.push({
            group_jid: g.id,
            scheduled_time: randomTime(cfg.start, cfg.end),
            scheduled_date: today(),
        });
    }
    if (!rows.length) {
        logger.info('Semua grup sudah punya jadwal hari ini');
        return;
    }
    scheduleQ.insertMany(rows);
    logger.info({ count: rows.length }, '📅 Jadwal broadcast dibuat');
    rows.forEach((r) => logger.info(`  → ${r.group_jid} jam ${r.scheduled_time}`));
}

async function sendPending(sock: WASocket): Promise<void> {
    const pending = scheduleQ.getPendingToday() as any[];
    if (!pending.length) return;
    const msg = messageQ.get() as any;
    if (!msg?.text) return;
    const imageBuffer = msg.image && fs.existsSync(msg.image) ? fs.readFileSync(msg.image) : null;
    for (const s of pending) {
        if (!isTimeReached(s.scheduled_time)) continue;
        try {
            if (imageBuffer) {
                await sock.sendMessage(s.group_jid, { image: imageBuffer, caption: msg.text }); // Ubah ke snake_case
            } else {
                await sock.sendMessage(s.group_jid, { text: msg.text }); // Ubah ke snake_case
            }
            scheduleQ.setStatus(s.id, 'sent', now());
            logger.info({ group_jid: s.group_jid, time: s.scheduled_time }, '✅ Terkirim');
        } catch (err) {
            scheduleQ.setStatus(s.id, 'failed');
            logger.error({ group_jid: s.group_jid, err }, '❌ Gagal kirim');
        }
    }
}

let isProcessing = false;
let cronInterval: NodeJS.Timeout | null = null;
export function startCrons(sock: WASocket): void {
    if (cronInterval) {
        clearInterval(cronInterval);
        logger.info('🔄 Restarting cron interval karena koneksi ulang...');
    }
    cronInterval = setInterval(async () => {
        if (isProcessing) {
            logger.warn('Tugas cron terlewati karena proses sebelumnya belum selesai.');
            return;
        }
        isProcessing = true;
        try {
            await sendPending(sock);
            const date = new Date();
            if (date.getHours() === 0 && date.getMinutes() === 0) {
                logger.info('🌙 Midnight cron — generate jadwal baru');
                scheduleQ.cleanOld();
                await generateDailySchedules(sock);
            }
        } catch (error) {
            logger.error({ error }, 'Error pada saat eksekusi cron native');
        } finally {
            isProcessing = false;
        }
    }, 60000);
    logger.info('✅ Native cron jobs dimulai / diperbarui');
}
