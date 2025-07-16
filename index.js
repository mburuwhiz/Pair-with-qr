const express = require("express");
const app = express();
const pino = require("pino");
const { toBuffer } = require("qrcode");
const path = require("path");
const fs = require("fs-extra");
const { Boom } = require("@hapi/boom");
const PORT = process.env.PORT || 5000;

const MESSAGE = `
━━━━━━━━━━━━━━━━━━━━━━━
  *✅  WHIZ-MD LINKED SUCCESSFULLY*
━━━━━━━━━━━━━━━━━━━━━━━

📌 You can Continue to Deploy now

*📁 GitHub:*
https://github.com/mburuwhiz/whiz-md

*🔍 Scan QR Code:*
https://pairwithwhizmd.onrender.com

*💬 Contact Owner:*
+254 754 783 683

*💡 Support Group:*
https://chat.whatsapp.com/JLmSbTfqf4I2Kh4SNJcWgM

⚠️ Keep your SESSION_ID private!
Unauthorized sharing allows others to access your chats.

━━━━━━━━━━━━━━━━━━━━━━━
🔧 Powered by WHIZ-MD • Built with 💡
━━━━━━━━━━━━━━━━━━━━━━━
`;

let sentSession = false;

if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync('./auth_info_baileys');
}

app.get("/", async (req, res) => {
    const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason, makeInMemoryStore } = require("@whiskeysockets/baileys");
    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

    try {
        const sock = makeWASocket({
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.chrome("Chrome(WHIZ-MD)"),
            auth: state
        });

        sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
            if (qr) {
                res.setHeader("Content-Type", "image/png");
                return res.end(await toBuffer(qr));
            }

            if (connection === "open" && !sentSession) {
                sentSession = true;
                await delay(3000);
                const user = sock.user.id;

                const creds = fs.readFileSync('./auth_info_baileys/creds.json');
                const sessionId = Buffer.from(creds).toString("base64");

                const qr1 = await sock.sendMessage(user, { text: sessionId });
                await sock.sendMessage(user, { text: MESSAGE }, { quoted: qr1 });

                await delay(1000);
                await sock.sendMessage(user, {
                    audio: {
                        url: "https://s31.aconvert.com/convert/p3r68-cdx67/gmz3g-g051v.mp3"
                    },
                    mimetype: 'audio/mp4',
                    ptt: true
                });

                try { await fs.emptyDirSync('./auth_info_baileys'); } catch { }
            }

            if (connection === "close") {
                let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

                if (reason === DisconnectReason.restartRequired) {
                    console.log("Restart Required, Restarting...");
                    sentSession = false;
                    return sock(); // recursive
                } else {
                    console.log("Connection closed. Reason:", reason);
                }
            }
        });

        sock.ev.on("creds.update", saveCreds);

    } catch (err) {
        console.log("Error:", err);
        await fs.emptyDirSync('./auth_info_baileys');
        res.end("❌ Internal Error");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 WHIZ-MD App running on http://localhost:${PORT}`);
});
