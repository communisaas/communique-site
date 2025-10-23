# Identity Verification UI - Usage Examples

## Complete Integration Examples

### Example 1: Template Submission Flow

**Scenario**: User customizes a congressional message template and needs to verify before sending.

```svelte
<!-- routes/s/[slug]/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import IdentityVerificationFlow from '$lib/components/auth/IdentityVerificationFlow.svelte';
  import VerificationPrompt from '$lib/components/auth/VerificationPrompt.svelte';

  let { data } = $props();
  let showVerificationFlow = $state(false);
  let userVerified = $state(data.user?.verified || false);

  function handleVerificationComplete(event: CustomEvent) {
    const { verified, method } = event.detail;

    // Update user verification status
    userVerified = verified;
    showVerificationFlow = false;

    // Track conversion
    trackEvent('verification_complete', {
      method,
      context: 'template_submission'
    });

    // Continue to submission
    submitTemplate();
  }

  async function submitTemplate() {
    const response = await fetch('/api/templates/submit', {
      method: 'POST',
      body: JSON.stringify({
        templateId: data.template.id,
        customizations: data.customizations,
        verified: userVerified
      })
    });

    if (response.ok) {
      goto(`/templates/${data.template.id}/success`);
    }
  }
</script>

<div class="mx-auto max-w-4xl p-6">
  {#if !showVerificationFlow}
    <!-- Template Customization -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold">{data.template.title}</h1>
      <p class="text-slate-600">{data.template.description}</p>
    </div>

    <!-- Template Editor -->
    <TemplateEditor bind:content={data.customizations} />

    <!-- Verification Prompt (if not verified) -->
    {#if !userVerified}
      <div class="mt-6">
        <VerificationPrompt
          variant="banner"
          dismissible={true}
          on:verify={() => showVerificationFlow = true}
        />
      </div>
    {/if}

    <!-- Submit Button -->
    <div class="mt-8">
      <button
        type="button"
        onclick={submitTemplate}
        class="w-full rounded-lg bg-blue-600 px-6 py-4 text-white"
      >
        {userVerified ? 'Send Verified Message' : 'Send Message'}
      </button>
    </div>
  {:else}
    <!-- Verification Flow -->
    <IdentityVerificationFlow
      userId={data.user.id}
      templateSlug={data.template.slug}
      on:complete={handleVerificationComplete}
      on:cancel={() => showVerificationFlow = false}
    />
  {/if}
</div>
```

---

### Example 2: Onboarding Flow

**Scenario**: New user signs up and is prompted to verify during onboarding.

```svelte
<!-- routes/onboarding/verify/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import IdentityVerificationFlow from '$lib/components/auth/IdentityVerificationFlow.svelte';

  let { data } = $props();

  async function handleVerificationComplete(event: CustomEvent) {
    const { verified, method } = event.detail;

    // Update user profile
    await fetch('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        verified,
        verificationMethod: method,
        onboardingStep: 'complete'
      })
    });

    // Track onboarding conversion
    trackEvent('onboarding_verification_complete', { method });

    // Redirect to dashboard
    goto('/dashboard?welcome=true');
  }

  function skipVerification() {
    // Allow skip, but track it
    trackEvent('onboarding_verification_skipped');
    goto('/dashboard?verified=false');
  }
</script>

<div class="mx-auto max-w-4xl p-6">
  <div class="mb-8 text-center">
    <h1 class="text-4xl font-bold text-slate-900">Welcome to Communiqué</h1>
    <p class="mt-2 text-lg text-slate-600">
      Let's verify your identity to maximize your impact with Congress
    </p>
  </div>

  <IdentityVerificationFlow
    userId={data.user.id}
    skipValueProp={false}
    on:complete={handleVerificationComplete}
    on:back={skipVerification}
  />

  <div class="mt-6 text-center">
    <button
      type="button"
      onclick={skipVerification}
      class="text-sm text-slate-600 hover:text-slate-900"
    >
      Skip for now
    </button>
  </div>
</div>
```

---

### Example 3: Settings / Profile Page

**Scenario**: User manages verification status in account settings.

