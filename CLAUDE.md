# CLAUDE.md

**Authoritative guide for Claude Code.** Single source of truth for VOTER Protocol's cryptographic social coordination infrastructure frontend.

---

## 🎯 What Communiqué Actually Is

**Communiqué is a multi-stakeholder social coordination platform using cryptographic primitives to enable accountability across ALL power structures.**

### Power Structures We Coordinate Against:

1. **Government** - Congress, state legislatures, regulators, agencies
2. **Corporate** - Executives, boards, shareholders (workplace accountability)
3. **Housing** - Landlords, HOAs, property management companies
4. **Institutional** - Universities, hospitals, school boards
5. **Labor** - Union organizing, worker cooperatives
6. **Nonprofit** - NGO accountability, participatory grantmaking
7. **Advocacy** - Community organizations, mutual aid networks

**See `docs/research/power-structures.md` for comprehensive power structure research (landlords, HOAs, universities, hospitals, school boards, nonprofits, worker organizing).**

### ⚠️ CRITICAL: Language Must Reflect Multi-Stakeholder Scope

**❌ NEVER use government-only language:**
- "Contact your representative"
- "Send to Congress"
- "Bills in your district"
- "Find campaigns"
- "Government issues"

**✅ Use power-structure-agnostic language:**
- Location + coordination count: "CA-11" / "47 coordinating in California"
- Direct action verbs: "Send message" / "Coordinate" / "Join"
- Template titles speak for themselves (no category labels)
- When relevant: "Send via email" / "Certified delivery" / "Congressional delivery"

**→ `docs/design/voice.md`** - Pragmatic cypherpunk voice guide (confident, direct, no corporate speak, technical details in popovers)

---

## Phase Roadmap

**Phase 1 (3 months to launch):** Reputation-only. Zero-knowledge verification, encrypted delivery, on-chain reputation tracking. No token.

**Phase 2 (12-18 months):** Token rewards, challenge markets, outcome markets powered by multi-agent treasury management.

---

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
```

Common commands:

```bash
npm run build          # prod build
npm run preview        # preview
npm run check          # type + svelte-check
npm run lint           # eslint with warnings allowed
npm run lint:strict    # eslint with zero tolerance
npm run format         # prettier --write . (auto-fix)
npm run test           # integration-first test suite
```

---

## 🚨 Code Quality: ABSOLUTE ZERO TOLERANCE 🚨

### Why This Nuclear-Level Strictness Exists

**WE JUST EXPERIENCED 1000+ ESLint ERRORS CAUSING COMPLETE DEVELOPMENT PARALYSIS.**

ROOT CAUSE: Inconsistent tooling, unclear standards, reactive error-fixing created endless technical debt.

### PREVENTION-FIRST APPROACH

**BEFORE writing ANY code:**

1. **Run `npm run lint` locally** - Must show 0 errors before committing
2. **Configure IDE with ESLint integration** - Real-time error prevention
3. **Use TypeScript strict mode** - Catch issues at development time
4. **Follow established patterns** - Don't create new anti-patterns

**CI WILL FAIL ON ANY ESLint ERROR. No exceptions. No "we'll fix it later."**

### ⚡ INSTANT PR REJECTION CRITERIA ⚡

**Any PR containing these patterns will be INSTANTLY REJECTED without review:**

- ❌ **`any` type usage** - No exceptions, no "temporary" uses
- ❌ **`@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`** - Fix the type issue
- ❌ **`as any` casting** - Use proper type guards
- ❌ **`Record<string, any>`** - Define proper interfaces
- ❌ **`unknown` as `any` substitute** - Use proper type narrowing
- ❌ **Generic parameters without constraints** - Always constrain generics
- ❌ **Loose object casting** - Use type guards

### ✅ MANDATORY PRACTICES

**Every line of code MUST:**
- ✅ Explicit types for ALL function parameters/returns
- ✅ Comprehensive interfaces for ALL data structures
- ✅ Type guards for ALL runtime validation
- ✅ Discriminated unions for ALL variant types
- ✅ Exhaustive type checking in ALL switch statements
- ✅ Proper generic constraints
- ✅ Strict null checks enabled

### 🚀 MANDATORY Pre-commit Workflow

**THESE COMMANDS MUST PASS WITH 0 ERRORS BEFORE ANY COMMIT:**

```bash
npm run format                   # Format code first
npm run lint --max-warnings 0    # CRITICAL: Must show "✖ 0 problems"
npm run check                    # TypeScript + Svelte validation
npm run build                    # Production build must succeed
npm run test:run                 # Test suite must pass
```

**If ANY command fails, you CANNOT commit. Fix the issues first.**

### 🆘 Emergency ESLint Recovery

**If you encounter >100 ESLint errors:**

1. **STOP IMMEDIATELY** - Don't try to fix manually
2. **Revert to last known good commit**: `git reset --hard HEAD~1`
3. **Run `npm run lint` to verify 0 errors**
4. **Make smaller, incremental changes**
5. **Test each change with `npm run lint` before proceeding**

**Never attempt mass automated fixes. They create more problems than they solve.**

---

## TypeScript Best Practices

### SvelteKit 5 Runes (MUST be typed)

```typescript
// ❌ WRONG - Missing types
let count = $state(0);
let props = $props();
let derived = $derived(count * 2);

