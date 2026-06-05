import { configQ, messageQ, scheduleQ } from '@/db/queries';
import { logger } from '@/lib/logger';
import { isTimeReached, now, randomTime, today } from '@/lib/utils';
import type { WASocket } from '@whiskeysockets/baileys';
import { existsSync, readFileSync } from 'fs';
import cron, { ScheduledTask } from 'node-cron';

let isProcessing = false;
let minuteTask: ScheduledTask | null = null;
let midnightTask: ScheduledTask | null = null;

export async function generateDailySchedules(sock: WASocket): Promise<void> {
    const cfg = configQ.get();
    if (!cfg) {
        logger.warn('Config tidak ditemukan, generate jadwal dibatalkan');
        return;
    }
    let groups: Record<string, { id: string; subject: string }>;
    try {
        groups = (await sock.groupFetchAllParticipating()) as Record<string, { id: string; subject: string }>;
    } catch (err) {
        logger.error({ err }, 'Gagal fetch daftar grup dari WhatsApp');
        return;
    }
    const groupList = Object.values(groups);
    if (!groupList.length) {
        logger.info('Bot tidak mengikuti grup manapun, generate jadwal dilewati');
        return;
    }
    const newRows: Array<{ groupJid: string; scheduledTime: string }> = [];
    for (const g of groupList) {
        if (scheduleQ.todayByGroup(g.id)) continue;
        newRows.push({
            groupJid: g.id,
            scheduledTime: randomTime(cfg.start, cfg.end),
        });
    }
    if (!newRows.length) {
        logger.info('Semua grup sudah memiliki jadwal untuk hari ini');
        return;
    }
    scheduleQ.insertMany(newRows);
    logger.info({ count: newRows.length, date: today() }, '📅 Jadwal broadcast hari ini berhasil dibuat');
    for (const r of newRows) {
        logger.debug({ groupJid: r.groupJid, scheduledTime: r.scheduledTime }, 'Jadwal grup');
    }
}

async function sendPending(sock: WASocket): Promise<void> {
    const pending = scheduleQ.getPendingToday();
    if (!pending.length) return;
    const msg = messageQ.get();
    if (!msg?.text) {
        logger.warn('Pesan broadcast belum diatur, pengiriman dilewati');
        return;
    }
    const imageBuffer = msg.image && existsSync(msg.image) ? readFileSync(msg.image) : null;
    for (const s of pending) {
        if (!isTimeReached(s.scheduled_time)) continue;
        try {
            if (imageBuffer) await sock.sendMessage(s.group_jid, { image: imageBuffer, caption: msg.text });
            else await sock.sendMessage(s.group_jid, { text: msg.text });
            scheduleQ.setStatus(s.id, 'sent', now());
            logger.info({ groupJid: s.group_jid, scheduledTime: s.scheduled_time }, '✅ Broadcast terkirim');
        } catch (err) {
            scheduleQ.setStatus(s.id, 'failed');
            logger.error({ err, groupJid: s.group_jid }, '❌ Gagal mengirim broadcast ke grup');
        }
    }
}

export function startCrons(sock: WASocket): void {
    if (minuteTask) {
        minuteTask.stop();
        logger.info('Cron menit lama dihentikan');
    }
    if (midnightTask) {
        midnightTask.stop();
        logger.info('Cron tengah malam lama dihentikan');
    }
    minuteTask = cron.schedule('* * * * *', async () => {
        if (isProcessing) {
            logger.warn('Cron tick dilewati — proses sebelumnya masih berjalan');
            return;
        }
        isProcessing = true;
        try {
            await sendPending(sock);
        } catch (err) {
            logger.error({ err }, 'Error tidak terduga saat eksekusi pengiriman broadcast');
        } finally {
            isProcessing = false;
        }
    });
    midnightTask = cron.schedule('0 0 * * *', () => {
        setTimeout(async () => {
            try {
                logger.info('🌙 Midnight cron — membersihkan jadwal lama dan membuat jadwal baru');
                scheduleQ.cleanOld();
                await generateDailySchedules(sock);
            } catch (err) {
                logger.error({ err }, 'Error saat eksekusi midnight cron');
            }
        }, 5000);
    });
    logger.info('✅ Node-cron jobs dimulai');
}
