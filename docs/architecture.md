# Architecture (at a glance)

## System
- SvelteKit 5 + TypeScript + Tailwind
- Server-rendered app with API routes under `src/routes/api`
- Supabase (Postgres) via Prisma
- Sessions via custom crypto (`@oslojs/crypto`)

## Key flows
- Country resolve (SSR) → choose delivery method
  - Email countries: template resolve → `mailto:` open
  - Certified (e.g., US CWC): generate and submit required forms
  - Always: viral pattern generator for platform-native sharing
- Congressional (US): address verify → reps lookup → CWC generate → delivery
- Onboarding: OAuth-only; 90-day sessions for template-action deep-link flows

## Core modules
- UI: `src/lib/components/`
- Stores: `src/lib/stores/`
- Utils: `src/lib/utils/` (browser utils, timers, API client)
- Server: `src/lib/server/` (analytics, auth, civic)
- Congress: `src/lib/congress/` (address lookup, CWC)

## Env vars
- Required: `SUPABASE_DATABASE_URL`
- Optional: OAuth client IDs/secrets; `CWC_API_KEY`, `PUBLIC_POSTHOG_*`

## Deep dives
- Vision: `docs/architecture/community-information-theory.md`
- Math: `docs/architecture/mathematical-foundations-cid.md`
- Funnel: `docs/architecture/low-friction-civic-action.md`
- UI: `docs/development/ui-structure-guidelines.md`

## Directory basics
- Routes: `src/routes/` (pages + API)
- Lib: `src/lib/` (components, server, types, stores, utils)
- Tests: `src/**/*.test.ts`, `e2e/`

## Database configuration
- Prisma uses `DATABASE_URL` at runtime/build time. In this project we set `SUPABASE_DATABASE_URL` and map it to `DATABASE_URL` during build (see `Dockerfile`). For local dev, you can define both or export `DATABASE_URL=$SUPABASE_DATABASE_URL`.
