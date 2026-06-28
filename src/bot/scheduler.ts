import { db } from '@/db/index.js';
import * as schema from '@/db/schema.js';
import dayjs from '@/lib/dayjs.js';
import { logger } from '@/lib/logger.js';
import type { WASocket } from '@whiskeysockets/baileys';
import { and, eq, inArray, lt } from 'drizzle-orm'; // Tambahkan inArray
import cron, { type ScheduledTask } from 'node-cron';

let task: ScheduledTask | null = null;
let isProcessing = false;

export function startCron(sock: WASocket): void {
    task?.stop();

    task = cron.schedule('* * * * *', async () => {
        if (isProcessing) return;
        isProcessing = true;

        try {
            await sendPending(sock);
        } catch (err) {
            logger.error({ err }, 'Error tidak terduga di cron broadcast');
        } finally {
            isProcessing = false;
        }
    });

    cron.schedule('0 0 * * *', () => {
        try {
            db.delete(schema.schedules)
                .where(and(inArray(schema.schedules.status, ['pending', 'failed']), lt(schema.schedules.createdAt, dayjs().toDate())))
                .run();

            logger.info('Jadwal lama dibersihkan');
        } catch (err) {
            logger.error({ err }, 'Gagal membersihkan jadwal lama di database');
        }
    });

    logger.info('Cron jobs dimulai');
}

async function sendPending(sock: WASocket): Promise<void> {
    const pending = db
        .select()
        .from(schema.schedules)
        .where(and(eq(schema.schedules.status, 'pending'), lt(schema.schedules.scheduledAt, dayjs().toDate())))
        .all();

    if (pending.length === 0) return;

    for (const s of pending) {
        try {
            const attachment = s.attachment ? JSON.parse(s.attachment) : null;
            if (attachment) {
                const buffer = Buffer.from(attachment.data, 'base64');
                const mimetype: string = attachment.mimetype;
                if (mimetype.startsWith('image/')) {
                    await sock.sendMessage(s.groupJid, { image: buffer, caption: s.text, mimetype });
                } else if (mimetype.startsWith('video/')) {
                    await sock.sendMessage(s.groupJid, { video: buffer, caption: s.text, mimetype });
                } else if (mimetype.startsWith('audio/')) {
                    await sock.sendMessage(s.groupJid, { audio: buffer, mimetype, ptt: false });
                } else {
                    await sock.sendMessage(s.groupJid, {
                        document: buffer,
                        mimetype,
                        fileName: attachment.filename ?? 'file',
                        caption: s.text,
                    });
                }
            } else {
                await sock.sendMessage(s.groupJid, { text: s.text });
            }

            db.update(schema.schedules).set({ status: 'success', updatedAt: dayjs().toDate() }).where(eq(schema.schedules.id, s.id)).run();

            logger.info({ groupJid: s.groupJid, scheduledAt: s.scheduledAt }, 'Broadcast terkirim');
        } catch (err) {
            db.update(schema.schedules).set({ status: 'failed', updatedAt: dayjs().toDate() }).where(eq(schema.schedules.id, s.id)).run();

            logger.error({ err, groupJid: s.groupJid }, 'Gagal mengirim broadcast');
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }
}
