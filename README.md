# Hyatt Tier List

Rank Hyatt hotels across five tiers: S, A, B, C, and D. The app ships with a curated 38-brand Hyatt portfolio, assigns each brand its own color, and supports add/edit flows from a single modal.

## What is in the app

- A redesigned homepage with a luxury-inspired Hyatt-style UI.
- Tier rows that update immediately when a hotel is added or edited.
- A shared modal for both create and edit actions.
- Local-first persistence when no database is configured.
- Prisma-backed API routes ready for Vercel + Postgres once `DATABASE_URL` and `DIRECT_URL` are set.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Database setup

The UI works without a database by storing entries in local browser storage. To enable server persistence:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Set the environment variables from `.env.example` before running migrations.