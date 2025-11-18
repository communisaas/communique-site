# Communiqué UX Responsibilities: Making Cryptography Invisible

**Date:** 2025-11-09
**Focus:** What UI/UX Communiqué must build to make complex privacy tech feel effortless

---

## TL;DR: The UX Layer

**User's Mental Model:**
1. Pick a template about an issue I care about
2. Add my personal story (30 seconds)
3. Click "Send to My Representatives"
4. Done. Message delivered anonymously.

**What Actually Happens (Invisible to User):**
1. Browser generates ZK proof (8-15s on mobile, shows "Preparing anonymous delivery...")
2. Address encrypted to TEE public key (XChaCha20-Poly1305)
3. Shadow Atlas Merkle tree updated (district membership proof)
4. Encrypted blob sent to TEE for delivery
5. Congressional office receives message with verification proof
6. On-chain reputation updated (ERC-8004)

**User Never Sees:** WASM proving, Halo2 circuits, Poseidon hashes, nullifiers, Merkle paths, TEE attestation, gas fees, blockchain transactions.

**User Only Sees:** "✅ Delivered anonymously to Representative Smith"

---

## Table of Contents

1. [First-Time User Flow](#first-time-user-flow)
2. [Returning User Flow](#returning-user-flow)
3. [Progressive Disclosure](#progressive-disclosure)
4. [Error States](#error-states)
5. [Implementation Checklist](#implementation-checklist)

---

## First-Time User Flow

### Step 1: Browse Templates (Zero-Friction Entry)

**URL:** `https://communi.email/` or `/browse`

**UI State:** Guest user, no login required

```svelte
<!-- What user sees -->
<main>
  <h1>Find Your Voice on Healthcare</h1>
  <p>247 constituents sent variations of this template to Congress</p>

  <TemplateCard
    title="Support Medicare Expansion"
    description="Request Medicare coverage for dental, vision, and hearing"
    verifiedSends={247}
    uniqueDistricts={82}
    avgReputation={8740}
  />

  <button>Add My Story →</button>
</main>
```

**What's Happening (Invisible):**
- Svelte component fetches templates from `/api/templates`
- Postgres query aggregates `verified_sends`, `unique_districts`
- No login wall, no tracking, no cookies
- User browses as guest

**Communiqué Responsibility:**
- ✅ Template browsing UI (SvelteKit component)
- ✅ Aggregate metrics display (privacy-preserving)
- ✅ Responsive design (mobile-first)

---

### Step 2: Add Personal Story (Still No Login)

**URL:** `/template/medicare-expansion`

**UI State:** Guest editing template

```svelte
<script lang="ts">
  let personalStory = $state('');
  let customizations = $state({
    intro: 'As a constituent in TX-07',
    body: '[template content]',
    conclusion: '[template conclusion]'
  });
</script>

<TemplateEditor>
  <h2>Add Your Personal Story</h2>
  <p>What makes this issue personal to you?</p>

  <textarea
    bind:value={personalStory}
    placeholder="I'm a nurse at Memorial Hospital. I've seen firsthand..."
    maxlength={500}
  />

  <p class="hint">
    Your story will be PUBLIC. Congressional offices will read this.
    Your identity will NOT be revealed.
  </p>

  <button onclick={handleNext}>Next: Verify & Send →</button>
</TemplateEditor>
```

**What's Happening (Invisible):**
- LOCAL STATE ONLY (not saved anywhere yet)
- Runes-based reactivity ($state, $derived)
- Character count, validation, auto-save to localStorage

**Communiqué Responsibility:**
- ✅ Template customization UI
- ✅ Character limits, validation
- ✅ Clear privacy messaging ("Your story will be PUBLIC, your identity will NOT")
- ✅ localStorage auto-save (draft recovery)

---

### Step 3: One-Time Identity Verification (30s-2min)

**URL:** `/verify`

**UI State:** User must verify before sending

```svelte
<VerificationPrompt>
  <h2>Verify You're a Real Constituent</h2>
  <p>One-time verification. Takes 30 seconds. Never stored.</p>

  <div class="verification-options">
    <!-- PRIMARY: self.xyz NFC passport (70% of users) -->
    <VerificationButton
      provider="self.xyz"
      icon="📱"
      duration="30 seconds"
      description="Tap your passport with your phone"
      recommended={true}
    />

    <!-- FALLBACK: Didit.me government ID (30% of users) -->
    <VerificationButton
      provider="didit"
      icon="🪪"
      duration="2 minutes"
      description="Government ID + biometric check"
    />
  </div>

  <details class="privacy-details">
    <summary>How is this private?</summary>
    <p>
      Your address is encrypted in your browser before sending.
      Only a secure enclave (TEE) can decrypt it temporarily for verification.
      Congressional offices NEVER see your address, name, or any identifying info.
      You're verified as "Constituent in TX-07" - anonymous but trustworthy.
    </p>
  </details>
</VerificationPrompt>
```

**What's Happening (Invisible):**

**If user chooses self.xyz:**
1. self.xyz SDK opens (NFC passport tap)
2. Returns `identity_commitment` (Poseidon hash of passport data)
3. Browser encrypts address to TEE public key (XChaCha20-Poly1305)
4. Encrypted blob stored in Postgres
5. TEE decrypts → geocodes → returns district ("TX-07")
6. Session credential cached: "Verified TX-07 constituent, expires 2026-01-01"
7. User is verified - NEVER ASKED AGAIN

**If user chooses Didit.me:**
1. Didit.me SDK opens (government ID + liveness check)
2. Returns `identity_proof` (ZK credential)
3. Same encryption flow as above

**Communiqué Responsibility:**
- ✅ self.xyz SDK integration (NFC passport UI)
- ✅ Didit.me SDK integration (government ID UI)
- ✅ Loading states ("Verifying with self.xyz...", "Encrypting address...")
- ✅ Progressive disclosure (privacy details hidden by default)
- ✅ Error handling ("NFC not available", "Verification failed")
- ✅ Session credential caching (IndexedDB or localStorage)

**What User Sees:**
```
✅ Verified as TX-07 Constituent
Your identity is protected. Congressional offices will see:
"Verified Constituent (TX-07)"
```

---

### Step 4: Anonymous Proof Generation (8-15s, Mobile)

**URL:** Same `/verify` page, automatic after verification

**UI State:** Browser generating ZK proof

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeProver, generateDistrictMembershipProof } from '$lib/core/zkp/prover-client';

  let proofStatus = $state<'loading' | 'generating' | 'complete'>('loading');
  let progress = $state(0);

  onMount(async () => {
    // Initialize WASM prover (5-10s first time)
    await initializeProver();
    proofStatus = 'generating';

    // Generate ZK proof (8-15s on mobile, 600ms-2s on desktop)
    const { proof, publicOutputs } = await generateDistrictMembershipProof({
      identityCommitment: sessionCredential.identity_commitment,
      actionId: '42',  // Congressional message action
      leafIndex: sessionCredential.leaf_index,
      merklePath: sessionCredential.merkle_path
    });

    proofStatus = 'complete';
  });
</script>

{#if proofStatus === 'loading'}
  <LoadingState>
    <Spinner />
    <p>Loading privacy tools...</p>
    <ProgressBar value={30} />
  </LoadingState>
{:else if proofStatus === 'generating'}
  <LoadingState>
    <Spinner />
    <p>Preparing anonymous delivery...</p>
    <ProgressBar value={60} />
    <small class="muted">Generating cryptographic proof (this takes ~10 seconds on mobile)</small>
  </LoadingState>
{:else}
  <SuccessState>
    <CheckIcon size={48} color="green" />
    <p>Ready to send anonymously!</p>
  </SuccessState>
{/if}
```

**What's Happening (Invisible):**
1. WASM module loaded (~800MB memory)
2. Halo2 circuit initialized (K=14, 4,096-leaf Merkle tree)
3. Browser generates ZK proof:
   - Input: `identity_commitment`, `action_id`, `leaf_index`, `merkle_path`
   - Output: `proof` (~4.6KB), `district_root`, `nullifier`
4. Proof proves: "I am ONE OF 4,096 registered TX-07 residents"
5. Proof DOESN'T reveal: which resident, which address, which leaf

**Communiqué Responsibility:**
- ✅ WASM prover client integration (`@voter-protocol/crypto` package)
- ✅ Loading states with accurate time estimates ("~10 seconds on mobile")
- ✅ Progress indicators (loading → generating → complete)
- ✅ Error handling ("Proof generation failed", "Please try again")
- ✅ Mobile optimization (reduce memory footprint, cancel if user navigates away)

**What User Sees:**
```
⏳ Preparing anonymous delivery... (~10 seconds)
[Progress bar: 60%]
```

Then:
```
✅ Ready to send anonymously!
```

---

### Step 5: Send Message (Click, Done)

**URL:** Same page, final confirmation

**UI State:** Review before sending

```svelte
<MessagePreview>
  <h2>Review Your Message</h2>

  <Card class="preview">
    <h3>To: Representative Jane Smith (TX-07)</h3>
    <p class="from">From: Verified Constituent (TX-07)</p>

    <div class="message-content">
      <p><strong>Re: Medicare Expansion</strong></p>
      <p>{customizations.intro}</p>
      <p>{customizations.body}</p>
      <blockquote>
        <p><strong>Personal Story:</strong></p>
        <p>{personalStory}</p>
      </blockquote>
      <p>{customizations.conclusion}</p>
    </div>
  </Card>

  <div class="privacy-summary">
    <PrivacyBadge icon="🔒" label="Anonymous Delivery" />
    <PrivacyBadge icon="✅" label="Verified TX-07" />
    <PrivacyBadge icon="🏛️" label="Official CWC API" />
  </div>

  <button onclick={handleSend} class="primary-cta">
    Send to Representative Smith
  </button>

  <details class="delivery-details">
    <summary>What happens when I send?</summary>
    <ol>
      <li>Your message is delivered via official Congressional Web Contact (CWC) API</li>
      <li>Representative Smith's office receives your PUBLIC message</li>
      <li>They see "Verified Constituent (TX-07)" - NOT your name or address</li>
      <li>Your on-chain reputation increases (+1 Healthcare Policy)</li>
      <li>You'll receive confirmation when delivered</li>
    </ol>
  </details>
</MessagePreview>
```

**What's Happening (Invisible):**
1. `POST /api/congressional/submit`
2. Payload: `{ proof, publicOutputs, encryptedWitness, encryptedMessage, templateId }`
3. Communiqué backend:
   - Stores encrypted blobs in Postgres
   - Submits ZK proof to Scroll L2 blockchain (gas-free for user)
   - Sends encrypted blob to TEE for delivery
4. TEE (AWS Nitro Enclave):
   - Decrypts address inside hardware enclave
   - Calls CWC API with plaintext address
   - Receives delivery confirmation
   - DESTROYS address (zeroed from memory)
5. On-chain:
   - Smart contract verifies ZK proof (300-500k gas)
   - Checks nullifier not reused
   - Updates ERC-8004 reputation (+1 Healthcare Policy)
6. Message record created (PUBLIC content, no user_id linkage)

**Communiqué Responsibility:**
- ✅ Message preview UI (what congressional office will see)
- ✅ Privacy badges (visual trust indicators)
- ✅ Progressive disclosure (delivery details hidden by default)
- ✅ Submission endpoint (`POST /api/congressional/submit`)
- ✅ Loading state during submission ("Delivering...")
- ✅ Success confirmation ("✅ Delivered to Representative Smith")
- ✅ Error handling ("Delivery failed", retry logic)

**What User Sees (During Submission):**
```
⏳ Delivering to Representative Smith...
```

**What User Sees (Success):**
```
✅ Delivered to Representative Smith!

Your message was delivered anonymously via official CWC API.
Representative Smith's office will see "Verified Constituent (TX-07)".

Your reputation increased: +1 Healthcare Policy (now 8,741)
```

---

## Returning User Flow

### No Re-Verification Needed

**URL:** `/template/medicare-expansion`

**UI State:** Session credential cached, user is already verified

```svelte
<script lang="ts">
  import { sessionCredential } from '$lib/stores/session';

  // Check if user has valid session credential
  const isVerified = $derived(
    sessionCredential.value &&
    sessionCredential.value.expires_at > Date.now()
  );
</script>

{#if isVerified}
  <VerifiedBadge>
    <CheckIcon size={20} color="green" />
    <span>Verified TX-07 Constituent (expires {formatDate(sessionCredential.value.expires_at)})</span>
  </VerifiedBadge>

  <TemplateEditor>
    <!-- Same customization UI as first-time flow -->
    <!-- But NO verification step - goes straight to proof generation -->
  </TemplateEditor>
{:else}
  <!-- Show verification prompt (session expired) -->
  <VerificationPrompt />
{/if}
```

**What's Happening (Invisible):**
- Session credential loaded from IndexedDB
- Checks expiration (typically 3-6 months)
- If valid: skip verification, proceed to proof generation
- If expired: prompt for re-verification

**Communiqué Responsibility:**
- ✅ Session credential caching (IndexedDB or localStorage)
- ✅ Expiration checking (validate timestamp)
- ✅ Verified badge UI ("Verified TX-07 Constituent")
- ✅ Seamless returning user flow (no friction)

**What User Sees:**
```
✅ Verified TX-07 Constituent (verified 2025-10-15, expires 2026-01-01)

[Template editor, no verification prompt]
```

---

## Progressive Disclosure

### Default View: Simple, Fast, Obvious

```svelte
<TemplateCard>
  <h2>Support Medicare Expansion</h2>
  <p>247 constituents sent this template</p>

  <button>Add My Story →</button>
</TemplateCard>
```

**User sees:** Template, button, done.

---

### Hover State: Aggregate Context (Optional)

```svelte
<TemplateCard on:hover={showStats}>
  <!-- Tooltip appears -->
  <Tooltip>
    <p>247 verified constituents sent variations</p>
    <p>82 unique congressional districts</p>
    <p>Average reputation: 8,740 in Healthcare Policy</p>
  </Tooltip>
</TemplateCard>
```

**User sees (if they hover):** Aggregate metrics, no individual tracking.

---

### Click "Details": Full Transparency (If User Asks)

```svelte
<details>
  <summary>How is this anonymous?</summary>
  <section class="technical-details">
    <h3>Privacy Technology</h3>
    <ul>
      <li><strong>Zero-Knowledge Proofs:</strong> You prove you're a TX-07 constituent without revealing which one</li>
      <li><strong>Encrypted Delivery:</strong> Your address is encrypted in your browser, decrypted only inside a secure enclave</li>
      <li><strong>On-Chain Reputation:</strong> Your civic action score is tracked on Scroll blockchain, not linked to your identity</li>
      <li><strong>Pseudonymous Messaging:</strong> Congressional offices see "Verified TX-07 Constituent", not your name</li>
    </ul>

    <a href="/docs/privacy" class="learn-more">Learn more about our privacy architecture →</a>
  </section>
</details>
```

**User sees (ONLY if they click "Details"):** Full technical explanation, links to architecture docs.

---

### Power User View: Cryptographic Audit Trail

**URL:** `/messages/abc123` (individual message detail page)

```svelte
<MessageDetail>
  <h2>Message to Representative Smith</h2>

  <Card class="delivery-status">
    <p>Status: ✅ Delivered (2025-11-09 14:32 UTC)</p>
    <p>Office Read: ✅ Yes (2025-11-09 16:45 UTC)</p>
    <p>Office Responded: ❌ No response yet</p>
  </Card>

  <details class="cryptographic-proof">
    <summary>Cryptographic Proof (Advanced)</summary>
    <section class="proof-details">
      <h3>Zero-Knowledge Proof</h3>
      <code class="proof-hex">{proofBytes.slice(0, 100)}...</code>

      <h3>Public Outputs</h3>
      <ul>
        <li><strong>District Root:</strong> <code>{publicOutputs.district_root}</code></li>
        <li><strong>Nullifier:</strong> <code>{publicOutputs.nullifier}</code></li>
        <li><strong>Action ID:</strong> <code>{publicOutputs.action_id}</code></li>
      </ul>

      <h3>On-Chain Verification</h3>
      <p>
        Scroll L2 Transaction:
        <a href="https://scroll.io/tx/{blockchainTxHash}" target="_blank">
          {blockchainTxHash.slice(0, 10)}...
        </a>
      </p>

      <h3>Reputation Update</h3>
      <p>+1 Healthcare Policy (ERC-8004 event on Scroll)</p>
    </section>
  </details>
</MessageDetail>
```

**User sees (ONLY if they're a power user who clicks "Cryptographic Proof"):** Full audit trail, blockchain transaction, ZK proof bytes, public outputs.

---

## Error States

### Graceful Degradation, Clear Next Steps

#### Error: NFC Not Available (self.xyz)

```svelte
<ErrorState>
  <WarningIcon size={48} color="orange" />
  <h3>NFC Not Available</h3>
  <p>Your device doesn't support NFC passport scanning.</p>

  <button onclick={switchToDidit}>Use Government ID Instead (2 minutes) →</button>

  <details>
    <summary>What is NFC?</summary>
    <p>
      Near Field Communication lets your phone read passport chips.
      Most modern phones support this (iPhone 7+, Android with NFC).
      If yours doesn't, use Didit.me instead (government ID + biometric).
    </p>
  </details>
</ErrorState>
```

---

#### Error: Proof Generation Failed

```svelte
<ErrorState>
  <ErrorIcon size={48} color="red" />
  <h3>Proof Generation Failed</h3>
  <p>Unable to generate anonymous delivery proof. This sometimes happens on older devices.</p>

  <button onclick={retryProof}>Try Again</button>
  <button onclick={contactSupport}>Contact Support</button>

  <details>
    <summary>What went wrong?</summary>
    <p>
      Your device may not have enough memory to generate the cryptographic proof.
      This requires ~800MB RAM and works best on devices from 2020 or later.
    </p>
  </details>
</ErrorState>
```

---

#### Error: Delivery Failed (CWC API)

```svelte
<ErrorState>
  <WarningIcon size={48} color="orange" />
  <h3>Delivery Temporarily Unavailable</h3>
  <p>Congressional office delivery system is down. We'll retry automatically.</p>

  <p>Your message is saved. We'll deliver it as soon as the CWC API is available.</p>

  <button onclick={viewQueue}>View Delivery Queue</button>

  <small class="muted">
    Delivery failures happen occasionally (CWC API rate limits or downtime).
    We automatically retry with exponential backoff.
  </small>
</ErrorState>
```

---

## Implementation Checklist

### Phase 1: Core UX (Week 1-2)

- [ ] Template browsing UI (`/browse`, `/template/:slug`)
- [ ] Template customization UI (textarea, character limits, validation)
- [ ] Draft auto-save to localStorage
- [ ] Mobile-responsive design (80% of users on mobile)

### Phase 2: Identity Verification (Week 3-4)

- [ ] self.xyz SDK integration (NFC passport UI)
- [ ] Didit.me SDK integration (government ID UI)
- [ ] Loading states ("Verifying...", "Encrypting...")
- [ ] Session credential caching (IndexedDB)
- [ ] Verified badge UI ("✅ Verified TX-07 Constituent")

### Phase 3: ZK Proof Generation (Week 5-6)

- [ ] WASM prover client integration (`@voter-protocol/crypto`)
- [ ] Prover initialization UI ("Loading privacy tools...")
- [ ] Proof generation progress ("Preparing anonymous delivery... ~10s")
- [ ] Mobile optimization (memory management, cancel on navigate)
- [ ] Error handling ("Proof generation failed", retry logic)

### Phase 4: Message Delivery (Week 7-8)

- [ ] Message preview UI (what congressional office will see)
- [ ] Privacy badges (anonymous delivery, verified district)
- [ ] Submission endpoint (`POST /api/congressional/submit`)
- [ ] Loading states ("Delivering...")
- [ ] Success confirmation ("✅ Delivered to Representative Smith")
- [ ] Delivery queue UI (retries, status tracking)

### Phase 5: Progressive Disclosure (Week 9-10)

- [ ] `<details>` elements for technical explanations
- [ ] Privacy details page (`/docs/privacy`)
- [ ] Cryptographic proof viewer (power users only)
- [ ] On-chain transaction links (Scroll block explorer)
- [ ] Audit trail UI (proof bytes, public outputs, blockchain tx)

---

## Success Metrics

### User Experience Targets

- **95% of users complete verification in <2 minutes** (self.xyz 30s, Didit.me 2min)
- **90% of users send message in <5 minutes total** (browse template → customize → send)
- **<5% drop-off during ZK proof generation** (8-15s is acceptable if we communicate clearly)

### Privacy Perception

- **80% of users understand "anonymous but verified"** (exit survey question)
- **<10% ask "why does this take 10 seconds?"** (clear loading state messaging)
- **0% believe their identity is revealed** (privacy messaging is effective)

### Mobile Performance

- **WASM prover works on 95% of mobile devices** (2020 or later, ~800MB RAM)
- **Proof generation <15s on 90% of devices** (acceptable with progress indicator)
- **<1% memory-related crashes** (browser out of memory during proving)

---

## The Reality Check

**What Users Think They're Doing:**
> "I'm sending a message to my representative about healthcare."

**What's Actually Happening:**
> Browser generates Halo2 zero-knowledge proof, encrypts witness to TEE public key, submits proof to Scroll L2 blockchain, sends encrypted blob to AWS Nitro Enclave for decryption and CWC API delivery, updates on-chain ERC-8004 reputation, and creates pseudonymous Message record in Postgres.

**Communiqué's Job:**
> Make the second paragraph COMPLETELY INVISIBLE unless the user explicitly wants to see it.

---

**The Golden Rule:**
> If explaining the technology is required for the user to trust it, the UX has failed.
> Trust comes from transparency WHEN ASKED, not from forcing users to understand Halo2.

---

*Communiqué PBC | UX Responsibilities | 2025-11-09*
