import { configQ, linkQ, messageQ } from '@/db/queries';
import { logger } from '@/lib/logger';
import { extractGroupLinks, now } from '@/lib/utils';
import { downloadMediaMessage, type WAMessage, type WASocket } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { generateDailySchedules } from './scheduler';

const ASSETS_DIR = path.join(process.cwd(), 'assets');
const COMMANDS = ['!setbc', '!setstart', '!setend', '!setth', '!generate'] as const;

export async function handleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
    if (msg.key.fromMe) {
        await handleCommand(sock, msg);
        return;
    }
    const jid = msg.key.remoteJid ?? '';
    if (jid.endsWith('@g.us')) await collectLinks(sock, msg, jid);
}

async function handleCommand(sock: WASocket, msg: WAMessage): Promise<void> {
    const replyJid = msg.key.remoteJid!;
    const c = msg.message;
    if (!c) return;
    const imageMsg = c.imageMessage;
    if (imageMsg && imageMsg.caption?.startsWith('!setbc')) {
        const text = imageMsg.caption.slice('!setbc'.length).trim();
        const imagePath = await downloadImage(sock, msg);
        messageQ.set(text, imagePath);
        logger.info({ imagePath }, 'Broadcast message + gambar diubah');
        await reply(sock, replyJid, `✅ Pesan broadcast diubah:\n\n${text}\n📷 Gambar: ${imagePath ? 'tersimpan' : 'gagal simpan'}`);
        return;
    }
    const text = getTextContent(msg);
    if (!text) return;
    if (text.startsWith('!setbc ')) {
        const newText = text.slice('!setbc '.length).trim();
        messageQ.set(newText);
        logger.info('Broadcast message diubah');
        await reply(sock, replyJid, `✅ Pesan broadcast diubah:\n\n${newText}`);
        return;
    }
    if (text.startsWith('!setstart ')) {
        const val = parseInt(text.slice('!setstart '.length).trim());
        if (isNaN(val) || val < 0 || val > 23) return reply(sock, replyJid, '❌ Jam tidak valid (0–23)');
        configQ.setStart(val);
        await reply(sock, replyJid, `✅ Jam mulai broadcast: ${String(val).padStart(2, '0')}:00`);
        return;
    }
    if (text.startsWith('!setend ')) {
        const val = parseInt(text.slice('!setend '.length).trim());
        if (isNaN(val) || val < 0 || val > 23) return reply(sock, replyJid, '❌ Jam tidak valid (0–23)');
        configQ.setEnd(val);
        await reply(sock, replyJid, `✅ Jam selesai broadcast: ${String(val).padStart(2, '0')}:00`);
        return;
    }
    if (text.startsWith('!setth ')) {
        const val = parseInt(text.slice('!setth '.length).trim());
        if (isNaN(val) || val < 1) return reply(sock, replyJid, '❌ Threshold minimal 1');
        configQ.setThreshold(val);
        await reply(sock, replyJid, `✅ Threshold laporan link: ${val}`);
        return;
    }
    if (text.trim() === '!generate') {
        await reply(sock, replyJid, '⏳ Membuat jadwal broadcast hari ini...');
        await generateDailySchedules(sock);
        await reply(sock, replyJid, '✅ Jadwal broadcast selesai dibuat. Cek log untuk detailnya.');
        return;
    }
}

async function collectLinks(sock: WASocket, msg: WAMessage, groupJid: string): Promise<void> {
    const text = getTextContent(msg);
    if (!text) return;
    const extracted = extractGroupLinks(text);
    if (!extracted.length) return;
    const senderName = msg.pushName ?? msg.key.participant ?? '';
    let sourceGroupName = '';
    try {
        sourceGroupName = (await sock.groupMetadata(groupJid)).subject;
    } catch {}
    for (const url of extracted) {
        linkQ.insert({
            url,
            sender_name: senderName,
            source_group_name: sourceGroupName,
            collected_at: now(),
        });
    }
    await maybeSendReport(sock);
}

async function maybeSendReport(sock: WASocket): Promise<void> {
    const cfg = configQ.get() as { link_threshold: number } | undefined;
    const unsentCountRow = linkQ.unsentCount() as { value: number } | undefined;
    const unsentCount = unsentCountRow?.value ?? 0;
    if (!cfg || unsentCount < cfg.link_threshold) return;
    const unsent = linkQ.getUnsent() as { url: string; sender_name: string; source_group_name: string }[];
    if (unsent.length === 0) return;
    const lines = unsent.map((l, i) => `${i + 1}. ${l.url}\n    👤 ${l.sender_name} | 📌 ${l.source_group_name}`);
    const report = `📋 *${unsent.length} Link Grup Baru*\n\n${lines.join('\n\n')}`;
    const botId = sock.user?.id?.split(':')[0];
    if (!botId) return;
    const selfJid = `${botId}@s.whatsapp.net`;
    try {
        await sock.sendMessage(selfJid, { text: report });
        linkQ.markAllSent();
        logger.info({ count: unsent.length }, '📤 Laporan link terkirim');
    } catch (err) {
        logger.error({ err }, 'Gagal kirim laporan');
    }
}

function getTextContent(msg: WAMessage): string {
    const c = msg.message;
    if (!c) return '';
    return c.conversation ?? c.extendedTextMessage?.text ?? c.imageMessage?.caption ?? c.videoMessage?.caption ?? '';
}

async function reply(sock: WASocket, jid: string, text: string): Promise<void> {
    await sock.sendMessage(jid, { text });
}

async function downloadImage(sock: WASocket, msg: WAMessage): Promise<string | null> {
    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        if (!buffer) return null;
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
        const imagePath = path.join(ASSETS_DIR, 'promo.jpg');
        fs.writeFileSync(imagePath, buffer as Buffer);
        return imagePath;
    } catch (err) {
        logger.error({ err }, 'Gagal download gambar');
        return null;
    }
}
