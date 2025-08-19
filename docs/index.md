# Communique Docs

**What this is**: Communique lets people take civic action in seconds.

- Global delivery: Email (countries with public emails) and Certified API/Form (e.g., US CWC); always includes social amplification tools
- Viral pattern generator for platform-native sharing
- Anchoring: Monad primary; optional mirror to ETH L2 (ERC‑8004 registries) when needed

## Start here
- **Dev quickstart**: [dev-quickstart.md](./dev-quickstart.md)
- **Architecture (at a glance)**: [architecture.md](./architecture.md)
- **Integrations**: [integrations.md](./integrations.md)

## Deep dives (optional)
- Vision: [architecture/community-information-theory.md](./architecture/community-information-theory.md)
- Mathematical foundations: [architecture/mathematical-foundations-cid.md](./architecture/mathematical-foundations-cid.md)
- Low‑friction action funnel: [architecture/low-friction-civic-action.md](./architecture/low-friction-civic-action.md)
- UI patterns: [development/ui-structure-guidelines.md](./development/ui-structure-guidelines.md)

If it isn’t linked above, consider it a deep dive.

## Source of truth (code)
- Key routes: `src/routes/`
- Core UI: `src/lib/components/`
- API + server utils: `src/lib/server/`, `src/routes/api/`
- Congressional: `src/lib/congress/`
- Types/stores/utils: `src/lib/types/`, `src/lib/stores/`, `src/lib/utils/`
- Database: Prisma client in `src/lib/server/db.ts` (Supabase Postgres)