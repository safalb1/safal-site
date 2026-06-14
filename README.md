# SAFAL — Neural Compute Mesh

A futuristic, fully-animated landing page **(frontend)** backed by a real, production-hardened API **(backend)** and a PostgreSQL database. The whole thing is built to run for **$0** on free tiers, and it works on its own even before you connect a backend.

> **New to all this?** Read top to bottom once. Every section is plain-English and assumes you've never deployed anything before.

---

## 1. What this website actually is

It's a marketing/landing site for a fictional product called **SAFAL** — a "neural compute mesh" that runs AI models across a network of GPUs. The page is designed to *feel* like a live system:

- A 3D wireframe "mesh core" rotates in the background, drawn by hand on an HTML canvas (no 3D library).
- A particle constellation reacts to your mouse.
- A **live telemetry panel** shows GPU load, throughput, latency, and a scrolling scheduler log that updates in real time.
- A **waitlist form** collects email addresses.

There are **two modes**, and the site switches automatically:

| Mode | When | What happens |
|------|------|--------------|
| **Demo** | No backend connected (`API_URL = ""`) | Everything animates. The telemetry is *simulated* in the browser. The form shows success but stores nothing. |
| **Live** | Backend connected | Telemetry streams from the server. The form writes real emails to the database. A live signup count appears. |

You can ship the demo today and wire up the backend whenever you like — nothing breaks in between.

---

## 2. How it works (the architecture)

```
        Visitor's browser
   ┌───────────────────────────┐
   │   index.html              │  ← the animated site (HTML/CSS/JS, no build step)
   │   • canvas mesh backdrop  │
   │   • telemetry panel       │
   │   • waitlist form         │
   └───────────┬───────────────┘
               │
       ┌───────┴───────────────────────────────────┐
       │  fetch  POST /api/waitlist  (sign up)      │
       │  fetch  GET  /api/waitlist/count (count)   │
       │  SSE    GET  /api/live  (live metrics)     │
       ▼                                            │
   ┌───────────────────────────┐                    │
   │   backend/server.js       │  ← Express API     │
   │   • helmet (security)     │                    │
   │   • rate limiting         │                    │
   │   • CORS allow-list       │                    │
   │   • Server-Sent Events    │                    │
   └───────────┬───────────────┘                    │
               │  SQL                                │
               ▼                                     │
   ┌───────────────────────────┐                    │
   │   PostgreSQL (waitlist)   │  ← stores emails   │
   └───────────────────────────┘                    │
```

### The three pieces

1. **Frontend — [`index.html`](index.html)**
   One self-contained file. Open it in a browser and it runs. At the very top of the `<script>` block there is one line you'll edit later:
   ```js
   const API_URL = ""; // set to your backend URL to go "live"
   ```

