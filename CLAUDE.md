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

### 🚨 NUCLEAR-LEVEL TYPESCRIPT STRICTNESS - ABSOLUTE ZERO TOLERANCE 🚨

**WE JUST SPENT MULTIPLE DEVELOPMENT CYCLES FIXING 193+ TYPESCRIPT ERRORS CAUSED BY LAZY TYPE PRACTICES. THIS STOPS NOW.**

**EVERY SINGLE TYPE SHORTCUT COSTS US DEVELOPMENT TIME. EVERY `any` TYPE LEADS TO PRODUCTION BUGS. EVERY TYPE SUPPRESSION COMMENT CREATES TECHNICAL DEBT.**

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

### ESLint & TypeScript Rules

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
