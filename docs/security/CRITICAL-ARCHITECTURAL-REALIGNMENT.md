# CRITICAL: Architectural Misalignment Identified

**Date:** October 2025
**Status:** 🚨 IMMEDIATE CORRECTION REQUIRED
**Severity:** Critical - Violates core VOTER Protocol principles

## The Problem

We've been implementing **client-side encryption with Supabase PostgreSQL storage** for PII (personal stories, addresses, phone numbers).

**This is fundamentally wrong.**

## What VOTER Protocol Actually Specifies

From `voter-protocol/ARCHITECTURE.md` and `voter-protocol/README.md`:

### Correct Architecture:

1. **PII Storage: NEAR CipherVault** (NOT PostgreSQL)
   - Contract: `ciphervault.near`
   - Client-side encryption: XChaCha20-Poly1305
   - Sovereign keys (never transmitted)
   - Poseidon commitments for ZK proofs
   - Guardian recovery (2-of-3 threshold)

2. **Template Storage: PostgreSQL → Filecoin**
   - PostgreSQL: Fast queries, metadata, search
   - Filecoin: Archival storage (permanent, decentralized)
   - Templates are PUBLIC (not encrypted)
   - Only **personal customizations** go to CipherVault

3. **Zero Database PII**
   - No addresses in PostgreSQL
   - No phone numbers in PostgreSQL
   - No personal stories in PostgreSQL
   - **"No plaintext personal stories, delivery confirmations, or addresses in database"** - Bootstrap Strategy

## What We Incorrectly Built

### ❌ What We Did:
```typescript
// Encrypt PII client-side with Web Crypto API
const encrypted = await ClientEncryption.encrypt(personalStory, {
  userId, source: 'passkey', sourceMaterial: passkeyData
});

// Store encrypted PII in Supabase PostgreSQL
await db.template_personalization.create({
  custom_value_encrypted: encrypted.ciphertext,
  encryption_metadata: { iv, authTag, algorithm, version }
});
```

### ✅ What We Should Do:
```typescript
// Encrypt PII client-side with XChaCha20-Poly1305
const sovereignKey = crypto.getRandomValues(new Uint8Array(32));
const nonce = crypto.randomBytes(24);
const ciphertext = xchacha20poly1305.seal(
  JSON.stringify({ personalStory, address, phone }),
  nonce,
  sovereignKey
);

// Generate Poseidon commitment for ZK proofs
const commitment = poseidon([
  hash(districtId),
  hash(address),
  hash(nonce)
]);

// Encrypt sovereign key with NEAR account key
const accountKey = await near.deriveAccountKey("alice.near");
const encryptedSovKey = aes_gcm.encrypt(sovereignKey, accountKey);

// Store in NEAR CipherVault (NOT PostgreSQL)
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

// PostgreSQL stores ONLY:
// - Template ID
// - User's NEAR account ID (alice.near) or Scroll address (0xABCD...)
// - CipherVault reference pointer
// - Metadata (timestamps, counts)
```

## Why This Matters

### VOTER Protocol Principles (from README.md):

> **"VOTER Protocol systematically dismantles every surveillance vector in the political data extraction industry."**

> **"Your browser does math proving district membership. Congressional offices verify the proof. Your address never leaves your device."**

> **"CipherVault stores all personal data encrypted with keys only you control—no seed phrases to write down, no corporate key escrow, no government backdoors."**

> **"Platforms can't ban you—there's no account to ban. They can't sell your data—it doesn't exist in harvestable form. They can't dox you—the connection between wallet and identity doesn't exist anywhere."**

### What We Violated:

1. **Surveillance Resistance**
   - ❌ We store encrypted PII in corporate database (Supabase)
   - ✅ Should store in decentralized blockchain (NEAR)

2. **Subpoena Resistance**
   - ❌ Supabase can be subpoenaed for encrypted data
   - ✅ NEAR blockchain: no corporate entity to subpoena

3. **Zero Corporate Key Escrow**
   - ❌ Our encryption keys derived from passkey/OAuth (we control process)
   - ✅ Sovereign keys generated client-side, never transmitted

4. **Architectural Privacy**
   - ❌ "Encryption added to existing architecture"
   - ✅ "Privacy through architecture - plaintext doesn't exist to steal"

## The Correct Data Model

### What Goes Where:

**NEAR CipherVault (Encrypted PII):**
- Legal name
- Full street address
- Congressional district
- Phone number
- Personal stories / connection blocks
- Delivery confirmations
- Verification credentials (Didit.me VC)

**PostgreSQL (Public/Pseudonymous Data):**
- Template text (public)
- Template metadata (title, category, tags)
- User account identifier (NEAR account ID or Scroll address)
- CipherVault reference pointers
- Template usage counts
- Timestamps, metrics
- Reputation scores (on-chain data, mirrored)

