import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// One shared connection pool for the whole app.
// DATABASE_URL comes from your host's environment (Supabase/Neon/Render).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Most hosted Postgres (Supabase/Neon/Render) require SSL.
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 10, // small pool — plenty for a waitlist, kind to free-tier DBs
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
});

// Don't let an unexpected idle-client error crash the process.
pool.on("error", (err) => console.error("[pg] idle client error:", err.message));

// Create the table on boot so a fresh database just works.
export async function migrate() {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("✓ database ready");
}

// Lightweight liveness check used by /api/ready.
export async function ping() {
  await pool.query("select 1");
}

// Total signups, for /api/waitlist/count.
export async function countWaitlist() {
  const { rows } = await pool.query("select count(*)::int as n from waitlist");
  return rows[0]?.n ?? 0;
}
