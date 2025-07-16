const express = require("express");
const app = express();

const pino = require("pino");
let { toBuffer } = require("qrcode");
const path = require('path');
const fs = require("fs-extra");
const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 5000;

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

if (fs.existsSync('./auth_info_baileys')) {
  fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

app.use("/", async (req, res) => {
  const {
    default: SuhailWASocket,
    useMultiFileAuthState,
    Browsers,
    delay,
    DisconnectReason,
    makeInMemoryStore,
  } = require("@whiskeysockets/baileys");

  const store = makeInMemoryStore({
    logger: pino().child({ level: 'silent', stream: 'store' }),
  });

  async function SUHAIL() {
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys');
    let responseSent = false; // 🛡️ Prevent double response

    try {
      let Smd = SuhailWASocket({
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["WhizMD", "123.0.0"], // ✅ Custom browser name
        auth: state
      });

      Smd.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

        if (qr && !responseSent) {
          responseSent = true;

          const qrBuffer = await toBuffer(qr);
          const base64Qr = qrBuffer.toString('base64');

          res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>WHIZ QR Code</title>
              <style>
                body {
                  margin: 0;
                  height: 100vh;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background: linear-gradient(-45deg, #ff004c, #ff9000, #00f2ff, #8e2de2);
                  background-size: 400% 400%;
                  animation: gradient 15s ease infinite;
                  font-family: Arial, sans-serif;
                }
                @keyframes gradient {
                  0% {background-position: 0% 50%;}
                  50% {background-position: 100% 50%;}
                  100% {background-position: 0% 50%;}
                }
                .container {
                  background: rgba(255, 255, 255, 0.1);
                  padding: 2rem;
                  border-radius: 16px;
                  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                  backdrop-filter: blur(10px);
                  text-align: center;
                }
                img {
                  width: 300px;
                  height: 300px;
                }
                h1 {
                  color: white;
                  margin-top: 1rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <img src="data:image/png;base64,${base64Qr}" alt="WHIZ QR Code" />
                <h1>Scan to Link WHIZ-MD</h1>
              </div>
            </body>
            </html>
          `);
          return; // ✅ stop further processing for this request
        }

        if (connection === "open") {
          await delay(3000);
          let user = Smd.user.id;

          let CREDS = fs.readFileSync(__dirname + '/auth_info_baileys/creds.json');
          let Scan_Id = "WHIZMD_" + Buffer.from(CREDS).toString('base64');

          console.log(`
====================  SESSION ID  ==========================                   
SESSION-ID ==> ${Scan_Id}
-------------------   SESSION CLOSED   -----------------------
          `);

          let msgsss = await Smd.sendMessage(user, { text: Scan_Id });
          await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
          await delay(1000);

          try {
            await fs.emptyDirSync(__dirname + '/auth_info_baileys');
          } catch (e) {}
        }

        Smd.ev.on('creds.update', saveCreds);

        if (connection === "close") {
          let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
          if (reason === DisconnectReason.connectionClosed) {
            console.log("Connection closed!");
          } else if (reason === DisconnectReason.connectionLost) {
            console.log("Connection Lost from Server!");
          } else if (reason === DisconnectReason.restartRequired) {
            console.log("Restart Required, Restarting...");
            SUHAIL().catch(err => console.log(err));
          } else if (reason === DisconnectReason.timedOut) {
            console.log("Connection TimedOut!");
          } else {
            console.log('Connection closed with bot. Please run again.');
            console.log(reason);
          }
        }
      });
    } catch (err) {
      console.log(err);
      await fs.emptyDirSync(__dirname + '/auth_info_baileys');
    }
  }

  SUHAIL().catch(async (err) => {
    console.log(err);
    await fs.emptyDirSync(__dirname + '/auth_info_baileys');
  });
});

app.listen(PORT, () => console.log(`App listened on port http://localhost:${PORT}`));
