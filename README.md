# Communiqué

**Multi-stakeholder cryptographic social coordination infrastructure.**

Communiqué enables accountability across ALL power structures—not just government. Using zero-knowledge proofs, encrypted delivery, and on-chain reputation, citizens coordinate action against Congress, corporate executives, landlords, HOAs, universities, hospitals, school boards, and nonprofits. All powered by [VOTER Protocol](https://github.com/communisaas/voter-protocol) blockchain settlement.

**Phase 1 (Current):** Reputation-only. Zero-knowledge verification, encrypted delivery, on-chain reputation tracking. No token.

**Phase 2 (12-18 months):** Token rewards, challenge markets, outcome markets powered by multi-agent treasury management.

---

## Quick Start

```bash
git clone https://github.com/communisaas/communique-site.git
cd communique-site
npm install
npm run dev        # http://localhost:5173
```

**Environment setup:** Create `.env` with database URL and at least one OAuth provider. See [docs/integration.md](./docs/integration.md) for complete setup.

---

## Phase Roadmap

**Phase 1 (Current):** Reputation-only. Zero-knowledge verification, encrypted delivery, on-chain reputation tracking. No token.

**Phase 2 (12-18 months):** Token rewards, challenge markets, outcome markets.

**Budget:** $326/month for 1,000 users / 10,000 messages (Phase 1)

---

## Documentation

| Topic                     | Location                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Getting Started**       | [Quick Start](#quick-start) (above)                                                                  |
| **Architecture**          | [docs/architecture.md](./docs/architecture.md) - System design, Communiqué/voter-protocol separation |
| **Frontend Patterns**     | [docs/frontend.md](./docs/frontend.md) - SvelteKit 5, runes, component composition                   |
| **Integration Guide**     | [docs/integration.md](./docs/integration.md) - OAuth, CWC API, identity verification, blockchain     |
| **Implementation Status** | [docs/implementation-status.md](./docs/implementation-status.md) - What's done, what remains         |
| **Development Guide**     | [CLAUDE.md](./CLAUDE.md) - Authoritative development standards (type safety, testing)                |
| **All Documentation**     | [docs/README.md](./docs/README.md) - Complete documentation map                                      |

### Key Documentation

**Understanding the System:**

- [docs/architecture.md](./docs/architecture.md) - Communiqué/voter-protocol separation, privacy architecture
- [docs/architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md](./docs/architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md) - Location signal accuracy (IP = state only)
- [docs/research/power-structures.md](./docs/research/power-structures.md) - ALL power structures we coordinate against
- [docs/design/voice.md](./docs/design/voice.md) - Pragmatic cypherpunk voice guide

**Building Features:**

- [docs/features/templates.md](./docs/features/templates.md) - Template system (creation, customization, moderation)
- [docs/features/identity-verification.md](./docs/features/identity-verification.md) - self.xyz + Didit.me flows
- [docs/features/jurisdiction.md](./docs/features/jurisdiction.md) - Jurisdiction system
- [docs/features/oauth.md](./docs/features/oauth.md) - OAuth flows (5 providers)

**Development:**

- [docs/development/testing.md](./docs/development/testing.md) - Integration-first test strategy
- [docs/development/database.md](./docs/development/database.md) - Prisma schema, migrations, seeding
- [docs/development/deployment.md](./docs/development/deployment.md) - Production deployment workflow

**Deep Technical Specs:**

- [docs/specs/zk-proof-integration.md](./docs/specs/zk-proof-integration.md) - ZK proof integration (5 phases, 45K guide)
- [docs/specs/portable-identity.md](./docs/specs/portable-identity.md) - IPFS + on-chain pointer architecture
- [docs/specs/universal-credibility.md](./docs/specs/universal-credibility.md) - Credential verification system

---

## Tech Stack

**Frontend:**

- SvelteKit 5, TypeScript (strict), Tailwind CSS
- Vitest (integration-first testing), Playwright (e2e)

**Backend:**

- Neon Postgres via Prisma
- @oslojs/crypto (cryptographic sessions)
- CWC API (congressional delivery)
- Census Bureau Geocoding API (district lookup)

**Identity & Privacy:**

- self.xyz + Didit.me (FREE identity verification)
- Browser-native ZKPs (Noir/UltraHonk, 600ms-10s proving)
- XChaCha20-Poly1305 (end-to-end encryption)

**Blockchain (via voter-protocol):**

- Scroll zkEVM (settlement layer)
- Noir/UltraHonk proofs (zero-knowledge)
- ERC-8004 reputation tracking

**Deployment:**

- Fly.io (production + staging)
- GitHub Actions (CI/CD)

---

## What Communiqué Is

Communiqué is the **frontend application** for VOTER Protocol's cryptographic infrastructure. Users interact with Communiqué. The blockchain settlement, zero-knowledge proofs, and economic mechanisms live in [voter-protocol](https://github.com/communisaas/voter-protocol).

**What Communiqué handles:**

- Template browsing, creation, customization
- OAuth authentication (5 providers)
- Address validation → congressional district lookup
- Browser-native ZK proofs (Noir/UltraHonk, 600ms-10s proving)
- Multi-target delivery (Congress + corporations + HOAs + schools + nonprofits)
- 3-layer content moderation (OpenAI + Gemini/Claude)
- Encrypted message delivery

**What voter-protocol handles:**

- Smart contracts on Scroll zkEVM
- Noir/UltraHonk ZK proof verification on-chain
- ERC-8004 on-chain reputation
- Multi-agent treasury management (Phase 2)
- Token economics, challenge markets, outcome markets (Phase 2)

**See [voter-protocol/README.md](https://github.com/communisaas/voter-protocol) for complete vision, cryptography, and economic architecture.**

---

## User Flow (Phase 1)

1. **Browse templates** - Filter by power structure (Congress, corporate, landlord, school, etc.)
2. **OAuth login** - One of 5 providers (Google/Facebook/Twitter/LinkedIn/Discord)
3. **Address collection** - Census Bureau geocoding → district lookup
4. **Customize template** - Fill variables, add personal connection
5. **Generate ZK proof** - Browser-native Noir/UltraHonk proving (600ms-10s device-dependent)
   - Modern desktop: 600-800ms
   - Recent mobile: 2-3s
   - Budget mobile: 5-10s
   - Address never leaves browser, never sent to any server
6. **Encrypt message** - XChaCha20-Poly1305 encryption in browser
7. **Deliver message** - Encrypted → CWC API → decision-maker office
8. **Build reputation** - On-chain ERC-8004 reputation tracking
9. **Earn rewards** - Token rewards launch in Phase 2 (12-18 months)

**Zero-knowledge guarantee:** Your address is used to generate a Noir/UltraHonk proof entirely in browser (WASM). Address never leaves your device, never sent to any server. Decision-makers verify proof on-chain (~60-100k gas, ~$0.002 per verification).

**Encrypted delivery:** Message plaintext exists only in: your browser → delivery API → decision-maker CRM. Platform operators cannot read messages.

---

## Development

### Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Production build
npm run preview          # Preview production build

# Code Quality (MUST pass before commit)
npm run format           # Prettier auto-fix
npm run lint             # ESLint with warnings allowed
npm run lint:strict      # Zero-tolerance ESLint (CI requirement)
npm run check            # TypeScript + Svelte validation

# Testing
npm run test             # All tests (integration + unit)
npm run test:run         # No watch mode
npm run test:e2e         # Playwright browser tests
npm run test:coverage    # With coverage report

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database (dev)
npm run db:migrate       # Create/run migrations (production)
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed sample data
```

### Code Quality Standards

**ZERO TOLERANCE POLICY:**

- No `any` types
- No `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`
- No type suppression
- All function parameters/returns explicitly typed
- All tests must pass before commit

**Pre-commit requirement:** `npm run format && npm run lint:strict && npm run check && npm run build && npm run test:run` must return 0 errors.

See [CLAUDE.md](./CLAUDE.md) for complete code quality standards.

---

## Project Structure

```
src/
├── routes/                    # SvelteKit routes (pages + API)
│   ├── api/                   # API endpoints
│   │   ├── agents/            # Content moderation
│   │   ├── address/           # District lookup
│   │   ├── blockchain/        # voter-protocol queries
│   │   └── templates/         # Template CRUD
│   ├── auth/                  # OAuth callbacks
│   └── onboarding/            # User onboarding
│
├── lib/
│   ├── components/            # Svelte components (domain-organized)
│   │   ├── auth/              # OAuth, verification flows
│   │   ├── template/          # Browse, create, customize
│   │   ├── analytics/         # Funnel tracking
│   │   └── ui/                # Design system components
│   │
│   ├── core/                  # Core production infrastructure
│   │   ├── auth/              # Session management
│   │   ├── analytics/         # Database analytics
│   │   ├── blockchain/        # voter-protocol integration
│   │   ├── congress/          # CWC delivery
│   │   ├── legislative/       # Multi-target delivery
│   │   └── server/            # Server-side utilities
│   │
│   ├── agents/                # Multi-agent systems
│   │   ├── content/           # Template moderation (3-layer)
│   │   └── voter-protocol/    # Reward calculation (Phase 2)
│   │
│   ├── stores/                # Svelte 5 runes-based state
│   ├── utils/                 # Utilities
│   ├── types/                 # TypeScript definitions
│   └── features/              # Feature-flagged beta features
│
├── app.html                   # HTML template
└── app.css                    # Global styles + Tailwind

docs/                          # Documentation
prisma/                        # Database schema + migrations
tests/                         # Integration, unit, e2e tests
```

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. **MUST pass before commit:**
   ```bash
   npm run format && npm run lint:strict && npm run check && npm run build && npm run test:run
   ```
4. Commit with conventional commits: `feat: add amazing feature`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

**Code quality standards:** See [CLAUDE.md](./CLAUDE.md). Any PR with type violations will be instantly rejected.

---

## License

[MIT License](./LICENSE)

---

_Communiqué PBC | Multi-Stakeholder Cryptographic Social Coordination | 2025_
