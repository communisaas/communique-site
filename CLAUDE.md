# CLAUDE.md

Authoritative guide for Claude Code in this repo. Single source of truth.

## Quick start
```bash
npm install
npm run dev        # http://localhost:5173
```

Common:
```bash
npm run build    # prod build
npm run preview  # preview
npm run check    # type + svelte-check
npm run lint     # eslint
npm run test     # integration-first test suite
```

## Environment
Required:
```bash
SUPABASE_DATABASE_URL=...
CWC_API_KEY=...
```

Feature flags (optional):
```bash
ENABLE_BETA=true        # Enable beta features
ENABLE_RESEARCH=true    # Enable research features (dev only)
```

Optional OAuth keys as needed.

## Architecture (at a glance)
- SvelteKit 5 + TypeScript + Tailwind + Feature Flags
- Supabase (Postgres) via Prisma; sessions via `@oslojs/crypto`
- International legislative abstraction (US Congress + UK Parliament + generic)
- Integration-first testing (53→6 tests, smart mocks, fixtures)
- Legislative flow: address verify → adapter selection → country-specific delivery

Code map:
- Routes/API: `src/routes/`
- UI: `src/lib/components/`
- Core production: `src/lib/core/` (auth, db, legislative)
- Feature-flagged: `src/lib/features/` (OFF/BETA/ROADMAP)
- Research/experimental: `src/lib/experimental/` (political field, sheaf theory)
- Tests: `tests/` (integration, unit, e2e, mocks, fixtures)

## Testing (Revolution: 53→6 files)
```bash
npm run test:run         # All tests (production focused)
npm run test:integration # Integration tests (primary)
npm run test:unit        # Critical unit tests only
npm run test:e2e         # End-to-end browser tests
npm run test:production  # Production features only
npm run test:beta        # Include beta features
npm run test:coverage    # With coverage report
```

## Database & Seeding
```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
npm run db:seed          # All seed data
npm run db:seed:core     # Core tables only
npm run db:seed:channels # Legislative channels
```

## Feature Development
```bash
# Check feature status
npm run dev  # See FEATURES.md dashboard

# Enable beta features in development
ENABLE_BETA=true npm run dev

# Enable research features (experimental)  
ENABLE_RESEARCH=true npm run dev
```

## Where to read more
- **Feature Status**: `docs/FEATURES.md`
- **Reorganization Guide**: `docs/REORGANIZATION.md`
- **Test Suite**: `tests/README.md` 
- **Database Seeding**: `docs/DATABASE-SEEDING.md`
- Architecture: `docs/architecture.md`
- Integrations: `docs/integrations.md`