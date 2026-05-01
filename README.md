# ⚡ IronLog – Workout Tracker PWA

A beautiful, offline-first workout tracking app for yourself and your clients.  
Works on iPhone, Android, and any browser. No App Store needed.

## Features
- 200+ preloaded exercises across 13 muscle groups
- Log sets, reps, and weight with previous performance reference
- Auto rest timer after marking a set done
- Client management — track workouts per client
- Full workout history
- Volume and streak stats
- Add custom exercises
- Export data as JSON
- Works 100% offline after first load

## Deploy to GitHub Pages (Free Hosting)

### Step 1 — Create a GitHub account
Go to [github.com](https://github.com) and sign up (free).

### Step 2 — Create a new repository
1. Click the **+** icon → **New repository**
2. Name it: `ironlog` (or anything you want)
3. Set it to **Public**
4. Click **Create repository**

### Step 3 — Upload these files
**Option A — GitHub Web UI (easiest, no Git needed):**
1. In your new repo, click **uploading an existing file**
2. Drag and drop ALL the files from this folder
3. Also upload the `icons/` folder contents into an `icons/` subfolder
4. Also upload `.github/workflows/deploy.yml` manually
5. Click **Commit changes**

**Option B — Git command line:**
```bash
git init
git add .
git commit -m "Initial IronLog app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ironlog.git
git push -u origin main
```

### Step 4 — Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Wait ~1 minute for deployment
4. Your app URL will be: `https://YOUR_USERNAME.github.io/ironlog/`

### Step 5 — Install on iPhone
1. Open Safari on your iPhone
2. Go to your app URL (e.g. `https://yourname.github.io/ironlog`)
3. Tap the **Share** button (box with arrow)
4. Tap **Add to Home Screen**
5. Tap **Add**
6. Done! The app icon now appears on your home screen

## File Structure
```
ironlog/
├── index.html          Main app HTML
├── style.css           All styles
├── app.js              App logic
├── db.js               IndexedDB database layer
├── exercises.js        200+ exercise database
├── sw.js               Service worker (offline support)
├── manifest.json       PWA manifest
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── .github/
    └── workflows/
        └── deploy.yml  Auto-deploy on push
```

## Tech Stack
- Pure HTML + CSS + Vanilla JavaScript (no frameworks, no build tools)
- IndexedDB for local storage
- Service Worker for offline use
- GitHub Pages for free hosting

## Adding More Features
Since you know Spring Boot — future ideas:
- Add a Spring Boot backend for multi-device sync
- REST API for client portal access
- Push notifications for workout reminders
