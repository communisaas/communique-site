# Architecture (at a glance)

## System
- SvelteKit 5 + TypeScript + Tailwind
- Server-rendered app with API routes under `src/routes/api`
- Supabase (Postgres) via Prisma
- Sessions via custom crypto (`@oslojs/crypto`)

## Key flows
- Template preview → resolve on client → `mailto:` open
- Congressional: address verify → reps lookup → CWC generate → delivery
- Onboarding: OAuth-only; 90-day sessions for template-action deep-link flows

## Core modules
- UI: `src/lib/components/`
- Stores: `src/lib/stores/`
- Utils: `src/lib/utils/` (browser utils, timers, API client)
- Server: `src/lib/server/` (analytics, auth, civic)
- Congress: `src/lib/congress/` (address lookup, CWC)

## Env vars
- Required: `SUPABASE_DATABASE_URL`, `CONGRESS_API_KEY`
- Optional: OAuth client IDs/secrets; `GOOGLE_CIVIC_API_KEY`

## Deep dives
- Vision: `docs/architecture/community-information-theory.md`
- Mathematical foundations: `docs/architecture/mathematical-foundations-cid.md`
- Low‑friction action funnel: `docs/architecture/low-friction-civic-action.md`
- UI patterns: `docs/development/ui-structure-guidelines.md`

## Directory basics
- Routes: `src/routes/` (pages + API)
- Lib: `src/lib/` (components, server, types, stores, utils)
- Tests: `src/**/*.test.ts`, `e2e/`

## Database configuration
- Prisma uses `DATABASE_URL` at runtime/build time. In this project we set `SUPABASE_DATABASE_URL` and map it to `DATABASE_URL` during build (see `Dockerfile`). For local dev, you can define both or export `DATABASE_URL=$SUPABASE_DATABASE_URL`.
