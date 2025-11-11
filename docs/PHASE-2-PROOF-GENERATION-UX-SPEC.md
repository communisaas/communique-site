# Phase 2: Proof Generation UX Specification
**Date**: 2025-11-10
**Status**: Ready for Design + Implementation
**Philosophy**: "Making Zero-Knowledge Proofs Invisible"

---

## TL;DR: What the User Experiences

**User's Mental Model:**
1. ✅ I verified my identity once (30 seconds, 6 months ago)
2. ✅ I customized this template with my story
3. 👉 **I click "Send to Representative"**
4. ⏳ (10 seconds of "Preparing secure delivery...")
5. ✅ Done. Message delivered anonymously.

**What Actually Happens (Invisible):**
1. Browser loads ZK proof generation module (WASM, 5.1MB)
2. Retrieves session credential from IndexedDB (merkle_path cached)
3. Generates Halo2 zero-knowledge proof (2-5s desktop, 8-15s mobile)
4. Encrypts witness to TEE public key (XChaCha20-Poly1305)
5. Submits proof + encrypted blob to backend
6. Backend verifies proof on-chain (Scroll zkEVM)
7. TEE decrypts + delivers to congressional office (CWC API)
8. On-chain reputation updated (ERC-8004)

**User Never Sees**: Halo2 circuits, Merkle paths, nullifiers, proof bytes, gas fees, blockchain transactions

**User Only Sees**: "✅ Delivered anonymously to Representative Smith"

---

## Design Principles for Zero-Knowledge UX

### 1. **Trust Through Timing**
**Problem**: ZK proof generation takes 2-15 seconds
**Anti-pattern**: "Generating cryptographic proof using Halo2 SHPLONK..."
**Correct pattern**: "Preparing secure delivery..."

**Why**: Users trust processes that match their mental model. "Secure delivery" = understandable. "SHPLONK" = gibberish that triggers suspicion.

### 2. **Educational Opportunity, Not Burden**
**Problem**: User is waiting 8-15 seconds on mobile
**Anti-pattern**: Blank loading spinner with no context
**Correct pattern**: Cycle educational messages every 3 seconds

**Educational messages** (rotate):
- "✓ Your exact address stays private"
- "✓ Congressional staff see: 'Verified constituent from CA-12'"
- "✓ Building your civic reputation on-chain"

**Why**: Waiting time becomes value communication. User learns why this matters without being lectured.

### 3. **Progressive Enhancement, Not Gatekeeping**
**Problem**: User returns after 30 days, has cached credentials
**Anti-pattern**: Re-show verification flow "for security"
**Correct pattern**: Skip straight to proof generation (instant send)

**Why**: Returning users should feel rewarded for verification, not punished with friction.

### 4. **Graceful Degradation on Errors**
**Problem**: Proof generation fails (old device, low memory)
**Anti-pattern**: "Error: WASM module failed to initialize"
**Correct pattern**: "This device may not support anonymous delivery. Use direct send instead?"

**Why**: Users don't care about WASM. They care about sending their message. Offer fallback.

---

## Component Architecture

### **New Component: `ProofGenerator.svelte`**

**Purpose**: Orchestrate ZK proof generation with educational loading states

**Location**: `/src/lib/components/zkp/ProofGenerator.svelte`

**Props**:
```typescript
interface Props {
  userId: string;
  templateId: string;
  messageContent: string;
  onProgress?: (state: ProofGenerationState) => void;
  onComplete?: (result: ProofResult) => void;
  onError?: (error: ProofError) => void;
}
```

**State Machine**:
```typescript
type ProofGenerationState =
  | { status: 'idle' }
  | { status: 'loading-credential' }           // Check IndexedDB (instant)
  | { status: 'initializing-prover'; progress: number }  // Load WASM (5-10s first time)
  | { status: 'generating-proof'; progress: number }     // Generate proof (2-15s)
  | { status: 'encrypting-witness' }           // Encrypt address (<100ms)
  | { status: 'submitting' }                   // POST to backend (<1s)
  | { status: 'complete'; submissionId: string }
  | { status: 'error'; message: string; recoverable: boolean }
```

