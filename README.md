<p align="center">
  <img src="docs/logo.svg" alt="blocscore" width="420">
</p>

<p align="center">
  <b>A bouldering-gym scoreboard — log your sends, climb through 1000+ achievements, build groups and compete on the leaderboard.</b>
</p>

<p align="center">
  <a href="#-license"><img src="https://img.shields.io/badge/license-GPLv3-blue.svg" alt="GPLv3 License"></a>
  <img src="https://img.shields.io/badge/React-18-61dafb.svg" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-5-646cff.svg" alt="Vite 5">
  <img src="https://img.shields.io/badge/PWA-installable-b8ff00.svg" alt="PWA">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome">
</p>

<p align="center">
  <a href="https://blocscore.de"><b>▶ Live</b></a> ·
  <a href="#-getting-started">Getting started</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-deployment">Deploy</a>
</p>

---

**blocscore** is a fast, mobile-first web app for tracking what you climb in a bouldering gym. Tap a wall on the hall map, log your tops and flashes, watch your skillpoints grow, unlock hundreds of achievements, form groups and battle it out on the leaderboard.

It was originally built for a real gym in Konstanz, Germany — the seed data models that gym's walls and reset schedule — but it works for **any** gym: swap the seed, adjust the wall layout, and you're ready to go.

> **Elevate. Score. Repeat.**

---

## ✨ Features

### 🧗 Routes & logging
- **One-tap logging** — cycle a route through *open → top → flash* straight from the list, or open the editor for details.
- **Per-ascent dates** — every send is timestamped, so your daily/weekly/monthly activity is accurate.
- **Route photos** — attach beta shots; images are downscaled client-side and lazy-loaded.
- **Tips & comments** — leave beta for a route (unlocked via skillpoints).
- **Grades 1–8** with colour coding, nicknames and per-route notes.

### 🗺️ Interactive hall map
- A custom **low-poly, neon-lime floor plan** of the gym.
- Tap a wall (Wettkampfwand, Block, Platte, Trainingsbereich …) to filter routes; the selected wall fills solid lime.
- Training boards (Kilter/Moon) and the kids area are shown for orientation.

### 🏆 Leaderboards
- **Solo** and **group** rankings.
- Three modes: **Current** (active routes), **All-time**, and **Achievements** (skillpoints).
- Flashes, tops and progress bars per climber.

### 👥 Groups
- Create or join groups, with **join requests** and member management (up to 10).
- **Private groups** — tracked among members, hidden from the community ranking.
- Per-group **stats dashboard**: combined totals, member ranking, and a **comparison chart** with a metric toggle (points / tops / flashes / metres).

### 🎖️ Achievements & Skillpoints
Over **1000 generated achievements** across many categories:

| Category | Examples |
| --- | --- |
| **Totals** | 25 → 45 000 routes climbed |
| **Flashes** | first flash → flash legend |
| **Per grade** | *N×* grade-6, flash *N×* grade-7 … |
| **Per colour** | climb / flash N blue, green, red … |
| **Day form** | N routes / flashes in a single day |
| **Special & combos** | rainbow days, all grades in one day |
| **Streets & multiples** | grade ladders, *N* of a kind |
| **Loyalty & endurance** | distinct climbing days, weekly streaks |
| **Mountains & classics** | cumulative metres = Zugspitze, El Cap, Everest … |
| **Speed challenges** | themed one-day pushes |

Earned **skillpoints** unlock app features progressively: emoji packs, route comments, group creation and the route-creator role.

### 📊 Stats
- **Personal**: activity by day / week / month / year, total metres, and a "peaks climbed" mountain tracker.
- **Hall**: overall activity, wall overview, popular routes and setter sessions.
- **Charts** rendered inline.

### 🔐 Roles, auth & privacy
- Roles: **Climber → Route Creator → Admin → Superadmin**.
- **PIN login** with **PBKDF2/SHA-256 hashing** (salted per account) — no plaintext passwords are ever stored.
- **Private mode** for individuals and groups (opt out of public ranking).

