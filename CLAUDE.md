# CLAUDE.md

Authoritative guide for Claude Code in this repo. Single source of truth for the **frontend application** of VOTER Protocol's cryptographic democratic infrastructure.

**Phase 1 (3 months to launch):** Reputation-only. Zero-knowledge verification, encrypted delivery, on-chain reputation tracking. No token.

**Phase 2 (12-18 months):** Token rewards, challenge markets, outcome markets powered by multi-agent treasury management.

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

### 🚨 ABSOLUTE ZERO ESLint ERROR POLICY 🚨

**WE JUST EXPERIENCED 1000+ ESLint ERRORS CAUSING COMPLETE DEVELOPMENT PARALYSIS. THIS NEVER HAPPENS AGAIN.**

**ROOT CAUSE ANALYSIS: Inconsistent tooling, unclear standards, and reactive error-fixing created an endless cycle of technical debt.**

#### 🛡️ PREVENTION-FIRST APPROACH 🛡️

**BEFORE writing ANY code:**

1. **Run `npm run lint` locally** - Must show 0 errors before committing
2. **Configure IDE with ESLint integration** - Real-time error prevention
3. **Use TypeScript strict mode** - Catch issues at development time
4. **Follow established patterns** - Don't create new anti-patterns

**CI WILL FAIL ON ANY ESLint ERROR. No exceptions. No "we'll fix it later."**

#### ⚡ INSTANT PR REJECTION CRITERIA ⚡

**Any PR containing these patterns will be INSTANTLY REJECTED without review:**

- ❌ **`any` type usage** - No exceptions, no "temporary" uses, no "quick fixes"
- ❌ **`@ts-ignore` comments** - Fix the fucking type issue, don't silence it
- ❌ **`@ts-nocheck` comments** - Every single file MUST be type-checked
- ❌ **`@ts-expect-error` comments** - Fix the code, not suppress the error
- ❌ **`as any` casting** - Use proper type guards and type assertions
- ❌ **`Record<string, any>` patterns** - Define proper interfaces
- ❌ **`(obj as any).property` access** - Define proper object types
- ❌ **`unknown` misuse as `any` substitute** - Use proper type narrowing
- ❌ **Generic function parameters without constraints** - Always constrain generics
- ❌ **Loose object casting like `data as SomeType`** - Use type guards

#### 💀 CONSEQUENCES OF TYPE VIOLATIONS 💀

- **Immediate PR rejection** - No discussion, no exceptions
- **Forced refactoring** - Violating code must be completely rewritten
- **Build failure** - CI will fail and block deployments
- **Code review rejection** - Reviewers are instructed to reject without mercy

#### ✅ MANDATORY TYPE PRACTICES ✅

**Every line of code MUST follow these practices:**

- ✅ **Explicit types for ALL function parameters and returns**
- ✅ **Comprehensive interfaces for ALL data structures**
- ✅ **Type guards for ALL runtime validation**
- ✅ **Discriminated unions for ALL variant types**
- ✅ **Exhaustive type checking in ALL switch statements**
- ✅ **Proper generic constraints for ALL generic functions**
- ✅ **Strict null checks enabled and enforced**
- ✅ **No implicit any configurations**

### 🔧 ESLint Configuration Standards

#### Error Handling Patterns (NEVER change these):

```typescript
// ✅ CORRECT - Use error when needed
try {
	riskyOperation();
} catch (error) {
	console.error('Operation failed:', error);
	throw error;
}

// ✅ CORRECT - Anonymous when unused
try {
	simpleOperation();
} catch {
	return { success: false };
}

// ❌ WRONG - Don't prefix used variables
try {
	riskyOperation();
} catch (_error) {
	console.error('Operation failed:', _error); // ERROR: _error used but prefixed
}
```

#### Unused Variable Rules:

- **Prefix with `_` ONLY if truly unused**: `_error`, `_event`, `_config`
- **Remove unused imports entirely** - Don't just prefix them
- **Use destructuring with rest**: `const { used, ..._unused } = obj;`

#### Import Standards:

- **ES6 imports only** - No `require()` statements
- **Type-only imports** - `import type { Type } from './module';`
- **Remove unused imports** - Don't accumulate dead imports

### 🚀 MANDATORY Pre-commit Workflow

**THESE COMMANDS MUST PASS WITH 0 ERRORS BEFORE ANY COMMIT:**

