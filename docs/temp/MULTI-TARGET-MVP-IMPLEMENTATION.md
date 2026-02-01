# Multi-Target Template MVP Implementation

> **Status**: REVIEWED - Ready for Implementation
> **Created**: 2026-01-31
> **Last Updated**: 2026-01-31 (Post Expert Review)
> **Reviewers**: UX Architect, Software Architect, QA Architect, CWC Integration Specialist

---

## Executive Summary

The communique platform requires fixes in **THREE areas** to enable multi-target templates:

1. **Multi-Target Submission Logic** - Fire both mailto AND CWC paths
2. **CWC Type/Office Code Fix** - Critical type mismatch between address-lookup and cwc-client
3. **Senate Silent Simulation Removal** - Align with WP-008 principles

### Current Behavior (Broken)
```
Template targets: Congress + Local Decision-Makers
UI shows: "Your 3 representatives" + "Mayor Breed"
Submission: Only fires CWC (decision-makers never contacted)
Office codes: Wrong format (bioguideId instead of H/S{STATE}{DISTRICT})
```

### Target Behavior (Fixed)
```
Template targets: Congress + Local Decision-Makers
UI shows: Pre-action briefing explaining both channels
Submission:
  1. Opens mailto: for decision-makers
  2. Shows parallel progress tracking
  3. Submits to CWC API with correct office codes
```

---

## Critical Issues Identified by Expert Review

### 🔴 CRITICAL: CWC Office Code Type Mismatch

**Location**: `src/lib/core/congress/address-lookup.ts` line 738

**Problem**: Address lookup returns `office_code: bioguideId` instead of formatted CWC codes.

```typescript
// CURRENT (WRONG)
office_code: bioguideId  // Returns "F000062"

// REQUIRED
office_code: CWCGenerator.generateOfficeCode(rep)  // Returns "SCA01" or "HCA13"
```

**Impact**: Senate API may reject submissions with malformed office codes.

### 🔴 CRITICAL: Type Mismatch (snake_case vs camelCase)

**Location**:
- `address-lookup.ts` uses: `bioguide_id`, `office_code` (snake_case)
- `cwc-client.ts` expects: `bioguideId`, `officeCode` (camelCase)

**Impact**: Field access returns `undefined` in XML generation.

### 🔴 CRITICAL: Senate Still Silently Simulates

**Location**: `cwc-client.ts` lines 169-170

**Problem**: When `CWC_API_KEY` missing, returns fake success:
```typescript
return this.simulateSubmission(senator, 'no_api_key');  // Returns success: true!
```

**Required**: Clear failure like House implementation.

### 🔴 CRITICAL: Svelte onMount Cannot Be Async

**Location**: `TemplateModal.svelte` line 141

**Problem**: Implementation doc incorrectly proposed `async onMount()`.

**Constraint**: Svelte's `onMount()` expects synchronous function returning cleanup.

### 🔴 CRITICAL: handleUnifiedEmailFlow Returns Void

**Location**: `TemplateModal.svelte` line 177

**Problem**: Cannot `await` this function - it returns void, not Promise.

---

## Implementation Plan (Revised)

### Phase 0: CWC Type Fixes (PREREQUISITE)

**Must complete before multi-target works.**

#### Fix 0.1: Create Type Adapter

**File**: `src/lib/core/congress/types.ts` (NEW)

```typescript
import { CWCGenerator } from './cwc-generator';

/**
 * Representative from address-lookup (snake_case)
 */
export interface Representative {
  bioguide_id: string;
  name: string;
  party: string;
  state: string;
  district: string;
  chamber: 'house' | 'senate';
  office_code: string;  // Currently set to bioguide_id (wrong)
  is_voting_member?: boolean;
  delegate_type?: 'delegate' | 'resident_commissioner';
}

/**
 * CongressionalOffice for CWC client (camelCase)
 */
export interface CongressionalOffice {
  bioguideId: string;
  name: string;
  party: string;
  state: string;
  district: string;
  chamber: 'house' | 'senate';
  officeCode: string;  // Must be formatted: H{STATE}{DISTRICT} or S{STATE}{01-03}
}

/**
 * Convert Representative to CongressionalOffice with proper office code
 */
export function toCongressionalOffice(rep: Representative): CongressionalOffice {
  return {
    bioguideId: rep.bioguide_id,
    name: rep.name,
    party: rep.party,
    state: rep.state,
    district: rep.district,
    chamber: rep.chamber,
    officeCode: CWCGenerator.generateOfficeCode({
      bioguideId: rep.bioguide_id,
      name: rep.name,
      party: rep.party,
      state: rep.state,
      district: rep.district,
      chamber: rep.chamber,
      officeCode: ''  // Will be generated
    })
  };
}

/**
 * Convert array of Representatives to CongressionalOffices
 */
export function toCongressionalOffices(reps: Representative[]): CongressionalOffice[] {
  return reps.map(toCongressionalOffice);
}
```

