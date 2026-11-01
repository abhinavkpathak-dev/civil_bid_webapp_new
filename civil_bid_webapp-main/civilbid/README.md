# CivilBid – Smarter Tenders. Better Decisions.

A React + Vite web application for Government departments, private organizations, and bidders. The application currently stores account and workflow data in the browser with `localStorage`; it is not yet backed by a secure production database or authentication service.

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in the `civilbid` folder (the folder containing this file and `package.json`).
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL printed by Vite. To test on a phone connected to the same Wi-Fi, run `npm run dev -- --host` and open the network URL on the phone.

## Accounts

Use the sign-up pages to create a local account. Accounts are stored only in that browser and will not sync between devices or browsers. Do not use real personal, financial, or government credentials in this application.

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

## Important production limitations

This is a front-end application, not yet a production-ready procurement system. Authentication is currently client-side, and data is stored in `localStorage`, which users can inspect or modify. Before public or official use, implement server-side authentication, password hashing, role-based authorization, a database, secure document upload/storage, audit logging, and server-side validation. Never put secrets or API keys in front-end code.

## Structure

- `src/main.jsx` — app entry
- `src/App.jsx` — routing, landing pages, authentication screens and workflows
- `src/data.js` — sample tender data and scoring calculations
- `src/styles.css` — styling and responsive layouts