```svelte
<!-- routes/settings/verification/+page.svelte -->
<script lang="ts">
  import { Shield, Check, AlertCircle } from 'lucide-svelte';
  import IdentityVerificationFlow from '$lib/components/auth/IdentityVerificationFlow.svelte';
  import VerificationValueProp from '$lib/components/auth/address-steps/VerificationValueProp.svelte';

  let { data } = $props();
  let showVerificationFlow = $state(false);

  const verificationStatus = $derived({
    verified: data.user.verified,
    method: data.user.verificationMethod,
    verifiedAt: data.user.verifiedAt
  });

  function handleVerificationComplete(event: CustomEvent) {
    showVerificationFlow = false;
    // Reload page data
    window.location.reload();
  }
</script>

<div class="mx-auto max-w-4xl p-6">
  <h1 class="mb-6 text-3xl font-bold text-slate-900">Identity Verification</h1>

  {#if !showVerificationFlow}
    {#if verificationStatus.verified}
      <!-- Verified Status -->
      <div class="rounded-xl border border-green-200 bg-green-50 p-6">
        <div class="flex items-start gap-4">
          <div class="rounded-full bg-green-100 p-3">
            <Shield class="h-6 w-6 text-green-600" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-green-900">
                Identity Verified
              </h2>
              <Check class="h-5 w-5 text-green-600" />
            </div>
            <p class="mt-1 text-sm text-green-800">
              Verified via {verificationStatus.method === 'nfc-passport' ? 'NFC Passport' : 'Government ID'}
              on {new Date(verificationStatus.verifiedAt).toLocaleDateString()}
            </p>
            <div class="mt-4 space-y-2 text-sm text-green-700">
              <p class="flex items-start gap-2">
                <Check class="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Your messages receive priority attention from congressional offices</span>
              </p>
              <p class="flex items-start gap-2">
                <Check class="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>You're building reputation with every civic action</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    {:else}
      <!-- Not Verified -->
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div class="flex items-start gap-4">
          <div class="rounded-full bg-amber-100 p-3">
            <AlertCircle class="h-6 w-6 text-amber-600" />
          </div>
          <div class="flex-1">
            <h2 class="text-lg font-semibold text-amber-900">
              Identity Not Verified
            </h2>
            <p class="mt-1 text-sm text-amber-800">
              Verifying your identity significantly increases the impact of your messages
            </p>
            <button
              type="button"
              onclick={() => showVerificationFlow = true}
              class="mt-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
            >
              Start Verification
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Why Verification Matters -->
    <div class="mt-8">
      <h2 class="mb-4 text-xl font-semibold text-slate-900">
        Why Verification Matters
      </h2>
      <VerificationValueProp variant="compact" />
    </div>
  {:else}
    <!-- Verification Flow -->
    <IdentityVerificationFlow
      userId={data.user.id}
      on:complete={handleVerificationComplete}
      on:cancel={() => showVerificationFlow = false}
    />
  {/if}
</div>
```

---

### Example 4: Sidebar Prompt (During Template Browsing)

**Scenario**: User browses templates; sidebar encourages verification.

```svelte
<!-- routes/templates/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import VerificationPrompt from '$lib/components/auth/VerificationPrompt.svelte';

  let { data } = $props();

  function handleVerifyClick() {
    // Navigate to verification flow
    goto('/onboarding/verify?return=/templates');
  }
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
  <!-- Main Content -->
  <div class="lg:col-span-3">
    <h1 class="mb-6 text-3xl font-bold">Browse Templates</h1>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each data.templates as template}
        <TemplateCard {template} />
      {/each}
    </div>
  </div>

  <!-- Sidebar -->
  <div class="lg:col-span-1">
    <div class="sticky top-6 space-y-6">
      <!-- Verification Prompt (if not verified) -->
      {#if !data.user?.verified}
        <VerificationPrompt
          variant="compact"
          on:verify={handleVerifyClick}
        />
      {/if}

      <!-- Other sidebar content -->
      <RecentActivity />
      <PopularTopics />
    </div>
  </div>
</div>
```

---

### Example 5: Modal Verification Flow

**Scenario**: User clicks "Verify Now" from anywhere; modal opens with full flow.

