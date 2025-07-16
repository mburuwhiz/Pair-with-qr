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
const axios = require("axios");

const app = express();
const PORT = process.env.PORT||3000;
app.use(express.static("public"));
app.set("view engine","ejs");
app.set("views", path.join(__dirname,"views"));

const authDir = path.join(__dirname,"auth");
fs.ensureDirSync(authDir);

let sock;
let currentQR = null;
let isConnected = false;

async function startSock(){
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  if(sock){
    sock.ev.removeAllListeners();
    sock.end();
  }
  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal:false,
    logger:pino({level:"silent"})
  });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async u=>{
    const { qr, connection, lastDisconnect } = u;
    if(qr){
      currentQR = qr;
      isConnected = false;
      console.log("🔄 QR generated");
    }
    if(connection==="open"){
      console.log("✅ Connected");
      isConnected = true;
      currentQR = null;
      const SECRET = await fs.readFile(path.join(authDir,"creds.json"));
      const sessionId = "WHIZMD_"+ Buffer.from(SECRET).toString("base64");
      await sock.sendMessage(sock.user.id,{text:`SESSION-ID ==> ${sessionId}`});
      const MSG = `━━━━━━━━━━━━━━━━━━━━━━━
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
🔧 Powered by WHIZ-MD • Built with 💡`;
      await sock.sendMessage(sock.user.id, {text:MSG});
      try{
        const resp=await axios.get("https://s31.aconvert.com/convert/p3r68-cdx67/gmz3g-g051v.mp3", {responseType:"arraybuffer"});
        await sock.sendMessage(sock.user.id,{
          audio: Buffer.from(resp.data), mimetype:"audio/mpeg", ptt:false
        });
      }catch(e){}
      setTimeout(startSock,2000);
    }
    if(connection==="close"){
      const code=new Boom(lastDisconnect?.error).output.statusCode;
      console.log("❌ Disconnected:",code);
      if(code!==401) setTimeout(startSock,2000);
    }
  });
}

startSock();

app.get("/",(req,res)=>res.redirect("/scan"));
app.get("/scan",(req,res)=>res.render("scan"));
app.get("/qr",(req,res)=>{
  if(!currentQR || isConnected) return res.status(404).send("No QR");
  qrcode.toBuffer(currentQR)
    .then(buf=>{res.type("png").send(buf);})
    .catch(()=>res.status(500).send("QR error"));
});

app.listen(PORT,()=>console.log(`🚀 on http://localhost:${PORT}`));
