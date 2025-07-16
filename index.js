const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
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

// Ensure clean auth state
fs.ensureDirSync(authDir);
fs.emptyDirSync(authDir);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

let qrBuffer = null;
let qrServed = false;

// Render the scan page
app.get("/", (req, res) => {
  res.render("scan");
});

// Provide QR when requested
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
          const sessionMsg = await sock.sendMessage(user, { text: Scan_Id });
          await sock.sendMessage(user, { text: MESSAGE }, { quoted: sessionMsg });

          // 🟢 DOWNLOAD & SEND AUDIO FILE
          try {
            const audioUrl = "https://s31.aconvert.com/convert/p3r68-cdx67/gmz3g-g051v.mp3";
            const resp = await axios.get(audioUrl, { responseType: "arraybuffer" });
            const audioBuffer = Buffer.from(resp.data, "binary");

            await sock.sendMessage(user, {
              audio: audioBuffer,
              mimetype: "audio/mpeg",
              ptt: false
            });
            console.log("✅ Audio sent alongside the session message");
          } catch (e) {
            console.error("❌ Failed to download/send audio:", e);
          }

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

  startSocket().catch((e) => {
    console.error("Socket error:", e);
    fs.emptyDirSync(authDir);
    if (!qrServed) res.status(500).send("Error generating QR");
  });
});

app.listen(PORT, () => {
  console.log(`✅ WHIZ‑MD server running on http://localhost:${PORT}`);
});