```svelte
<!-- lib/components/VerificationModal.svelte -->
<script lang="ts">
  import { X } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import IdentityVerificationFlow from './auth/IdentityVerificationFlow.svelte';

  interface Props {
    userId: string;
    open?: boolean;
  }

  let { userId, open = false }: Props = $props();

  const dispatch = createEventDispatcher<{
    close: void;
    complete: { verified: boolean; method: string };
  }>();

  function handleClose() {
    dispatch('close');
  }

  function handleComplete(event: CustomEvent) {
    dispatch('complete', event.detail);
    handleClose();
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-8 shadow-2xl">
      <!-- Close Button -->
      <button
        type="button"
        onclick={handleClose}
        class="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        aria-label="Close"
      >
        <X class="h-6 w-6" />
      </button>

      <!-- Verification Flow -->
      <IdentityVerificationFlow
        {userId}
        on:complete={handleComplete}
        on:cancel={handleClose}
      />
    </div>
  </div>
{/if}
```

**Usage in parent component**:

```svelte
<script lang="ts">
  import VerificationModal from '$lib/components/VerificationModal.svelte';

  let showModal = $state(false);

  function handleVerificationComplete(event: CustomEvent) {
    const { verified, method } = event.detail;
    // Handle completion
  }
</script>

<button onclick={() => showModal = true}>
  Verify Identity
</button>

<VerificationModal
  userId={data.user.id}
  bind:open={showModal}
  on:complete={handleVerificationComplete}
/>
```

---

### Example 6: Progressive Disclosure (Multi-Step Form)

**Scenario**: Verification is step 3 of 5 in a larger form flow.

```svelte
<!-- routes/campaigns/create/+page.svelte -->
<script lang="ts">
  import VerificationValueProp from '$lib/components/auth/address-steps/VerificationValueProp.svelte';
  import VerificationChoice from '$lib/components/auth/address-steps/VerificationChoice.svelte';
  import SelfXyzVerification from '$lib/components/auth/address-steps/SelfXyzVerification.svelte';
  import DiditVerification from '$lib/components/auth/address-steps/DiditVerification.svelte';

  let currentStep = $state(1);
  let verificationMethod = $state<'nfc' | 'government-id' | null>(null);
  let verified = $state(false);

  const steps = [
    'Campaign Details',
    'Target Audience',
    'Identity Verification',
    'Message Content',
    'Review & Launch'
  ];

  function handleMethodSelect(event: CustomEvent) {
    verificationMethod = event.detail.method;
  }

  function handleVerificationComplete(event: CustomEvent) {
    verified = true;
    currentStep = 4; // Advance to next step
  }
</script>

<div class="mx-auto max-w-4xl p-6">
  <!-- Progress Steps -->
  <div class="mb-8">
    <div class="flex items-center justify-between">
      {#each steps as step, index}
        <div class="flex flex-col items-center">
          <div class="flex h-10 w-10 items-center justify-center rounded-full {index + 1 === currentStep ? 'bg-blue-600 text-white' : index + 1 < currentStep ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'}">
            {index + 1}
          </div>
          <p class="mt-2 text-xs {index + 1 === currentStep ? 'font-semibold' : ''}">
            {step}
          </p>
        </div>
      {/each}
    </div>
  </div>

  <!-- Step Content -->
  {#if currentStep === 3}
    <div class="space-y-6">
      {#if !verificationMethod}
        <!-- Step 3a: Show value prop + method choice -->
        <VerificationValueProp variant="compact" />
        <VerificationChoice on:select={handleMethodSelect} />
      {:else if verificationMethod === 'nfc'}
        <!-- Step 3b: NFC verification -->
        <SelfXyzVerification
          userId={data.user.id}
          on:complete={handleVerificationComplete}
        />
      {:else if verificationMethod === 'government-id'}
        <!-- Step 3c: Government ID verification -->
        <DiditVerification
          userId={data.user.id}
          on:complete={handleVerificationComplete}
        />
      {/if}
    </div>
  {/if}
</div>
```

---

### Example 7: Conditional Verification (Based on Template Type)

**Scenario**: Some templates require verification; others don't.

