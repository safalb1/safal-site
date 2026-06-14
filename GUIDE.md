# SAFAL — Full-Stack A→Z Guide

A futuristic animated site (frontend) + a real API (backend) + a database — and exactly how to host all three for **$0**. No prior deployment experience assumed.

---

## 0. What you have

```
safal/
├─ index.html                  ← the site (frontend). Pure HTML/CSS/JS, no build step.
├─ backend/
│  ├─ server.js                ← Express API (the /api/waitlist endpoint)
│  ├─ db.js                    ← PostgreSQL connection
│  ├─ schema.sql               ← the database table
│  ├─ package.json             ← backend dependencies
│  └─ .env.example             ← template for secrets
├─ .github/workflows/deploy.yml ← auto-publishes the site to GitHub Pages
├─ .gitignore
└─ GUIDE.md                    ← this file
```

**Architecture:**

```
   Visitor's browser
        │  loads
        ▼
   index.html  ──── POST /api/waitlist ────►  Express backend  ──►  PostgreSQL
   (GitHub Pages)         (fetch)              (Render)              (Supabase)
   static, free                               free tier             free tier
```

---

## 1. The one thing everyone gets wrong about GitHub

> **GitHub Pages can only host static files** — HTML, CSS, JS, images. It **cannot run a backend server or a database.**

So "host everything on GitHub" isn't possible *for the dynamic parts*. The real, standard, still-free setup is:

| Layer | Where it lives | Cost |
|------|----------------|------|
| Frontend (`index.html`) | **GitHub Pages** (or Vercel / Netlify) | Free |
| Backend (`server.js`) | **Render** (or Railway / Fly.io) | Free |
| Database (PostgreSQL) | **Supabase** (or Neon) | Free |

Your code still lives in **one GitHub repo**. GitHub Pages serves the frontend; Render watches the same repo and runs the backend. That's the whole trick.

**The site works on its own first.** With no backend connected, the form runs in demo mode (it just shows success). Connect the backend later, whenever you want.

---

## 2. Prerequisites (one-time, ~5 min)

1. **A GitHub account** — https://github.com
2. **Git** — https://git-scm.com (check: `git --version`)
3. **Node.js 18+** (only needed to run the backend locally) — https://nodejs.org (check: `node --version`)

---

## 3. See the site right now

Just open `index.html` in any browser. That's it — the animation runs, the form works in demo mode. Nothing to install.

---

## 4. Put it on GitHub

```bash
cd safal
git init
git add .
git commit -m "SAFAL: initial commit"
```

Create an empty repo on GitHub (no README), then:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/safal.git
git push -u origin main
```

---

## 5. Deploy the frontend → GitHub Pages

1. On GitHub: **repo → Settings → Pages**.
2. Under **Source**, choose **GitHub Actions**.
3. Done. The included `deploy.yml` publishes on every push.
4. Your site is live at: `https://YOUR_USERNAME.github.io/safal/`

> Prefer drag-and-drop? **Netlify** or **Vercel**: "Import from GitHub," pick the repo, leave build settings empty (it's static), deploy. Both give instant HTTPS and are free.

**At this point your animated site is live on the internet.** The next sections add the database + backend so the waitlist actually stores emails.

---

## 6. Create the database → Supabase (free)

1. Sign up at https://supabase.com → **New project**. Pick a region near your users; save the database password.
2. Left sidebar → **SQL Editor** → paste the contents of `backend/schema.sql` → **Run**. (Creates the `waitlist` table.)
3. **Project Settings → Database → Connection string → URI.** Copy it. It looks like:
   ```
   postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` with the password from step 1. **This is your `DATABASE_URL`.**

---

## 7. Run the backend locally (optional but recommended)

```bash
cd backend
npm install
cp .env.example .env        # then edit .env, paste your DATABASE_URL
npm run dev
```

You should see `✓ database ready` and `✓ SAFAL API on :8080`. Test it:

```bash
curl -X POST http://localhost:8080/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# → {"ok":true}
```

Check Supabase → **Table Editor → waitlist**: your row is there.

---

## 8. Deploy the backend → Render (free)

1. Sign up at https://render.com → **New → Web Service** → connect your GitHub repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. **Environment → Add Environment Variable:**
   - `DATABASE_URL` = your Supabase URI from step 6
   - `ALLOWED_ORIGIN` = your site URL, e.g. `https://YOUR_USERNAME.github.io`
4. **Create Web Service.** Render gives you a URL like `https://safal-api.onrender.com`.
5. Test it: open `https://safal-api.onrender.com/api/health` → should show `{"ok":true}`.

> Render's free tier sleeps after inactivity, so the first request after a quiet spell takes ~30s to wake. Fine for a waitlist. Railway and Fly.io are alternatives with similar steps.

---

## 9. Connect the site to the backend

Open `index.html`, find this line near the top of the `<script>` section:

```js
const API_URL = ""; // e.g. "https://your-api.onrender.com"
```

Set it to your Render URL — the **base** only, no path, no trailing slash (the
frontend appends `/api/waitlist`, `/api/live`, etc. itself):

```js
const API_URL = "https://safal-api.onrender.com";
```

Commit and push:

```bash
git add index.html && git commit -m "Connect form to live API" && git push
```

GitHub Pages redeploys automatically. The form now writes real emails to your database. **Full stack, live, $0.**

---

## 10. Custom domain (optional)

- **Frontend:** repo → Settings → Pages → Custom domain → enter `yourdomain.com`, then add the DNS records GitHub shows at your registrar. HTTPS is automatic.
- **Backend:** Render → your service → Settings → Custom Domains. Update `API_URL` and `ALLOWED_ORIGIN` to match.

---

## 11. Cost summary

| Service | Free tier covers |
|--------|------------------|
| GitHub Pages | Unlimited static hosting + HTTPS |
| Render | 1 web service, sleeps when idle |
| Supabase | 500MB database, plenty for a waitlist |

Total: **$0** until you have real traffic.

---

## 12. Troubleshooting

- **Form says "Couldn't reach the server"** → backend asleep (wait 30s and retry) or `API_URL` is wrong. Open `/api/health` directly to confirm the backend is up.
- **CORS error in the browser console** → `ALLOWED_ORIGIN` on Render doesn't exactly match your site's origin. It must be the scheme + host, e.g. `https://you.github.io` (no trailing path, no slash).
- **`DB connect failed`** → check `DATABASE_URL`; make sure `[YOUR-PASSWORD]` was replaced and the project isn't paused in Supabase.
- **Pages shows 404** → Settings → Pages → Source must be **GitHub Actions**, and the Actions run must have finished green (check the **Actions** tab).
- **Animation feels heavy on an old phone** → it already scales particle count to screen size and honors "reduce motion" in OS accessibility settings; lower the `N` (core nodes) and `P` (particles) constants in `index.html` if needed.

---

## 13. Where to take it next

- Add a `GET /api/waitlist/count` endpoint and show a live signup count on the site.
- Send a welcome email on signup (Resend / Postmark have free tiers).
- Swap the waitlist for real auth (Supabase Auth handles this for you).
- Replace the canvas core with your own geometry — it's ~40 lines of plain JS at the bottom of `index.html`.
