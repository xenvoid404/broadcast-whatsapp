import './database/setup.js';
import dotenv from 'dotenv';
dotenv.config();
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

const adminNumber = process.env.ADMIN_NUMBER;

if (!adminNumber) {
    console.error('Nomor admin belum diset di .env');
    process.exit(1);
}

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'info' })
    });

    sock.ev.on('connection.update', update => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.log('Scan QR berikut:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startSock();
            }
        } else if (connection === 'open') {
            console.log('Koneksi whatsapp aktif!');
        }
    });

    sock.ev.on('messages.upsert', async event => {
        for (const m of event.messages) {
            console.log(JSON.stringify(m, undefined, 2));

            console.log('replying to', m.key.remoteJid);
            await sock.sendMessage(m.key.remoteJid!, { text: 'Hello Word' });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startSock();