```bash
# 1. Format code first
npm run format

# 2. CRITICAL: Must show "✖ 0 problems"
npm run lint --max-warnings 0

# 3. TypeScript compilation must succeed
npm run check

# 4. Production build must succeed
npm run build

# 5. Test suite must pass
npm run test:run
```

**If ANY command fails, you CANNOT commit. Fix the issues first.**

### 🆘 Emergency ESLint Recovery Procedure

**If you encounter >100 ESLint errors:**

1. **STOP IMMEDIATELY** - Don't try to fix them manually
2. **Revert to last known good commit**: `git reset --hard HEAD~1`
3. **Run `npm run lint` to verify 0 errors**
4. **Make smaller, incremental changes**
5. **Test each change with `npm run lint` before proceeding**

**Never attempt mass automated fixes. They create more problems than they solve.**

## TypeScript Best Practices for This Codebase

### SvelteKit 5 Type Requirements:

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

### Agent Type Requirements:

```typescript
// Complete type definitions for all agent decisions
export interface SupplyDecision {
	rewardAmount: number;
	baseRewardUSD: number;
	multipliers: {
		participationScore: number;
		marketConditions: number;
		timeDecay: number;
	};
	reasoning: string;
	confidence: number;
	timestamp: string;
	claim?: string; // All optional properties explicitly typed
	stakes?: number;
}

// Type guards for runtime validation
export function isSupplyDecision(value: unknown): value is SupplyDecision {
	return (
		typeof value === 'object' &&
		value !== null &&
		'rewardAmount' in value &&
		typeof (value as SupplyDecision).rewardAmount === 'number'
	);
}
```

### Prisma and Database Types:

```typescript
// Import generated Prisma types
import type { User, Template, Submission } from '@prisma/client';

// Extend with relations when needed
type UserWithTemplates = User & {
	templates: Template[];
};

// NEVER use loose object types
// ❌ WRONG
const user: any = await prisma.user.findFirst();

// ✅ CORRECT
const user: User | null = await prisma.user.findFirst();
```

### Test Type Requirements:

```typescript
// vi.mock MUST have proper return types
vi.mock('$lib/core/api/client', () => ({
	api: {
		post: vi.fn<[string, unknown], Promise<ApiResponse<VerificationResult>>>()
	}
}));

// Mock data must match interfaces exactly
const mockUser: MockUser = {
	id: 'test-id',
	email: 'test@example.com'
	// ALL required properties must be present
};
```

### 🔥 REAL-WORLD TYPE VIOLATION PATTERNS WE JUST FIXED 🔥

**These are the EXACT lazy patterns that caused our 193+ TypeScript errors:**

#### ❌ Component Event Dispatch Type Mismatches

```typescript
// WRONG - Extra properties in event dispatch
dispatch('complete', {
	address: verified,
	district: districtData, // ← Not in event type definition
	extraField: value // ← Not in event type definition
});

// CORRECT - Only dispatch properties defined in event type
const dispatch = createEventDispatcher<{
	complete: { address: string; verified: boolean };
}>();
dispatch('complete', { address: verified, verified: true });
```

#### ❌ Route ID Comparisons with Non-Existent Routes

```typescript
// WRONG - Comparing against removed/non-existent routes
const isTemplate = $page.route.id === '/s/[slug]' || $page.route.id === '/[slug]-backup';

// CORRECT - Only compare against actual routes
const isTemplate = $page.route.id === '/s/[slug]';
```

#### ❌ Object Spread with Duplicate Properties

```typescript
// WRONG - Duplicate properties cause TypeScript errors
return {
	id: template.id, // ← Duplicate after spread
	title: template.title, // ← Duplicate after spread
	...template, // ← Already includes id, title
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

#### ❌ Generic Record Types in Validator Functions

```typescript
// WRONG - Generic casting loses type information
const stepData = (formData as any)[currentStep] as Record<string, unknown>;
formErrors = validators[currentStep](stepData); // ← Type mismatch

// CORRECT - Use explicit type checks for each step
if (currentStep === 'objective') {
	formErrors = validators.objective(formData.objective);
} else if (currentStep === 'audience') {
	formErrors = validators.audience(formData.audience);
}
```

#### ❌ Prisma Field Naming Inconsistencies

```typescript
// WRONG - Mixing snake_case and camelCase
const user = {
	congressional_district: data.congressionalDistrict, // ← Inconsistent
	verification_method: data.verificationMethod // ← Inconsistent
};