// ✅ CORRECT - Properly typed
let count = $state<number>(0);
let props = $props<{ title: string; id: number }>();
let derived = $derived<number>(count * 2);

// Component props MUST be typed
let {
	template,
	onComplete
}: {
	template: Template;
	onComplete: (data: CompletionData) => void;
} = $props();
```

### Prisma Database Types

```typescript
// Import generated Prisma types
import type { User, Template, Submission } from '@prisma/client';

// Extend with relations when needed
type UserWithTemplates = User & {
	templates: Template[];
};

// ❌ WRONG
const user: any = await prisma.user.findFirst();

// ✅ CORRECT
const user: User | null = await prisma.user.findFirst();
```

### 🔥 Real-World Type Violation Patterns We Just Fixed

**These are the EXACT lazy patterns that caused our 193+ TypeScript errors:**

#### ❌ Component Event Dispatch Type Mismatches

```typescript
// WRONG - Extra properties not in event type
dispatch('complete', {
	address: verified,
	district: districtData, // ← Not in event type
	extraField: value       // ← Not in event type
});

// CORRECT - Only dispatch defined properties
const dispatch = createEventDispatcher<{
	complete: { address: string; verified: boolean };
}>();
dispatch('complete', { address: verified, verified: true });
```

#### ❌ Object Spread with Duplicate Properties

```typescript
// WRONG - Duplicate properties cause TypeScript errors
return {
	id: template.id,    // ← Duplicate after spread
	title: template.title, // ← Duplicate after spread
	...template,        // ← Already includes id, title
	recipientEmails: emails
};

// CORRECT - Extract conflicting props, then spread
const { metrics, ...otherProps } = template;
return {
	...otherProps,
	recipientEmails: emails,
	metrics: { sent: metrics?.sent }
};
```

#### ❌ Prisma Field Naming Inconsistencies

```typescript
// WRONG - Mixing snake_case and camelCase
const user = {
	congressional_district: data.congressionalDistrict, // ← Inconsistent
	verification_method: data.verificationMethod        // ← Inconsistent
};

// CORRECT - Consistent snake_case for Prisma fields
const user = {
	congressional_district: data.congressional_district,
	verification_method: data.verification_method
};
```

### Type Checking Commands

```bash
npm run check              # TypeScript + Svelte validation
npx tsc --noEmit           # Pure TypeScript check
npm run build              # Verify production build

