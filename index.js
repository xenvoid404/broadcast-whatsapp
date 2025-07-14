require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const { GroupLink } = require('./models/GroupLink');

const adminJid = process.env.ADMIN_JID;
const groupThreshold = parseInt(process.env.GROUP_THRESHOLD);
const delayMin = parseInt(process.env.DELAY_MIN);
const delayMax = parseInt(process.env.DELAY_MAX);

if (!adminJid) {
    console.error('❌ ADMIN_JID belum diset di .env');
    process.exit(1);
}

if (isNaN(groupThreshold) || groupThreshold <= 0) {
    console.error('❌ GROUP_THRESHOLD tidak valid');
    process.exit(1);
}

if (isNaN(delayMin) || isNaN(delayMax) || delayMin < 1000 || delayMax < delayMin) {
    console.error('❌ DELAY_MIN dan DELAY_MAX tidak valid');
    process.exit(1);
}

const broadcastState = {
    waiting: false,
    lastActivity: null
};

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
    return Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
}

async function addNewLink(sock, text) {
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

    const unsent = await GroupLink.findAll({
        where: { is_sent_to_admin: false },
        limit: groupThreshold
    });

    if (unsent.length >= groupThreshold) {
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
}

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

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'info' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('message.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        if (!text) return;

        await addNewLink(sock, text);

        const from = msg.key.participant || msg.key.remoteJid;
        const command = text.trim();

        console.log({
            command,
            from,
            adminJid,
            isAdmin: from === adminJid
        });

        if (from?.trim() === adminJid?.trim()) {
            if (command.startsWith('/bcast')) {
                broadcastState.waiting = true;
                broadcastState.lastActivity = Date.now();
                await sock.sendMessage(from, { text: 'Kirimkan pesan yang ingin di broadcast (teks/gambar).\nKetik /cancel untuk membatalkan.' });
                return;
            }

            if (command.startsWith('/cancel')) {
                broadcastState.waiting = false;
                await sock.sendMessage(from, { text: 'Broadcast dibatalkan.' });
                return;
            }

            if (broadcastState.waiting) {
                if (!text) {
                    await sock.sendMessage(from, { text: '❗Hanya pesan teks yang didukung.' });
                    return;
                }

                broadcastState.lastActivity = Date.now();
                await sock.sendMessage(from, { text: 'Broadcast dimulai...' });

                try {
                    const groups = await sock.groupFetchAllParticipating();
                    const groupIds = Object.keys(groups);

                    await broadcastText(sock, text, groupIds, groups);
                    await sock.sendMessage(from, { text: `Broadcast selesai ke ${groupIds.length} grup.` });
                } catch (error) {
                    console.error('❌ Error saat broadcast:', error.message);
                    await sock.sendMessage(from, { text: `❌ Gagal broadcast: ${error.message}` });
                } finally {
                    broadcastState.waiting = false;
                }
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
