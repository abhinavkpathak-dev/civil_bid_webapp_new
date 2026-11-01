# CivilBid – Smarter Tenders. Better Decisions.

A React + Vite web application for Government departments, private organizations, and bidders. Data is stored in a live Supabase database with real authentication.

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in the `civilbid` folder (the folder containing this file and `package.json`).
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL printed by Vite. To test on a phone connected to the same Wi-Fi, run `npm run dev -- --host` and open the network URL on the phone.

## Live backend (Supabase)

Accounts, tenders and bids are stored in a live Supabase database (Postgres + Auth + Realtime). Passwords are handled by Supabase Auth, and Row Level Security controls who can read or change each row. Nothing is hardcoded or stored only in the browser.

1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
3. In **Authentication -> Providers -> Email**, turn off **Confirm email** (or keep it on and confirm by email before logging in).
4. In **Project Settings -> API**, copy the **Project URL** and the **anon public key**.
5. Locally, copy `.env.example` to `.env.local` and fill in the two `VITE_SUPABASE_*` values. On Vercel add the same two variables, plus `GEMINI_API_KEY`, under **Settings -> Environment Variables**, then redeploy.

## Build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

## Deploy

### Vercel

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Set the **Root Directory** to `civilbid` if the repository contains the parent folder.
4. Build command: `npm run build`. Output directory: `dist`.
5. Deploy. The included `vercel.json` rewrites application routes to `index.html`.

### GitHub Pages

GitHub Pages can host the static build, but this project currently uses hash-based routes and Vite's default base path. For a repository URL such as `https://USERNAME.github.io/REPOSITORY/`, set Vite's `base` to `'/REPOSITORY/'`, rebuild, then publish the `dist` folder using GitHub Actions. Vercel is the simpler deployment option for this project.

## Known limitations

Role selection at sign-up is self-asserted (there is no official verification of government accounts), and the Copilot chat history is still kept in the browser. Add proper account verification and server-side chat storage before any official use.

## Structure

- `src/main.jsx` — app entry
- `src/App.jsx` — routing, landing pages, authentication screens and workflows
- `src/store.js` — Supabase database, auth and realtime layer
- `src/data.js` — eligibility matching and tender-health calculations
- `supabase/schema.sql` — database tables, security policies and helper functions
- `src/styles.css` — styling and responsive layouts
