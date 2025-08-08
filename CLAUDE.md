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
npm run test     # unit + e2e
```

## Environment
Required:
```bash
DATABASE_URL=...
CONGRESS_API_KEY=...
```
Optional OAuth keys as needed.

## Architecture (at a glance)
- SvelteKit 5 + TypeScript + Tailwind
- CockroachDB via Prisma; sessions via `@oslojs/crypto`
- Client-side template resolution → `mailto:`
- Congressional flow: address verify → reps lookup → CWC XML

Code map:
- Routes/API: `src/routes/`
- UI: `src/lib/components/`
- Server utils: `src/lib/server/`
- Congress: `src/lib/congress/`
- Types/stores/utils: `src/lib/types/`, `src/lib/stores/`, `src/lib/utils/`

## Database
```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
```

## Where to read more
- Dev quickstart: `docs/dev-quickstart.md`
- Architecture: `docs/architecture.md`
- Integrations: `docs/integrations.md`