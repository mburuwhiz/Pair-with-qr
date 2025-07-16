// index.js
const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const { toBuffer } = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
  Browsers,
  delay,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 5000;
const authDir = path.join(__dirname, "auth_info_baileys");

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

fs.ensureDirSync(authDir);
fs.emptyDirSync(authDir);

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

let qrBuffer = null;
let qrServed = false;

app.get("/", (req, res) => {
  res.render("scan");
});

app.get("/qr", async (req, res) => {
  const store = makeInMemoryStore({ logger: pino({ level: "silent" }) });

  async function startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.macOS("WHIZ-MD"),
      logger: pino({ level: "silent" })
    });

    store.bind(sock.ev);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr && !qrServed) {
        qrBuffer = await toBuffer(qr);
        qrServed = true;
        res.writeHead(200, { "Content-Type": "image/png" });
        return res.end(qrBuffer);
      }

      if (connection === "open") {
        const user = sock.user.id;
        const creds = path.join(authDir, "creds.json");
        if (fs.existsSync(creds)) {
          const data = fs.readFileSync(creds);
          const Scan_Id = "WHIZMD_" + Buffer.from(data).toString("base64");
          await delay(2000);
          const sent = await sock.sendMessage(user, { text: Scan_Id });
          await sock.sendMessage(user, { text: MESSAGE }, { quoted: sent });
          await delay(1000);
          fs.emptyDirSync(authDir);
        }
      }

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        if (reason === DisconnectReason.restartRequired) startSocket().catch(console.error);
      }
    });

    sock.ev.on("creds.update", saveCreds);
  }

  startSocket().catch((err) => {
    console.error("Socket failed:", err);
    fs.emptyDirSync(authDir);
    if (!qrServed) res.status(500).send("QR error");
  });
});

app.listen(PORT, () => {
  console.log(`✅ WHIZ-MD server running on http://localhost:${PORT}`);
});