#### Fix 0.2: Update submit-mvp Endpoint

**File**: `src/routes/api/cwc/submit-mvp/+server.ts`

```typescript
// Line ~100: After getRepresentativesForAddress()
import { toCongressionalOffices } from '$lib/core/congress/types';

const rawRepresentatives = await getRepresentativesForAddress(address);
const representatives = toCongressionalOffices(rawRepresentatives);

// Now safe to pass to cwcClient.submitToAllRepresentatives()
```

#### Fix 0.3: Remove Senate Silent Simulation

**File**: `src/lib/core/congress/cwc-client.ts`

Replace lines 169-170:
```typescript
// BEFORE (WRONG)
if (!this.apiKey) {
  return this.simulateSubmission(senator, 'no_api_key');
}

// AFTER (CORRECT - matches House behavior)
if (!this.apiKey) {
  console.warn('[CWC Senate] No API key configured - submission will fail');
  return {
    success: false,
    status: 'failed' as const,
    office: senator.name,
    chamber: 'senate' as const,
    timestamp: new Date().toISOString(),
    error: 'Senate CWC delivery not configured. Set CWC_API_KEY environment variable.',
    details: {
      configuration: 'missing_api_key',
      action: 'Configure CWC_API_KEY in environment'
    }
  };
}
```

---

### Phase 1: Multi-Target Detection

**File**: `src/lib/components/template/TemplateModal.svelte`

Add detection function after imports:

```typescript
import { parseRecipientConfig } from '$lib/utils/deriveTargetPresentation';

interface MultiTargetInfo {
  hasCongressional: boolean;
  hasDecisionMakers: boolean;
  isMultiTarget: boolean;
  decisionMakerNames: string[];
}

function detectMultiTarget(template: ComponentTemplate): MultiTargetInfo {
  const config = parseRecipientConfig(template.recipient_config);

  const hasCongressional =
    template.deliveryMethod === 'cwc' ||
    (config?.cwcRouting === true);

  const decisionMakers = config?.decisionMakers ?? [];
  const emails = config?.emails ?? [];

  const hasDecisionMakers =
    decisionMakers.length > 0 || emails.length > 0;

  const decisionMakerNames = decisionMakers
    .slice(0, 2)
    .map(dm => dm.shortName || dm.name);

  return {
    hasCongressional,
    hasDecisionMakers,
    isMultiTarget: hasCongressional && hasDecisionMakers,
    decisionMakerNames
  };
}
```

---

### Phase 2: Modal State Machine Extension

**File**: `src/lib/components/template/TemplateModal.svelte`

Add new state variables:

```typescript
// Multi-target state tracking
let multiTargetInfo = $state<MultiTargetInfo | null>(null);
let multiTargetProgress = $state<{
  mailtoLaunched: boolean;
  mailtoConfirmed: boolean;
  cwcStarted: boolean;
  cwcComplete: boolean;
  cwcResults: CWCSubmissionResult[] | null;
}>({
  mailtoLaunched: false,
  mailtoConfirmed: false,
  cwcStarted: false,
  cwcComplete: false,
  cwcResults: null
});

// Track component lifecycle for navigation guard
let componentActive = true;

onDestroy(() => {
  componentActive = false;
  useTimerCleanup(componentId)();
  // ... existing cleanup
});
```

---

### Phase 3: Modify onMount (Synchronous)

**File**: `src/lib/components/template/TemplateModal.svelte`

Replace lines 141-156:

