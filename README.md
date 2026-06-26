# A | Cap Quiz Bot

NestJS backend for the **A | Cap** Telegram/Bale quiz bot — contact collection, channel join gate, risk-assessment quiz, admin panel, and Mini App.

## Prerequisites

- Node.js 20+
- PostgreSQL (local Docker, [Neon](https://neon.tech), [Supabase](https://supabase.com), or Railway)

## Local setup

```bash
cd nodejs_space
cp .env.example .env
# Edit .env — set DATABASE_URL and bot tokens
npm install
npx prisma db push
npm run build
npm run start:prod
```

Open:

- Landing page: http://localhost:3000
- Health check: http://localhost:3000/health
- Admin panel: http://localhost:3000/admin
- API docs: http://localhost:3000/api-docs

### Database with Docker (optional)

```bash
docker compose up db -d
```

Then set in `.env`:

```
DATABASE_URL=postgresql://quiz:quiz@localhost:5432/quiz_bot?schema=public
```

Run `npx prisma db push` to create tables.

### Development mode

```bash
npm run start:dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Yes | From [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHANNEL_ID` | Yes | Channel username, e.g. `@ecobori` |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Random string for webhook validation |
| `ADMIN_PASSWORD` | Yes | Admin panel password |
| `APP_ORIGIN` | Yes (prod) | Public URL, e.g. `https://your-app.onrender.com` |
| `PORT` | No | Default `3000` |
| `BALE_BOT_TOKEN` | No | Bale messenger bot token |
| `GOOGLE_CREDENTIALS_JSON` | No | Service account JSON for Sheets sync |

## Deploy

### Render

1. Push this repo to GitHub.
2. Create a **Web Service** on [Render](https://render.com) and connect the repo.
3. Render reads `render.yaml` — set all env vars in the dashboard.
4. Add a PostgreSQL database (or use Neon/Supabase) and set `DATABASE_URL`.
5. After deploy, register the Telegram webhook:

```bash
APP_ORIGIN=https://your-app.onrender.com npm run setup:webhook
```

### Railway

1. Create a project on [Railway](https://railway.app).
2. Add PostgreSQL + deploy from GitHub (`nodejs_space` as root directory).
3. Set env vars from `.env.example`.
4. Railway uses `railway.toml` + `Dockerfile`.
5. Run `npm run setup:webhook` with your Railway URL.

### Docker (any VPS)

```bash
docker compose up -d --build
```

The container runs `prisma db push` on startup, then starts the app.

## Telegram webhook

After your app has a public HTTPS URL:

```bash
# Set APP_ORIGIN in .env first
npm run setup:webhook
```

Webhook URL: `{APP_ORIGIN}/webhook/telegram`  
Bale webhook URL: `{APP_ORIGIN}/webhook/bale`

## Project structure

```
src/
  quiz/       Bot conversation flow & scoring
  telegram/   Telegram API + webhook
  bale/       Bale messenger (extends Telegram)
  admin/      Admin panel & CSV export
  webapp/     Telegram Mini App
  sheets/     Google Sheets leaderboard sync
prisma/       Database schema
scripts/      Webhook setup & seed utilities
```
