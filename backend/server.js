import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { pool, migrate, ping, countWaitlist } from "./db.js";

/* ---------------------------------------------------------------------------
 * Environment
 * ------------------------------------------------------------------------- */
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || "development";
const HAS_DB = Boolean(process.env.DATABASE_URL);

// Comma-separated list of sites allowed to call this API.
// e.g. ALLOWED_ORIGIN="https://you.github.io,http://localhost:5500"
const ORIGINS =
  process.env.ALLOWED_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) || [];

const app = express();
app.set("trust proxy", 1); // we're behind a proxy on Render/Railway/Fly

/* ---------------------------------------------------------------------------
 * Security & performance middleware
 * ------------------------------------------------------------------------- */
app.use(
  helmet({
    // A simple JSON API + SSE doesn't need a strict CSP here; the static site
    // sets its own. crossOriginResourcePolicy stays relaxed so the separately
    // hosted frontend can read responses.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.use(express.json({ limit: "16kb" }));

app.use(
  cors({
    origin: ORIGINS.length ? ORIGINS : "*",
    methods: ["GET", "POST"],
  })
);

// Global, generous rate limit; the waitlist route gets a stricter one below.
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------------------------------------------------------------------------
 * Health & readiness — hosts ping these to know the server is alive.
 * ------------------------------------------------------------------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true, env: NODE_ENV, db: HAS_DB }));

app.get("/api/ready", async (_req, res) => {
  if (!HAS_DB) return res.json({ ok: true, db: false }); // db optional in demo mode
  try {
    await ping();
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

/* ---------------------------------------------------------------------------
 * Waitlist
 * ------------------------------------------------------------------------- */
const waitlistLimiter = rateLimit({
  windowMs: 60_000,
  max: 5, // 5 signups / minute / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Slow down a moment." },
});

app.post("/api/waitlist", waitlistLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: "Invalid email." });
  if (email.length > 254) return res.status(400).json({ error: "Email too long." });

  if (!HAS_DB) {
    // Demo mode: accept but don't persist, so the site works with no database.
    return res.status(201).json({ ok: true, demo: true });
  }

  try {
    // ON CONFLICT = signing up twice is harmless, not an error.
    const { rowCount } = await pool.query(
      "insert into waitlist (email) values ($1) on conflict (email) do nothing",
      [email]
    );
    if (rowCount > 0) signupCount += rowCount; // optimistic bump for the live readout
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[waitlist]", err.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// Live signup count (the frontend shows "N builders already in line").
app.get("/api/waitlist/count", async (_req, res) => {
  if (!HAS_DB) return res.json({ count: 0, demo: true });
  try {
    res.json({ count: await countWaitlist() });
  } catch {
    res.status(500).json({ error: "Could not read count." });
  }
});

/* ---------------------------------------------------------------------------
 * Live mesh telemetry — Server-Sent Events.
 * The frontend's telemetry panel + hero status subscribe to this. These are
 * synthesized metrics (this is a demo mesh); swap in real values when you have
 * them — the wire format stays the same.
 * ------------------------------------------------------------------------- */
const clients = new Set();

// --- real backend signals mixed into the telemetry stream ---
// signupCount is cached and refreshed periodically so we don't hit the DB
// on every 2s broadcast; it's also bumped optimistically on each new signup.
let signupCount = 0;
async function refreshSignups() {
  if (!HAS_DB) return;
  try {
    signupCount = await countWaitlist();
  } catch {
    /* leave the last good value */
  }
}

function meshSnapshot() {
  const wave = Math.sin(Date.now() / 4000);
  return {
    // synthetic "mesh" values (fictional product — these drive the visuals)
    nodes: Math.round(4096 + wave * 30 + (Math.random() * 20 - 10)),
    tps: 1.1e6 + Math.random() * 0.3e6,
    lat: 36 + Math.random() * 6,
    gpu: 68 + Math.random() * 22,
    queue: 400 + Math.random() * 1200,
    // REAL signals from this running server
    uptime: Math.floor(process.uptime()),
    clients: clients.size,
    signups: signupCount,
  };
}

const LOG_OK = ["replica placed", "node rejoined mesh", "weights synced", "route table updated", "autoscale +1 node", "cache warmed", "health gossip ok"];
const LOG_WARN = ["node drained, rerouting", "backpressure on edge-eu", "cold start mitigated"];
const REGIONS = ["us-east", "eu-west", "ap-south", "sa-east"];

function meshLog() {
  const warn = Math.random() < 0.18;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  return {
    ts: new Date().toLocaleTimeString("en-GB"),
    level: warn ? "WARN" : "OK",
    msg: `${pick(REGIONS)} · ${warn ? pick(LOG_WARN) : pick(LOG_OK)}`,
  };
}

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(frame);
}

// Emit on an interval regardless of client count (cheap, one timer pair).
setInterval(() => clients.size && broadcast("metrics", meshSnapshot()), 2000);
setInterval(() => clients.size && broadcast("log", meshLog()), 1600);

app.get("/api/live", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable proxy buffering (nginx)
  });
  res.write("retry: 3000\n\n");
  // Prime the client immediately.
  res.write(`event: metrics\ndata: ${JSON.stringify(meshSnapshot())}\n\n`);
  res.write(`event: log\ndata: ${JSON.stringify(meshLog())}\n\n`);

  clients.add(res);
  const keep = setInterval(() => res.write(": keepalive\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(keep);
    clients.delete(res);
  });
});

/* ---------------------------------------------------------------------------
 * 404 + error fallthrough
 * ------------------------------------------------------------------------- */
app.use((_req, res) => res.status(404).json({ error: "Not found." }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal error." });
});

/* ---------------------------------------------------------------------------
 * Boot + graceful shutdown
 * ------------------------------------------------------------------------- */
async function start() {
  if (HAS_DB) {
    await migrate();
    await refreshSignups();
    setInterval(refreshSignups, 20_000); // keep the live count fresh
  } else {
    console.warn("⚠ No DATABASE_URL set — running in DEMO mode (signups are not stored).");
  }
  const server = app.listen(PORT, () => console.log(`✓ SAFAL API on :${PORT} (${NODE_ENV})`));

  const shutdown = (sig) => {
    console.log(`\n${sig} received — shutting down…`);
    for (const res of clients) res.end();
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // force-exit safety net
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((e) => {
  console.error("Startup failed:", e.message);
  process.exit(1);
});