```typescript
onMount(() => {
  // Detect multi-target FIRST
  multiTargetInfo = detectMultiTarget(template);

  if (multiTargetInfo.isMultiTarget) {
    console.log('[TemplateModal] Multi-target template detected');

    // Show briefing state (user understands two things will happen)
    modalActions.setState('multi-target-briefing');
    return;
  }

  // Single-target flows (unchanged)
  if (template.deliveryMethod === 'cwc') {
    console.log('[TemplateModal] Congressional template detected, initiating CWC flow');
    submitCongressionalMessage();
    return;
  }

  // Decision-makers only
  handleUnifiedEmailFlow();
});
```

---

### Phase 4: Multi-Target Briefing State

Add handler for briefing acknowledgment:

```typescript
/**
 * User acknowledged the dual-track briefing, proceed with both channels
 */
function handleMultiTargetProceed() {
  console.log('[TemplateModal] Multi-target: User acknowledged, starting dual-track flow');

  // Step 1: Launch mailto for decision-makers
  // This is synchronous - opens email client
  handleUnifiedEmailFlow();
  multiTargetProgress.mailtoLaunched = true;

  // Step 2: Check if we need address for CWC
  const user = $page.data?.user;
  const hasAddress = user?.street && user?.city && user?.state && user?.zip;

  if (!user) {
    // Guest user: mailto sent, prompt auth for CWC
    console.log('[TemplateModal] Multi-target: Guest user, prompting auth for CWC');
    coordinated.setTimeout(() => {
      if (!componentActive) return;
      // Store pending CWC
      sessionStorage.setItem('pendingCwcTemplate', template.id);
      dispatch('close');
      modalActions.openModal('onboarding-modal', 'onboarding', {
        template,
        source: 'multi-target-cwc',
        message: 'Create an account to contact your congressional representatives'
      });
    }, 2000, 'guest-multi-target-auth', componentId);
    return;
  }

  if (!hasAddress) {
    // Authenticated but no address: mailto sent, collect address for CWC
    console.log('[TemplateModal] Multi-target: Collecting address for CWC');
    coordinated.setTimeout(() => {
      if (!componentActive) return;
      modalActions.setState('multi-target-address');
      collectingAddress = true;
      needsAddress = true;
    }, 2000, 'multi-target-address-gate', componentId);
    return;
  }

  // Has user + address: proceed to CWC after delay
  console.log('[TemplateModal] Multi-target: Proceeding to CWC submission');
  coordinated.setTimeout(() => {
    if (!componentActive) return;
    multiTargetProgress.cwcStarted = true;
    submitCongressionalMessage();
  }, 3000, 'multi-target-cwc', componentId);
}

/**
 * After address collected in multi-target flow, continue to CWC
 */
function handleMultiTargetAddressComplete() {
  console.log('[TemplateModal] Multi-target: Address collected, proceeding to CWC');
  collectingAddress = false;
  needsAddress = false;
  multiTargetProgress.cwcStarted = true;
  submitCongressionalMessage();
}
```

---

### Phase 5: New Modal States (UI)

Add to the template section:

