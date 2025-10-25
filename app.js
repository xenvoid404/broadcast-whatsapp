import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const adminNumber = process.env.ADMIN_NUMBER ? `${process.env.ADMIN_NUMBER}@s.whatsapp.net` : '';
const delayMin = parseInt(process.env.DELAY_MIN) || 10000;
const delayMax = parseInt(process.env.DELAY_MAX) || 60000;

if (!adminNumber) {
    logger.error('Nomor admin belum diset di .env');
    process.exit(1);
}

let cronJobsInitialized = false;
let reconnectAttempts = 0;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

async function broadcastText(sock, text, groupIds, groups) {
    for (const groupId of groupIds) {
        try {
            if (groups[groupId].announce) {
                logger.warn(`[Skip] Grup ${groupId} hanya admin yang bisa kirim pesan.`);
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

            logger.info(`[Sukses] Terkirim ke grup: ${groupId}`);
            const d = randomDelay();
            logger.info(`Delay ${d / 1000}s...`);
            await delay(d);
        } catch (error) {
            logger.error(`[Gagal] Kirim ke ${groupId}:`, error.message);
        }
    }
}

function setupScheduledBroadcasts(sock) {
    if (cronJobsInitialized) return;

    Object.keys(process.env).forEach(key => {
        if (!key.startsWith('BROADCAST_SCHEDULE_')) return;

        const scheduleId = key.split('_').pop();
        const schedule = process.env[key];
        const messageFilePath = process.env[`BROADCAST_MESSAGE_FILE_${scheduleId}`];

        if (!schedule || !messageFilePath) {
            logger.warn(`Konfigurasi tidak lengkap untuk jadwal ${scheduleId}`);
            return;
        }

        if (!cron.validate(schedule)) {
            logger.error(`Jadwal cron tidak valid: "${schedule}"`);
            return;
        }

        const absolutePath = path.resolve(messageFilePath);
        if (!fs.existsSync(absolutePath)) {
            logger.error(`File tidak ditemukan: "${absolutePath}"`);
            return;
        }

        logger.info(`Penjadwalan broadcast [${scheduleId}]: "${schedule}"`);
        cron.schedule(schedule, async () => {
            logger.info(`Menjalankan broadcast [${scheduleId}]...`);
            try {
                await sock.sendMessage(adminNumber, { text: `🚀 Memulai broadcast [${scheduleId}]...` });

                const message = fs.readFileSync(absolutePath, 'utf-8').trim();
                if (!message) {
                    logger.warn(`File pesan kosong untuk [${scheduleId}]`);
                    return;
                }

                const groups = await sock.groupFetchAllParticipating();
                const groupIds = Object.keys(groups);

                await broadcastText(sock, message, groupIds, groups);

                logger.info(`✅ Broadcast [${scheduleId}] selesai ke ${groupIds.length} grup`);
                await sock.sendMessage(adminNumber, { text: `✅ Broadcast [${scheduleId}] selesai ke ${groupIds.length} grup` });
            } catch (error) {
                logger.error(`Error broadcast [${scheduleId}]:`, error.message);
                await sock.sendMessage(adminNumber, { text: `❌ Gagal broadcast [${scheduleId}]: ${error.message}` });
            }
        });
    });

    cronJobsInitialized = true;
}

async function startSock() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            version,
            browser: ['Bot Broadcast', 'Chrome', '3.0'],
            markOnlineOnConnect: false,
            syncFullHistory: false,
            getMessage: async () => ({ conversation: '' })
        });

        sock.ev.on('connection.update', async update => {
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
                logger.info('Scan QR berikut:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                logger.error(`Koneksi terputus. Status: ${statusCode}`);

                if (shouldReconnect && ++reconnectAttempts <= 5) {
                    const reconnectDelay = Math.min(5000 * reconnectAttempts, 30000);
                    logger.info(`Reconnect dalam ${reconnectDelay / 1000}s... (Percobaan ${reconnectAttempts})`);
                    await delay(reconnectDelay);
                    startSock();
                } else if (!shouldReconnect) {
                    logger.error('Logout detected. Hapus folder auth dan scan QR ulang.');
                } else {
                    logger.fatal('Terlalu banyak percobaan reconnect.');
                    process.exit(1);
                }
            } else if (connection === 'open') {
                logger.info('✅ Koneksi WhatsApp aktif!');
                reconnectAttempts = 0;
                setupScheduledBroadcasts(sock);
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const match = text.match(/https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{22})/);

            if (match?.[1]) {
                const inviteCode = match[1];
                logger.info(`[Auto Join] Ditemukan kode: ${inviteCode}`);
                try {
                    await sock.groupAcceptInvite(inviteCode);
                    logger.info(`[Auto Join] Berhasil join grup: ${inviteCode}`);
                } catch (error) {
                    logger.error(`[Auto Join] Gagal join ${inviteCode}:`, error.message);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (error) {
        logger.fatal('Gagal startup:', error.message);

        if (++reconnectAttempts <= 5) {
            logger.info(`Retry dalam 10s... (Percobaan ${reconnectAttempts})`);
            await delay(10000);
            startSock();
        } else {
            process.exit(1);
        }
    }
}

startSock();