### 🌍 Polish
- **Bilingual** UI (Deutsch / English).
- **Installable PWA** — add it to your home screen straight from the app (Chromium) or via Safari's share sheet (iOS).
- Mobile-first, dark theme, custom circular app icon.

---

## 🛠️ Tech stack

- **React 18** + **Vite 5** (single-page app, no router — tab-based navigation)
- **Supabase** as the shared backend (a single key/value table), with **localStorage** for per-device state
- **Web Crypto API** for PIN hashing
- **PWA** (web manifest, installable, custom icons)
- No CSS framework — hand-written styles, SVG illustrations and charts

---

## 🧱 Architecture

blocscore is a **client-side app** with a thin storage adapter:

```
src/
├── App.jsx        # the whole app: UI, state, scoring, achievements, i18n, styles
├── seed.js        # demo gym: walls, routes, reset schedule
├── storage.js     # get/set/delete adapter → Supabase (shared) or localStorage (local)
└── main.jsx       # entry point
```

- **`shared: true`** data (the community: accounts, routes, groups, scores) → **Supabase**, so every device in the gym sees the same board.
- **`shared: false`** data (session, language) → **localStorage**, per browser.

The community is stored as one JSON document. On load, any legacy plaintext PINs are **migrated to hashes automatically** (existing PINs keep working).

---

## 🚀 Getting started

```bash
# 1. clone
git clone https://github.com/manubloc/blocscore.git
cd blocscore

# 2. install
npm install

# 3. run locally
npm run dev        # → http://localhost:5173

# 4. production build
npm run build      # → dist/
npm run preview    # preview the build
```

Without Supabase configured, the app runs fully against **localStorage** with the seed data — perfect for trying it out.

---

## 🌐 Deployment

The repo ships with a GitHub Actions workflow that builds and deploys to **GitHub Pages** on every push to `main`.

### 1. Set up Supabase (one-time, ~5 min)
1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the SQL in [`supabase_setup.sql`](supabase_setup.sql).
3. Copy your **Project URL** and **anon key** from *Settings → API*.

### 2. Add repository secrets
**GitHub → Settings → Secrets and variables → Actions:**

| Secret | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_KEY` | `eyJ…` (anon / public key) |

### 3. Push
Commit to `main` and the workflow deploys automatically. A custom domain (e.g. `blocscore.de`) can be set in *Settings → Pages*.

---

## ⚙️ Configuration

Most gym-specific setup lives in **`src/seed.js`** and a few constants in **`src/App.jsx`**:

| What | Where | Default |
| --- | --- | --- |
| Walls, routes, reset schedule | `seed.js` | demo gym |
| Wall height (metres per route) | `community.wallHeight` | `3.5 m` |
| Scoring (points per grade / flash bonus) | `community.scoring` | `0.25 / 0.25` |
| Skillpoint gates (comments / groups) | `NEED_COMMENT`, `NEED_GROUP` | `100 / 200` |
| Default admin logins | `SEED_COMMUNITY` | see below |

> ⚠️ **Change the default admin & superadmin PINs after first login** (Account → change password). The seed values are placeholders only.

---

## 🔒 Security notes

- **PINs are hashed** (PBKDF2/SHA-256 + per-account salt) — plaintext passwords are never stored or transmitted.
- The Supabase **anon key is public by design** and the data table is readable with it. That means names, scores and *hashes* are technically visible to anyone with the key. Hashes can't be reversed, but **short numeric PINs could be brute-forced offline** — prefer a longer passphrase for admin accounts.
- For true privacy (hiding the data from the public key entirely), move PIN verification to a **Supabase Edge Function** backed by a non-public table with Row Level Security. This is an optional, larger step beyond the default setup.

---

## 🤝 Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

Licensed under the **GNU General Public License v3.0 or later** — see [`LICENSE`](LICENSE).

You are free to use, study, share and modify blocscore; derivative works must remain under the same license.

---

<p align="center"><sub>Built for the climbing community. Elevate. Score. Repeat.</sub></p>