// CORRECT - Use consistent snake_case for Prisma fields
const user = {
	congressional_district: data.congressional_district,
	verification_method: data.verification_method
};
```

### Type Checking Commands:

```bash
# These MUST pass with zero errors:
npm run check         # Runs svelte-check with TypeScript
npx tsc --noEmit      # Pure TypeScript check
npm run build         # Verify production build succeeds

# Quick check during development:
npx tsc --noEmit --skipLibCheck
```

### Pattern-Matching Error Resolution Strategy:

When fixing TypeScript errors, group similar patterns:

1. **Prisma field naming** - Fix all snake_case vs camelCase inconsistencies together
2. **Component event types** - Update all event dispatcher interfaces together
3. **Route comparisons** - Remove all references to non-existent routes together
4. **Object spreads** - Fix all duplicate property conflicts together
5. **Type casting** - Replace all `any` casts with proper type guards together

### ⚡ ENFORCEMENT PROTOCOL ⚡

#### Pre-Commit Requirements (ALL MUST PASS):

```bash
# These commands MUST return ZERO errors or the commit is REJECTED:
npm run check         # TypeScript + Svelte validation
npx tsc --noEmit      # Pure TypeScript compilation check
npm run build         # Production build verification
npm run lint:strict   # Zero-tolerance ESLint check
```

#### Development Workflow Requirements:

- **Before every commit**: Run all type-checking commands
- **Before every PR**: Verify 0 TypeScript errors
- **During development**: Use `npx tsc --noEmit --watch` for real-time checking
- **In CI/CD**: Automated rejection of any type violations

#### Code Review Standards:

- **Any `any` type = INSTANT REJECTION**
- **Any type suppression = INSTANT REJECTION**
- **Any loose casting = INSTANT REJECTION**
- **Any missing interface = REQUIRES IMMEDIATE FIX**

### 💰 THE REAL COST OF TYPE SHORTCUTS 💰

**Why we're this fucking strict:**

- **193+ TypeScript errors** we just spent cycles fixing
- **Hours of development time** wasted on type debugging
- **Production bugs** caused by runtime type mismatches
- **Technical debt** that compounds over time
- **Developer frustration** from dealing with type chaos

**EVERY TYPE SHORTCUT COSTS MORE TIME THAN DOING IT RIGHT THE FIRST TIME.**

### 🎯 ZERO EXCEPTIONS POLICY 🎯

**No matter who you are, no matter how "urgent" the feature:**

- **No temporary `any` types** - There is no such thing as "temporary"
- **No "quick fixes" with type suppression** - Fix the actual issue
- **No "I'll fix it later" type violations** - Fix it now or don't commit
- **No "it's just a test" exceptions** - Tests must be strictly typed too

**Remember: We just spent multiple development cycles fixing 193+ TypeScript errors caused by these exact patterns. This nuclear-level strictness exists because we learned the hard way that type shortcuts are never worth it.**

## Environment

### Required (Core):

```bash
SUPABASE_DATABASE_URL=...           # Supabase Postgres connection string
```

### Congressional Delivery (Optional):

```bash
CWC_API_KEY=...                     # Communicating With Congress API key
CWC_API_BASE_URL=...                # CWC API base URL (default: https://soapbox.senate.gov/api)
```

### OAuth Providers (Optional - any combination):

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

### Webhook Security:

```bash
LAMBDA_WEBHOOK_SECRET=...           # AWS Lambda webhook authentication
VOTER_API_KEY=...                   # VOTER Protocol API authentication
COMMUNIQUE_API_KEY=...              # Internal API authentication
```

### Feature Flags:

```bash
ENABLE_BETA=true                    # Enable beta features (default: false)
NODE_ENV=production                 # Environment (affects OAuth security, logging)
```

### AWS Infrastructure (Optional):

```bash
DYNAMO_TABLE_NAME=...               # DynamoDB table for rate limiting
JOB_STATUS_API_URL=...              # Job status tracking endpoint
MAX_RETRIES=3                       # Maximum retry attempts for CWC submissions
RATE_LIMIT_WINDOW_SECONDS=3600      # Rate limit window (default: 1 hour)
RATE_LIMIT_COUNT=10                 # Rate limit count (default: 10 per hour)
VISIBILITY_TIMEOUT_SECONDS=300      # SQS visibility timeout (default: 5 minutes)
```

## Architecture (Phase 1: Reputation-Only Frontend)

**What Communiqué handles:**
- SvelteKit 5 + TypeScript + Tailwind (frontend framework)
- Supabase (Postgres) via Prisma; cryptographic sessions via `@oslojs/crypto`
- OAuth authentication (Google, Facebook, Twitter, LinkedIn, Discord)
- Address validation → Census Bureau geocoding → congressional district lookup
- Template creation, customization, and 3-layer content moderation
- Witness encryption in browser (XChaCha20-Poly1305 to TEE public key)
- Halo2 zero-knowledge proofs (2-5s TEE-based proving in AWS Nitro Enclaves native Rust)
- Encrypted delivery via CWC API through AWS Nitro Enclaves (ARM-based TEE, no Intel ME/AMD PSP)
- Integration-first testing (53→6 tests, smart mocks, fixtures)

**What voter-protocol handles:**
- Smart contracts on Scroll zkEVM (Ethereum L2)
- Halo2 zero-knowledge proof verification on-chain
- ERC-8004 on-chain reputation tracking
- Multi-agent treasury management (Phase 2)
- Token economics, challenge markets, outcome markets (Phase 2)

**Phase 1 cryptographic flow:**
1. Identity verification: self.xyz NFC passport (70%) + Didit.me (30%) - both FREE
2. Witness encryption: Address encrypted in browser (XChaCha20-Poly1305), sent to Proof Service API
3. ZK proof generation: TEE decrypts witness, generates Halo2 proof (2-5s native Rust), address exists only in TEE memory during proving
4. Encrypted delivery: XChaCha20-Poly1305 → AWS Nitro Enclaves (ARM Graviton, hypervisor-isolated) → CWC API → congressional office
5. Reputation tracking: On-chain ERC-8004 reputation updates (no token rewards yet)

**Phase 2 additions (12-18 months):**
- Token rewards for verified civic actions
- Multi-agent treasury execution (OpenAI + Gemini/Claude consensus)
- Challenge markets (dispute resolution)
- Outcome markets (impact verification)

Code map:

- **Routes/API**: `src/routes/` (pages, SSR, API endpoints)
- **UI Components**: `src/lib/components/` (organized by domain: auth, landing, template, analytics, ui)
- **Core Production**: `src/lib/core/`
  - `auth/` - Authentication, OAuth, session management
  - `analytics/` - Funnel tracking, database analytics
  - `api/` - Unified API client
  - `blockchain/` - VOTER Protocol client integration
  - `congress/` - US Congressional delivery (CWC, address lookup)
  - `legislative/` - Legislative abstraction layer (adapters, delivery pipeline, variable resolution)
  - `server/` - Server-side utilities (verification, sentiment, security, metrics)
  - `db.ts` - Prisma database client
- **Service Layer**: `src/lib/services/`
  - `aws/` - AWS integrations (SQS, DynamoDB)
  - `delivery/` - Email delivery, SMTP server, integration types
- **Agent Infrastructure**: `src/lib/agents/`
  - `content/` - Template moderation and consensus
  - `shared/` - Base agent classes and type guards
  - `voter-protocol/` - Blockchain reward calculation
- **State Management**: `src/lib/stores/` (Svelte 5 runes-based)
- **Utilities**: `src/lib/utils/` (formatting, debounce, portal, template resolution)
- **Types**: `src/lib/types/` (comprehensive TypeScript definitions)
- **Feature-flagged**: `src/lib/features/` (ai-suggestions, config)
- **Integrations**: `src/lib/integrations/` (VOTER Protocol)
- **Data**: `src/lib/data/` (static data files)
- **Actions**: `src/lib/actions/` (Svelte actions)
- **Tests**: `tests/` (integration, unit, e2e, mocks, fixtures)

## Agent Architecture (Multi-Agent Content Moderation + VOTER Protocol)

**Phase 1 (active now):** Content moderation agents only. 3-layer consensus for template quality.

**Phase 2 (12-18 months):** VOTER Protocol agents for treasury management, reward calculation, impact verification.

### Phase 1: Content Moderation Agents

**Active now:**
- **Content Agents** (`src/lib/agents/content/`): Template moderation and quality assessment
- **Shared Infrastructure** (`src/lib/agents/shared/`): Base agent classes, type guards, common utilities

**Consensus Mechanism:**

```typescript
// Multi-agent voting for template approval (Phase 1)
const consensusResult = await agentConsensus.processTemplate({
	template,
	agents: ['openai', 'gemini', 'claude'],
	consensusThreshold: 0.67
});