**Visual Treatment**:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Loader2, Lock, Check, ShieldCheck } from '@lucide/svelte';

  let state = $state<ProofGenerationState>({ status: 'idle' });
  let educationIndex = $state(0);

  // Cycle educational messages every 3 seconds
  $effect(() => {
    if (state.status === 'generating-proof') {
      const interval = setInterval(() => {
        educationIndex = (educationIndex + 1) % 3;
      }, 3000);
      return () => clearInterval(interval);
    }
  });
</script>

{#if state.status === 'loading-credential'}
  <div class="proof-loader">
    <Loader2 class="h-8 w-8 animate-spin text-blue-600" />
    <p class="text-slate-700">Checking verification...</p>
  </div>

{:else if state.status === 'initializing-prover'}
  <div class="proof-loader">
    <Lock class="h-12 w-12 text-blue-600 animate-pulse" />
    <h3 class="text-lg font-semibold text-slate-900">Loading privacy tools...</h3>
    <p class="text-sm text-slate-600">First time setup: 5-10 seconds</p>
    <div class="progress-bar">
      <div class="progress-fill" style="width: {state.progress}%"></div>
    </div>
  </div>

{:else if state.status === 'generating-proof'}
  <div class="proof-loader">
    <ShieldCheck class="h-12 w-12 text-blue-600 animate-pulse" />
    <h3 class="text-lg font-semibold text-slate-900">Preparing secure delivery...</h3>
    <p class="text-sm text-slate-600">
      Proving you're a constituent without revealing your identity
    </p>
    <div class="progress-bar">
      <div class="progress-fill" style="width: {state.progress}%"></div>
    </div>

    <!-- Educational messaging (cycles every 3s) -->
    {#if educationIndex === 0}
      <div class="education-message">
        <Check class="h-4 w-4 text-green-600" />
        <span class="text-sm text-slate-700">Your exact address stays private</span>
      </div>
    {:else if educationIndex === 1}
      <div class="education-message">
        <Check class="h-4 w-4 text-green-600" />
        <span class="text-sm text-slate-700">
          Congressional staff see: "Verified constituent from {district}"
        </span>
      </div>
    {:else}
      <div class="education-message">
        <Check class="h-4 w-4 text-green-600" />
        <span class="text-sm text-slate-700">Building your civic reputation on-chain</span>
      </div>
    {/if}
  </div>

{:else if state.status === 'encrypting-witness'}
  <div class="proof-loader">
    <Lock class="h-8 w-8 text-blue-600 animate-pulse" />
    <p class="text-slate-700">Encrypting delivery details...</p>
  </div>

{:else if state.status === 'submitting'}
  <div class="proof-loader">
    <Loader2 class="h-8 w-8 animate-spin text-blue-600" />
    <p class="text-slate-700">Sending to Representative {representativeName}...</p>
  </div>

{:else if state.status === 'complete'}
  <div class="proof-success">
    <div class="success-icon">
      <Check class="h-12 w-12 text-white" strokeWidth={3} />
    </div>
    <h3 class="text-2xl font-bold text-slate-900">Delivered Successfully!</h3>
    <p class="text-slate-600">Your message was sent anonymously to Representative {representativeName}</p>

    <div class="delivery-details">
      <div class="detail-item">
        <ShieldCheck class="h-5 w-5 text-green-600" />
        <span>Anonymous delivery</span>
      </div>
      <div class="detail-item">
        <Lock class="h-5 w-5 text-green-600" />
        <span>Cryptographically verified</span>
      </div>
      <div class="detail-item">
        <Check class="h-5 w-5 text-green-600" />
        <span>Reputation increased (+1)</span>
      </div>
    </div>
  </div>

{:else if state.status === 'error'}
  <div class="proof-error">
    <AlertCircle class="h-12 w-12 text-red-600" />
    <h3 class="text-lg font-semibold text-slate-900">Unable to Generate Proof</h3>
    <p class="text-sm text-slate-600">{state.message}</p>

    {#if state.recoverable}
      <button onclick={retryProof} class="btn-primary">Try Again</button>
    {:else}
      <div class="fallback-options">
        <p class="text-sm text-slate-600">
          This device may not support anonymous delivery (requires ~800MB memory).
        </p>
        <button onclick={useFallback} class="btn-secondary">
          Use Direct Send Instead
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .proof-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    text-align: center;
  }

  .progress-bar {
    width: 100%;
    max-width: 300px;
    height: 8px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(to right, #3b82f6, #6366f1);
    transition: width 200ms ease;
  }

  .education-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(34, 197, 94, 0.05);
    border-radius: 0.5rem;
    margin-top: 1rem;
  }

  .proof-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    text-align: center;
  }

  .success-icon {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
  }

  .delivery-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding: 1.5rem;
    background: rgba(34, 197, 94, 0.05);
    border-radius: 0.75rem;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #475569;
  }