```svelte
<!-- routes/s/[slug]/+page.svelte -->
<script lang="ts">
  import VerificationPrompt from '$lib/components/auth/VerificationPrompt.svelte';
  import IdentityVerificationFlow from '$lib/components/auth/IdentityVerificationFlow.svelte';

  let { data } = $props();

  const requiresVerification = data.template.requiresVerification;
  const userVerified = data.user?.verified || false;
  const showVerificationGate = requiresVerification && !userVerified;

  let showVerificationFlow = $state(false);
</script>

<div class="mx-auto max-w-4xl p-6">
  {#if showVerificationGate && !showVerificationFlow}
    <!-- Verification Required Gate -->
    <div class="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
      <h2 class="mb-2 text-2xl font-bold text-slate-900">
        Verification Required
      </h2>
      <p class="mb-6 text-slate-700">
        This template requires identity verification to ensure your message
        reaches the right congressional office.
      </p>

      <VerificationPrompt
        variant="full"
        on:verify={() => showVerificationFlow = true}
      />
    </div>
  {:else if showVerificationFlow}
    <!-- Verification Flow -->
    <IdentityVerificationFlow
      userId={data.user.id}
      templateSlug={data.template.slug}
      on:complete={() => {
        showVerificationFlow = false;
        window.location.reload();
      }}
      on:cancel={() => showVerificationFlow = false}
    />
  {:else}
    <!-- Template Content -->
    <TemplateEditor template={data.template} />
  {/if}
</div>
```

---

## API Integration Patterns

### Polling for Verification Status (Self.xyz)

```typescript
// In SelfXyzVerification.svelte
async function pollVerificationStatus(sessionId: string) {
  const response = await fetch(`/api/identity/status?sessionId=${sessionId}`);
  const data = await response.json();

  if (data.status === 'verified') {
    // Verification complete
    return { verified: true, method: 'nfc-passport' };
  } else if (data.status === 'failed') {
    // Verification failed
    throw new Error(data.error || 'Verification failed');
  } else {
    // Still pending
    return null;
  }
}
```

### Webhook Handling (Didit)

```typescript
// routes/api/identity/didit/webhook/+server.ts
export async function POST({ request }) {
  const payload = await request.json();

  // Validate webhook signature
  const isValid = await validateDigitWebhook(payload);

  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  // Update user verification status
  await db.user.update({
    where: { id: payload.userId },
    data: {
      verified: payload.status === 'verified',
      verificationMethod: 'government-id',
      verifiedAt: new Date()
    }
  });

  return new Response('OK', { status: 200 });
}
```

---

## Analytics & Tracking

### Event Tracking Examples

```typescript
// Track verification flow progression
function trackVerificationEvent(eventName: string, properties: Record<string, unknown>) {
  analytics.track(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
    userId: currentUser.id,
    sessionId: currentSession.id
  });
}

// Events to track:
trackVerificationEvent('verification_started', {
  method: 'nfc-passport',
  context: 'template_submission'
});

trackVerificationEvent('verification_method_selected', {
  method: 'nfc-passport',
  alternativeShown: true
});

trackVerificationEvent('verification_completed', {
  method: 'nfc-passport',
  duration: 32, // seconds
  retries: 0
});

trackVerificationEvent('verification_failed', {
  method: 'government-id',
  error: 'Invalid ID format',
  retries: 2
});

trackVerificationEvent('verification_abandoned', {
  step: 'qr-code-display',
  duration: 15
});
```

---

## Testing Examples

### Unit Tests (Vitest)

```typescript
import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import VerificationChoice from './VerificationChoice.svelte';

describe('VerificationChoice', () => {
  it('renders both verification methods', () => {
    const { getByText } = render(VerificationChoice);

    expect(getByText('NFC Passport')).toBeInTheDocument();
    expect(getByText('Government ID')).toBeInTheDocument();
  });

  it('dispatches select event when method chosen', async () => {
    const { component, getByRole } = render(VerificationChoice);

    const selectHandler = vi.fn();
    component.$on('select', selectHandler);

    const nfcButton = getByRole('button', { name: /NFC Passport/i });
    await fireEvent.click(nfcButton);

    expect(selectHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { method: 'nfc' }
      })
    );
  });
});
```

### Integration Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('complete NFC verification flow', async ({ page }) => {
  await page.goto('/onboarding/verify');

  // Step 1: Value proposition
  await expect(page.getByText('Make Your Voice Heard')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Verification' }).click();

  // Step 2: Method selection
  await expect(page.getByText('NFC Passport')).toBeVisible();
  await page.getByRole('button', { name: /NFC Passport/i }).click();

  // Step 3: Verification
  await expect(page.getByText('Generate QR Code')).toBeVisible();
  await page.getByRole('button', { name: 'Generate QR Code' }).click();

  // QR code should appear
  await expect(page.getByAltText('Verification QR Code')).toBeVisible();

  // Simulate verification completion (mock webhook)
  // ... webhook simulation logic ...

  // Step 4: Success
  await expect(page.getByText('Verification Complete!')).toBeVisible();
});
```

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
