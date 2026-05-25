# Volunteer Management

Single-repo Next.js project for the IEEE Student Branch University of Moratuwa
Volunteer Management System.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Appwrite Cloud: Auth, TablesDB, Storage, Realtime, Functions, Sites

## Current Status

This repo is at Sprint 0 foundation status. Product features are intentionally
not implemented yet.

The revised product scope is internal volunteer management:

- Google login for accounts.
- `@uom.lk` email verification before a user can volunteer.
- One true Admin account that manages all other privileges.
- Student Branch roles: ExCom, SB Lead, SB Member.
- Event roles: Chair, Co Chair, Event Member.
- No university index number validation.
- No in-house form builder.
- No in-house email sender.
- No public event discovery module.
- Lifetime volunteer points, with monthly/yearly best selections based on points
  earned during those periods.

## Setup

Copy `.env.example` to `.env.local` and fill the Appwrite project values before
running the app.

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