</style>
```

---

## Performance Targets & UX Mitigation

### Desktop (2024+ Hardware)
**Target Performance**:
- First-time initialization: 5-7 seconds
- Cached initialization: <100ms
- Proof generation: 1-3 seconds
- Total time: 2-5 seconds (cached)

**UX Mitigation**:
- Show "Loading privacy tools..." on first use
- Cache WASM module + prover keys in IndexedDB
- Subsequent proofs feel instant (2-3s is acceptable)

### Mobile (2020+ Devices)
**Target Performance**:
- First-time initialization: 10-15 seconds
- Cached initialization: 1-2 seconds
- Proof generation: 8-15 seconds
- Total time: 10-18 seconds

**UX Mitigation**:
- **Educational messaging**: Use wait time to explain benefits
- **Progress indicator**: Show proof generation progress (not just spinner)
- **Clear time estimate**: "~10 seconds on mobile" sets expectations
- **Mobile optimization**: Lazy-load WASM only when needed

---

## Integration Points

### 1. **Template Submission Flow** (`/s/[slug]`)

**Current Flow**:
```
1. User customizes template
2. User clicks "Send Message"
3. VerificationGate checks if verified
4. If verified → Submit to CWC API
5. If not verified → Show identity verification
```

**New Flow (Phase 2)**:
```
1. User customizes template
2. User clicks "Send Message"
3. VerificationGate checks if verified
4. If not verified → Show identity verification
5. If verified → Check Shadow Atlas registration
6. If not registered → Register in Shadow Atlas
7. If registered → Generate ZK proof (ProofGenerator)
8. Submit proof + encrypted blob to backend
9. Success confirmation
```

**Implementation**:
```svelte
<!-- /src/routes/s/[slug]/+page.svelte -->
<script lang="ts">
  import ProofGenerator from '$lib/components/zkp/ProofGenerator.svelte';
  import { isShadowAtlasRegistered } from '$lib/core/identity/shadow-atlas-handler';

  let showProofGenerator = $state(false);

  async function handleSendMessage() {
    // Check if user is verified
    if (!isVerified) {
      showVerificationModal = true;
      return;
    }

    // Check if user is registered in Shadow Atlas
    const isRegistered = await isShadowAtlasRegistered(userId);
    if (!isRegistered) {
      // Trigger Shadow Atlas registration (automatic)
      await registerInShadowAtlas({...});
    }

    // Show proof generation UI
    showProofGenerator = true;
  }

  function handleProofComplete(event: CustomEvent<ProofResult>) {
    // Proof generated successfully
    submissionId = event.detail.submissionId;
    showSuccessMessage = true;
  }
