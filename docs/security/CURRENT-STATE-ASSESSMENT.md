# Current Implementation State Assessment

**Date:** October 13, 2025
**Context:** Post-cleanup, ready for CipherVault integration
**Purpose:** Identify what's built, what's missing, and clear next steps

---

## ✅ What We Have (Production-Ready)

### Week 1: Critical Security Fixes (COMPLETE)
1. **No server-side signing** - All signing client-side only
2. **Privacy-safe account IDs** - `random-a3f2d9c8.communique.testnet`
3. **Passkey authentication** - WebAuthn/FIDO2 working
4. **Social recovery** - Guardian-based recovery mechanism

### Week 2: RPC Infrastructure (COMPLETE)
1. **Provider abstraction layer** - Production-ready
2. **3 free providers** - Ankr (primary), dRPC, 1RPC
3. **Health-aware failover** - Circuit breaker pattern
4. **Monitoring dashboard** - `/admin/rpc-monitor` live
5. **Zero cost** - $0/month operational

### Database Schema (CLEANED)
```prisma
model User {
  // ✅ Public/pseudonymous data only
  near_account_id           String?
  near_account_entropy      String?   // For privacy-safe account generation
  scroll_address            String?
  ciphervault_envelope_id   String?   // Reference to NEAR CipherVault

  // ✅ No PII fields
  // ❌ REMOVED: phone_encrypted, street_encrypted, etc.
}

model template_personalization {
  custom_value              String    // Public customizations only
  ciphervault_ref           String?   // Reference for PII (personal stories)

  // ✅ No encrypted PII in database
  // ❌ REMOVED: custom_value_encrypted, encryption_metadata
}
```

### Blockchain Types (DEFINED)
- `src/lib/types/blockchain.ts` - Complete type definitions
- BlockchainUser, CivicCertification, VirtualReward, etc.
- All typed correctly, no CipherVault implementation yet

---

## ❌ What We DON'T Have (Critical Gaps)

### 1. CipherVault Integration (NOT STARTED)

**Missing Components:**
- ❌ No `libsodium-wrappers` installed (XChaCha20-Poly1305 encryption)
- ❌ No `circomlibjs` installed (Poseidon commitments)
- ❌ No `src/lib/core/blockchain/ciphervault.ts` file
- ❌ No client-side encryption implementation
- ❌ No CipherVault contract calls
- ❌ No envelope storage/retrieval logic

**What We Need:**
From VOTER Protocol `ARCHITECTURE.md` lines 170-235:

```typescript
// Required implementation:

// 1. XChaCha20-Poly1305 encryption
const ciphertext = xchacha20poly1305.seal(
  JSON.stringify(pii),
  nonce,
  sovereignKey
);

// 2. Poseidon commitment generation
const commitment = poseidon([
  hash(pii.district_id),
  hash(pii.address),
  hash(nonce)
]);

// 3. Sovereign key encryption with NEAR account key
const accountKey = await near.deriveAccountKey("alice.near");
const encryptedSovKey = aes_gcm.encrypt(sovereignKey, accountKey);

// 4. Store in CipherVault contract
await near.functionCall({
  contractId: "ciphervault.near",
  methodName: "store_envelope",
  args: {
    encrypted_data: Array.from(ciphertext),
    nonce: Array.from(nonce),
    poseidon_commit: commitment,
    encrypted_sovereign_key: Array.from(encryptedSovKey)
  }
});
```

### 2. Data Flow Updates (NOT STARTED)

**Current Flow (WRONG):**
```typescript
// Template personalization
const personalStory = formData.personalConnection;
await db.template_personalization.create({
  custom_value: personalStory  // ❌ PII in PostgreSQL
});
```

**Required Flow (CORRECT):**
```typescript
// Template personalization
const personalStory = formData.personalConnection;

// 1. Encrypt and store in CipherVault
const envelopeId = await ciphervault.storeEnvelope({
  legal_name: userData.name,
  address: userData.address,
  personal_story: personalStory
});

// 2. Store ONLY reference in PostgreSQL
await db.template_personalization.create({
  custom_value: "[See CipherVault]",  // Public placeholder
  ciphervault_ref: envelopeId         // Reference only
});
```

