# Exam Room

A simple, mobile-first web app for showing test papers to students on their phones.
The teacher uploads a PDF, shares a link, and students read the paper inside the website with a
timer and exit detection.

Architecture, decisions and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## How it works

1. **Teacher** logs in and opens **Manage** once to add classes, their subjects and chapters, and
   the students (one by one or a pasted list). Every student gets a 6-digit PIN, shown once.
2. The teacher taps **New test**, picks the PDF, class, subject, chapters, title, time limit and
   allowed exits (0, 1 or 2). The PDF is turned into page images in the teacher's browser.
3. The test page shows a link and a code. Send the link with **Copy link** or **Send on WhatsApp**.
4. **Student** logs in once with class, roll number and PIN (the phone stays logged in for 60
   days), opens the test from the student home or the link and taps **Start test**. The timer
   starts and never stops.
5. If the student leaves the page or switches apps, a red warning appears. After the allowed
   exits the test locks. The teacher can tap **Unlock** in the results.
6. The student taps **Finish**, or the test is submitted when the time is up. After that the paper
   cannot be opened again.
7. The teacher's results list updates every 5 seconds.

## Requirements

- Node.js 22 (see `.nvmrc`)

## Run locally

```bash
npm install
cp .env.example .env     # then edit values if needed
npm run dev
```

- Web app: http://localhost:5173 (API calls are proxied to the server)
- API server: http://localhost:3000
- On a phone on the same Wi-Fi: use the "Network" address Vite prints, e.g. `http://192.168.x.x:5173`
  (keeping the screen on and fullscreen need HTTPS, so check those on the Render site)
- Teacher password: the `TEACHER_PASSWORD` value in `.env`

## Scripts

| Command          | What it does                                         |
| ---------------- | ---------------------------------------------------- |
| `npm run dev`    | Server (auto-restart) + web app (hot reload)         |
| `npm run build`  | Type-check, then build web and server for production |
| `npm start`      | Run the production build (serves API + web app)      |
| `npm test`       | Run tests                                            |
| `npm run check`  | Type-check + lint + format check + tests             |
| `npm run format` | Format all files with Prettier                       |

## Project layout

```
shared/   API types used by both sides (types only)
server/   Node + Express API, serves the built web app in production
web/      React + Vite app (teacher and student pages)
docs/     Architecture and decisions
```

## Deploy for free (Render + Turso)

Both services are free and need no credit card for this size (Render may sometimes ask to verify
the account with a card; it is not charged).

### 1. Create the database on Turso

1. Sign up at https://turso.tech (GitHub login is fine).
2. Create a database, for example `exam-room`. Choose the location closest to Singapore
   (for example Mumbai or Singapore), because the server runs in Render's Singapore region.
3. Copy the database URL. It looks like `libsql://exam-room-<your-name>.turso.io`.
4. Create a token for the database and copy it.

The server creates all tables itself on the first start.

### 2. Create the web service on Render

1. Sign up at https://render.com with GitHub.
2. Click **New** → **Blueprint** and choose the `Exam-Room` repository. Render reads `render.yaml`.
3. Fill in the values Render asks for:
   - `TEACHER_PASSWORD`: the password you will use to log in (at least 8 characters)
   - `DATABASE_URL`: the Turso URL from step 1
   - `DATABASE_AUTH_TOKEN`: the Turso token from step 1
   - `SESSION_SECRET` is created by Render automatically.
   - The fingerprint login uses the `onrender.com` address that Render gives automatically. Only
     if you later use your own domain, set `PUBLIC_ORIGIN` to it (students then set up the
     fingerprint again).
4. Click **Apply**. The first build takes a few minutes.
5. Open the `https://exam-room-....onrender.com` address and log in as the teacher.

Every push to `main` deploys again automatically.

### Before every exam

- The free service sleeps after 15 minutes without visitors, and the first visit then takes about
  one minute. **Open the site 2–3 minutes before the exam starts.** During the exam the students
  keep it awake.
- Restarts never lose data: everything lives in the Turso database.

### Test on real phones before the first real exam

Follow the step-by-step list in [docs/DEVICE-CHECKS.md](docs/DEVICE-CHECKS.md) on an Android
phone (Chrome) and an iPhone (Safari), on the Render HTTPS address.
