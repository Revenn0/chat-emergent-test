import {
  makeWASocket,
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
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001";
const PORT = parseInt(process.env.BAILEYS_PORT || "3001");
const AUTH_BASE = path.join(__dirname, "auth_sessions");

const logger = pino({ level: "silent" });
const app = express();
app.use(express.json());

// ── State per user ────────────────────────────────────────
const sessions = new Map(); // user_id -> { sock, status, qr, logs }

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { sock: null, status: "disconnected", qr: null, logs: [] });
  }
  return sessions.get(userId);
}

function addLog(userId, level, message) {
  const s = getSession(userId);
  const entry = { level, message, timestamp: new Date().toISOString() };
  s.logs.unshift(entry);
  if (s.logs.length > 100) s.logs = s.logs.slice(0, 100);
  console.log(`[${userId}][${level.toUpperCase()}] ${message}`);
}

async function notifyBackend(userId, event, data) {
  try {
    await axios.post(`${BACKEND_URL}/api/wa/event`, { event, data, user_id: userId }, { timeout: 5000 });
  } catch {}
}

// ── Connect per user ──────────────────────────────────────
async function connectUser(userId) {
  const authDir = path.join(AUTH_BASE, userId);
  if (!existsSync(authDir)) await mkdir(authDir, { recursive: true });

  const s = getSession(userId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  addLog(userId, "info", `Connecting Baileys v${version.join(".")}`);
  s.status = "connecting";
  s.qr = null;

  const sock = makeWASocket({
    version,
    logger,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    browser: ["WhatsApp 365 Bot", "Chrome", "1.0.0"],
  });
  s.sock = sock;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      addLog(userId, "info", "QR code generated — scan with WhatsApp");
      try { s.qr = await QRCode.toDataURL(qr, { width: 300, margin: 2 }); } catch {}
      s.status = "qr_ready";
    }

    if (connection === "close") {
      s.qr = null;
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom &&
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
      addLog(userId, "warn", `Connection closed: ${lastDisconnect?.error?.message || "unknown"}`);
      s.status = "disconnected";
      if (shouldReconnect) {
        addLog(userId, "info", "Reconnecting...");
        setTimeout(() => connectUser(userId), 3000);
      } else {
        addLog(userId, "info", "Logged out — auth cleared");
        try { const { rmSync } = await import("fs"); rmSync(authDir, { recursive: true, force: true }); } catch {}
      }
    }

    if (connection === "open") {
      s.qr = null;
      s.status = "connected";
      addLog(userId, "info", `Connected! JID: ${sock.user?.id}`);
      await notifyBackend(userId, "connected", { jid: sock.user?.id });
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
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || null;
      if (!text) continue;
      addLog(userId, "info", `Message from ${pushName}: ${text.substring(0, 50)}`);
      try {
        const resp = await axios.post(`${BACKEND_URL}/api/wa/message`, { from, pushName, text, timestamp: msg.messageTimestamp, user_id: userId }, { timeout: 30000 });
        const reply = resp.data?.reply;
        if (reply && s.sock) {
          await s.sock.sendMessage(from, { text: reply });
          addLog(userId, "info", `Replied to ${pushName}: ${reply.substring(0, 50)}`);
        }
      } catch (e) {
        addLog(userId, "error", `Error processing message: ${e.message}`);
      }
    }
  });
}

// ── REST API ──────────────────────────────────────────────

app.get("/status", (req, res) => {
  const userId = req.query.user_id || "default";
  const s = getSession(userId);
  res.json({ status: s.status, connected: s.status === "connected", jid: s.sock?.user?.id || null });
});

app.get("/qr", (req, res) => {
  const userId = req.query.user_id || "default";
  const s = getSession(userId);
  res.json({ qr: s.qr, status: s.status });
});

app.post("/reconnect", async (req, res) => {
  const userId = req.body.user_id || "default";
  const s = getSession(userId);
  try {
    if (s.sock) { try { s.sock.end(); } catch {} s.sock = null; }
    addLog(userId, "info", "Reconnect requested");
    setTimeout(() => connectUser(userId), 500);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/disconnect", async (req, res) => {
  const userId = req.body.user_id || "default";
  const s = getSession(userId);
  try {
    if (s.sock) { await s.sock.logout(); s.sock = null; }
    s.status = "disconnected";
    s.qr = null;
    addLog(userId, "info", "Disconnected by user");
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/send", async (req, res) => {
  const { user_id, to, message } = req.body;
  const userId = user_id || "default";
  const s = getSession(userId);
  if (!s.sock || s.status !== "connected") return res.status(400).json({ error: "Not connected" });
  try {
    await s.sock.sendMessage(to, { text: message });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/logs", (req, res) => {
  const userId = req.query.user_id || "default";
  const s = getSession(userId);
  res.json({ logs: s.logs });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Baileys] Listening on port ${PORT}`);
});
