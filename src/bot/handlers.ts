import { configQ, linkQ, messageQ } from '@/db/queries';
import { logger } from '@/lib/logger';
import { extractGroupLinks, now } from '@/lib/utils';
import { downloadMediaMessage, type WAMessage, type WASocket } from '@whiskeysockets/baileys';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateDailySchedules } from './scheduler';

const ASSETS_DIR = join(process.cwd(), 'assets');

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
    const imageMsg = msg.message?.imageMessage;
    if (imageMsg?.caption?.startsWith('!setbc')) {
        const text = imageMsg.caption.slice('!setbc'.length).trim();
        const imagePath = await downloadImage(sock, msg);
        messageQ.set(text, imagePath);
        logger.info({ imagePath }, 'Pesan broadcast dan gambar diperbarui');
        await reply(sock, replyJid, `✅ Pesan broadcast diubah:\n\n${text}\n📷 Gambar: ${imagePath ? 'tersimpan' : 'gagal disimpan'}`);
        return;
    }
    const text = extractText(msg);
    if (!text) return;
    if (text.startsWith('!setbc ')) {
        const newText = text.slice('!setbc '.length).trim();
        messageQ.set(newText);
        logger.info('Pesan broadcast diperbarui');
        await reply(sock, replyJid, `✅ Pesan broadcast diubah:\n\n${newText}`);
        return;
    }
    if (text.startsWith('!setstart ')) {
        const val = parseHour(text.slice('!setstart '.length));
        if (val === null) return reply(sock, replyJid, '❌ Jam tidak valid (0–23)');
        configQ.setStart(val);
        logger.info({ start: val }, 'Jam mulai broadcast diperbarui');
        await reply(sock, replyJid, `✅ Jam mulai broadcast: ${String(val).padStart(2, '0')}:00`);
        return;
    }
    if (text.startsWith('!setend ')) {
        const val = parseHour(text.slice('!setend '.length));
        if (val === null) return reply(sock, replyJid, '❌ Jam tidak valid (0–23)');
        configQ.setEnd(val);
        logger.info({ end: val }, 'Jam selesai broadcast diperbarui');
        await reply(sock, replyJid, `✅ Jam selesai broadcast: ${String(val).padStart(2, '0')}:00`);
        return;
    }
    if (text.startsWith('!setth ')) {
        const val = parseInt(text.slice('!setth '.length).trim(), 10);
        if (isNaN(val) || val < 1) return reply(sock, replyJid, '❌ Threshold minimal 1');
        configQ.setThreshold(val);
        logger.info({ threshold: val }, 'Threshold laporan link diperbarui');
        await reply(sock, replyJid, `✅ Threshold laporan link: ${val}`);
        return;
    }
    if (text.trim() === '!generate') {
        await reply(sock, replyJid, '⏳ Membuat jadwal broadcast hari ini...');
        await generateDailySchedules(sock);
        await reply(sock, replyJid, '✅ Jadwal broadcast selesai dibuat');
        return;
    }
}

async function collectLinks(sock: WASocket, msg: WAMessage, groupJid: string): Promise<void> {
    const text = extractText(msg);
    if (!text) return;
    const extracted = extractGroupLinks(text);
    if (!extracted.length) return;
    const senderName = msg.pushName ?? msg.key.participant ?? '';
    let sourceGroupName = '';
    try {
        sourceGroupName = (await sock.groupMetadata(groupJid)).subject;
    } catch {
        /* abaikan */
    }
    let added = 0;
    for (const url of extracted) {
        if (linkQ.exists(url)) continue;
        linkQ.insert(url, senderName, sourceGroupName, now());
        added++;
    }
    if (added > 0) {
        logger.info({ added, groupJid, senderName }, '🔗 Link grup baru tersimpan');
        await maybeSendLinkReport(sock);
    }
}

async function maybeSendLinkReport(sock: WASocket): Promise<void> {
    const cfg = configQ.get();
    if (!cfg) return;
    const unsentCount = linkQ.unsentCount();
    if (unsentCount < cfg.link_threshold) return;
    const unsent = linkQ.getUnsent();
    const lines = unsent.map((l, i) => `${i + 1}. ${l.url}\n    👤 ${l.sender_name} | 📌 ${l.source_group_name}`);
    const report = `📋 *${unsent.length} Link Grup Baru*\n\n${lines.join('\n\n')}`;
    const botNumber = sock.user?.id?.split(':')[0];
    if (!botNumber) return;
    try {
        await sock.sendMessage(`${botNumber}@s.whatsapp.net`, { text: report });
        linkQ.markAllSent();
        logger.info({ count: unsent.length }, '📤 Laporan link grup terkirim ke diri sendiri');
    } catch (err) {
        logger.error({ err }, 'Gagal mengirim laporan link grup');
    }
}

function extractText(msg: WAMessage): string {
    const c = msg.message;
    if (!c) return '';
    return c.conversation ?? c.extendedTextMessage?.text ?? c.imageMessage?.caption ?? c.videoMessage?.caption ?? '';
}

function parseHour(raw: string): number | null {
    const val = parseInt(raw.trim(), 10);
    return isNaN(val) || val < 0 || val > 23 ? null : val;
}

async function reply(sock: WASocket, jid: string, text: string): Promise<void> {
    await sock.sendMessage(jid, { text });
}

async function downloadImage(sock: WASocket, msg: WAMessage): Promise<string | null> {
    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        if (!buffer) return null;
        mkdirSync(ASSETS_DIR, { recursive: true });
        const dest = join(ASSETS_DIR, 'promo.jpg');
        writeFileSync(dest, buffer as Buffer);
        return dest;
    } catch (err) {
        logger.error({ err }, 'Gagal mengunduh gambar dari pesan');
        return null;
    }
}