# Quick check during development:
npx tsc --noEmit --skipLibCheck
```

### ⚡ ENFORCEMENT PROTOCOL

#### Pre-Commit Requirements (ALL MUST PASS):

```bash
npm run check              # TypeScript + Svelte validation
npx tsc --noEmit           # Pure TypeScript compilation check
npm run build              # Production build verification
npm run lint:strict        # Zero-tolerance ESLint check
```

#### Code Review Standards:

- **Any `any` type = INSTANT REJECTION**
- **Any type suppression = INSTANT REJECTION**
- **Any loose casting = INSTANT REJECTION**
- **Any missing interface = REQUIRES IMMEDIATE FIX**

### 💰 THE REAL COST OF TYPE SHORTCUTS

**Why we're this strict:**

- **193+ TypeScript errors** we just spent cycles fixing
- **Hours of development time** wasted on type debugging
- **Production bugs** caused by runtime type mismatches
- **Technical debt** that compounds over time
- **Developer frustration** from dealing with type chaos

**EVERY TYPE SHORTCUT COSTS MORE TIME THAN DOING IT RIGHT THE FIRST TIME.**

### 🎯 ZERO EXCEPTIONS POLICY

**No matter who you are, no matter how "urgent" the feature:**

- **No temporary `any` types** - There is no such thing as "temporary"
- **No "quick fixes" with type suppression** - Fix the actual issue
- **No "I'll fix it later" type violations** - Fix it now or don't commit
- **No "it's just a test" exceptions** - Tests must be strictly typed too

**Remember: We just spent multiple development cycles fixing 193+ TypeScript errors caused by these exact patterns. This nuclear-level strictness exists because we learned the hard way that type shortcuts are never worth it.**

---

## Architecture Overview

### What Communiqué Handles (Frontend + Orchestration)

- **SvelteKit 5** + TypeScript + Tailwind (frontend framework)
- **Neon Postgres** via Prisma; cryptographic sessions via `@oslojs/crypto`
- **OAuth authentication** (Google, Facebook, Twitter, LinkedIn, Discord)
- **Address validation** → Census Bureau geocoding → congressional district lookup
- **Template system** - Creation, customization, multi-target delivery (Congress + corporations + HOAs + schools + nonprofits)
- **3-layer content moderation** - Multi-agent consensus (OpenAI, Gemini, Claude)
- **Witness encryption** in browser (XChaCha20-Poly1305 to TEE public key)
- **ZK proof coordination** - Halo2 proofs (2-5s TEE-based proving in AWS Nitro Enclaves native Rust)
- **Encrypted delivery** via CWC API through AWS Nitro Enclaves (ARM-based TEE, no Intel ME/AMD PSP)
- **Integration-first testing** (53→6 tests, smart mocks, fixtures)

### What voter-protocol Handles (Blockchain + Cryptography)

- **Smart contracts** on Scroll zkEVM (Ethereum L2)
- **Halo2 ZK proof verification** on-chain
- **ERC-8004 on-chain reputation** tracking
- **Multi-agent treasury management** (Phase 2)
- **Token economics, challenge markets, outcome markets** (Phase 2)

**→ `docs/architecture.md`** - Comprehensive architecture doc explaining Communiqué/voter-protocol separation, cypherpunk principles, privacy architecture, cost analysis

**→ `docs/architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md`** - Location signal accuracy matrix (IP = state-level only, NOT district), false precision prevention, code enforcement patterns

### Phase 1 Cryptographic Flow

1. **Identity verification**: self.xyz NFC passport (70%) + Didit.me (30%) - both FREE
2. **Witness encryption**: Address encrypted in browser (XChaCha20-Poly1305)
   - **Current (MVP):** Encrypted blob stored in Postgres (platform cannot decrypt)
   - **Phase 2:** IPFS storage + on-chain pointer (99.97% cost reduction)
3. **ZK proof generation**: TEE decrypts witness, generates Halo2 proof (2-5s native Rust), address exists only in TEE memory during proving
4. **Encrypted delivery**: XChaCha20-Poly1305 → AWS Nitro Enclaves (ARM Graviton, hypervisor-isolated) → CWC API → congressional office
5. **Reputation tracking**: On-chain ERC-8004 reputation updates (no token rewards yet)

**→ `docs/specs/zk-proof-integration.md`** - ZK proof integration guide (5 phases, 10 weeks, 45K comprehensive)

**→ `docs/specs/portable-identity.md`** - IPFS + on-chain pointer architecture (Phase 2, 19K)

**→ `docs/specs/universal-credibility.md`** - Credential verification system (17K)

### Phase 2 Additions (12-18 months)

- Token rewards for verified civic actions
- Multi-agent treasury execution (OpenAI + Gemini/Claude consensus)
- Challenge markets (dispute resolution)
- Outcome markets (impact verification)

---

## Code Map

### Routes & API
**Location:** `src/routes/`
- **Pages** - SvelteKit SSR pages, layout components
- **API endpoints** - `/api/*` server routes (templates, auth, verification, congressional delivery)

### UI Components
**Location:** `src/lib/components/`

Organized by domain:
- **`auth/`** - OAuth flows, session UI, address verification modals
- **`landing/`** - Template browser, location filter, channel explainer
- **`template/`** - Template cards, creator UI, variable editor
- **`analytics/`** - Funnel tracking UI, delivery dashboards
- **`ui/`** - Reusable primitives (buttons, modals, forms, atmospheric background)

### Core Production Systems
**Location:** `src/lib/core/`

- **`auth/`** - Authentication, OAuth providers, session management
- **`analytics/`** - Funnel tracking, database analytics, event logging
- **`api/`** - Unified API client for backend communication
- **`blockchain/`** - VOTER Protocol client integration (reputation queries)
- **`congress/`** - US Congressional delivery (CWC API, address lookup)
- **`legislative/`** - Legislative abstraction layer (adapters, delivery pipeline, variable resolution)
- **`location/`** - Location inference engine (5-signal system: IP, browser, OAuth, behavioral, verified)
- **`server/`** - Server-side utilities (verification, sentiment, security, metrics)
- **`db.ts`** - Prisma database client

**→ `docs/architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md`** explains why IP can only reliably determine state (NOT district), and how the 5-signal system progressively improves accuracy

### Service Layer
**Location:** `src/lib/services/`

- **`aws/`** - AWS integrations (SQS, DynamoDB, rate limiting)
- **`delivery/`** - Email delivery, SMTP server, multi-target delivery
- **`geolite2.ts`** - IP geolocation database (state-level only)

### Agent Infrastructure
**Location:** `src/lib/agents/`

- **`content/`** - Template moderation and multi-agent consensus (OpenAI, Gemini, Claude)
- **`shared/`** - Base agent classes, type guards, common utilities
- **`voter-protocol/`** - Blockchain reward calculation (Phase 2)

**→ `docs/agents/agent-architecture.md`** (if exists) - Agent orchestration patterns, LangGraph workflows

### State Management
**Location:** `src/lib/stores/`

Svelte 5 runes-based reactive state (NOT old stores API).

### Utilities & Types
**Location:** `src/lib/utils/` and `src/lib/types/`

- **Utils** - Formatting, debounce, portal, template resolution
- **Types** - Comprehensive TypeScript definitions for templates, users, locations, jurisdictions

### Feature Flags
**Location:** `src/lib/features/`

Beta features (AI suggestions, template intelligence) gated by `ENABLE_BETA` env var.

### Tests
**Location:** `tests/`

- **`integration/`** - Integration tests (database, API, auth flows)
- **`unit/`** - Unit tests (utilities, type guards, business logic)
- **`e2e/`** - End-to-end browser tests (Playwright)
- **`mocks/`** - Mock data factories
- **`fixtures/`** - Test fixtures

**→ `docs/development/testing.md`** - Test strategy (integration-first approach, smart mocks, fixtures)

**→ `docs/testing/DATABASE-CLEARING-ISSUE.md`** - Important: Tests clear database for isolation; use `npm run test:reseed` to auto-reseed

---

## Environment Variables

### Required (Core)

```bash
DATABASE_URL=...                    # Neon Postgres connection string
```

### Congressional Delivery (Optional)

```bash
CWC_API_KEY=...                     # Communicating With Congress API key
CWC_API_BASE_URL=...                # CWC API base URL (default: https://soapbox.senate.gov/api)
```

### OAuth Providers (Optional - any combination)

```bash
# OAuth Configuration
OAUTH_REDIRECT_BASE_URL=...         # Base URL for OAuth callbacks (e.g., http://localhost:5173)

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Facebook OAuth
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...

# Twitter OAuth
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Discord OAuth
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

### Webhook Security

```bash
LAMBDA_WEBHOOK_SECRET=...           # AWS Lambda webhook authentication
VOTER_API_KEY=...                   # VOTER Protocol API authentication
COMMUNIQUE_API_KEY=...              # Internal API authentication
```

### Feature Flags

```bash
ENABLE_BETA=true                    # Enable beta features (default: false)
NODE_ENV=production                 # Environment (affects OAuth security, logging)
```

### AWS Infrastructure (Optional)

```bash
DYNAMO_TABLE_NAME=...               # DynamoDB table for rate limiting
JOB_STATUS_API_URL=...              # Job status tracking endpoint
MAX_RETRIES=3                       # Maximum retry attempts for CWC submissions
RATE_LIMIT_WINDOW_SECONDS=3600      # Rate limit window (default: 1 hour)
RATE_LIMIT_COUNT=10                 # Rate limit count (default: 10 per hour)
VISIBILITY_TIMEOUT_SECONDS=300      # SQS visibility timeout (default: 5 minutes)
```

---

## Agent Architecture

### Phase 1: Content Moderation (Active Now)

**Location:** `src/lib/agents/content/`

**Purpose:** 3-layer multi-agent consensus for template quality.

**Active Agents:**
- **Content Agents** - Template moderation and quality assessment
- **Shared Infrastructure** - Base agent classes, type guards, common utilities

**Consensus Mechanism:**

```typescript
// Multi-agent voting for template approval
const consensusResult = await agentConsensus.processTemplate({
	template,
	agents: ['openai', 'gemini', 'claude'],
	consensusThreshold: 0.67  // 2/3 majority required
});

// Returns:
// - approval: boolean
// - consensusType: 'unanimous' | 'majority' | 'split'
// - confidence: number
// - reasoning: string[]
```

**Orchestration:**
- **3 AI agents** (OpenAI, Gemini, Claude) vote on template quality
- **LangGraph workflows** orchestrate agent coordination
- **TypeScript orchestration** (N8N deprecated)

### Phase 2: VOTER Protocol Agents (12-18 months)

**Not implemented yet:**

**Location:** `src/lib/agents/voter-protocol/`

**Purpose:** Blockchain reward calculation, treasury management, impact verification.

**Planned Agents:**
- **Reward calculation agents** - Determine token rewards for verified actions
- **Multi-agent treasury** - OpenAI + Gemini/Claude consensus for reward distribution
- **Impact verification agents** - Cross-agent scoring of civic action outcomes
- **Challenge market agents** - Dispute resolution with economic stakes

### Agent API Endpoints

```bash
# Phase 1 (active):
POST /api/agents/consensus          # Multi-agent template moderation

# Phase 2 (12-18 months):
POST /api/agents/calculate-reward   # VOTER Protocol reward calculation
POST /api/agents/track-impact       # Impact verification and scoring
POST /api/agents/verify             # Identity and action verification
POST /api/agents/update-reputation  # Reputation score updates
```

---

## VOTER Protocol Integration

### Phase 1 (Current): Read-Only + Reputation

- **Read-only blockchain queries** - Fetch user reputation, platform metrics
- **Reputation tracking** - On-chain ERC-8004 reputation updates (no token rewards)
- **Deterministic address generation** - Wallet-free blockchain participation via passkeys
- **Gas management** - Platform pays all transaction fees

**Integration example:**

```typescript
import { voterBlockchainClient } from '$lib/core/blockchain/voter-client';

// Query user reputation (read-only)
const stats = await voterBlockchainClient.getUserStats(userAddress);
// Returns: { actionCount, reputationScore, lastActionTime }

// Query platform metrics
const metrics = await voterBlockchainClient.getPlatformStats();
// Returns: { totalUsers, totalActions, totalReputation }
```

### Phase 2 (12-18 months): Token Rewards + Markets

- **Client-side transaction signing** - Users sign with passkey (Face ID / Touch ID)
- **Token rewards** - Automatic reward distribution for verified civic actions
- **Challenge markets** - Dispute resolution with economic stakes
- **Outcome markets** - Impact verification with reputation + token rewards

**→ `docs/integration.md`** - Comprehensive integration guide (voter-protocol, CWC API, OAuth providers, identity verification, TEE encrypted delivery)

---

## Testing

### Test Commands

```bash
npm run test             # All tests (integration + unit)
npm run test:run         # All tests (no watch mode)
npm run test:reseed      # Tests + auto-reseed database (RECOMMENDED)
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end browser tests (Playwright)
npm run test:all         # Complete test suite (unit + integration + e2e)
npm run test:coverage    # With coverage report
npm run test:production  # Production features only (ENABLE_BETA=false)
npm run test:beta        # Include beta features (ENABLE_BETA=true)
npm run test:ci          # CI pipeline tests (test:run + test:e2e)
npm run test:health      # Generate health reports in coverage/ directory
npm run test:drift       # Mock drift detection reports
```

**⚠️ IMPORTANT:** Tests clear the database for test isolation. Use `npm run test:reseed` to automatically reseed after running tests, or manually run `npm run db:seed` afterward.

### Coverage Reporting

**CI uses tokenless Code Coverage Summary** - No external service required, runs entirely in GitHub Actions.

**Coverage formats:**
- `coverage/lcov.info` - For local inspection
- `coverage/cobertura-coverage.xml` - For CI reporting (Code Coverage Summary action)
- `coverage/` - HTML reports for detailed local analysis

**CI features:**
- Automatic PR comments with coverage summary
- Coverage badges without external services
- **Informational only** - Reports coverage but doesn't block CI (targets: 20% global, 40% critical paths)

**→ `docs/testing/DATABASE-CLEARING-ISSUE.md`** - Details on database clearing behavior

**→ `docs/development/testing.md`** - Test strategy (integration-first approach, smart mocks, fixtures, coverage requirements)

---

## Database & Seeding

### Database Commands

```bash
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes (development)
npm run db:migrate       # Create/run migrations (production)
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed sample data
npm run db:seed:core     # Same as db:seed (alias)
npm run db:start         # Start Docker Compose for local database
```

**→ `docs/development/database.md`** - Prisma schema documentation, migration workflows, seeding patterns

**→ `docs/development/schema.md`** - Database schema reference (if more detailed than database.md)

---

## Feature Development

### Standard Development

```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Beta Features

```bash
ENABLE_BETA=true npm run dev   # Enable beta features in development
```

**Feature flags control access to:**
- **Beta features** (`src/lib/features/`) - AI suggestions, template intelligence

**→ `docs/development/flags.md`** - Feature flag system documentation (if exists)

---

## Documentation Navigation

### 🎯 Quick Reference

**"What's the current status?"**
→ **`docs/implementation-status.md`** - What's done, what remains (SINGLE SOURCE OF TRUTH)

**"How does Communiqué work?"**
→ **`docs/architecture.md`** - Communiqué/voter-protocol separation, cypherpunk principles, privacy architecture

**"How do I integrate with external systems?"**
→ **`docs/integration.md`** - voter-protocol, CWC API, OAuth providers, identity verification (self.xyz, Didit.me), TEE encrypted delivery

**"How do I build frontend features?"**
→ **`docs/frontend.md`** - SvelteKit 5 patterns, runes-based state management, component composition, type safety

**"How do I test?"**
→ **`docs/development/testing.md`** - Integration-first test strategy, mocks, fixtures

**"How do I deploy?"**
→ **`docs/development/deployment.md`** - Production deployment workflow

### 📚 Documentation Structure

**Start here:**
→ **`docs/README.md`** - Comprehensive documentation map (15 active docs, down from 95+, 84% reduction)

**Understanding the System:**
- **`docs/architecture.md`** - System architecture, separation of concerns
- **`docs/architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md`** - Location signal accuracy (IP = state only), false precision prevention
- **`docs/integration.md`** - External system integrations
- **`docs/frontend.md`** - SvelteKit 5 frontend patterns
- **`docs/research/power-structures.md`** - ALL power structures (landlords, HOAs, universities, hospitals, school boards, nonprofits, worker organizing)
- **`docs/design/voice.md`** - Pragmatic cypherpunk voice (confident, direct, technical details in popovers)

**Building Features:**
- **`docs/features/templates.md`** - Template system (creation, customization, moderation)
- **`docs/features/creator.md`** - Template creator UI (CodeMirror editor, variable system)
- **`docs/features/identity-verification.md`** - self.xyz + Didit.me flows (session-based verification)
- **`docs/features/jurisdiction.md`** - Jurisdiction system (TemplateJurisdiction model replacing deprecated string arrays)
- **`docs/features/oauth.md`** - OAuth flows (Google, Facebook, Twitter, LinkedIn, Discord)
- **`docs/features/onboarding.md`** - User onboarding flows

**Development:**
- **`docs/development/testing.md`** - Test strategy, mocks, fixtures
- **`docs/development/database.md`** - Prisma schema, migrations, seeding
- **`docs/development/deployment.md`** - Deployment workflows
- **`docs/development/integrations/`** - External service integrations:
  - `message-generation-integration.md` - AI message generation
  - `decision-maker-resolution-integration.md` - Decision-maker lookup
  - `multi-target-delivery-spec.md` - Multi-target delivery (Congress + corporations + HOAs)

**Deep Technical Specs:**
- **`docs/specs/zk-proof-integration.md`** - ZK proof integration guide (5 phases, 10 weeks, 45K comprehensive)
- **`docs/specs/portable-identity.md`** - IPFS + on-chain pointer architecture (Phase 2, 19K)
- **`docs/specs/universal-credibility.md`** - Credential verification system (17K)
- **`docs/specs/progressive-template-sections.md`** - Template sectioning UX
- **`docs/specs/interactive-location-breadcrumb.md`** - Location filter breadcrumb UI

**Historical Context:**
- **`docs/archive/`** - Superseded docs, migrations, historical decisions
  - `2025-01-district-verification/` - Pre-voter-protocol separation
  - `2025-11-refactor/` - Architecture refactor process
  - `2025-11-phase-2-implementation/` - Phase 2 status files (superseded by implementation-status.md)
  - `2025-11-design-iterations/` - OAuth flow refactor, UI copy audits, progressive precision UX
  - `migrations/` - Database privacy migration records

---

## Principles

### Information Ownership (No Redundancy)

**Implementation Status:** ONLY in `docs/implementation-status.md`
**Architecture:** ONLY in `docs/architecture.md`
**Integration:** ONLY in `docs/integration.md`
**Frontend:** ONLY in `docs/frontend.md`
**Features:** ONLY in `docs/features/*.md`
**Development:** ONLY in `docs/development/*.md`
**Specs:** ONLY in `docs/specs/*.md`

**Every piece of information has ONE home. No duplication across docs.**

### Documentation Philosophy

**No Cruft** - Every document serves a clear purpose. Historical/superseded content lives in `archive/`.

**No Redundancy** - "Redundancy kills context." Every piece of information has exactly ONE home.

**No Fragmentation** - "Fragmentation tears us into development hell." Related information lives together.

**Claude Code Optimization** - Docs optimized for AI instances to quickly find relevant context without confusion.

---

*Communiqué PBC | Multi-Stakeholder Cryptographic Social Coordination | 2025-01*
