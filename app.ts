import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', update => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
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
