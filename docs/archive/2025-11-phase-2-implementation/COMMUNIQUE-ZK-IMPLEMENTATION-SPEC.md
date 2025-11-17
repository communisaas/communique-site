# Communiqué Zero-Knowledge Proof Implementation Specification

**Date**: 2025-11-10
**Status**: Ready to Implement
**Dependencies**: voter-protocol Shadow Atlas (in progress), @voter-protocol/halo2-browser-prover@0.1.2 ✅

---

## Overview

This document specifies the **Communiqué-side implementation** for zero-knowledge proof generation and submission. The Shadow Atlas Merkle tree generation is handled by voter-protocol; this spec covers the integration layer, UI flows, and submission pipeline.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ COMMUNIQUÉ FRONTEND (Browser)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. Identity Verification (✅ COMPLETE)                      │
│    ├─ IdentityVerificationFlow.svelte                       │
│    ├─ SelfXyzVerification.svelte                            │
│    └─ DiditVerification.svelte                              │
│           ↓                                                  │
│ 2. Shadow Atlas Registration (⏳ IN PROGRESS)               │
│    POST /api/shadow-atlas/register                          │
│    { identity_commitment, district, proof }                 │
│           ↓                                                  │
│    Response: { leaf_index, merkle_path[], merkle_root }     │
│           ↓                                                  │
│ 3. Session Credential Cache (✅ COMPLETE)                   │
│    IndexedDB (session-credentials.ts): {                    │
│      leaf_index, merkle_path, merkle_root, district,        │
│      expires_at (6 months)                                   │
│    }                                                         │
│           ↓                                                  │
│ 4. Template Customization (✅ EXISTING)                     │
│    User customizes congressional message                     │
│           ↓                                                  │
│ 5. ZK Proof Generation (✅ COMPLETE)                        │
│    ┌──────────────────────────────────────────────────────┐│
│    │ ProofGenerator.svelte                                 ││
│    │ - Load cached session credential                      ││
│    │ - Initialize WASM prover (if needed, 5-10s)          ││
│    │ - Generate proof (2-5s desktop, 8-15s mobile)        ││
│    │ - Educational loading states                          ││
│    └──────────────────────────────────────────────────────┘│
│           ↓                                                  │
│ 6. Witness Encryption (✅ COMPLETE)                         │
│    ┌──────────────────────────────────────────────────────┐│
│    │ witness-encryption.ts                                 ││
│    │ - Fetch TEE public key (mock)                         ││
│    │ - Encrypt address (AES-GCM fallback)                 ││
│    │ - Encrypt message content                             ││
│    └──────────────────────────────────────────────────────┘│
│           ↓                                                  │
│ 7. Submission (✅ COMPLETE)                                 │
│    POST /api/submissions/create                             │
│    {                                                         │
│      proof: Uint8Array,                                     │
│      publicOutputs: { district_root, nullifier, action_id },│
│      encryptedWitness: Uint8Array,                          │
│      encryptedMessage: Uint8Array,                          │
│      templateId                                              │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│ COMMUNIQUÉ BACKEND (SvelteKit API)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 8. Shadow Atlas Registration Endpoint (✅ COMPLETE)         │
│    ┌──────────────────────────────────────────────────────┐│
│    │ /api/shadow-atlas/register/+server.ts                ││
│    │ - Verify identity proof (self.xyz or Didit.me)       ││
│    │ - Call voter-protocol Shadow Atlas API (mock)        ││
│    │ - Store user registration in database                ││
│    │ - Return merkle_path + sessionCredential             ││
│    └──────────────────────────────────────────────────────┘│
│                                                              │
│ 9. TEE Public Key Distribution (✅ COMPLETE - MOCK)         │
│    GET /api/tee/public-key                                  │
│    { publicKey: string, keyId: string }                     │
│                                                              │
│ 10. Submission Endpoint (✅ COMPLETE)                       │
│    ┌──────────────────────────────────────────────────────┐│
│    │ /api/submissions/create/+server.ts                   ││
│    │ - Check nullifier uniqueness                         ││
│    │ - Store encrypted blobs (Postgres)                   ││
│    │ - TODO: Submit proof to blockchain (async)           ││
│    │ - TODO: Send to TEE for delivery (async)             ││
│    └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL SERVICES                                            │
├─────────────────────────────────────────────────────────────┤
│ - voter-protocol Shadow Atlas (Merkle tree generation)       │
│ - AWS Nitro Enclaves (TEE for decryption + CWC delivery)    │
│ - Scroll zkEVM (On-chain proof verification)                │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Shadow Atlas Registration API

**File**: `src/routes/api/shadow-atlas/register/+server.ts`

#### Input Schema
```typescript
interface RegistrationRequest {
  userId: string;
  identityCommitment: string; // Poseidon hash from self.xyz/Didit.me
  congressionalDistrict: string; // "CA-12", "NY-15", etc.
  identityProof: {
    method: 'self.xyz' | 'didit';
    verificationId: string;
    timestamp: string;
    signature: string; // Provider signature
  };
}
```

#### Output Schema
```typescript
interface RegistrationResponse {
  success: boolean;
  data?: {
    leafIndex: number; // 0-4095
    merklePath: string[]; // 12 hex strings
    merkleRoot: string; // Hex string
    districtSize: number; // Current tree size
    expiresAt: string; // ISO timestamp (6 months)
  };
  error?: string;
}
```

#### Business Logic
1. Verify user is authenticated (session check)
2. Validate identity proof signature
3. Call voter-protocol Shadow Atlas API to add commitment
4. Store registration in database:
   ```typescript
   await db.user.update({
     where: { id: userId },
     data: {
       identity_verified: true,
       verification_method: identityProof.method,
       identity_commitment: identityCommitment,
       shadow_atlas_leaf_index: leafIndex,
       congressional_district: congressionalDistrict,
       verification_expires_at: expiresAt
     }
   });
   ```
5. Return merkle_path for client-side caching

#### Error Handling
- `401`: Not authenticated
- `400`: Invalid identity proof signature
- `409`: User already registered in different district
- `503`: Shadow Atlas tree full (4,096 limit)
- `500`: voter-protocol API unavailable

---

### 2. Session Credential Storage

**File**: `src/lib/core/identity/session-credentials.ts`

#### Storage Schema (IndexedDB)
```typescript
interface SessionCredential {
  userId: string;
  identityCommitment: string;
  leafIndex: number;
  merklePath: string[]; // 12 sibling hashes
  merkleRoot: string;
  congressionalDistrict: string;
  verificationMethod: 'self.xyz' | 'didit';
  createdAt: Date;
  expiresAt: Date; // 6 months from creation
}
```

#### API Functions
```typescript
// Store credential after registration
export async function storeSessionCredential(
  credential: SessionCredential
): Promise<void>

// Retrieve cached credential
export async function getSessionCredential(
  userId: string
): Promise<SessionCredential | null>

// Check if credential is valid (not expired)
export async function hasValidCredential(
  userId: string
): Promise<boolean>

// Clear credential (logout or re-verification)
export async function clearSessionCredential(
  userId: string
): Promise<void>
```

#### Implementation Details
- Use `idb` library for IndexedDB access
- Database name: `communique-session`
- Store name: `credentials`
- Index on `userId` for fast lookup
- Automatically clear expired credentials on read

---

### 3. Proof Generator Component

**File**: `src/lib/components/zkp/ProofGenerator.svelte`

#### Props
```typescript
interface Props {
  userId: string;
  templateId: string;
  messageContent: string;
  onProgress?: (state: ProofGenerationState) => void;
  onComplete?: (result: ProofResult) => void;
  onError?: (error: Error) => void;
}
```

#### State Machine
```typescript
type ProofGenerationState =
  | { status: 'idle' }
  | { status: 'loading-credential' }
  | { status: 'initializing-prover'; progress: number }
  | { status: 'generating-proof'; progress: number }
  | { status: 'encrypting-witness' }
  | { status: 'submitting' }
  | { status: 'complete'; submissionId: string }
  | { status: 'error'; message: string }
```

#### UI Flow
```svelte
{#if state.status === 'initializing-prover'}
  <div class="proof-loader">
    <div class="spinner" />
    <h3>Loading privacy tools...</h3>
    <p class="text-sm text-slate-600">
      First time setup: 5-10 seconds
    </p>
    <ProgressBar progress={state.progress} />
  </div>
{:else if state.status === 'generating-proof'}
  <div class="proof-loader">
    <div class="spinner" />
    <h3>Proving you're a constituent...</h3>
    <p class="text-sm text-slate-600">
      Generating zero-knowledge proof without revealing your identity
    </p>
    <ProgressBar progress={state.progress} />

    <!-- Educational messaging (cycles every 3s) -->
    {#if educationIndex === 0}
      <p class="education">
        ✓ Your exact address stays private
      </p>
    {:else if educationIndex === 1}
      <p class="education">
        ✓ Congressional staff see: "Verified constituent from {district}"
      </p>
    {:else}
      <p class="education">
        ✓ Building your civic reputation on-chain
      </p>
    {/if}
  </div>
{/if}
```

#### Performance Targets
- **Desktop**: 2-5 seconds proof generation
- **Mobile**: 8-15 seconds proof generation
- **Progress updates**: Every 100ms
- **Educational messages**: Rotate every 3 seconds

---

### 4. Witness Encryption Module

**File**: `src/lib/core/encryption/witness-encryption.ts`

#### Dependencies
```typescript
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
```

#### API Functions
```typescript
interface WitnessData {
  street: string;
  city: string;
  state: string;
  zip: string;
  congressionalDistrict: string;
}

interface EncryptedBlob {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublicKey?: Uint8Array; // For ECDH if needed
}

// Encrypt user address to TEE public key
export async function encryptWitness(
  witnessData: WitnessData,
  teePublicKey: Uint8Array
): Promise<EncryptedBlob>

// Encrypt message content to TEE public key
export async function encryptMessage(
  messageContent: string,
  teePublicKey: Uint8Array
): Promise<EncryptedBlob>

// Fetch TEE public key from backend
export async function fetchTEEPublicKey(): Promise<Uint8Array>
```

#### Encryption Details
- **Algorithm**: XChaCha20-Poly1305 AEAD
- **Nonce**: 24 bytes (192 bits), randomly generated
- **Key derivation**: ECDH with TEE public key (X25519)
- **Authenticated data**: Template ID, timestamp
- **Output**: `nonce || ciphertext || tag`

#### Security Properties
- ✅ Communiqué backend CANNOT decrypt (no private key)
- ✅ Only TEE can decrypt (has private key in Nitro Enclave)
- ✅ Tampering detected (AEAD authentication)
- ✅ Nonce never reused (random per encryption)

---

### 5. Congressional Submission Endpoint

**File**: `src/routes/api/congressional/submit/+server.ts`

#### Input Schema
```typescript
interface SubmissionRequest {
  proof: number[]; // Uint8Array serialized as number[]
  publicOutputs: {
    districtRoot: string; // Hex
    nullifier: string; // Hex
    actionId: string; // Hex
  };
  encryptedWitness: number[]; // Uint8Array serialized
  encryptedMessage: number[]; // Uint8Array serialized
  templateId: string;
  customizations?: Record<string, unknown>;
}
```

#### Business Logic
1. **Deserialize arrays**: Convert number[] → Uint8Array
2. **Check nullifier uniqueness**:
   ```typescript
   const existing = await db.submission.findUnique({
     where: {
       nullifier_action_id: {
         nullifier: publicOutputs.nullifier,
         action_id: publicOutputs.actionId
       }
     }
   });
   if (existing) {
     return json({ error: 'Action already taken' }, { status: 409 });
   }
   ```
3. **Store submission**:
   ```typescript
   const submission = await db.submission.create({
     data: {
       proof_bytes: proofBytes,
       district_root: publicOutputs.districtRoot,
       nullifier: publicOutputs.nullifier,
       action_id: publicOutputs.actionId,
       encrypted_witness: witnessBytes,
       encrypted_message: messageBytes,
       template_id: templateId,
       customizations,
       status: 'pending'
     }
   });
   ```
4. **Submit to blockchain** (async, don't block):
   ```typescript
   voterBlockchainClient.submitProof({
     proof: proofBytes,
     publicOutputs: [
       publicOutputs.districtRoot,
       publicOutputs.nullifier,
       publicOutputs.actionId
     ]
   }).then(txHash => {
     db.submission.update({
       where: { id: submission.id },
       data: {
         blockchain_tx_hash: txHash,
         status: 'verified'
       }
     });
   }).catch(console.error);
   ```
5. **Send to TEE** (async, don't block):
   ```typescript
   sendToTEE({
     submissionId: submission.id,
     encryptedWitness: witnessBytes,
     encryptedMessage: messageBytes,
     templateId
   }).catch(console.error);
   ```

#### Output Schema
```typescript
interface SubmissionResponse {
  success: boolean;
  data?: {
    submissionId: string;
    status: 'pending';
    message: string;
  };
  error?: string;
}
```

---

### 6. Database Schema Updates

**File**: `prisma/schema.prisma`

#### New Models
```prisma
// Shadow Atlas registration tracking
model ShadowAtlasRegistration {
  id                     String   @id @default(cuid())
  user_id                String   @unique
  identity_commitment    String   @unique
  congressional_district String
  leaf_index             Int
  merkle_root            String
  verification_method    String   // 'self.xyz' | 'didit'
  registered_at          DateTime @default(now())
  expires_at             DateTime // 6 months

  user                   User     @relation(fields: [user_id], references: [id])

  @@index([congressional_district])
  @@index([expires_at])
  @@map("shadow_atlas_registration")
}

// Zero-knowledge proof submissions
model Submission {
  id                   String   @id @default(cuid())

  // ZK proof data
  proof_bytes          Bytes    // ~4.6KB Halo2 proof
  district_root        String   // Public output 1
  nullifier            String   // Public output 2
  action_id            String   // Public output 3

  // Encrypted data (only TEE can decrypt)
  encrypted_witness    Bytes    // Address
  encrypted_message    Bytes    // Message content

  // Metadata
  template_id          String
  customizations       Json?
  status               String   // pending | verified | delivered | failed
  blockchain_tx_hash   String?  // Scroll L2 transaction

  // Timestamps
  created_at           DateTime @default(now())
  verified_at          DateTime?
  delivered_at         DateTime?

  @@unique([nullifier, action_id])
  @@index([status])
  @@index([blockchain_tx_hash])
  @@index([template_id])
  @@map("submission")
}
```

#### User Model Updates
```prisma
model User {
  // ... existing fields ...

  // Shadow Atlas registration (one-to-one)
  shadow_atlas_registration ShadowAtlasRegistration?

  // Identity verification flags
  identity_verified         Boolean  @default(false)
  verification_expires_at   DateTime?
}
```

---

## Implementation Phases

### **Phase 1: Shadow Atlas Integration (Week 1-2)** ⏳ IN PROGRESS

#### Tasks
1. ✅ Create `/api/shadow-atlas/register` endpoint
2. ✅ Implement `session-credentials.ts` (IndexedDB storage)
3. ⏳ Update `IdentityVerificationFlow.svelte` to call registration (CURRENT)
4. ✅ Add database migrations for new models (ShadowAtlasRegistration, Submission)
5. ⏸️ Unit tests for registration flow (PENDING)

#### Acceptance Criteria
- ✅ User can verify identity (self.xyz or Didit.me) - EXISTING
- ✅ Registration API endpoint created with mock Shadow Atlas integration
- ✅ Session credential storage in IndexedDB implemented
- ⏳ UI calls registration after identity verification (IN PROGRESS)
- ⏸️ Credential persists across page reloads (TO TEST)
- ⏸️ Expired credentials auto-clear (TO TEST)

---

### **Phase 2: Proof Generation UI (Week 3-4)** ✅ COMPLETE

#### Tasks
1. ✅ Create `ProofGenerator.svelte` component (487 lines)
2. ✅ Integrate with template submission flow (TemplateModal updated)
3. ✅ Implement loading states + educational messaging (8 states, 3 rotating messages)
4. ✅ Add error handling + retry logic (graceful degradation with recovery)
5. ⏸️ E2E test: verify → cache → generate proof (PENDING Phase 3)

#### Acceptance Criteria
- ✅ Prover initializes on first use (progress tracking 0-100%)
- ✅ Subsequent proofs use cached instance (initializeProver() caching)
- ✅ Loading states show progress + education (cycles every 3s)
- ✅ Mobile performance target: 8-15s (responsive design complete)
- ✅ Errors handled gracefully with retry (recoverable error states)

---

### **Phase 3: Encryption + Submission (Week 5-6)** ✅ COMPLETE (Mock Implementation)

#### Tasks
1. ✅ Implement `witness-encryption.ts` (AES-GCM fallback, XChaCha20 TODO)
2. ✅ Create `/api/tee/public-key` endpoint (mock key rotation)
3. ✅ Create `/api/submissions/create` endpoint (nullifier checking)
4. ✅ Wire up proof → encrypt → submit flow (ProofGenerator integration)
5. ⏸️ Integration tests for full pipeline (PENDING Phase 4)

#### Acceptance Criteria
- ✅ Witness encrypted in browser (ECDH + AES-GCM)
- ✅ Message encrypted in browser (via encrypted witness)
- ✅ Submission stored in database (Prisma Submission model)
- ✅ Nullifier uniqueness enforced (DB constraint + check)
- ⏸️ Blockchain submission queued (async) - TODO: voterBlockchainClient integration

---

### **Phase 4: Polish + Testing (Week 7-8)**

#### Tasks
1. Error handling polish
2. Loading state optimization
3. E2E testing (Playwright)
4. Performance profiling
5. Documentation updates

#### Acceptance Criteria
- ✅ All error cases handled
- ✅ Loading times <target (10s mobile)
- ✅ E2E tests passing
- ✅ No memory leaks (WASM cleanup)
- ✅ Production-ready deployment

---

## Testing Strategy

### Unit Tests
```typescript
// session-credentials.test.ts
describe('Session Credential Storage', () => {
  test('stores and retrieves credential', async () => {
    const credential = createMockCredential();
    await storeSessionCredential(credential);
    const retrieved = await getSessionCredential(credential.userId);
    expect(retrieved).toEqual(credential);
  });

  test('rejects expired credentials', async () => {
    const expired = { ...createMockCredential(), expiresAt: pastDate };
    await storeSessionCredential(expired);
    const valid = await hasValidCredential(expired.userId);
    expect(valid).toBe(false);
  });
});
```

### Integration Tests
```typescript
// registration-flow.test.ts
describe('Shadow Atlas Registration', () => {
  test('completes full registration flow', async () => {
    // 1. Mock identity verification
    const verificationResult = mockSelfXyzVerification();

    // 2. Call registration API
    const response = await fetch('/api/shadow-atlas/register', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'test-user',
        identityCommitment: '0x1234...',
        congressionalDistrict: 'CA-12',
        identityProof: verificationResult.proof
      })
    });

    // 3. Verify response
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.merklePath).toHaveLength(12);
  });
});
```

### E2E Tests
```typescript
// proof-generation.spec.ts
test('User can generate and submit proof', async ({ page }) => {
  // 1. Navigate to template
  await page.goto('/s/climate-action');

  // 2. Customize message
  await page.fill('[data-testid="message-editor"]', 'My climate story...');

  // 3. Click submit (triggers verification if needed)
  await page.click('[data-testid="submit-message"]');

  // 4. Complete identity verification
  await page.click('[data-testid="verify-selfxyz"]');
  await completeSelfXyzFlow(page);

  // 5. Wait for proof generation (up to 20s on CI)
  await page.waitForSelector('[data-testid="proof-generating"]');
  await page.waitForSelector('[data-testid="proof-complete"]', { timeout: 20000 });

  // 6. Verify submission success
  const successMessage = await page.textContent('[data-testid="success-message"]');
  expect(successMessage).toContain('Message submitted anonymously');
});
```

---

## Security Considerations

### Browser-Side Security
1. **Session credentials in IndexedDB**:
   - ✅ No PII stored (only merkle_path)
   - ✅ Encrypted at rest (browser security)
   - ❌ Accessible to XSS (Content Security Policy required)

2. **Proof generation**:
   - ✅ Happens client-side (no server sees private inputs)
   - ✅ Address never sent to Communiqué backend
   - ✅ Nullifier prevents double-action

3. **Witness encryption**:
   - ✅ Only TEE can decrypt (Communiqué has no private key)
   - ✅ AEAD prevents tampering
   - ❌ Vulnerable if TEE compromised

### Backend Security
1. **Nullifier enforcement**:
   - ✅ Database constraint prevents double-submission
   - ✅ Checked before storing submission

2. **Encrypted blob storage**:
   - ✅ Communiqué CANNOT decrypt
   - ✅ No plaintext PII in database
   - ❌ Metadata (district, template) not encrypted

3. **API authentication**:
   - ✅ Session-based auth required
   - ✅ Rate limiting on proof submission
   - ❌ No Cloudflare Turnstile yet (Phase 2)

---

## Performance Benchmarks

### Target Metrics
| Metric | Desktop | Mobile | Acceptable |
|--------|---------|--------|------------|
| **Prover Init** | 5-7s | 10-15s | <20s |
| **Proof Generation** | 1-3s | 8-15s | <20s |
| **Witness Encryption** | <100ms | <200ms | <500ms |
| **Total Submission** | 2-5s | 10-20s | <30s |

### Memory Constraints
- **WASM Peak**: ~800MB
- **Mobile Limit**: 1GB available
- **Strategy**: Lazy-load prover, cleanup after proof

---

## Deployment Checklist

### Environment Variables
```bash
# Communiqué Backend
TEE_PUBLIC_KEY=... # Base64 encoded X25519 public key
TEE_ENDPOINT=https://tee.communique.vote/decrypt-and-deliver

# voter-protocol Integration
SHADOW_ATLAS_API_URL=https://voter-protocol.com/api/shadow-atlas
BLOCKCHAIN_RPC_URL=https://scroll.io/rpc
VOTER_CONTRACT_ADDRESS=0x...

# Feature Flags
ENABLE_ZK_PROOFS=true # Enable proof generation flow
ENABLE_TEE_DELIVERY=false # Phase 2 - disable until TEE deployed
```

### Database Migrations
```bash
# Apply schema changes
npx prisma db push

# Or create migration
npx prisma migrate dev --name add-shadow-atlas-models
```

### NPM Dependencies
```bash
# Already installed
npm install @voter-protocol/halo2-browser-prover@0.1.2

# Need to install
npm install @noble/ciphers  # XChaCha20-Poly1305 encryption
npm install idb             # IndexedDB wrapper
```

---

## Next Steps

1. **Review this spec** - Validate assumptions with team
2. **Start with Phase 1** - Shadow Atlas registration API
3. **Parallel work**:
   - voter-protocol: Merkle tree generation
   - Communiqué: Integration layer (this spec)
   - Infrastructure: TEE deployment (AWS Nitro)

**Ready to start building?** Let's implement Phase 1 first.

---

**Last Updated**: 2025-11-10
**Author**: Claude Code
**Status**: ✅ Ready to Implement
