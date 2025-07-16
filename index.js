const express = require("express");
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Auth state
const authFolder = "./auth";
fs.ensureDirSync(authFolder);

let sock;
let currentQR = "";
let isConnected = false;

// WhatsApp Connection Function
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: "silent" }),
  });

  // QR event
  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log("🔄 New QR Generated.");
    }

    if (connection === "open") {
      console.log("✅ Connected to WhatsApp");

      isConnected = true;
      currentQR = "";

      const msg = `\n━━━━━━━━━━━━━━━━━━━━━━━
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
━━━━━━━━━━━━━━━━━━━━━━━`;

      const [jid] = Object.keys(sock.authState.creds.myAppStateKeyId || {});
      if (jid) {
        await sock.sendMessage(jid, { text: msg });
      }

      await sock.sendMessage(sock.user.id, { text: msg });
    }

    if (connection === "close") {
      const reason = new Boom(update.lastDisconnect?.error)?.output?.statusCode;
      console.log("❌ Connection closed. Reason:", reason);
      if (reason !== 401) {
        startSock(); // Reconnect if not logged out
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// Start connection
startSock();


// Routes
app.get("/", (req, res) => {
  res.redirect("/scan");
});

app.get("/scan", (req, res) => {
  res.render("scan");
});

app.get("/qr", async (req, res) => {
  if (!currentQR || isConnected) {
    return res.status(404).send("QR not available or already connected");
  }

  try {
    const qrImage = await qrcode.toBuffer(currentQR, { type: "png" });
    res.setHeader("Content-Type", "image/png");
    res.send(qrImage);
  } catch (err) {
    console.error("❌ Failed to generate QR image", err);
    res.status(500).send("Failed to generate QR code");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