2. **Backend — [`backend/`](backend/)** — an [Express](https://expressjs.com) server exposing:
   | Route | Method | Purpose |
   |-------|--------|---------|
   | `/api/health` | GET | "Am I alive?" — hosts ping this. |
   | `/api/ready` | GET | "Is the database reachable?" |
   | `/api/waitlist` | POST | Save an email (validated + rate-limited). |
   | `/api/waitlist/count` | GET | How many signups so far. |
   | `/api/live` | GET (SSE) | A never-ending stream of mesh metrics + log lines. |

   It's **production-hardened**: security headers ([helmet](https://helmetjs.github.io/)), gzip ([compression](https://www.npmjs.com/package/compression)), per-IP [rate limiting](https://www.npmjs.com/package/express-rate-limit), a CORS allow-list, input validation, structured error handling, and **graceful shutdown** (it closes connections cleanly when the host stops it).

   It also runs **without a database** ("demo mode"): if you don't give it a `DATABASE_URL`, signups are accepted but not stored, and the live telemetry still streams. Handy for testing.

3. **Database — PostgreSQL** — a single `waitlist` table, created automatically on boot from [`backend/schema.sql`](backend/schema.sql).

### What "Server-Sent Events" means (the live panel)
SSE is a one-way stream: the browser opens `GET /api/live` once and the server keeps pushing little messages (`metrics` and `log`) down that same connection forever. It's simpler than WebSockets and perfect for "live dashboard" numbers. If the connection can't be made, the frontend silently falls back to the in-browser simulation — so the panel is never blank.

---

## 3. File map

```
website_c/
├─ index.html                     ← the entire frontend (animations + logic)
├─ README.md                      ← you are here
├─ GUIDE.md                       ← the original step-by-step deploy walkthrough
├─ .gitignore                     ← keeps secrets / node_modules out of git
├─ .github/
│  └─ workflows/
│     └─ deploy.yml               ← auto-publishes ONLY index.html to GitHub Pages
└─ backend/
   ├─ server.js                   ← Express API (routes, security, SSE, shutdown)
   ├─ db.js                       ← PostgreSQL pool + helpers (migrate/ping/count)
   ├─ schema.sql                  ← the waitlist table
   ├─ package.json                ← backend dependencies + scripts
   ├─ .env.example                ← template for secrets (copy to .env locally)
   ├─ Dockerfile                  ← container image for the backend (optional)
   ├─ .dockerignore
   └─ render.yaml                 ← optional one-click Render deploy config
```

---

## 4. See the site right now (zero setup)

Just **double-click `index.html`** (or right-click → open with your browser). The animation runs and the form works in demo mode. Nothing to install.

> A few browser features (like the live-count fetch) only activate once a backend is connected — that's expected in demo mode.

---

## 5. Running the backend locally (optional)

> ⚠️ **Heads-up:** this needs **Node.js 18 or newer**, and it does **not** appear to be installed on this computer. Install it first from <https://nodejs.org> (the "LTS" version), then reopen your terminal and check: `node --version`.

```bash
cd backend
npm install
cp .env.example .env        # Windows PowerShell: copy .env.example .env
npm run dev
```

You'll see either `✓ database ready` (if you filled in `DATABASE_URL`) or a `DEMO mode` warning (if you left it blank). Both are fine. Then test it:

```bash
curl http://localhost:8080/api/health
# → {"ok":true,"env":"development","db":false}

curl -X POST http://localhost:8080/api/waitlist \
  -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\"}"
# → {"ok":true}  (or {"ok":true,"demo":true} with no database)
```

To watch the live stream in your terminal: `curl -N http://localhost:8080/api/live`

---

## 6. Putting it on GitHub  ⭐ read this carefully

> **Important — your home folder is already a Git repository.**
> This project lives inside `C:\Users\safal\…`, and that entire folder is one big git repo. If you `git push` from there, you'd upload your **whole computer's home directory** to GitHub. **Don't.** Make this project its own separate repo first.

### Step 1 — give this project its own repo

Open a terminal **in the `website_c` folder** and run:

```bash
# (PowerShell) make sure you're in the project folder:
cd "C:\Users\safal\Dropbox\My PC (DESKTOP-U79LPJ1)\Downloads\website_c"

git init
git add .
git commit -m "SAFAL: production-ready site + backend"
```

> Because there's a parent repo, also confirm Git is treating *this* folder as the root: `git rev-parse --show-toplevel` should print the `website_c` path. If it still points at your home folder, the `git init` above fixes it by creating a `.git` here.

### Step 2 — create an empty GitHub repo and push

1. Go to <https://github.com/new>, name it e.g. `safal-site`, **don't** add a README/license (you already have files), and click **Create repository**.
2. Back in your terminal:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/safal-site.git
git push -u origin main
```

Your code is now on GitHub. Nothing secret was pushed — `.env` files and `node_modules` are excluded by `.gitignore`.

---

## 7. Deploy the **frontend** → GitHub Pages (free)

1. On GitHub: **your repo → Settings → Pages**.
2. Under **Source**, choose **GitHub Actions**.
3. Done. The included [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes on every push to `main`. It deliberately publishes **only `index.html`** — your backend source is never exposed.
4. Your live site: `https://YOUR_USERNAME.github.io/safal-site/`

> Prefer drag-and-drop hosting? **Netlify** or **Vercel** both work: "Import from GitHub", pick the repo, leave build settings empty (it's a static site), deploy. Instant HTTPS, also free.

**At this point your animated site is live on the internet in demo mode.** The next sections make the waitlist real.

---

## 8. Create the database → Supabase (free)

1. Sign up at <https://supabase.com> → **New project**. Pick a region near your users and **save the database password**.
2. Left sidebar → **SQL Editor** → paste the contents of [`backend/schema.sql`](backend/schema.sql) → **Run**. (Creates the `waitlist` table. The backend also does this automatically on boot, but running it once now confirms your connection works.)
3. **Project Settings → Database → Connection string → URI.** Copy it; it looks like:
   ```
   postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` with the password from step 1. **This is your `DATABASE_URL`.**

> [Neon](https://neon.tech) is an equally good free alternative — same idea, copy its connection string.

---

## 9. Deploy the **backend** → Render (free)

1. Sign up at <https://render.com> → **New → Web Service** → connect your GitHub repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. **Environment → add variables:**
   - `DATABASE_URL` = your Supabase URI from §8
   - `ALLOWED_ORIGIN` = your site's origin, e.g. `https://YOUR_USERNAME.github.io`
   - `NODE_ENV` = `production`
4. **Create Web Service.** Render gives you a URL like `https://safal-api.onrender.com`.
5. Test it: open `https://safal-api.onrender.com/api/health` → should show `{"ok":true,...}`.

> Render's free tier **sleeps after ~15 min of inactivity**, so the first request after a quiet spell takes ~30s to wake. Fine for a waitlist. (Railway, Fly.io, and the included [`Dockerfile`](backend/Dockerfile) are alternatives.)

---

## 10. Connect the site to the backend (the "go live" switch)

Open [`index.html`](index.html), find this near the top of the `<script>` section:

```js
const API_URL = "";
```

Set it to your Render URL (**no trailing slash**):

```js
const API_URL = "https://safal-api.onrender.com";
```

Commit and push:

```bash
git add index.html
git commit -m "Connect site to live API"
git push
```

GitHub Pages redeploys automatically. Now the telemetry panel streams from your server, the live signup count appears, and the form writes real emails to your database. **Full stack, live, $0.** 🎉

---

## 11. Production checklist

- [x] Security headers (helmet), gzip (compression), CORS allow-list
- [x] Rate limiting (global + stricter on the signup route)
- [x] Input validation + payload size limit (16 KB)
- [x] Health (`/api/health`) and readiness (`/api/ready`) endpoints
- [x] Graceful shutdown on SIGTERM/SIGINT
- [x] Secrets kept out of git via `.gitignore`; set in host dashboards, not files
- [x] CI publishes only the static frontend, never backend source
- [x] Frontend honors `prefers-reduced-motion` and scales animation to device
- [ ] **You:** set a real `ALLOWED_ORIGIN` (don't leave it open in production)
- [ ] **You:** (optional) add a custom domain in both Pages and Render

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|--------|--------------------|
| Form says "Couldn't reach the server" | Backend asleep (wait ~30s, retry) **or** `API_URL` is wrong. Open `…/api/health` directly to confirm the backend is up. |
| CORS error in the browser console | `ALLOWED_ORIGIN` on Render must exactly match your site's origin — scheme + host only, e.g. `https://you.github.io` (no trailing path/slash). |
| Live panel shows "simulated" even with a backend | `API_URL` not set, the URL is wrong, or `/api/live` is unreachable — it falls back to simulation by design. Check the browser Network tab. |
| `DB connect failed` / `/api/ready` returns 503 | Check `DATABASE_URL`; make sure `[YOUR-PASSWORD]` was replaced and the Supabase project isn't paused. |
| Pages shows 404 | Settings → Pages → Source must be **GitHub Actions**, and the run in the **Actions** tab must be green. |
| `node: command not found` | Node.js isn't installed. Get the LTS from <https://nodejs.org>, reopen your terminal. |
| Animation heavy on an old phone | It already scales particles to screen size and honors "reduce motion." To go lighter, lower the `N` (core nodes) and `P` (particles) constants near the bottom of `index.html`. |

---

## 13. Where to take it next

- Add admin auth and a small dashboard to view signups (Supabase Auth handles login for you).
- Send a welcome email on signup ([Resend](https://resend.com) / [Postmark](https://postmarkapp.com) have free tiers).
- Replace the **simulated** telemetry in `server.js` (`meshSnapshot`/`meshLog`) with real metrics — the SSE wire format stays the same, so the frontend needs no changes.
- Swap the canvas mesh for your own geometry — it's ~60 lines of plain JS at the bottom of `index.html`.

---

*Built as a $0 full-stack reference: GitHub Pages (frontend) · Render (backend) · Supabase (database).*
