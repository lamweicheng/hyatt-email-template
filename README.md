# Hyatt Email Template

Build reusable Hyatt email drafts from selectable topics.

## What is in the app

- An editable default email template with support for `{{topics}}`, `{{managerName}}`, `{{hotelName}}`, and `{{confirmationNumber}}` placeholders.
- A topic library where each topic has a title and content.
- Checkbox selection so only the chosen topic content is inserted into the final email.
- Topic ordering so selected content can appear earlier or later in the final email.
- Popup editors for the base email and topic library, with the landing page focused on preview and selection.
- A live email preview that you can copy and paste.
- Local-first persistence when no database is configured.
- Prisma-backed persistence once `DATABASE_URL` and `DIRECT_URL` are set.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Database setup

The UI works without a database by storing settings in local browser storage. To enable server persistence:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Set the environment variables from `.env.example` before running migrations.

## Template placeholder

Use `{{topics}}` anywhere in the default template to control where selected topic content is inserted. Use `{{managerName}}`, `{{hotelName}}`, and `{{confirmationNumber}}` to place those details explicitly. If the older literal text `[Manager's Name]` is still present in a saved template, the preview also replaces that automatically. If booking-detail placeholders are omitted, the preview appends the missing booking details and selected topic content after the base template.