```svelte
<!-- Multi-Target Briefing State -->
{:else if $modalState?.state === 'multi-target-briefing' && multiTargetInfo}
  <div class="p-6">
    <h3 class="text-lg font-semibold text-slate-900 mb-4">
      Contacting {3 + multiTargetInfo.decisionMakerNames.length} decision-makers
    </h3>

    <div class="space-y-3 mb-6">
      <!-- Your Action: Email -->
      <div class="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
        <div class="flex items-center gap-2 mb-1">
          <Send class="h-4 w-4 text-amber-600" />
          <span class="font-medium text-amber-900">Your email client will open</span>
        </div>
        <p class="text-sm text-amber-700">
          {multiTargetInfo.decisionMakerNames.join(', ')}
          {#if multiTargetInfo.decisionMakerNames.length < (multiTargetInfo.decisionMakers?.length ?? 0)}
            +{(multiTargetInfo.decisionMakers?.length ?? 0) - multiTargetInfo.decisionMakerNames.length} more
          {/if}
          — you'll review and send
        </p>
      </div>

      <!-- System Action: Congress -->
      <div class="rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4">
        <div class="flex items-center gap-2 mb-1">
          <ShieldCheck class="h-4 w-4 text-blue-600" />
          <span class="font-medium text-blue-900">Automatic delivery to Congress</span>
        </div>
        <p class="text-sm text-blue-700">
          Your 3 representatives — we'll deliver through verified channels
        </p>
      </div>
    </div>

    <Button
      variant="primary"
      size="lg"
      classNames="w-full"
      onclick={handleMultiTargetProceed}
    >
      <Send class="mr-2 h-5 w-5" />
      Start — Open Email & Deliver to Congress
    </Button>
  </div>

<!-- Multi-Target Progress State -->
{:else if $modalState?.state === 'multi-target-progress'}
  <div class="p-6 space-y-4">
    <!-- Email Track -->
    <div class="rounded-lg border border-slate-200 p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium text-slate-900">
            Email to {multiTargetInfo?.decisionMakerNames.join(', ')}
          </p>
          <p class="text-sm text-slate-600">
            {#if multiTargetProgress.mailtoConfirmed}
              Sent
            {:else if multiTargetProgress.mailtoLaunched}
              Did you send it?
            {:else}
              Preparing...
            {/if}
          </p>
        </div>
        {#if multiTargetProgress.mailtoConfirmed}
          <CheckCircle2 class="h-5 w-5 text-green-600" />
        {:else if multiTargetProgress.mailtoLaunched}
          <div class="flex gap-2">
            <Button size="sm" onclick={() => { multiTargetProgress.mailtoConfirmed = true; }}>
              Yes, sent
            </Button>
            <Button size="sm" variant="ghost" onclick={() => handleUnifiedEmailFlow()}>
              Retry
            </Button>
          </div>
        {:else}
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        {/if}
      </div>
    </div>

    <!-- Congress Track -->
    <div class="rounded-lg border border-slate-200 p-4">
      {#if multiTargetProgress.cwcStarted}
        <CWCProgressTracker
          submissionId={submissionId}
          template={template}
          onComplete={(results) => {
            multiTargetProgress.cwcComplete = true;
            multiTargetProgress.cwcResults = results;
          }}
        />
      {:else}
        <div class="flex items-center gap-3">
          <div class="h-5 w-5 animate-pulse rounded-full bg-blue-200" />
          <p class="text-slate-600">Congress delivery will start after email...</p>
        </div>
      {/if}
    </div>

    <!-- Combined Completion -->
    {#if multiTargetProgress.mailtoConfirmed && multiTargetProgress.cwcComplete}
      <div class="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
        <CheckCircle2 class="h-8 w-8 text-green-600 mx-auto mb-2" />
        <p class="font-medium text-green-900">
          All {3 + (multiTargetInfo?.decisionMakerNames.length ?? 0)} decision-makers contacted
        </p>
      </div>
    {/if}
  </div>

<!-- Multi-Target Address Collection -->
{:else if $modalState?.state === 'multi-target-address'}
  <div class="p-6">
    <div class="rounded-lg bg-green-50 border border-green-200 p-3 mb-4">
      <div class="flex items-center gap-2">
        <CheckCircle2 class="h-4 w-4 text-green-600" />
        <span class="text-sm text-green-800">
          Email opened for {multiTargetInfo?.decisionMakerNames.join(', ')}
        </span>
      </div>
    </div>

    <h3 class="text-lg font-semibold mb-2">Now, let's contact Congress</h3>
    <p class="text-sm text-slate-600 mb-4">
      Enter your address to verify your congressional district
    </p>

    <AddressCollectionForm
      {template}
      onComplete={handleMultiTargetAddressComplete}
    />
  </div>
{/if}
```

---

### Phase 6: Export parseRecipientConfig

**File**: `src/lib/utils/deriveTargetPresentation.ts`

Ensure function is exported (add `export` if missing):

```typescript
// Line 147 - verify export keyword present
export function parseRecipientConfig(recipientConfig: unknown): PerceptualRecipientConfig | null {
```

---

## Testing Scenarios

### Unit Tests

