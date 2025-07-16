const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const { toDataURL } = require("qrcode");

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
🔧 Powered by WHIZ • Built with 💡
━━━━━━━━━━━━━━━━━━━━━━━
`;

fs.ensureDirSync(authDir);
fs.emptyDirSync(authDir);
app.use("/static", express.static(path.join(__dirname, "public")));

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
    logger: pino({ level: "silent" }).child({ stream: "store" })
  });

  async function startSocket(sendHTML) {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.macOS("WHIZ-MD"),
      logger: pino({ level: "silent" })
    });

    store.bind(sock.ev);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        const dataUrl = await toDataURL(qr);
        return sendHTML(dataUrl);
      }

      if (connection === "open") {
        await delay(2000);
        const user = sock.user.id;

        const credsPath = path.join(authDir, "creds.json");
        if (!fs.existsSync(credsPath)) {
          console.error("creds.json not found");
          return;
        }

        const credsData = fs.readFileSync(credsPath);
        const Scan_Id = "WHIZMD_" + Buffer.from(credsData).toString("base64");

        console.log(`
====================  SESSION ID  ==========================
SESSION-ID ==> ${Scan_Id}
-------------------   SESSION CLOSED   ----------------------
        `);

        const sessionMsg = await sock.sendMessage(user, { text: Scan_Id });
        await sock.sendMessage(user, { text: MESSAGE }, { quoted: sessionMsg });

        await delay(1000);
        fs.emptyDirSync(authDir);
      }

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        switch (reason) {
          case DisconnectReason.connectionClosed:
            console.log("Connection closed!");
            break;
          case DisconnectReason.connectionLost:
            console.log("Connection lost!");
            break;
          case DisconnectReason.restartRequired:
            console.log("Restart required!");
            startSocket(sendHTML).catch(console.error);
            break;
          case DisconnectReason.timedOut:
            console.log("Connection timed out!");
            break;
          default:
            console.log("Disconnected:", reason);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);
  }

  try {
    await startSocket((qrUrl) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>WHIZ-MD QR Login</title>
          <link rel="stylesheet" href="/static/styles.css" />
        </head>
        <body>
          <div class="animated-bg"></div>
          <div id="app">
            <div class="container">
              <div class="header">
                <h1>Scan QR to Login</h1>
                <p>Powered by WHIZ-MD • Expires in 30 seconds</p>
              </div>
              <div class="qr-container">
                <div class="qr-wrapper">
                  <img src="${qrUrl}" id="qrcode" alt="QR Code" />
                </div>

                <div class="timer-container">
                  <div class="timer-circle">
                    <svg class="timer-svg" viewBox="0 0 100 100">
                      <circle class="timer-bg" cx="50" cy="50" r="45" />
                      <circle class="timer-progress" cx="50" cy="50" r="45" />
                    </svg>
                    <div class="timer-text" id="timer">30</div>
                  </div>
                  <div class="timer-label">QR Code Expires In</div>
                </div>

                <div class="expired-message" id="expired">
                  <h2>⏱ QR Code Expired</h2>
                  <p>The code expired after 30 seconds. Please reload the page to generate a new one.</p>
                  <button class="reload-btn" onclick="location.reload()">🔄 Reload Page</button>
                </div>
              </div>
            </div>
          </div>

          <script>
            const timerCircle = document.querySelector(".timer-progress");
            const timerText = document.getElementById("timer");
            const expiredBox = document.getElementById("expired");
            const totalSeconds = 30;
            let current = totalSeconds;

            const interval = setInterval(() => {
              current--;
              timerText.textContent = current;
              const offset = 283 - (283 * (totalSeconds - current)) / totalSeconds;
              timerCircle.style.strokeDashoffset = offset;

              if (current <= 0) {
                clearInterval(interval);
                expiredBox.classList.add("show");
                document.getElementById("qrcode").style.filter = "grayscale(100%) blur(2px)";
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
    });
  } catch (err) {
    console.error("Error starting socket:", err);
    fs.emptyDirSync(authDir);
    res.status(500).send("Internal server error.");
  }
});

app.listen(PORT, () => {
  console.log(`✅ WHIZ-MD server is running on http://localhost:${PORT}`);
});
