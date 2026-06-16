<p align="center">
  <img src="docs/logo.svg" alt="blocscore" width="420">
</p>

<p align="center">
  <b>A bouldering-gym scoreboard — log your sends, climb through 1000+ achievements, build groups, and compete on the leaderboard.</b>
</p>

<p align="center">
  <a href="#license"><img src="https://img.shields.io/badge/license-GPLv3-blue.svg" alt="GPLv3 License"></a>
  <img src="https://img.shields.io/badge/React-18-61dafb.svg" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-5-646cff.svg" alt="Vite 5">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome">
</p>

<p align="center">
  <a href="https://manubloc.github.io/blocscore/"><b>▶ Live demo</b></a>
</p>

---

**blocscore** is a fast, mobile-first web app for tracking what you climb in a bouldering gym.
It was originally built as a real-world example for **Boulderhalle Steinbock in Konstanz, Germany** —
the seed data models that gym's walls and reset schedule — but it works for any gym: change the seed
and the wall layout and you're ready to go.

> **Elevate. Score. Repeat.**

## ✨ Features

- **Routes** — interactive top-view gym map, per-area grade bubbles, strong color fields per route, optional short description to tell apart routes of the same colour & grade, auto-generated route names, and per-route comments.
- **Achievements** — 1000+ unlockables across totals, flash, points, per-grade, per-colour, per-wall, combos, daily streaks, "straights" & "multiples", loyalty and **endurance/consistency** (weekly streaks, days-in-window). Each with progress bars and points.
- **Groups / Clans** — create a team (max 10), join by request or invite, group leaderboard.
- **Leaderboard** — solo and group rankings by **current routes**, **all-time**, and **achievement points**.
- **Roles & progression** — *Climber → Route Creator → Admin*. Some features unlock with achievement points: comments (100), creating a group (1000), requesting Route Creator (10000). Admins manage users and roles.
- **Inactivity archiving** — accounts inactive for over a year are auto-archived (removed from scorings) and can be reactivated on request.
- **Bilingual (DE / EN)** — switchable from the login screen and in Account; name generators adapt to the language.
- **Private mode**, profile emojis, changeable passwords.

## 🧱 Tech stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- A single self-contained component (`src/App.jsx`) with an inline design system
- No backend required — persistence via the browser's `localStorage` (`src/storage.js`)

## 🚀 Getting started

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build locally
```

## 🌐 Deployment

### GitHub Pages (included workflow)

1. Push this repository to GitHub on the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every push.
   Your site goes live at **https://manubloc.github.io/blocscore/**.

`vite.config.js` uses `base: "./"`, so it works under a sub-path with no extra configuration.

### Vercel / Netlify

Import the repository, choose the **Vite** preset (build command `npm run build`, output directory `dist`), and deploy.

## 💾 Data & persistence

This app ships with two storage modes — you choose by configuring environment variables:

| Mode | When | What it means |
|---|---|---|
| **localStorage** (default) | `VITE_SUPABASE_URL` not set | Each visitor has their own local board. Great for demos. |
| **Supabase** | Both env vars set | One shared database — everyone sees the same routes, results and rankings. |

### Setting up Supabase (shared gym board, ~10 minutes)

1. Create a **free** project at [supabase.com](https://supabase.com) (no credit card needed).
2. In the Supabase dashboard → **SQL Editor** → paste and run the contents of [`supabase_setup.sql`](supabase_setup.sql). This creates the `blocscore_store` table.
3. Go to **Settings → API** and copy your **Project URL** and **anon/public key**.
4. In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `VITE_SUPABASE_URL` → your project URL (e.g. `https://abcdef.supabase.co`)
   - `VITE_SUPABASE_KEY` → your anon key (`eyJ...`)
5. Trigger a new deploy (push any change, or **Actions → Run workflow**).

That's it — blocscore now uses a real shared database. All climbers log in from their own device and see the same leaderboard.

> **Local development:** copy `.env.example` to `.env` and fill in your Supabase credentials. Vite picks them up automatically.

## 🗂️ Project structure

```
blocscore/
├─ index.html              # entry HTML (loads Google Fonts)
├─ vite.config.js          # base:"./" for sub-path hosting
├─ src/
│  ├─ main.jsx             # mounts the app, wires up window.storage
│  ├─ App.jsx              # the whole app (UI, scoring, i18n, achievements)
│  ├─ seed.js              # demo seed data (gym, walls, routes, accounts)
│  └─ storage.js           # localStorage-backed persistence shim
├─ .github/workflows/      # GitHub Pages deploy workflow
└─ docs/                   # logo / assets
```

## 👤 Accounts

The app ships with a single **admin** account (login `admin`, password `12345`) and no demo users —
a clean slate for a real gym. Climbers simply **sign up** with a name and PIN; usernames are unique
(case-insensitive). Change the admin password under *Account → Change password* after the first login.

> The seed contains the gym's **routes, walls and reset schedule** but no climbing results, so the
> leaderboard starts empty and fills up as people log their sends.

## 🛠️ Adapting it to your gym

The gym-specific bits live in `src/seed.js` and a few constants in `src/App.jsx` (wall codes/names,
grade range, reset dates). Swap the seed, adjust the wall layout, and rebuild.

## 🗺️ Roadmap

- Optional Supabase backend for a shared, multi-device board
- Real authentication
- Photo hold-marking on routes

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md). In short: fork, create a branch,
make your change, run `npm run build` to verify, and open a pull request.

## 📄 License

Released under the **[GNU General Public License v3.0](LICENSE)** (`GPL-3.0-or-later`).

This is a strong copyleft license: you're free to use, study, share and modify the software, but any
distributed work based on it must also be released under the GPLv3 with its source available.

## 🙏 Acknowledgements

Originally created as an example project for **Boulderhalle Steinbock, Konstanz**. Built with React & Vite.
