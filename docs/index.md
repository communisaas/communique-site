# Communique Docs

**Democracy infrastructure that competes in the attention economy.**

While memecoins hit $40B in 24 hours, civic engagement reads like homework. Communique transforms political participation into instant action that spreads like viral content.

**What this is**: Instant civic action infrastructure, globally.

- **One click, real impact**: Contact representatives in seconds, not hours
- **Global delivery**: US Congress (CWC) today, Westminster tomorrow, new governance forms beyond
- **Viral by design**: Templates that spread through networks like memes
- **VOTER Protocol powered**: Every action earns rewards, builds reputation, creates accountability
- **On-chain verification**: Anchored on Monad with ERC-8004 portable reputation

The US Congressional API is our proof of concept. Parliamentary systems are next. Any governance structure that accepts citizen input can integrate.

## Start here

- **Dev quickstart**: [dev-quickstart.md](./dev-quickstart.md)
- **Architecture (at a glance)**: [architecture.md](./architecture.md)
- **Integrations**: [integrations.md](./integrations.md)

## Deep dives (optional)

- Agent Architecture: [agents/agent-architecture.md](./agents/agent-architecture.md)
- VOTER Blockchain Integration: [integrations/voter-blockchain.md](./integrations/voter-blockchain.md)
- Low-Friction UX: [architecture/low-friction-civic-action.md](./architecture/low-friction-civic-action.md)
- UI patterns: [development/ui-structure-guidelines.md](./development/ui-structure-guidelines.md)

If it isn’t linked above, consider it a deep dive.

## Source of truth (code)

- Key routes: `src/routes/`
- Core UI: `src/lib/components/`
- API + server utils: `src/lib/server/`, `src/routes/api/`
- Congressional: `src/lib/congress/`
- Types/stores/utils: `src/lib/types/`, `src/lib/stores/`, `src/lib/utils/`
- Database: Prisma client in `src/lib/server/db.ts` (Supabase Postgres)