**Affected Files:**
- `src/routes/api/templates/personalize/+server.ts` (or equivalent)
- `src/routes/api/user/address/+server.ts`
- `src/routes/api/user/profile/+server.ts`
- Any file that currently stores PII

### 3. ZK Proof Infrastructure (NOT STARTED)

**Missing:**
- ❌ Shadow Atlas (district Merkle tree on IPFS)
- ❌ ResidencyCircuit (Circom/Groth16 ZK-SNARK)
- ❌ Proof generation UI (8-12 second wait)
- ❌ On-chain verification

**Note:** This is Week 4 work, can defer until CipherVault complete.

---

## 🔍 Contract Status: Does `ciphervault.near` Exist?

**Critical Question:** Is the CipherVault contract deployed on NEAR testnet/mainnet?

**Need to Verify:**
```bash
# Check testnet
near view ciphervault.testnet get_envelope '{"envelope_id": "test"}'

# Check mainnet
near view ciphervault.near get_envelope '{"envelope_id": "test"}'
```

**Three Scenarios:**

### Scenario A: Contract EXISTS (Best Case)
- ✅ Use existing contract
- ✅ Follow VOTER Protocol spec exactly
- Timeline: 6-9 days (just integration)

### Scenario B: Contract NOT DEPLOYED (Most Likely)
- ⚠️ Need to deploy contract first
- Options:
  1. Deploy VOTER Protocol's contract (if available in repo)
  2. Write minimal CipherVault contract ourselves
  3. Use NEAR storage API directly (simpler, no contract)
- Timeline: +3-5 days for contract deployment

### Scenario C: We Build Minimal Version First
- 🎯 Use NEAR's native encrypted storage
- Deploy simple contract with basic envelope CRUD
- Upgrade to full VOTER Protocol spec later
- Timeline: 4-6 days (faster MVP)

**Recommendation:** Check if contract exists, if not, build minimal version first.

---

## 📋 Immediate Next Steps

### Step 1: Verify CipherVault Contract Status (30 minutes)

```bash
# Clone/check voter-protocol repo
cd /Users/noot/Documents/voter-protocol

# Look for contract code
find . -name "*.rs" -path "*ciphervault*"
ls -la contracts/ 2>/dev/null

# Check if deployed
near view ciphervault.testnet contract_metadata '{}'
near view ciphervault.near contract_metadata '{}'
```

### Step 2: Install Dependencies (5 minutes)

```bash
cd /Users/noot/Documents/communique
npm install libsodium-wrappers circomlibjs
```

### Step 3: Create CipherVault Module Skeleton (1 hour)

```typescript
// src/lib/core/blockchain/ciphervault.ts

import sodium from 'libsodium-wrappers';
import { poseidon } from 'circomlibjs';

/**
 * NEAR CipherVault Integration
 *
 * Stores PII encrypted with XChaCha20-Poly1305 on NEAR blockchain.
 * PostgreSQL stores only envelope references, never PII.
 */

export interface CipherEnvelope {
  owner: string;              // alice.near
  encrypted_data: Uint8Array; // XChaCha20-Poly1305 sealed PII
  nonce: Uint8Array;          // 24 bytes
  poseidon_commit: string;    // ZK commitment hash
  encrypted_sovereign_key: Uint8Array; // AES-GCM encrypted
  version: number;
  created_at: number;
  guardians: string[];        // 2-of-3 recovery
}

export interface PIIData {
  legal_name?: string;
  address?: string;
  district_id?: string;
  phone?: string;
  personal_story?: string;
  [key: string]: unknown;
}

export class CipherVault {
  private contractId: string;
  private near: any; // NEAR connection from existing setup

  constructor(contractId: string = 'ciphervault.near') {
    this.contractId = contractId;
  }

  /**
   * Store encrypted PII in CipherVault
   * Returns envelope ID for PostgreSQL reference
   */
  async storeEnvelope(pii: PIIData, nearAccountId: string): Promise<string> {
    // TODO: Implement
    throw new Error('Not yet implemented');
  }

  /**
   * Retrieve and decrypt PII from CipherVault
   */
  async getEnvelope(envelopeId: string): Promise<PIIData> {
    // TODO: Implement
    throw new Error('Not yet implemented');
  }

  /**
   * Update existing envelope (creates new version)
   */
  async updateEnvelope(envelopeId: string, pii: PIIData): Promise<string> {
    // TODO: Implement
    throw new Error('Not yet implemented');
  }

  // Private encryption methods
  private async encryptPII(pii: PIIData): Promise<{
    ciphertext: Uint8Array;
    nonce: Uint8Array;
    sovereignKey: Uint8Array;
  }> {
    // TODO: XChaCha20-Poly1305 implementation
    throw new Error('Not yet implemented');
  }

  private async generateCommitment(pii: PIIData, nonce: Uint8Array): Promise<string> {
    // TODO: Poseidon hash implementation
    throw new Error('Not yet implemented');
  }

  private async encryptSovereignKey(sovereignKey: Uint8Array, nearAccountId: string): Promise<Uint8Array> {
    // TODO: AES-GCM with NEAR-derived key
    throw new Error('Not yet implemented');
  }
}
```

