const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const { toDataURL } = require("qrcode");
const { default: makeWASocket, useMultiFileAuthState, makeInMemoryStore, Browsers, delay, DisconnectReason } = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 5000;
const authDir = path.join(__dirname, 'auth_info_baileys');

fs.ensureDirSync(authDir);
fs.emptyDirSync(authDir);

// View Engine & Public
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const MESSAGE = process.env.MESSAGE || `
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

let latestQR = "";
let qrExpireTimeout;

// Serve scan page
app.get("/", async (req, res) => {
  return res.render("scan", {
    qr: latestQR,
    message: MESSAGE
  });
});

// Start Socket
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.macOS("WHIZ-MD"),
    logger: pino({ level: 'silent' }),
  });

  store.bind(sock.ev);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      latestQR = await toDataURL(qr);

      clearTimeout(qrExpireTimeout);
      qrExpireTimeout = setTimeout(() => {
        latestQR = "";
      }, 30 * 1000); // 30 seconds
    }

    if (connection === "open") {
      await delay(2000);
      const user = sock.user.id;

      const credsPath = path.join(authDir, "creds.json");
      if (!fs.existsSync(credsPath)) return;

      const credsData = fs.readFileSync(credsPath);
      const Scan_Id = "WHIZMD_" + Buffer.from(credsData).toString("base64");

      const sessionMsg = await sock.sendMessage(user, { text: Scan_Id });
      await sock.sendMessage(user, { text: MESSAGE }, { quoted: sessionMsg });

      await delay(1000);
      fs.emptyDirSync(authDir);
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      switch (reason) {
        case DisconnectReason.restartRequired:
          console.log("🔄 Restarting...");
          startSocket().catch(console.error);
          break;
        default:
          console.log("❌ Disconnected:", reason);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startSocket().catch(console.error);

app.listen(PORT, () => {
  console.log(`✅ WHIZ-MD server is running on http://localhost:${PORT}`);
});