**Scroll Blockchain (Settlement):**
- Reputation scores (ERC-8004)
- ZK proof verifications
- Challenge market outcomes
- Outcome market positions
- Token rewards
- Civic action records

**Filecoin (Archival):**
- Template history
- Archived campaigns
- Long-term storage

## What This Means for Our Implementation

### Must Undo:

1. **Database Schema Changes**
   - ❌ Remove `phone_encrypted`, `street_encrypted`, `connection_details_encrypted` from User model
   - ❌ Remove `custom_value_encrypted`, `encryption_metadata` from template_personalization
   - ✅ Add `ciphervault_envelope_id` references instead

2. **Encryption Module**
   - ❌ `ClientEncryption` class using AES-256-GCM
   - ✅ Use XChaCha20-Poly1305 (as specified in VOTER architecture)
   - ✅ Integrate with NEAR CipherVault contract

3. **Storage Flow**
   - ❌ Encrypt → PostgreSQL
   - ✅ Encrypt → NEAR CipherVault → PostgreSQL stores reference

### Must Build:

1. **NEAR CipherVault Integration**
   - XChaCha20-Poly1305 encryption
   - Poseidon commitment generation
   - Sovereign key management
   - Guardian recovery setup

2. **Correct Data Flow**
   - Template personalization → CipherVault
   - User profile PII → CipherVault
   - PostgreSQL → Reference pointers only

3. **ZK Proof Integration**
   - ResidencyCircuit (Circom + Groth16)
   - Shadow Atlas (district Merkle tree)
   - ZK proof generation (8-12 seconds)

## Why We Made This Mistake

### Root Cause: Bootstrap Strategy Misinterpretation

From `docs/security/bootstrap-strategy.md`:

> **"Client-side encryption for sensitive data before it touches Supabase."**

This was **temporary guidance for zero-budget launch** - NOT the final architecture.

The correct interpretation:
- **Week 1-2:** Fix immediate security holes
- **Week 2:** Client-side encryption as **temporary measure**
- **Week 3-4:** Migrate to NEAR CipherVault (proper architecture)

We treated Week 2 temporary measure as permanent solution.

## Immediate Action Required

### Phase 1: Stop Current Work ✅ DONE

- ✅ Identified architectural misalignment
- ✅ Document correct architecture
- ⏸️ Pause template/profile encryption integration

### Phase 2: Realign Architecture (Week 2-3)

1. **NEAR CipherVault Integration** (3-4 days)
   - Install `near-api-js`
   - Implement XChaCha20-Poly1305 encryption
   - Integrate with `ciphervault.near` contract
   - Implement Poseidon commitment generation

2. **Update Database Schema** (1 day)
   - Remove encrypted PII fields
   - Add `ciphervault_envelope_id` references
   - Add `near_account_id` or `scroll_address` columns

3. **Update Data Flow** (2-3 days)
   - Template personalization → CipherVault
   - User profile → CipherVault
   - Congressional delivery → CipherVault reference

4. **ZK Proof Integration** (Week 4)
   - Shadow Atlas integration
   - ResidencyCircuit compilation
   - ZK proof generation UI

### Phase 3: Filecoin Migration (Week 5+)

- Template archival to Filecoin
- Long-term storage strategy

## The Silver Lining

**What we built wasn't wasted:**

1. **Encryption primitives** - Valuable learning, just wrong algorithm
2. **Test patterns** - Can adapt for CipherVault
3. **Database thinking** - Correct understanding of what needs protection
4. **Performance analysis** - Still relevant for ZK proofs

**What we learned:**

1. **Read the architecture first** - Don't extrapolate from bootstrap docs
2. **Question misalignments** - User caught this, we should have
3. **Verify against principles** - "Client-side encryption" ≠ "CipherVault"

## Cost of Correction

**Time:**
- Undo: 1 day (revert schema, remove encryption module)
- Rebuild: 5-7 days (CipherVault integration, data flow)
- Total: ~1 week lost, ~1 week to correct

**Better than:**
- Launching with wrong architecture
- Rebuilding after production usage
- Violating core protocol principles

## Conclusion

This is a **critical architectural correction**, not a minor fix.

We were building **corporate database with client-side encryption** when we should be building **decentralized blockchain storage with zero corporate custody**.

The difference:
- ❌ Supabase encrypted: Can be subpoenaed, corporate custody, surveillance surface
- ✅ NEAR CipherVault: No subpoena target, user custody, architectural privacy

**VOTER Protocol's core value proposition is eliminating surveillance infrastructure.**

**We almost built surveillance infrastructure with encryption on top.**

---

**Next Steps:**

1. Update todo list to reflect architectural realignment
2. Research NEAR CipherVault implementation
3. Implement XChaCha20-Poly1305 encryption
4. Integrate with `ciphervault.near` contract
5. Update all data flows accordingly

**This is the correct path forward.**
