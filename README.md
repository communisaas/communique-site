# Communiqué: VOTER Protocol Frontend

**The user-facing application for cryptographic civic engagement.**

Turn-key congressional delivery via CWC API. OAuth-powered onboarding. Zero-knowledge district verification in browser. Template system with 3-layer content moderation. All powered by [VOTER Protocol](https://github.com/communisaas/voter-protocol) blockchain infrastructure.

**Phase 1 (3 months to launch):** Reputation-only. Cryptographic verification, encrypted delivery, quality signals for congressional offices. No token.

**Phase 2 (12-18 months):** Token rewards, challenge markets, outcome markets.

---

## What This Is

Communiqué is the **frontend application** that implements VOTER Protocol's cryptographic infrastructure. Users interact with Communiqué. The blockchain settlement, zero-knowledge proofs, and economic mechanisms live in [voter-protocol](https://github.com/communisaas/voter-protocol).

**What Communiqué handles:**

- Template browsing, creation, and customization
- OAuth authentication (Google, Facebook, Twitter, LinkedIn, Discord)
- Address validation and congressional district lookup
- Halo2 zero-knowledge proofs (600ms-10s device-dependent browser-native proving)
- Message delivery via CWC API (congressional offices)
- 3-layer content moderation (OpenAI + Gemini/Claude + human)
- Encrypted message delivery to congressional offices (hardware-attested encryption)

**What voter-protocol handles:**

- Smart contracts on Scroll zkEVM
- Halo2 zero-knowledge proof verification (no trusted setup)
- On-chain reputation (ERC-8004 portable credibility)
- Multi-agent treasury management (Phase 2)
- Challenge markets and outcome markets (Phase 2)

**See [voter-protocol/README.md](https://github.com/communisaas/voter-protocol) for the complete vision, cryptography, and economic architecture.**

---

## Architecture (Phase 1)

**What ships in 3 months:**

```
Browser (Client-Side)
├─ OAuth login (5 providers)
├─ Address collection → Census Bureau geocoding
├─ Template selection → Variable customization
├─ Shadow Atlas witness generation (WASM)
├─ Halo2 proof generation (600ms-10s device-dependent browser WASM)
│  ├─ Web Workers (4 workers for parallel Poseidon hashing)
│  ├─ Two-tier Merkle path (district tree + global tree)
│  └─ K=12 circuit (4K constraints, optimized from K=14)
└─ Message encryption (XChaCha20-Poly1305)

Server (SvelteKit 5 SSR)
├─ Supabase (Postgres) via Prisma
├─ Session management (@oslojs/crypto)
├─ CWC API integration (congressional delivery)
├─ 3-layer content moderation (OpenAI + Gemini/Claude + human)
├─ self.xyz (projected 70%) + Didit.me (projected 30%) FREE identity verification
├─ Shadow Atlas API (district tree distribution via IPFS)
└─ voter-protocol blockchain client (proof verification, reputation queries)

Settlement Layer (voter-protocol repo)
├─ Scroll zkEVM (Ethereum L2)
├─ Halo2 zero-knowledge proof verification
├─ ERC-8004 reputation tracking
└─ Phase 1: Reputation-only (no tokens)
```

**Budget:** $326/month for 1,000 users / 10,000 messages (Phase 1)

**Phase 2 additions** (12-18 months):

- VOTER token rewards
- Challenge markets (stake on verifiable claims)
- Outcome markets (financially compete with lobbying)
- Multi-agent treasury management

---

## Tech Stack

**Frontend:**

- SvelteKit 5 (runes: $state, $derived, $effect)
- TypeScript (strict mode, zero `any` types)
- Tailwind CSS + design system (governance-neutral)
- Playwright (e2e testing)
- Vitest (integration-first test suite)

**Backend:**

- Supabase (Postgres database)
- Prisma ORM (type-safe database queries)
- @oslojs/crypto (cryptographic sessions)
- CWC API (Communicating With Congress)
- Census Bureau Geocoding API (district lookup)

**Identity & Privacy:**

- self.xyz (FREE NFC passport verification, projected 70% adoption)
- Didit.me (FREE government ID upload, projected 30% adoption)
- Browser-native ZKPs (no cloud proving, address never leaves device)
- XChaCha20-Poly1305 (end-to-end encryption for message delivery)

**Blockchain (via voter-protocol):**

- Scroll zkEVM (settlement layer)
- Halo2 recursive proofs (zero-knowledge proofs)
- NEAR Chain Signatures (cross-chain account abstraction)

**Deployment:**

- Fly.io (production + staging)
- GitHub Actions (CI/CD)
- Prisma migrations (schema versioning)

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/communisaas/communique-site.git
cd communique-site
npm install
```

### 2. Environment Setup

Create `.env`:

```bash
# Database (required)
SUPABASE_DATABASE_URL="postgresql://user:pass@host:port/db"

# OAuth (at least one provider required)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
OAUTH_REDIRECT_BASE_URL="http://localhost:5173"

# Congressional delivery (optional for development)
CWC_API_KEY="..."
CWC_API_BASE_URL="https://soapbox.senate.gov/api"

# Feature flags (optional)
ENABLE_BETA=false
ENABLE_RESEARCH=false
NODE_ENV=development
```

**Complete environment variable reference:** See CLAUDE.md lines 398-465

### 3. Database Setup

```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:seed        # Seed templates and legislative channels
```

### 4. Start Development

```bash
npm run dev  # http://localhost:5173
```

**With feature flags:**

```bash
ENABLE_BETA=true npm run dev       # Enable beta features
ENABLE_RESEARCH=true npm run dev   # Enable experimental features
```

---

## User Flow (Phase 1)

**Template Selection → Customization → Delivery:**

1. **Browse templates** - Filter by topic (healthcare, climate, labor, education)
2. **OAuth login** - One of 5 providers (Google/Facebook/Twitter/LinkedIn/Discord)
3. **Address collection** - Census Bureau geocoding → congressional district lookup
4. **Customize template** - Fill variables, add personal connection block
5. **Generate ZK proof** - Browser-native Halo2 proving (600ms-10s device-dependent)
   - Modern desktop (Apple M3, AMD Ryzen 9): 600-800ms
   - Recent mobile (iPhone 15, Pixel 8): 2-3s
   - Budget mobile (iPhone 12, budget Android): 5-10s
   - Shadow Atlas district tree loaded from IPFS (progressive loading, cached in IndexedDB)
   - Witness generation in Web Workers (4 parallel workers for Poseidon hashing)
   - Halo2 proof generation in browser WASM (K=12 circuit, KZG commitment)
   - Address never leaves browser, never sent to any server
6. **Encrypt message** - XChaCha20-Poly1305 encryption in browser
7. **Deliver to Congress** - Encrypted message → CWC API → congressional office
8. **Build reputation** - On-chain reputation tracking (Phase 1)
9. **Earn rewards** - Token rewards launch in Phase 2 (12-18 months)

**Zero-knowledge proof generation happens entirely in browser.** Your address is used to query Shadow Atlas district tree (downloaded from IPFS, cached locally), generate Merkle witness in Web Workers, then prove district membership using browser WASM. Address never leaves your device, never sent to any server. Congressional offices verify proof on-chain (~60-100k gas, estimated $0.002 per verification).

**Performance:** 600-800ms on modern desktop, 2-3s on recent mobile, 5-10s on budget devices. Proving happens entirely in browser—your address never leaves your device.

**Encrypted delivery:** Message plaintext exists only in: your browser → CWC API → congressional CRM. Platform operators cannot read messages.

---

## Development Commands

### Code Quality (MUST pass before commit)

```bash
npm run format         # Prettier auto-fix
npm run lint           # ESLint with warnings allowed
npm run lint:strict    # Zero-tolerance ESLint (CI requirement)
npm run check          # TypeScript + Svelte validation
npm run build          # Production build verification
```

**Pre-commit requirement:** All commands must return 0 errors. See CLAUDE.md for nuclear-level type safety standards.

### Testing (Integration-First)

```bash
npm run test              # All tests (integration + unit)
npm run test:run          # No watch mode
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e          # Playwright browser tests
npm run test:coverage     # With coverage report
npm run test:ci           # CI pipeline (test:run + test:e2e)
```

**Test philosophy:** Integration-first. Real database, real mocks, real fixtures. 53 tests consolidated to 6 high-value integration tests.

### Database

```bash
npm run db:generate    # Generate Prisma client (after schema changes)
npm run db:push        # Push schema to database (dev)
npm run db:migrate     # Create/run migrations (production)
npm run db:studio      # Open Prisma Studio GUI
npm run db:seed        # Seed templates and channels
npm run db:reset       # Reset database (dev only)
npm run db:start       # Start Docker Compose (local Postgres)
```

### Deployment

```bash
npm run build          # Production build
npm run preview        # Preview production build

# Fly.io deployment
fly deploy --config fly.staging.toml    # Staging
fly deploy                              # Production
```

---

## Project Structure

```
src/
├── routes/                    # SvelteKit routes (pages + API)
│   ├── auth/                  # OAuth callback handlers
│   ├── api/                   # API endpoints
│   │   ├── agents/            # Content moderation, consensus
│   │   ├── address/           # District lookup, validation
│   │   ├── blockchain/        # voter-protocol client queries
│   │   └── templates/         # Template CRUD
│   ├── s/[slug]/             # Template sharing pages
│   └── onboarding/           # Address/profile collection
│
├── lib/
│   ├── components/           # Svelte components (domain-organized)
│   │   ├── auth/             # OAuth, verification flows
│   │   ├── template/         # Browse, create, customize
│   │   ├── analytics/        # Funnel tracking
│   │   └── ui/               # Design system components
│   │
│   ├── core/                 # Core production infrastructure
│   │   ├── auth/             # Session management (@oslojs/crypto)
│   │   ├── analytics/        # Funnel tracking, database analytics
│   │   ├── api/              # Unified API client
│   │   ├── blockchain/       # voter-protocol integration
│   │   ├── congress/         # CWC delivery, address lookup
│   │   ├── legislative/      # International abstraction layer
│   │   ├── server/           # Server-side utilities
│   │   └── db.ts             # Prisma client singleton
│   │
│   ├── agents/               # Multi-agent systems
│   │   ├── content/          # Template moderation (3-layer)
│   │   ├── shared/           # Base classes, type guards
│   │   └── voter-protocol/   # Blockchain reward calculation
│   │
│   ├── stores/               # Svelte 5 runes-based state
│   ├── utils/                # Formatting, debounce, resolution
│   ├── types/                # TypeScript definitions
│   ├── features/             # Feature-flagged (ENABLE_BETA)
│   ├── experimental/         # Research (ENABLE_RESEARCH)
│   └── integrations/         # External service clients
│
├── app.html                  # HTML template
└── app.css                   # Global styles + Tailwind

docs/                         # Documentation
prisma/                       # Database schema + migrations
static/                       # Static assets
tests/                        # Integration, unit, e2e tests
```

---

## Key Features (Phase 1)

### Template System

- **Variable extraction**: `[Your City]`, `[Your Representative]`, `[Your Experience]`
- **CodeMirror editor**: Syntax highlighting, auto-insertion
- **Personalization blocks**: Users add their own story
- **3-layer moderation**: OpenAI + Gemini/Claude consensus + human review
- **Share flows**: Viral mechanics with deep-link templates

### Congressional Delivery

- **CWC API integration**: Official Communicating With Congress delivery
- **Address validation**: Census Bureau geocoding → district lookup
- **Encrypted delivery**: End-to-end encryption (browser → CWC API)
- **Delivery confirmation**: Cryptographic receipts with timestamps
- **Representative lookup**: Automatic based on verified address

### Zero-Knowledge Verification

- **Browser-native proving**: Halo2 proofs (600ms-10s device-dependent browser WASM)
- **Shadow Atlas**: Two-tier Merkle tree (535 district trees + 1 global tree)
- **Progressive loading**: District trees loaded from IPFS, cached in IndexedDB
- **Web Workers**: Parallel Poseidon hashing across 4 workers for witness generation
- **Privacy guarantee**: Address never leaves browser, never sent to any server
- **On-chain verification**: Congressional offices verify proofs (~60-100k gas, estimated $0.002/user)
- **Identity verification**: self.xyz (projected 70%) + Didit.me (projected 30%), both FREE
- **Sybil resistance**: One verified identity = one account

### Multi-Agent Moderation

- **3 AI agents**: OpenAI, Gemini, Claude vote on template quality
- **67% consensus required**: Prevents single-model bias
- **Content categories**: Legal/harmful detection, not fact-checking (Phase 1)
- **Human escalation**: Borderline cases reviewed manually
- **Challenge markets**: Phase 2 adds economic stakes on verifiable claims

### International Legislative Support

- **Tiered access by country**:
  - US: CWC certified delivery (web forms)
  - Tier 1 (UK, Canada, EU): Direct email to offices
  - Tier 2: Social media + public contact methods
- **Dynamic channel resolution**: SSR-based routing
- **Governance-neutral design**: Works for Westminster, Congressional, Parliamentary systems

---

## OAuth Provider Setup

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com)
2. Create project → Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add redirect URIs:
   - `http://localhost:5173/auth/google/callback` (dev)
   - `https://staging.communi.email/auth/google/callback` (staging)
   - `https://communi.email/auth/google/callback` (prod)

### Other Providers

Similar setup for Facebook, Twitter, LinkedIn, Discord:

- Create app in developer console
- Configure redirect: `{BASE_URL}/auth/{provider}/callback`
- Add client ID/secret to `.env`

**Complete OAuth guide:** See `docs/authentication/oauth-setup.md`

---

## Integration with voter-protocol

Communiqué is the frontend. voter-protocol is the blockchain infrastructure.

**Read-only queries (Phase 1):**

```typescript
import { voterBlockchainClient } from '$lib/core/blockchain/voter-client';

// Query user reputation (on-chain)
const stats = await voterBlockchainClient.getUserStats(userAddress);
// Returns: { actionCount, civicEarned, lastActionTime, voterTokenBalance }

// Query platform metrics
const metrics = await voterBlockchainClient.getPlatformStats();
// Returns: { totalUsers, totalActions, totalCivicMinted, ... }
```

**Client-side signing (Phase 2):**

```typescript
// Prepare unsigned transaction
const { unsignedTx } = await voterBlockchainClient.prepareActionTransaction({
	userAddress,
	actionType: 'CWC_MESSAGE',
	templateId,
	deliveryConfirmation
});

// User signs with passkey (Face ID / Touch ID)
const signedTx = await passkeyWallet.signTransaction(unsignedTx);

// Submit to blockchain
await submitTransaction(signedTx);
```

**Phase 1:** No token rewards, no transaction signing. Reputation tracking only.
**Phase 2:** Token rewards, challenge markets, outcome markets require client-side signing.

---

## Documentation

**Communiqué-specific:**

- **[CLAUDE.md](./CLAUDE.md)** - Authoritative development guide (type safety, testing, architecture)
- **[docs/design-system.md](./docs/design-system.md)** - Complete design system (colors, typography, components)
- **[docs/database-seeding.md](./docs/database-seeding.md)** - Database setup and seeding
- **[tests/README.md](./tests/README.md)** - Integration-first test suite

**voter-protocol (blockchain infrastructure):**

- **[voter-protocol/README.md](https://github.com/communisaas/voter-protocol)** - Vision, cryptography, economics
- **[voter-protocol/QUICKSTART.md](https://github.com/communisaas/voter-protocol/QUICKSTART.md)** - Non-technical user onboarding
- **[voter-protocol/TECHNICAL.md](https://github.com/communisaas/voter-protocol/TECHNICAL.md)** - Blockchain deep dive
- **[voter-protocol/CONGRESSIONAL.md](https://github.com/communisaas/voter-protocol/CONGRESSIONAL.md)** - Legislative staff guide
- **[voter-protocol/ARCHITECTURE.md](https://github.com/communisaas/voter-protocol/ARCHITECTURE.md)** - Complete technical architecture
- **[voter-protocol/SECURITY.md](https://github.com/communisaas/voter-protocol/SECURITY.md)** - Living threat model

---

## Common Issues

### OAuth Redirect Mismatches

Ensure redirect URIs match exactly in provider consoles:

```
http://localhost:5173/auth/{provider}/callback          # dev
https://staging.communi.email/auth/{provider}/callback  # staging
https://communi.email/auth/{provider}/callback          # prod
```

### Database Connection Issues

- Check Supabase Postgres connection string format
- Ensure database exists and is accessible
- Run `npm run db:generate` after schema changes
- Use `npm run db:studio` to inspect database state

### Missing Environment Variables

All OAuth providers need client ID/secret. CWC delivery requires API key. Check `.env` against CLAUDE.md environment section.

### TypeScript Errors

**Zero tolerance policy.** See CLAUDE.md for nuclear-level type safety standards. No `any` types, no `@ts-ignore`, no type suppression. Fix the actual issue.

### ZK Proof Generation Fails

- Check Shadow Atlas IPFS availability (district tree download)
- IndexedDB caching must be enabled (50MB district tree storage)
- 600ms-10s proving time is normal (device-dependent browser WASM Halo2 proof)
- Web Workers must be available (SharedArrayBuffer requires COOP/COEP headers)
- Check browser console for detailed error messages

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

**Code quality standards:** See CLAUDE.md. Any PR with type violations will be instantly rejected.

---

## License

[MIT License](./LICENSE)

---

_Communiqué PBC | Frontend for VOTER Protocol | 2025_
