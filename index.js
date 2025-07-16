// Serve QR Code as styled web page
const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const { toDataURL } = require("qrcode");

const app = express();
const PORT = process.env.PORT || 5000;
const authDir = path.join(__dirname, 'auth_info_baileys');

fs.ensureDirSync(authDir);
fs.emptyDirSync(authDir);

app.get("/", async (req, res) => {
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeInMemoryStore,
    Browsers,
    delay,
    DisconnectReason
  } = require("@whiskeysockets/baileys");

  const store = makeInMemoryStore({
    logger: pino({ level: 'silent' })
  });

  async function startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.macOS("WHIZ-MD"),
      logger: pino({ level: 'silent' })
    });

    store.bind(sock.ev);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        const qrDataURL = await toDataURL(qr);
        return res.send(generatePage(qrDataURL));
      }

      if (connection === "open") {
        await delay(2000);
        const user = sock.user.id;

        const credsPath = path.join(authDir, "creds.json");
        if (!fs.existsSync(credsPath)) return;

        const credsData = fs.readFileSync(credsPath);
        const Scan_Id = "WHIZMD_" + Buffer.from(credsData).toString("base64");

        const sessionMsg = await sock.sendMessage(user, { text: Scan_Id });
        await sock.sendMessage(user, { text: process.env.MESSAGE || 'WHIZ-MD AUTH SUCCESSFUL' }, { quoted: sessionMsg });

        await delay(1000);
        fs.emptyDirSync(authDir);
      }

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        if (reason === DisconnectReason.restartRequired) startSocket().catch(console.error);
      }
    });

    sock.ev.on("creds.update", saveCreds);
  }

  try {
    await startSocket();
  } catch (err) {
    console.error("QR Failed:", err);
    res.status(500).send("Error generating QR code");
  }
});

function generatePage(qrDataURL) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WHIZ-MD QR Login</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/whizmd/static/styles.css">
    </head>
    <body>
      <div class="animated-bg"></div>
      <div id="app">
        <div class="container">
          <div class="header">
            <h1>WHIZ-MD Login</h1>
            <p>Scan QR within 30 seconds</p>
          </div>
          <div class="qr-container">
            <div class="qr-wrapper">
              <img id="qrcode" src="${qrDataURL}" alt="QR Code"/>
            </div>
            <div class="timer-container">
              <div class="timer-circle">
                <svg class="timer-svg">
                  <circle class="timer-bg" cx="60" cy="60" r="45"></circle>
                  <circle id="progress" class="timer-progress" cx="60" cy="60" r="45"></circle>
                </svg>
                <div id="time" class="timer-text">30</div>
              </div>
              <div class="timer-label">QR expires in</div>
            </div>
            <div class="expired-message" id="expired">
              <h2>⏳ QR Expired!</h2>
              <p>Click below to reload the page and get a fresh QR.</p>
              <button class="reload-btn" onclick="location.reload()">🔄 Reload Page</button>
            </div>
          </div>
        </div>
      </div>
      <script>
        let time = 30;
        const progress = document.getElementById('progress');
        const timer = document.getElementById('time');
        const expired = document.getElementById('expired');

        const total = 283;
        const tick = () => {
          time--;
          timer.innerText = time;
          const offset = total - (time / 30) * total;
          progress.style.strokeDashoffset = offset;

          if (time <= 0) {
            clearInterval(interval);
            expired.classList.add("show");
            document.getElementById("qrcode").style.filter = "blur(3px) grayscale(0.6)";
          }
        };

        let interval = setInterval(tick, 1000);
        progress.style.strokeDasharray = total;
        progress.style.strokeDashoffset = 0;
      </script>
    </body>
    </html>
  `;
}

app.listen(PORT, () => console.log(`🟢 WHIZ-MD Server running at http://localhost:${PORT}`));
