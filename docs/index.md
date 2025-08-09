# Communique Docs

**What this is**: Communique lets people take civic action in seconds. Templates resolve on-device and open a mailto with personalized content; for congressional delivery we generate CWC-compliant payloads.

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