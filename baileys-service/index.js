import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
} from "@whiskeysockets/baileys";
import express from "express";
import QRCode from "qrcode";
import axios from "axios";
import pino from "pino";
import { Boom } from "@hapi/boom";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001";
const PORT = parseInt(process.env.BAILEYS_PORT || "3001");
const AUTH_DIR = path.join(__dirname, "auth_info");

const logger = pino({ level: "silent" });

const app = express();
app.use(express.json());

// State
let sock = null;
let qrCodeData = null;
let connectionStatus = "disconnected"; // disconnected | connecting | connected
let connectionLogs = [];

function addLog(level, message) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  connectionLogs.unshift(entry);
  if (connectionLogs.length > 200) connectionLogs = connectionLogs.slice(0, 200);
  console.log(`[${level.toUpperCase()}] ${message}`);
}

async function notifyBackend(event, data) {
  try {
    await axios.post(`${BACKEND_URL}/api/wa/event`, { event, data }, { timeout: 5000 });
  } catch (e) {
    addLog("warn", `Could not notify backend: ${e.message}`);
  }
}

async function connectToWhatsApp() {
  if (!existsSync(AUTH_DIR)) {
    await mkdir(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  addLog("info", `Connecting with Baileys v${version.join(".")}`);
  connectionStatus = "connecting";
  qrCodeData = null;

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    browser: ["WhatsApp AI Bot", "Chrome", "1.0.0"],
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      addLog("info", "QR code generated — scan with WhatsApp");
      try {
        qrCodeData = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
      } catch (e) {
        addLog("error", `QR generation error: ${e.message}`);
      }
      connectionStatus = "qr_ready";
    }

    if (connection === "close") {
      qrCodeData = null;
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom &&
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;

      addLog(
        "warn",
        `Connection closed. Reason: ${lastDisconnect?.error?.message || "unknown"}`
      );
      connectionStatus = "disconnected";

      if (shouldReconnect) {
        addLog("info", "Reconnecting...");
        setTimeout(connectToWhatsApp, 3000);
      } else {
        addLog("info", "Logged out — auth cleared");
        connectionStatus = "disconnected";
        // Clear auth on logout
        try {
          const { rmSync } = await import("fs");
          rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch {}
      }
    }

    if (connection === "open") {
      qrCodeData = null;
      connectionStatus = "connected";
      const jid = sock.user?.id || "unknown";
      addLog("info", `Connected! JID: ${jid}`);
      await notifyBackend("connected", { jid });
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;

      const from = msg.key.remoteJid;
      const pushName = msg.pushName || from.split("@")[0];
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        null;

      if (!text) continue;

      addLog("info", `Message from ${pushName} (${from}): ${text.substring(0, 50)}`);

      try {
        const resp = await axios.post(
          `${BACKEND_URL}/api/wa/message`,
          { from, pushName, text, timestamp: msg.messageTimestamp },
          { timeout: 30000 }
        );

        const reply = resp.data?.reply;
        if (reply && sock) {
          await sock.sendMessage(from, { text: reply });
          addLog("info", `Replied to ${pushName}: ${reply.substring(0, 50)}`);
        }
      } catch (e) {
        addLog("error", `Error processing message: ${e.message}`);
      }
    }
  });
}

// ---- REST API ----

app.get("/status", (req, res) => {
  res.json({
    status: connectionStatus,
    connected: connectionStatus === "connected",
    jid: sock?.user?.id || null,
  });
});

app.get("/qr", (req, res) => {
  if (qrCodeData) {
    res.json({ qr: qrCodeData, status: connectionStatus });
  } else {
    res.json({ qr: null, status: connectionStatus });
  }
});

app.post("/disconnect", async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
    connectionStatus = "disconnected";
    qrCodeData = null;
    addLog("info", "Disconnected by user");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/reconnect", async (req, res) => {
  try {
    if (sock) {
      try { sock.end(); } catch {}
      sock = null;
    }
    addLog("info", "Reconnect requested");
    setTimeout(connectToWhatsApp, 500);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/send", async (req, res) => {
  const { to, message } = req.body;
  if (!sock || connectionStatus !== "connected") {
    return res.status(400).json({ error: "Not connected" });
  }
  try {
    await sock.sendMessage(to, { text: message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/logs", (req, res) => {
  res.json({ logs: connectionLogs });
});

app.listen(PORT, "0.0.0.0", () => {
  addLog("info", `Baileys service listening on port ${PORT}`);
  connectToWhatsApp();
});
