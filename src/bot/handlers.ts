import { db } from '@/db/index.js';
import * as schema from '@/db/schema.js';
import dayjs from '@/lib/dayjs.js';
import { logger } from '@/lib/logger.js';
import { downloadMediaMessage, type WAMessage, type WASocket } from '@whiskeysockets/baileys';
import { count, eq } from 'drizzle-orm';

export async function handleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
    if (msg.key.fromMe) return await handleCommand(sock, msg);
    const jid = msg.key.remoteJid ?? '';
    if (jid.endsWith('@g.us')) await collectLink(sock, msg, jid);
}

async function handleCommand(sock: WASocket, msg: WAMessage): Promise<void> {
    const replyJid = msg.key.remoteJid!;
    const { text, caption } = extractContent(msg);

    const trigger = text ?? caption ?? '';
    if (!trigger.startsWith('!bc')) return;

    const bcText = trigger.slice('!bc'.length).trim();
    const attachmentObj = await extractAttachment(sock, msg);
    const attachment = attachmentObj ? JSON.stringify(attachmentObj) : null;

    let groups: Record<string, { id: string; subject: string }>;

    try {
        groups = (await sock.groupFetchAllParticipating()) as Record<string, { id: string; subject: string }>;
    } catch (err) {
        logger.error({ err }, 'Gagal fetch daftar grup');
        return await reply(sock, replyJid, '❌ Gagal mengambil daftar grup.');
    }

    const groupList = Object.values(groups);
    if (groupList.length === 0) return await reply(sock, replyJid, '❌ Bot tidak mengikuti grup manapun.');

    db.insert(schema.schedules)
        .values(
            groupList.map((g) => ({
                groupJid: g.id,
                text: bcText,
                attachment,
                scheduledAt: dayjs()
                    .add(Math.floor(Math.random() * 60 * 60000), 'millisecond')
                    .toDate(),
            })),
        )
        .run();

    logger.info({ count: groupList.length }, 'Jadwal broadcast dibuat');
    return await reply(sock, replyJid, `Broadcast dijadwalkan ke ${groupList.length} grup dalam 1 jam ke depan.`);
}

async function collectLink(sock: WASocket, msg: WAMessage, groupJid: string): Promise<void> {
    const { text, caption } = extractContent(msg);
    const content = text ?? caption ?? '';
    if (!content) return;

    const extracted = content.match(/https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,24}/g) ?? [];
    if (!extracted.length) return;

    const senderName = msg.pushName ?? msg.key.participant ?? '';
    let sourceGroupName = '';
    try {
        sourceGroupName = (await sock.groupMetadata(groupJid)).subject;
    } catch {}

    let added = 0;
    for (const url of extracted) {
        const exists = db.select().from(schema.links).where(eq(schema.links.url, url)).limit(1).get();
        if (exists) continue;

        db.insert(schema.links).values({ url, senderName, sourceGroupName }).onConflictDoNothing().run();
        added++;
    }

    if (added > 0) {
        logger.info({ added, groupJid, senderName }, 'Link grup baru tersimpan');
        await maybeSendLinkReport(sock);
    }
}

async function maybeSendLinkReport(sock: WASocket): Promise<void> {
    const result = db.select({ value: count() }).from(schema.links).where(eq(schema.links.isSent, false)).get();
    if (!result || result.value < 5) return;

    const unsent = db.select().from(schema.links).where(eq(schema.links.isSent, false)).all();
    const lines = unsent.map((l, i) => `${i + 1}. ${l.url}\n    👤 ${l.senderName} | 📌 ${l.sourceGroupName}`);
    const report = `📋 *${unsent.length} Link Grup Baru*\n\n${lines.join('\n\n')}`;

    const botNumber = sock.user?.id?.split(':')[0];
    if (!botNumber) return;

    try {
        await sock.sendMessage(`${botNumber}@s.whatsapp.net`, { text: report });
        db.update(schema.links).set({ isSent: true }).where(eq(schema.links.isSent, false)).run();
        logger.info({ count: unsent.length }, 'Laporan link grup terkirim');
    } catch (err) {
        logger.error({ err }, 'Gagal mengirim laporan link grup');
    }
}

function extractContent(msg: WAMessage): { text: string | null; caption: string | null } {
    const c = msg.message;
    if (!c) return { text: null, caption: null };

    const text = c.conversation ?? c.extendedTextMessage?.text ?? null;
    const caption = c.imageMessage?.caption ?? c.videoMessage?.caption ?? c.documentMessage?.caption ?? null;

    return { text, caption };
}

async function extractAttachment(sock: WASocket, msg: WAMessage): Promise<{ mimetype: string; data: string; filename?: string } | null> {
    const c = msg.message;
    if (!c) return null;

    const hasMedia = c.imageMessage ?? c.videoMessage ?? c.audioMessage ?? c.documentMessage ?? c.stickerMessage;
    if (!hasMedia) return null;

    try {
        const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
        if (!buffer) return null;

        const mimetype =
            c.imageMessage?.mimetype ??
            c.videoMessage?.mimetype ??
            c.audioMessage?.mimetype ??
            c.documentMessage?.mimetype ??
            c.stickerMessage?.mimetype ??
            'application/octet-stream';

        const filename = c.documentMessage?.fileName ?? undefined;

        return { mimetype, data: buffer.toString('base64'), filename };
    } catch (err) {
        logger.error({ err }, 'Gagal download media dari pesan');
        return null;
    }
}

async function reply(sock: WASocket, jid: string, text: string): Promise<void> {
    await sock.sendMessage(jid, { text });
}
