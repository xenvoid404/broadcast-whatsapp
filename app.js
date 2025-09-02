import './database/setup.js';
import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

import { Group } from './database/models/group.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const adminNumber = process.env.ADMIN_NUMBER ? `${process.env.ADMIN_NUMBER}@s.whatsapp.net` : '';
const groupThreshold = parseInt(process.env.GROUP_THRESHOLD) || 5;
const delayMin = parseInt(process.env.DELAY_MIN) || 10000;
const delayMax = parseInt(process.env.DELAY_MAX) || 60000;

if (!adminNumber) {
    logger.error('Nomor admin belum diset di .env');
    process.exit(1);
}

/**
 * Memberikan jeda waktu eksekusi.
 * @param {number} ms - Waktu jeda dalam milidetik.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Menghasilkan jeda waktu acak dalam rentang yang ditentukan.
 * @returns {number} - Waktu jeda acak dalam milidetik.
 */
function randomDelay() {
    return Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
}

/**
 * Menambahkan link grup baru ke database jika belum ada.
 * @param {string} text - Teks yang mungkin berisi link grup WhatsApp.
 */
async function addNewLink(text) {
    const regex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}/g;
    const links = text.match(regex);
    if (!links) return;

    for (const link of links) {
        try {
            const [group, created] = await Group.findOrCreate({
                where: { link },
                defaults: { link, sent: false }
            });

            if (created) {
                logger.info(`[Link Baru] Ditemukan dan disimpan: ${group.link}`);
            }
        } catch (error) {
            logger.error(`[DB Error] Gagal menyimpan link ${link}:`, error);
        }
    }
}

/**
 * Mengirimkan pesan broadcast ke daftar grup.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Instance socket Baileys.
 * @param {string} text - Teks yang akan dikirim.
 * @param {string[]} groupIds - Array ID grup.
 * @param {object} groups - Objek metadata grup.
 */
async function broadcastText(sock, text, groupIds, groups) {
    for (const groupId of groupIds) {
        try {
            const groupMetadata = groups[groupId];
            if (groupMetadata.announce) {
                logger.warn(`[Skip] Grup ${groupId} hanya mengizinkan admin untuk mengirim pesan.`);
                continue;
            }

            await sock.sendMessage(groupId, {
                text: text,
                contextInfo: {
                    isFromStatus: true,
                    forwardingScore: 69,
                    isForwarded: true,
                    externalAdReply: {
                        title: process.env.MSG_TITLE,
                        body: process.env.MSG_BODY,
                        thumbnailUrl: process.env.MSG_THUMB,
                        mediaUrl: process.env.MSG_MEDIA,
                        mediaType: process.env.MSG_MEDIA_TYPE,
                        sourceUrl: process.env.MSG_SOURCE
                    }
                }
            });

            logger.info(`[Sukses] Pesan teks terkirim ke grup: ${groupId}`);
            const d = randomDelay();
            logger.info(`Delay ${d / 1000}s sebelum lanjut...`);
            await delay(d);
        } catch (error) {
            logger.error(`[Gagal] Kirim ke grup ${groupId}: `, error);
        }
    }
}

/**
 * Mengatur jadwal broadcast berdasarkan konfigurasi di .env.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Instance socket Baileys.
 */
function setupScheduledBroadcasts(sock) {
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('BROADCAST_SCHEDULE_')) {
            const scheduleId = key.split('_').pop();
            const schedule = process.env[key];
            const messageFileKey = `BROADCAST_MESSAGE_FILE_${scheduleId}`;
            const messageFilePath = process.env[messageFileKey];

            if (!schedule || !messageFilePath) {
                logger.warn(`Konfigurasi tidak lengkap untuk jadwal ${scheduleId}. Schedule dan Message File harus ada.`);
                return;
            }

            if (!cron.validate(schedule)) {
                logger.error(`Jadwal cron tidak valid untuk ${key}: "${schedule}"`);
                return;
            }

            const absoluteMessagePath = path.resolve(messageFilePath);
            if (!fs.existsSync(absoluteMessagePath)) {
                logger.error(`File pesan tidak ditemukan untuk ${messageFileKey}: "${absoluteMessagePath}"`);
                return;
            }

            logger.info(`Penjadwalan broadcast [${scheduleId}] diaktifkan: "${schedule}"`);
            cron.schedule(schedule, async () => {
                logger.info(`Menjalankan broadcast terjadwal [${scheduleId}]...`);
                try {
                    const message = fs.readFileSync(absoluteMessagePath, 'utf-8');
                    if (!message.trim()) {
                        logger.warn(`File pesan untuk jadwal [${scheduleId}] kosong.`);
                        return;
                    }
                    const groups = await sock.groupFetchAllParticipating();
                    const groupIds = Object.keys(groups);

                    await broadcastText(sock, message, groupIds, groups);

                    logger.info(`✅ Broadcast terjadwal [${scheduleId}] selesai ke ${groupIds.length} grup.`);
                    await sock.sendMessage(adminNumber, { text: `✅ Broadcast terjadwal [${scheduleId}] selesai ke ${groupIds.length} grup.` });
                } catch (error) {
                    logger.error(`Error saat broadcast terjadwal [${scheduleId}]:`, error.message);
                    await sock.sendMessage(adminNumber, { text: `Gagal broadcast terjadwal [${scheduleId}]: ${error.message}` });
                }
            });
        }
    });
}

/**
 * Mengirimkan link grup yang terkumpul ke admin.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Instance socket Baileys.
 */
async function sendCollectedLinksToAdmin(sock) {
    try {
        const unsent = await Group.findAll({ where: { sent: false }, limit: groupThreshold });
        if (unsent.length >= groupThreshold) {
            const list = unsent.map((l, i) => `${i + 1}. ${l.link}`).join('n');
            const message = `📥 Link grup terkumpul:

${list}`;

            await sock.sendMessage(adminNumber, { text: message });
            await Group.update({ sent: true }, { where: { id: unsent.map(g => g.id) } });
            logger.info(`${unsent.length} link dikirim ke admin.`);
        }
    } catch (err) {
        logger.error('Gagal kirim ke admin:', err.message);
    }
}

/**
 * Fungsi utama untuk memulai koneksi WhatsApp.
 */
async function startSock() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }) // Gunakan logger kustom
        });

        sock.ev.on('connection.update', update => {
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
                logger.info('Scan QR berikut:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.error('Koneksi terputus', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                if (shouldReconnect) {
                    startSock();
                }
            } else if (connection === 'open') {
                logger.info('Koneksi whatsapp aktif!');
                setupScheduledBroadcasts(sock);
            }
        });

        sock.ev.on('messages.upsert', async event => {
            const { messages } = event;
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            if (!text) return;

            await addNewLink(text);
            await sendCollectedLinksToAdmin(sock);
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (error) {
        logger.fatal('Gagal memulai aplikasi:', error);
        process.exit(1);
    }
}

startSock();
