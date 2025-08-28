require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { sequelize } = require('./database/setup.js');
const { GroupLink } = require('./database/models/group-link.js');

// Validasi variabel lingkungan
const adminJid = process.env.ADMIN_JID;
const groupThreshold = parseInt(process.env.GROUP_THRESHOLD) || 5;
const delayMin = parseInt(process.env.DELAY_MIN) || 10000;
const delayMax = parseInt(process.env.DELAY_MAX) || 60000;

if (!adminJid) {
    console.error('❌ ADMIN_JID belum diset di .env');
    process.exit(1);
}

// Sinkronisasi database
sequelize
    .sync()
    .then(() => console.log('Database dan tabel sudah siap!'))
    .catch(err => console.error('Gagal menyiapkan database: ', err));

// Fungsi utilitas
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
    return Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
}

// Fungsi untuk menyimpan link grup
async function addNewLink(text) {
    const regex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}/g;
    const links = text.match(regex);
    if (!links) return;

    for (const link of links) {
        const exists = await GroupLink.findOne({ where: { link } });
        if (exists) continue;

        await GroupLink.create({
            link: link,
            is_sent_to_admin: false
        });
    }
}

// Fungsi untuk broadcast pesan
async function broadcastText(sock, text, groupIds, groups) {
    for (const groupId of groupIds) {
        try {
            const groupMetadata = groups[groupId];
            if (groupMetadata.announce) {
                console.log(`[Skip] Grup ${groupId} hanya mengizinkan admin untuk mengirim pesan.`);
                continue;
            }

            await sock.sendMessage(groupId, {
                text: text,
                contextInfo: {
                    isFromStatus: true,
                    forwardingScore: 69,
                    isForwarded: true,
                    externalAdReply: {
                        title: 'Yuipedia Vpn',
                        body: 'Best Tunneling Service',
                        thumbnailUrl: 'https://yuivpn.com/storage/images/logos/ubR3lKinEXjrlTY5Jnpwp4yZZHqgX4mSrv0mZXXg.png',
                        mediaUrl: 'https://yuivpn.com',
                        mediaType: 1,
                        sourceUrl: 'https://yuivpn.com'
                    }
                }
            });

            console.log(`[Sukses] Pesan teks terkirim ke grup: ${groupId}`);

            const d = randomDelay();
            console.log(`⏳ Delay ${d / 1000}s sebelum lanjut...`);
            await delay(d);
        } catch (error) {
            console.error(`[Gagal] Kirim ke grup ${groupId}:`, error.message);
        }
    }
}

// Setup broadcast terjadwal
function setupScheduledBroadcasts(sock) {
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('BROADCAST_SCHEDULE_')) {
            const scheduleId = key.split('_').pop();
            const schedule = process.env[key];
            const messageFileKey = `BROADCAST_MESSAGE_FILE_${scheduleId}`;
            const messageFilePath = process.env[messageFileKey];

            if (!schedule || !messageFilePath) {
                console.warn(`⚠️ Konfigurasi tidak lengkap untuk jadwal ${scheduleId}. Schedule dan Message File harus ada.`);
                return;
            }

            if (!cron.validate(schedule)) {
                console.error(`❌ Jadwal cron tidak valid untuk ${key}: "${schedule}"`);
                return;
            }

            const absoluteMessagePath = path.resolve(messageFilePath);
            if (!fs.existsSync(absoluteMessagePath)) {
                console.error(`❌ File pesan tidak ditemukan untuk ${messageFileKey}: "${absoluteMessagePath}"`);
                return;
            }

            console.log(`🕰️ Penjadwalan broadcast [${scheduleId}] diaktifkan: "${schedule}"`);
            cron.schedule(schedule, async () => {
                console.log(`🚀 Menjalankan broadcast terjadwal [${scheduleId}]...`);
                try {
                    const message = fs.readFileSync(absoluteMessagePath, 'utf-8');
                    const groups = await sock.groupFetchAllParticipating();
                    const groupIds = Object.keys(groups);

                    await broadcastText(sock, message, groupIds, groups);

                    console.log(`✅ Broadcast terjadwal [${scheduleId}] selesai ke ${groupIds.length} grup.`);
                    await sock.sendMessage(adminJid, { text: `✅ Broadcast terjadwal [${scheduleId}] selesai ke ${groupIds.length} grup.` });
                } catch (error) {
                    console.error(`❌ Error saat broadcast terjadwal [${scheduleId}]:`, error.message);
                    await sock.sendMessage(adminJid, { text: `❌ Gagal broadcast terjadwal [${scheduleId}]: ${error.message}` });
                }
            });
        }
    });
}

// Fungsi utama untuk koneksi WhatsApp
async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'error' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        if (!text) return;

        await addNewLink(text);

        // Kirim link ke admin jika sudah mencapai threshold
        const unsentCount = await GroupLink.count({ where: { is_sent_to_admin: false } });
        if (unsentCount >= groupThreshold) {
            const unsent = await GroupLink.findAll({
                where: { is_sent_to_admin: false },
                limit: groupThreshold
            });

            const list = unsent.map((l, i) => `${i + 1}. ${l.link}`).join('\n');
            const message = `📥 Link grup terkumpul:\n\n${list}`;

            try {
                await sock.sendMessage(adminJid, { text: message });
                await GroupLink.update({ is_sent_to_admin: true }, { where: { is_sent_to_admin: false } });
                console.log(`📤 ${unsent.length} link dikirim ke admin.`);
            } catch (err) {
                console.error('❌ Gagal kirim ke admin:', err.message);
            }
        }
    });

    sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
        if (qr) {
            console.log('📱 Scan QR berikut:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('✅ Koneksi WhatsApp aktif');
            setupScheduledBroadcasts(sock);
        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Koneksi terputus', shouldReconnect ? ', mencoba reconnect...' : '');

            if (lastDisconnect?.error?.output?.payload?.content?.[0]?.attrs?.type === 'device_removed') {
                console.log('⚠️ Device dihapus, perlu scan ulang');
                fs.rmSync('auth', { recursive: true, force: true });
            }

            if (shouldReconnect) {
                await delay(5000);
                startSock();
            }
        }
    });

    process.on('SIGINT', async () => {
        console.log('🛑 Menutup koneksi...');
        process.exit(0);
    });
}

startSock().catch(err => {
    console.error('❌ Gagal memulai aplikasi:', err);
    process.exit(1);
});
