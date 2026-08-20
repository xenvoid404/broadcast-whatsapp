import type { WASocket } from '@whiskeysockets/baileys';
import { and, eq, lt } from 'drizzle-orm';
import cron, { type ScheduledTask } from 'node-cron';
import { db } from '#/db/index.js';
import * as model from '#/db/models.js';
import dayjs from '#/utils/dayjs.js';
import { logger } from '#/utils/logger.js';

let task: ScheduledTask | null = null;
let isProcessing = false;

export function startCron(sock: WASocket): void {
  task?.stop();

  task = cron.schedule('* * * * *', async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const pendings = db
        .select()
        .from(model.schedules)
        .where(and(eq(model.schedules.status, 'pending'), lt(model.schedules.scheduledAt, dayjs().toDate())))
        .all();
      if (pendings.length === 0) return;

      for (const p of pendings) {
        try {
          const attachment = p.attachment ? JSON.parse(p.attachment) : null;
          if (attachment) {
            const buffer = Buffer.from(attachment.data, 'base64');
            const mimetype: string = attachment.mimetype;
            if (mimetype.startsWith('image/')) {
              await sock.sendMessage(p.groupJid, { image: buffer, caption: p.text, mimetype });
            } else if (mimetype.startsWith('video/')) {
              await sock.sendMessage(p.groupJid, { video: buffer, caption: p.text, mimetype });
            } else if (mimetype.startsWith('audio/')) {
              await sock.sendMessage(p.groupJid, { audio: buffer, mimetype, ptt: false });
            } else {
              await sock.sendMessage(p.groupJid, {
                document: buffer,
                mimetype,
                fileName: attachment.filename ?? 'file',
                caption: p.text,
              });
            }
          } else {
            await sock.sendMessage(p.groupJid, { text: p.text });
          }

          db.update(model.schedules)
            .set({ status: 'success', updatedAt: dayjs().toDate() })
            .where(eq(model.schedules.id, p.id))
            .run();
          logger.info({ groupJid: p.groupJid, scheduledAt: p.scheduledAt }, 'Broadcast terkirim');
        } catch (err) {
          db.update(model.schedules)
            .set({ status: 'failed', updatedAt: dayjs().toDate() })
            .where(eq(model.schedules.id, p.id))
            .run();
          logger.error({ err, groupJid: p.groupJid }, 'Gagal mengirim broadcast');
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (err) {
      logger.error({ err }, 'Error tidak terduga di cron broadcast');
    } finally {
      isProcessing = false;
    }
  });
}
