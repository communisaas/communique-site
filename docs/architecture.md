# Architecture (at a glance)

## System
- SvelteKit 5 + TypeScript + Tailwind
- Server-rendered app with API routes under `src/routes/api`
- CockroachDB via Prisma
- Sessions via custom crypto (`@oslojs/crypto`)

## Key flows
- Template preview → resolve on client → `mailto:` open
- Congressional: address verify → reps lookup → CWC generate → delivery
- Onboarding: OAuth-only; 90-day sessions for social funnel

## Core modules
- UI: `src/lib/components/`
- Stores: `src/lib/stores/`
- Utils: `src/lib/utils/` (browser utils, timers, API client)
- Server: `src/lib/server/` (analytics, auth, civic)
- Congress: `src/lib/congress/` (address lookup, CWC)

## Env vars
- Required: `DATABASE_URL`, `CONGRESS_API_KEY`
- Optional: OAuth client IDs/secrets; `GOOGLE_CIVIC_API_KEY`

## Deep dives
- Vision: `docs/architecture/community-information-theory.md`
- Math foundations: `docs/architecture/mathematical-foundations-cid.md`
- Pipeline trace: `docs/architecture/MATHEMATICAL_PIPELINE_TRACE.md`
- Social funnel: `docs/architecture/SOCIAL_MEDIA_FUNNEL.md`

## Directory basics
- Routes: `src/routes/` (pages + API)
- Lib: `src/lib/` (components, server, types, stores, utils)
- Tests: `src/**/*.test.ts`, `e2e/`
