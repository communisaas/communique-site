# Architecture (at a glance)

## Global Democracy Infrastructure

Communique is governance-neutral infrastructure. US Congress via CWC API is our launch market. Parliamentary systems follow. Any governance structure accepting citizen input can integrate.

## System

- SvelteKit 5 + TypeScript + Tailwind
- Server-rendered app with API routes under `src/routes/api`
- Supabase (Postgres) via Prisma
- Sessions via custom crypto (`@oslojs/crypto`)
- VOTER Protocol integration for rewards and reputation
- Dual agent systems: Template Processing (AI moderation) + VOTER Protocol (blockchain rewards)

## Key flows

**Universal civic action pipeline:**

- Country resolve (SSR) → governance adapter → delivery method
  - Email countries: template resolve → `mailto:` with tracking
  - Certified APIs (US CWC, future Parliamentary): generate compliant forms → verified submission
  - Always: viral pattern generator + VOTER rewards + reputation building

**Governance-specific flows:**

- Congressional (US): address → district → representatives → CWC API → blockchain rewards
- Parliamentary (future): postcode → constituency → MPs → submission API
- Direct Democracy (future): proposal → signature → referendum tracking

**User journey:**

- Onboarding: OAuth-only; 90-day sessions for template-action deep-link flows
- Action: Select template → fill variables → send → earn VOTER → build reputation

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

- Agent Architecture: `docs/agents/agent-architecture.md`
- Two Agent Systems: `docs/agents/two-agent-systems.md`
- VOTER Integration: `docs/integrations/voter-blockchain.md`
- UI: `docs/development/ui-structure-guidelines.md`

## Database configuration

- Prisma uses `DATABASE_URL` at runtime/build time. In this project we set `SUPABASE_DATABASE_URL` and map it to `DATABASE_URL` during build (see `Dockerfile`). For local dev, you can define both or export `DATABASE_URL=$SUPABASE_DATABASE_URL`.
