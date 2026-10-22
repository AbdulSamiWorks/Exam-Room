# Exam Room

A simple, mobile-first web app for showing test papers to students on their phones.
The teacher uploads a PDF, shares a link, and students read the paper inside the website with a
timer, exit detection and a watermark.

Architecture, decisions and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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

## Deployment

Render (free) + Turso (free). Step-by-step guide will be added in milestone M7.