</script>

{#if showProofGenerator}
  <Modal>
    <ProofGenerator
      {userId}
      templateId={template.id}
      messageContent={customizedMessage}
      on:complete={handleProofComplete}
      on:error={handleProofError}
    />
  </Modal>
{/if}
```

### 2. **Direct Integration in TemplateModal**

**For seamless UX, integrate directly into submission button**:

```svelte
<!-- /src/lib/components/template/TemplateModal.svelte -->
<button onclick={handleSubmit} class="btn-primary">
  {#if isGeneratingProof}
    <Loader2 class="animate-spin" /> Preparing secure delivery...
  {:else}
    Send to Representative {representative.name}
  {/if}
</button>

{#if isGeneratingProof}
  <ProofGenerator
    {userId}
    templateId={template.id}
    messageContent={customizedMessage}
    onProgress={handleProgress}
    onComplete={handleComplete}
    onError={handleError}
  />
{/if}
```

---

## Error Handling & Recovery

### Error Categories

#### 1. **Credential Missing** (Recoverable)
**Cause**: Session credential expired or cleared
**User Message**: "Your verification has expired. Please verify again (30 seconds)"
**Recovery**: Show identity verification flow

#### 2. **WASM Initialization Failed** (Sometimes Recoverable)
**Cause**: Browser incompatibility, memory limits
**User Message**: "Unable to load privacy tools. This device may not be supported."
**Recovery**: Offer retry OR fallback to direct send

#### 3. **Proof Generation Failed** (Recoverable)
**Cause**: Invalid merkle_path, insufficient memory
**User Message**: "Proof generation failed. Please try again."
**Recovery**: Retry with fresh Shadow Atlas data

#### 4. **Submission Failed** (Recoverable)
**Cause**: Network error, backend unavailable
**User Message**: "Unable to submit message. Please try again."
**Recovery**: Retry submission (proof already generated)

### Error Recovery UI

```svelte
{#if error}
  <div class="error-state">
    <AlertCircle class="h-12 w-12 text-red-600" />
    <h3 class="text-lg font-semibold">Unable to Send Message</h3>
    <p class="text-sm text-slate-600">{error.message}</p>

    <div class="error-actions">
      {#if error.recoverable}
        <button onclick={retry} class="btn-primary">Try Again</button>
      {/if}

      {#if error.code === 'WASM_INIT_FAILED'}
        <button onclick={useFallback} class="btn-secondary">
          Use Direct Send (No Anonymous Delivery)
        </button>
      {/if}

      <button onclick={contactSupport} class="btn-text">Contact Support</button>
    </div>

    <details class="technical-details">
      <summary>Technical Details</summary>
      <code>{JSON.stringify(error, null, 2)}</code>
    </details>
  </div>
{/if}
```

---

## Testing Strategy

### Unit Tests

```typescript
// ProofGenerator.test.ts
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ProofGenerator from '$lib/components/zkp/ProofGenerator.svelte';

describe('ProofGenerator', () => {
  test('shows loading state initially', async () => {
    const { getByText } = render(ProofGenerator, {
      props: { userId: 'test', templateId: 'test', messageContent: 'test' }
    });

    expect(getByText('Checking verification...')).toBeInTheDocument();
  });

  test('progresses through proof generation states', async () => {
    const { getByText } = render(ProofGenerator, { ... });

    await waitFor(() => expect(getByText('Loading privacy tools...')).toBeInTheDocument());
    await waitFor(() => expect(getByText('Preparing secure delivery...')).toBeInTheDocument());
    await waitFor(() => expect(getByText('Delivered Successfully!')).toBeInTheDocument());
  });

  test('shows educational messages during proof generation', async () => {
    const { getByText } = render(ProofGenerator, { ... });

    await waitFor(() => expect(getByText(/Your exact address stays private/)).toBeInTheDocument());

    // Wait for message rotation (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));

    expect(getByText(/Congressional staff see/)).toBeInTheDocument();
  });

  test('handles errors gracefully', async () => {
    // Mock proof generation failure
    vi.mock('$lib/core/proof/prover', () => ({
      generateProof: vi.fn().mockRejectedValue(new Error('WASM init failed'))
    }));

    const { getByText } = render(ProofGenerator, { ... });

    await waitFor(() => expect(getByText('Unable to Generate Proof')).toBeInTheDocument());
    expect(getByText('Try Again')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// proof-generation-flow.test.ts
import { test, expect } from '@playwright/test';

test('complete proof generation flow', async ({ page }) => {
  // 1. Navigate to template
  await page.goto('/s/climate-action');

  // 2. Customize message
  await page.fill('[data-testid="message-editor"]', 'My climate story...');

  // 3. Click send (user already verified)
  await page.click('[data-testid="send-message"]');

  // 4. Verify proof generation modal appears
  await expect(page.locator('text=Preparing secure delivery...')).toBeVisible();

  // 5. Wait for educational messages to cycle
  await expect(page.locator('text=Your exact address stays private')).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page.locator('text=Congressional staff see')).toBeVisible();

  // 6. Wait for proof generation to complete (up to 20s on CI)
  await expect(page.locator('text=Delivered Successfully!')).toBeVisible({ timeout: 20000 });

  // 7. Verify success message shows correct details
  await expect(page.locator('text=Anonymous delivery')).toBeVisible();
  await expect(page.locator('text=Cryptographically verified')).toBeVisible();
  await expect(page.locator('text=Reputation increased')).toBeVisible();
});

test('handles proof generation failure gracefully', async ({ page }) => {
  // Mock proof generation failure
  await page.route('**/api/congressional/submit', route => {
    route.abort('failed');
  });

  await page.goto('/s/climate-action');
  await page.fill('[data-testid="message-editor"]', 'Test message');
  await page.click('[data-testid="send-message"]');

  // Should show error state
  await expect(page.locator('text=Unable to Send Message')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('text=Try Again')).toBeVisible();
});
```

---

## Success Metrics

### Technical Performance
- **95% of proofs complete in <20s** (including mobile)
- **<1% WASM initialization failures** (browser compatibility)
- **<5% proof generation failures** (invalid credentials, memory)
- **<1% submission failures** (network, backend availability)

### User Experience
- **<5% drop-off during proof generation** (users wait through loading)
- **80% understand "anonymous delivery"** (exit survey)
- **<10% ask "why does this take 10 seconds?"** (clear messaging)
- **90% complete message send in <5 minutes total** (browse → customize → send)

### Conversion Impact
- **No significant drop-off vs. Phase 1** (proof generation doesn't add friction)
- **Increased trust in platform** (anonymous delivery messaging resonates)
- **Higher returning user rate** (cached credentials work seamlessly)

---

## Next Steps

1. **Design Mockups** (Figma)
   - Proof generation loading states
   - Educational messaging variations
   - Error states with recovery paths
   - Success confirmation designs

2. **Implement ProofGenerator Component** (Week 1)
   - State machine implementation
   - Progress tracking
   - Educational message rotation
   - Error handling + recovery

3. **Integration with Template Flow** (Week 2)
   - Integrate into TemplateModal
   - Handle verification → registration → proof flow
   - Test error recovery paths

4. **Mobile Optimization** (Week 3)
   - Reduce memory footprint
   - Optimize proof generation time
   - Test on real devices (2020-2024)

5. **User Testing** (Week 4)
   - A/B test messaging variations
   - Measure drop-off rates
   - Gather qualitative feedback
   - Iterate based on findings

---

**The Golden Rule**: "Preparing secure delivery" should feel like a feature, not a bug. The 10-second wait is an opportunity to communicate value, not a frustration to endure.

---

*Communiqué PBC | Phase 2 UX Specification | 2025-11-10*