// Result includes:
// - approval: boolean
// - consensusType: 'unanimous' | 'majority' | 'split'
// - confidence: number
// - reasoning: string[]
```

**Agent Orchestration:**

Template moderation uses LangGraph-based multi-agent consensus:
- **3 AI agents** (OpenAI, Gemini, Claude) vote on template quality
- **LangGraph workflows** orchestrate agent coordination
- **TypeScript orchestration** (N8N deprecated)
- See: `docs/agents/agent-architecture.md` for details
- Code: `src/lib/agents/content/`

### Phase 2: VOTER Protocol Agents (12-18 months)

**Not implemented yet:**
- **VOTER Protocol Agents** (`src/lib/agents/voter-protocol/`): Blockchain reward calculation and verification
- **Multi-agent treasury management**: OpenAI + Gemini/Claude consensus for reward distribution
- **Impact verification**: Cross-agent scoring of civic action outcomes
- **Challenge market agents**: Dispute resolution with economic stakes

### Agent API Endpoints:

```bash
# Phase 1 (active):
POST /api/agents/consensus          # Multi-agent template moderation

# Phase 2 (12-18 months):
POST /api/agents/calculate-reward   # VOTER Protocol reward calculation
POST /api/agents/track-impact       # Impact verification and scoring
POST /api/agents/verify             # Identity and action verification
POST /api/agents/update-reputation  # Reputation score updates
```

### VOTER Protocol Integration (Phase 1: Read-Only + Reputation):

**Phase 1 (current):**
- **Read-only blockchain queries**: Fetch user reputation, platform metrics
- **Reputation tracking**: On-chain ERC-8004 reputation updates (no token rewards)
- **Deterministic address generation**: Wallet-free blockchain participation via passkeys
- **Gas management**: Platform pays all transaction fees

**Phase 2 (12-18 months):**
- **Client-side transaction signing**: Users sign with passkey (Face ID / Touch ID)
- **Token rewards**: Automatic reward distribution for verified civic actions
- **Challenge markets**: Dispute resolution with economic stakes
- **Outcome markets**: Impact verification with reputation + token rewards

**Integration example (Phase 1):**

```typescript
import { voterBlockchainClient } from '$lib/core/blockchain/voter-client';

