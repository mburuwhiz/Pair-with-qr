const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const authDir = path.join(__dirname, "auth");
fs.ensureDirSync(authDir);

let sock = null;
let currentQR = null;
let isConnected = false;

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  if (sock) sock.ev.removeAllListeners(), sock.end();

  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async update => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      currentQR = qr;
      isConnected = false;
      console.log("🔄 New QR generated");
    }

    if (connection === "open") {
      console.log("✅ Connected");
      isConnected = true;
      currentQR = null;

      const msg = `━━━━━━━━━━━━━━━━━━━━━━━
*✅  WHIZ-MD LINKED SUCCESSFULLY*
━━━━━━━━━━━━━━━━━━━━━━━

📌 You can Continue to Deploy now

*📁 GitHub:* https://github.com/mburuwhiz/whiz-md
*🔍 Scan QR Code:* https://pairwithwhizmd.onrender.com
*💬 Contact Owner:* +254 754 783 683
*💡 Support Group:* https://chat.whatsapp.com/JLmSbTfqf4I2Kh4SNJcWgM

⚠️ Keep your SESSION_ID private!
Unauthorized sharing allows others to access your chats.

━━━━━━━━━━━━━━━━━━━━━━━
🔧 Powered by WHIZ-MD • Built with 💡`;

      await sock.sendMessage(sock.user.id, { text: msg });

      // optional: restart for next QR
      await new Promise(r => setTimeout(r, 2000));
      startSock();
    }

    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log("❌ Disconnected:", code);
      if (code !== 401) startSock();
    }
  });
}

startSock();

app.get("/", (req, res) => res.redirect("/scan"));

app.get("/scan", (req, res) => res.render("scan"));

app.get("/qr", async (req, res) => {
  if (!currentQR || isConnected) {
    return res.status(404).send("No QR available");
  }
  try {
    const png = await qrcode.toBuffer(currentQR, { type: "png" });
    res.type("png").send(png);
  } catch (e) {
    console.error("❌ QR render issue:", e);
    res.status(500).send("QR Error");
  }
});

app.listen(PORT, () => console.log(`🚀 Listening at http://localhost:${PORT}`));
