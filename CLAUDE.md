# CLAUDE.md

Authoritative guide for Claude Code in this repo. Single source of truth for cryptographic democratic infrastructure.

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
npm run lint     # eslint with warnings allowed
npm run lint:strict # eslint with zero tolerance (for cleanup)
npm run format   # prettier --write . (auto-fix formatting)
npm run test     # integration-first test suite
```

## Code Quality Standards

### ESLint & TypeScript Rules

- **No `any` types** - Use `unknown`, `object`, or proper interfaces (downgraded to warnings during cleanup)
- **Prefix unused parameters** with `_` (e.g., `_error`, `_event`, `_config`)
- **Remove unused imports** - Clean imports before commits
- **Use ES6 imports** - Convert `require()` to `import` statements
- **Proper error handling** - Name error parameters consistently

### Pre-commit Checklist

```bash
npm run format     # Auto-fix formatting
npm run lint       # Check for violations (warnings OK during cleanup)
npm run check      # TypeScript validation
npm run build      # Verify build succeeds
npm run test:run   # Run test suite
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

## Architecture (Cypherpunk Democratic Infrastructure)

- SvelteKit 5 + TypeScript + Tailwind + Algorithmic Coordination
- Supabase (Postgres) via Prisma; cryptographic sessions via `@oslojs/crypto`
- VOTER Protocol integration: Didit.me zero-knowledge verification + algorithmic treasury execution
- International legislative abstraction (US Congress + UK Parliament + generic)
- Integration-first testing (53→6 tests, smart mocks, fixtures)
- Cryptographic flow: identity verify → algorithmic certification → autonomous reward distribution

Code map:

- Routes/API: `src/routes/`
- UI: `src/lib/components/`
- Core production: `src/lib/core/` (auth, db, legislative)
- Agent Infrastructure: `src/lib/agents/` (cryptographic coordination, algorithmic verification)
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