// Query user reputation (read-only)
const stats = await voterBlockchainClient.getUserStats(userAddress);
// Returns: { actionCount, reputationScore, lastActionTime }

// Query platform metrics
const metrics = await voterBlockchainClient.getPlatformStats();
// Returns: { totalUsers, totalActions, totalReputation }
```

**Integration example (Phase 2):**

```typescript
// Prepare unsigned transaction for user to sign
const { unsignedTx } = await voterBlockchainClient.prepareActionTransaction({
  userAddress,
  actionType: 'CWC_MESSAGE',
  templateId,
  deliveryConfirmation
});

// User signs with passkey (Face ID / Touch ID)
const signedTx = await passkeyWallet.signTransaction(unsignedTx);

// Submit to blockchain for reward distribution
await submitTransaction(signedTx);
```

## Testing (Integration-First Test Suite)

```bash
npm run test             # All tests (integration + unit)
npm run test:run         # All tests (no watch mode)
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

## Database & Seeding

```bash
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes (development)
npm run db:migrate       # Create/run migrations (production)
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed sample data
npm run db:seed:core     # Same as db:seed (alias)
npm run db:start         # Start Docker Compose for local database
```

## Feature Development

```bash
# Standard development
npm run dev

# Enable beta features in development
ENABLE_BETA=true npm run dev
```

Feature flags control access to:

- **Beta features** (`src/lib/features/`): AI suggestions, template intelligence

## Where to read more

- **Test Suite**: `tests/README.md`
- **Database Seeding**: `docs/database-seeding.md`
- **Architecture**: `docs/architecture.md`
- **Integrations**: `docs/integrations.md`
- **Development**: `docs/dev-quickstart.md`
- **Roadmap**: `docs/roadmap.md`
- **Agent Architecture**: `docs/agents/agent-architecture.md`
- **Agent Consensus**: `docs/agents/consensus-roadmap.md`
- **Legislative Abstraction**: `docs/legislative/abstraction-layer.md`
- **Analytics System**: `docs/analytics/overview.md`
- **Template Creator**: `docs/features/template-creator.md`
- **OAuth Setup**: `docs/authentication/oauth-setup.md`
- **CWC Integration**: `docs/congressional/cwc-integration.md`
- **Feature Flags**: `docs/development/feature-flags.md`
