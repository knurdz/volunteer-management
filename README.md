# Volunteer Management

Single-repo Next.js project for the IEEE Student Branch University of Moratuwa
Volunteer Management System.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Appwrite Cloud: Auth, TablesDB, Storage, Realtime, Functions, Sites

## Current Status

Feature 1 is implemented: authentication, UoM verification, single Admin access,
Student Branch roles, event-scoped responsibilities, and audit logging.

The revised product scope is internal volunteer management:

- Google login for accounts.
- `@uom.lk` email verification before a user can volunteer.
- One true Admin account that manages all other privileges.
- Student Branch roles: ExCom, SB Lead, SB Member.
- Event roles: Chair, Vice Chair, Committee Lead, Committee Member.
- No university index number validation.
- No in-house form builder.
- SMTP-based UoM verification email sender.
- No public event discovery module.
- Lifetime volunteer points, with monthly/yearly best selections based on points
  earned during those periods.

## Setup

Use Node 22 or newer for local development. The npm scripts set
`FORCE_NODE_FETCH=1` so the Appwrite server SDK works cleanly on Node 26.

Copy `.env.example` to `.env.local` and fill the Appwrite project values before
running the app.

For Google login, create a Google OAuth Web Client and add this authorized
redirect URI in Google Cloud:

```txt
https://YOUR_APPWRITE_REGION.cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/YOUR_APPWRITE_PROJECT_ID
```

Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`, then run:

```bash
npm run setup:appwrite:oauth
```

For UoM verification emails, configure SMTP in `.env`. The app sends email
directly from the Next.js server; no KNURDZ email API is required.

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sender@example.com
SMTP_PASSWORD=your_smtp_password_or_app_password
SMTP_FROM_EMAIL=sender@example.com
SMTP_FROM_NAME=IEEE SB UoM Volunteer Management
```

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev` - local development
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript validation
- `npm run check` - lint and typecheck
- `npm run test` - unit tests
- `npm run setup:appwrite` - create/reuse Appwrite tables
- `npm run setup:appwrite:oauth` - configure Appwrite Google OAuth provider
