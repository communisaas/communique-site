# Development Documentation

**Setup, database, testing, deployment, and code maintenance.**

---

## Getting Started

### 1. [quickstart.md](quickstart.md) - Development Setup

Install dependencies, run dev server, common commands.

**Start here**: `npm install` → `npm run dev` → http://localhost:5173

**Commands**:
- `npm run dev` - Dev server
- `npm run build` - Production build
- `npm run test` - Test suite
- `npm run check` - Type checking

### 2. [schema.md](schema.md) - Database Schema

Prisma schema, zero-knowledge fields, relationships, migrations.

**What it documents**: User, Template, Submission, Analytics models.

**Key insight**: We store commitment hashes, not plaintext location data.

**Cross-reference**: `/prisma/schema.prisma`

### 3. [seeding.md](seeding.md) - Database Seeding

Test data generation, seed scripts, development fixtures.

**Commands**:
- `npm run db:seed` - Seed test data
- `npm run db:push` - Push schema changes (dev)
- `npm run db:migrate` - Create migration (production)

---

## Testing & Quality

### 4. [testing.md](testing.md) - Test Strategy

Integration-first testing, smart mocks, test fixtures.

**Philosophy**: Integration tests > unit tests. Test user flows, not implementation details.

**Test types**:
- Integration tests (53 → 6 consolidated)
- Unit tests (template resolution, analytics)
- E2E tests (Playwright, critical user paths)

**Commands**:
- `npm run test` - All tests
- `npm run test:integration` - Integration only
- `npm run test:e2e` - E2E browser tests

### 5. [flags.md](flags.md) - Feature Flags

Beta feature toggles, environment-based configuration.

**Environment variables**:
- `ENABLE_BETA=true` - Enable beta features
- `NODE_ENV=production` - Production mode

**Feature flags**:
- AI template suggestions (beta)
- Semantic search (beta)
- Gamification/leaderboards (planned)

---

## Monitoring & Analytics

### 6. [analytics.md](analytics.md) - Analytics Tracking

Funnel tracking, event logging, database analytics.

**What we track**:
- Template views → customizations → submissions
- OAuth conversion rates
- Search queries → template clicks
- User retention cohorts

**Privacy**: All analytics are aggregate. No individual tracking without consent.

### 7. [deployment.md](deployment.md) - Production Checklist

Pre-deployment verification, production build, environment checks.

**Before deploying**:
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes
- [ ] `npm run check` (type checking)
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Feature flags configured

---

## Code Maintenance

### 8. [maintenance.md](maintenance.md) - Code Health

Linting, formatting, dependency updates, tech debt tracking.

**Commands**:
- `npm run lint` - ESLint
- `npm run format` - Prettier
- `npm run check` - TypeScript + Svelte validation

**Standards**:
- Zero ESLint errors (CI enforced)
- Prettier for formatting (no debates)
- TypeScript strict mode
- No `any` types (use proper types or `unknown`)

### 9. [ownership.md](ownership.md) - Component Ownership

Code ownership map, who maintains what, escalation paths.

**Structure**:
- `/src/lib/components/auth/` - Authentication team
- `/src/lib/components/template/` - Template team
- `/src/lib/core/` - Platform team
- `/src/routes/` - Feature teams

---

## Architecture Cross-References

**TEE systems** → See `/docs/architecture/tee.md`

**VOTER Protocol integration** → See `/docs/INTEGRATION-GUIDE.md`

**Congressional delivery** → See `/docs/congressional/`

**Frontend architecture** → See `/docs/FRONTEND-ARCHITECTURE.md`

---

## Development Workflow

### Daily Development

1. **Pull latest**: `git pull`
2. **Install deps**: `npm install` (if package.json changed)
3. **Run dev server**: `npm run dev`
4. **Make changes**
5. **Run tests**: `npm run test`
6. **Type check**: `npm run check`
7. **Commit**: `git commit -m "feat: description"`

### Before Creating PR

1. **Run full test suite**: `npm run test:run`
2. **Type check**: `npm run check`
3. **Lint**: `npm run lint`
4. **Build**: `npm run build`
5. **Format**: `npm run format`

**All must pass** or PR will be rejected by CI.

### Database Changes

1. **Modify schema**: Edit `/prisma/schema.prisma`
2. **Generate client**: `npm run db:generate`
3. **Push changes (dev)**: `npm run db:push`
4. **Create migration (prod)**: `npm run db:migrate`
5. **Update seed data**: Edit `/scripts/seed-database.ts`

---

## For New Developers

**First day**:
1. Read quickstart.md
2. Run `npm install && npm run dev`
3. Browse codebase in `/src/lib/`
4. Read schema.md (understand data model)
5. Run test suite (`npm run test`)

**First week**:
1. Pick "good first issue" from GitHub
2. Read relevant docs in `/docs/features/`
3. Make PR following development workflow above
4. Get code review feedback
5. Ship feature

**First month**:
1. Read FRONTEND-ARCHITECTURE.md (SvelteKit 5 patterns)
2. Read CYPHERPUNK-ARCHITECTURE.md (product philosophy)
3. Understand TEE architecture (`/docs/architecture/`)
4. Take ownership of a component (see ownership.md)

---

## Common Tasks

**Add new feature**:
1. Create feature flag in flags.md
2. Add database schema in schema.prisma
3. Create UI components in `/src/lib/components/`
4. Add API routes in `/src/routes/api/`
5. Write integration tests
6. Document in `/docs/features/`

**Fix bug**:
1. Write failing test that reproduces bug
2. Fix bug
3. Verify test passes
4. Check no regressions (`npm run test:run`)
5. Create PR

**Refactor code**:
1. Write tests for current behavior
2. Refactor
3. Verify tests still pass
4. Check type safety (`npm run check`)
5. Update docs if behavior changed

---

## Emergency Procedures

**Production is down**:
1. Check Fly.io logs: `fly logs`
2. Check database connection
3. Check environment variables
4. Rollback deploy if needed: `fly releases list` → `fly rollback`

**Database migration failed**:
1. Check migration status: `npx prisma migrate status`
2. Rollback: `npx prisma migrate resolve --rolled-back`
3. Fix migration file
4. Retry: `npm run db:migrate`

**Tests failing in CI but passing locally**:
1. Check Node version matches CI (see `.github/workflows/`)
2. Check environment variables
3. Run `npm ci` (clean install)
4. Check for race conditions in tests