### Step 4: Test Skeleton (30 minutes)

```typescript
// tests/integration/ciphervault.test.ts

import { describe, it, expect } from 'vitest';
import { CipherVault } from '$lib/core/blockchain/ciphervault';

describe('CipherVault Integration', () => {
  it('should encrypt PII client-side', async () => {
    // TODO: Test encryption without contract
  });

  it('should generate Poseidon commitments', async () => {
    // TODO: Test commitment generation
  });

  it('should store envelope in CipherVault', async () => {
    // TODO: Test full flow (requires contract or mock)
  });
});
```

### Step 5: Decide Implementation Strategy (Discussion)

**Three Options:**

1. **Full VOTER Protocol Spec** (6-9 days)
   - Use `ciphervault.near` if deployed
   - Full XChaCha20-Poly1305 + Poseidon + Guardian recovery
   - Production-grade from day 1

2. **Minimal MVP First** (4-6 days)
   - Simple NEAR storage with encryption
   - Basic envelope CRUD
   - Upgrade to full spec later

3. **Bootstrap with Browser Crypto** (2-3 days, DANGEROUS)
   - Temporary client-side only encryption
   - No blockchain storage yet
   - **NOT RECOMMENDED** - This is what got us in trouble last time

**Recommendation:** Option 1 if contract exists, Option 2 if not.

---

## 🎯 Critical Path Forward

### Blocking Questions (Answer TODAY):
1. ✅ Does `ciphervault.near` contract exist on testnet?
2. ✅ Is contract code available in voter-protocol repo?
3. ✅ Can we deploy it ourselves if not?

### Then Execute (Week 2-3):
1. Install dependencies (`libsodium-wrappers`, `circomlibjs`)
2. Create `src/lib/core/blockchain/ciphervault.ts`
3. Implement XChaCha20-Poly1305 encryption
4. Implement Poseidon commitments
5. Integrate with NEAR contract
6. Update all data flows (template personalization, user profile, etc.)
7. Test end-to-end with testnet

### Success Criteria:
- ✅ No PII in PostgreSQL (verified with DB query)
- ✅ All PII stored in CipherVault (on-chain)
- ✅ Template personalization works with encrypted storage
- ✅ User profile updates work with encrypted storage
- ✅ Congressional delivery references CipherVault (not plaintext)

---

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Week 1 Security Fixes | ✅ COMPLETE | Production-ready |
| RPC Infrastructure | ✅ COMPLETE | Zero-cost, production-ready |
| Database Schema | ✅ CLEANED | No PII fields, only references |
| Documentation | ✅ CLEANED | Outdated docs archived |
| CipherVault Integration | ❌ NOT STARTED | Blocking next phase |
| Data Flow Updates | ❌ NOT STARTED | Depends on CipherVault |
| ZK Proofs | ⏳ WEEK 4 | Can defer until CipherVault done |
| Trust Model Docs | ⏳ WEEK 3 | Can do during CipherVault work |

**Current Blocker:** CipherVault integration (Week 2-3 work)

**Next Action:** Verify contract status, then begin implementation.

---

**Ready to proceed with CipherVault implementation once contract status is confirmed.**