```typescript
describe('detectMultiTarget', () => {
  it('returns isMultiTarget: true for cwc + decisionMakers', () => {
    const template = {
      deliveryMethod: 'cwc',
      recipient_config: { decisionMakers: [{ name: 'Mayor' }] }
    };
    expect(detectMultiTarget(template).isMultiTarget).toBe(true);
  });

  it('returns isMultiTarget: true for email + cwcRouting', () => {
    const template = {
      deliveryMethod: 'email',
      recipient_config: { cwcRouting: true, emails: ['test@example.com'] }
    };
    expect(detectMultiTarget(template).isMultiTarget).toBe(true);
  });

  it('returns isMultiTarget: false for cwc only', () => {
    const template = {
      deliveryMethod: 'cwc',
      recipient_config: {}
    };
    expect(detectMultiTarget(template).isMultiTarget).toBe(false);
  });
});

describe('toCongressionalOffice', () => {
  it('converts snake_case to camelCase', () => {
    const rep = { bioguide_id: 'P000197', office_code: 'P000197' };
    const office = toCongressionalOffice(rep);
    expect(office.bioguideId).toBe('P000197');
    expect(office.officeCode).toMatch(/^[HS][A-Z]{2}\d{2}$/);
  });

  it('generates correct Senate office code', () => {
    const rep = { bioguide_id: 'F000062', state: 'CA', chamber: 'senate' };
    const office = toCongressionalOffice(rep);
    expect(office.officeCode).toMatch(/^SCA0[123]$/);
  });

  it('generates correct House office code', () => {
    const rep = { bioguide_id: 'P000197', state: 'CA', district: '11', chamber: 'house' };
    const office = toCongressionalOffice(rep);
    expect(office.officeCode).toBe('HCA11');
  });
});
```

### Integration Tests

1. Multi-target with authenticated user + address
2. Multi-target with authenticated user, no address
3. Multi-target with guest user
4. CWC type conversion in submit-mvp endpoint
5. Senate fails clearly when no API key

### E2E Tests

1. Full multi-target flow: briefing → mailto → progress → CWC → completion
2. Navigation away during delay: component cleanup guards
3. Partial CWC failure: per-representative results displayed

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/lib/core/congress/types.ts` | NEW: Type adapter | P0 |
| `src/lib/core/congress/cwc-client.ts` | Remove Senate simulation | P0 |
| `src/routes/api/cwc/submit-mvp/+server.ts` | Use type adapter | P0 |
| `src/lib/components/template/TemplateModal.svelte` | Multi-target logic + states | P1 |
| `src/lib/utils/deriveTargetPresentation.ts` | Export parseRecipientConfig | P1 |
| `src/lib/components/template/CWCProgressTracker.svelte` | onComplete callback | P2 |

---

## Environment Requirements

```env
# Required for ANY congressional delivery
CWC_API_KEY=<senate-api-key>
CONGRESS_API_KEY=<congress-gov-api-key>

# Required for House delivery (fails clearly if missing)
GCP_PROXY_URL=<whitelisted-proxy-url>
GCP_PROXY_AUTH_TOKEN=<proxy-auth-token>
```

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Navigation away during delay | `componentActive` guard before setTimeout callbacks |
| Session expires mid-flow | Consider auth refresh before CWC (P2) |
| Mailto fails silently | "Did you send?" confirmation with retry |
| CWC partial failure | Per-representative results in UI |
| Type mismatch | Explicit adapter function with tests |

---

## Open Questions (Resolved by Review)

| Question | Resolution |
|----------|------------|
| Timing between mailto and CWC | 3 seconds (increased from 1.5s per architect review) |
| onMount async? | NO - Svelte constraint, must be synchronous |
| parseRecipientConfig import safe? | YES - no circular dependency risk |
| What if user closes mid-flow? | componentActive guard + sessionStorage for pending CWC |

---

## Appendix: Expert Review Summary

### UX/Perceptual Review
- ✅ Adopted: Pre-action briefing state
- ✅ Adopted: Parallel progress tracking
- ✅ Adopted: Warm/cool color coding (amber for user, blue for system)
- ✅ Adopted: "Did you send?" confirmation pattern

### Architecture Review
- ✅ Fixed: onMount cannot be async
- ✅ Fixed: handleUnifiedEmailFlow returns void
- ✅ Fixed: Delay increased to 3s
- ✅ Added: componentActive lifecycle guard
- ✅ Added: Type adapter for CWC

### QA Review
- ✅ Addressed: Guest auth gate
- ✅ Addressed: Address gating for mailto
- ✅ Addressed: Navigation guard
- ✅ Addressed: Partial failure UI
- ⚠️ Deferred: Session refresh (P2)
- ⚠️ Deferred: Template snapshot for data race (P2)

### CWC Integration Review
- ✅ Fixed: Type mismatch (snake_case → camelCase)
- ✅ Fixed: Office code generation
- ✅ Fixed: Senate silent simulation removed
- ⚠️ Deferred: Enhanced error logging (P2)
