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

## Codebase structure
- `src/routes/` - SvelteKit routes, pages, and API endpoints.
- `src/lib/core/` - Production-ready code.
  - `auth/` - Authentication and session management.
  - `templates/` - Template creation and delivery.
  - `congress/` - US Congressional features.
  - `api/` - Unified API client.
  - `db.ts` - Database client.
- `src/lib/features/` - Feature-flagged implementations (beta, roadmap).
- `src/lib/experimental/` - Research prototypes.
- `src/lib/shared/` - Shared types, utils, and constants.
- `tests/` - Integration, unit, and e2e tests.

## Env vars
- Required: `SUPABASE_DATABASE_URL`
- Optional: OAuth client IDs/secrets; `CWC_API_KEY`

## Deep dives
- Vision: `docs/architecture/community-information-theory.md`
- Math: `docs/architecture/mathematical-foundations-cid.md`
- Funnel: `docs/architecture/low-friction-civic-action.md`
- UI: `docs/development/ui-structure-guidelines.md`

## Database configuration
- Prisma uses `DATABASE_URL` at runtime/build time. In this project we set `SUPABASE_DATABASE_URL` and map it to `DATABASE_URL` during build (see `Dockerfile`). For local dev, you can define both or export `DATABASE_URL=$SUPABASE_DATABASE_URL`.
