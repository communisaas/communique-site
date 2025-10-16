# VOTER Protocol: Option A Implementation Plan

**Strategy:** Build protocol stack correctly in voter-protocol, then integrate into communique
**Timeline:** 6-9 days for protocol, 3-4 days for integration, 2-3 days for deployment
**Total:** ~2-3 weeks to production-ready

---

## Phase 1: Protocol Stack (voter-protocol)

**Timeline:** 6-9 days
**Location:** `/Users/noot/Documents/voter-protocol/`

### Day 1-2: Repository Structure & CipherVault Contract Foundation

#### Task 1.1: Set Up Monorepo Structure (2 hours)
```bash
cd /Users/noot/Documents/voter-protocol

# Create directory structure
mkdir -p contracts/near/ciphervault/src
mkdir -p packages/crypto/src
mkdir -p packages/client/src
mkdir -p packages/types/src

# Initialize workspace
cat > package.json << 'EOF'
{
  "name": "voter-protocol",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
EOF

# Initialize packages
cd packages/types && npm init -y
cd ../crypto && npm init -y
cd ../client && npm init -y
```

#### Task 1.2: Create TypeScript Shared Types (3 hours)
**File:** `packages/types/src/envelope.ts`

```typescript
/**
 * CipherVault envelope structure
 * Matches NEAR contract CipherEnvelope struct
 */
export interface CipherEnvelope {
  owner: string;              // alice.near
  encrypted_data: Uint8Array; // XChaCha20-Poly1305 sealed PII
  nonce: Uint8Array;          // 24 bytes
  poseidon_commit: string;    // Hex string (32 bytes)
  encrypted_sovereign_key: Uint8Array; // AES-GCM encrypted
  version: number;
  created_at: number;         // Unix timestamp
  guardians: string[];        // 2-of-3 recovery
}

/**
 * PII data structure (before encryption)
 */
export interface PIIData {
  legal_name?: string;
  address?: string;
  district_id?: string;
  phone?: string;
  personal_story?: string;
  verification_credential?: unknown; // Didit.me VC
  [key: string]: unknown;
}

/**
 * Envelope creation options
 */
export interface EnvelopeOptions {
  guardians?: string[];       // Optional guardian accounts
  ttl?: number;               // Time-to-live in seconds
}

/**
 * Envelope retrieval result
 */
export interface EnvelopeResult {
  envelope_id: string;
  data: PIIData;
  metadata: {
    created_at: Date;
    version: number;
    guardians: string[];
  };
}
```

**File:** `packages/types/src/index.ts`
```typescript
export * from './envelope';
export * from './reputation';
export * from './challenge';
```

#### Task 1.3: CipherVault Contract (Rust) - Basic Structure (6 hours)
**File:** `contracts/near/ciphervault/Cargo.toml`

```toml
[package]
name = "ciphervault"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
near-sdk = "5.5.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
borsh = "1.5.0"

[profile.release]
codegen-units = 1
opt-level = "z"
lto = true
debug = false
panic = "abort"
overflow-checks = true
```

**File:** `contracts/near/ciphervault/src/lib.rs`

```rust
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault};
use near_sdk::serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct CipherEnvelope {
    pub owner: AccountId,
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub poseidon_commit: String,
    pub encrypted_sovereign_key: Vec<u8>,
    pub version: u32,
    pub created_at: u64,
    pub guardians: Vec<AccountId>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct CipherVault {
    envelopes: UnorderedMap<String, CipherEnvelope>,
    envelope_counter: u64,
}

#[near_bindgen]
impl CipherVault {
    #[init]
    pub fn new() -> Self {
        Self {
            envelopes: UnorderedMap::new(b"e"),
            envelope_counter: 0,
        }
    }

    /// Store encrypted PII envelope
    /// Returns envelope_id for PostgreSQL reference
    pub fn store_envelope(
        &mut self,
        encrypted_data: Vec<u8>,
        nonce: Vec<u8>,
        poseidon_commit: String,
        encrypted_sovereign_key: Vec<u8>,
        guardians: Option<Vec<AccountId>>,
    ) -> String {
        // Validate inputs
        assert!(encrypted_data.len() > 0, "Encrypted data cannot be empty");
        assert_eq!(nonce.len(), 24, "Nonce must be 24 bytes");
        assert!(poseidon_commit.len() == 64, "Poseidon commitment must be 32 bytes (64 hex chars)");

        // Generate envelope ID
        self.envelope_counter += 1;
        let envelope_id = format!("{}-{}", env::predecessor_account_id(), self.envelope_counter);

        // Create envelope
        let envelope = CipherEnvelope {
            owner: env::predecessor_account_id(),
            encrypted_data,
            nonce,
            poseidon_commit,
            encrypted_sovereign_key,
            version: 1,
            created_at: env::block_timestamp(),
            guardians: guardians.unwrap_or_default(),
        };

        // Store
        self.envelopes.insert(&envelope_id, &envelope);

        envelope_id
    }

    /// Retrieve envelope (owner only)
    pub fn get_envelope(&self, envelope_id: String) -> Option<CipherEnvelope> {
        let envelope = self.envelopes.get(&envelope_id)?;

        // Only owner can retrieve
        assert_eq!(
            env::predecessor_account_id(),
            envelope.owner,
            "Only owner can retrieve envelope"
        );

        Some(envelope)
    }

    /// Update envelope (creates new version)
    pub fn update_envelope(
        &mut self,
        envelope_id: String,
        encrypted_data: Vec<u8>,
        nonce: Vec<u8>,
        poseidon_commit: String,
        encrypted_sovereign_key: Vec<u8>,
    ) -> String {
        // Get existing envelope
        let existing = self.envelopes.get(&envelope_id)
            .expect("Envelope not found");

        // Verify ownership
        assert_eq!(
            env::predecessor_account_id(),
            existing.owner,
            "Only owner can update envelope"
        );

        // Create new version
        let new_envelope = CipherEnvelope {
            owner: existing.owner,
            encrypted_data,
            nonce,
            poseidon_commit,
            encrypted_sovereign_key,
            version: existing.version + 1,
            created_at: env::block_timestamp(),
            guardians: existing.guardians,
        };

        // Store with same ID (overwrites)
        self.envelopes.insert(&envelope_id, &new_envelope);

        envelope_id
    }

    /// Delete envelope (owner only)
    pub fn delete_envelope(&mut self, envelope_id: String) {
        let envelope = self.envelopes.get(&envelope_id)
            .expect("Envelope not found");

        assert_eq!(
            env::predecessor_account_id(),
            envelope.owner,
            "Only owner can delete envelope"
        );

        self.envelopes.remove(&envelope_id);
    }

    /// Check if envelope exists
    pub fn envelope_exists(&self, envelope_id: String) -> bool {
        self.envelopes.get(&envelope_id).is_some()
    }

    /// Get envelope count (for testing)
    pub fn get_envelope_count(&self) -> u64 {
        self.envelope_counter
    }
}

// TODO: Guardian recovery methods (2-of-3 threshold)
// TODO: Access control for guardians
// TODO: Envelope expiration/TTL
```

**File:** `contracts/near/ciphervault/build.sh`
```bash
#!/bin/bash
set -e

# Build contract
cargo build --target wasm32-unknown-unknown --release

# Copy to output
mkdir -p ../../out
cp target/wasm32-unknown-unknown/release/ciphervault.wasm ../../out/

echo "Contract built: out/ciphervault.wasm"
```

### Day 3-4: Crypto SDK (@voter-protocol/crypto)

#### Task 2.1: Setup Crypto Package (1 hour)
```bash
cd packages/crypto

# Install dependencies
npm install libsodium-wrappers circomlibjs
npm install -D @types/libsodium-wrappers typescript vitest

# TypeScript config
cat > tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF
```

#### Task 2.2: XChaCha20-Poly1305 Encryption (4 hours)
**File:** `packages/crypto/src/encryption.ts`

```typescript
import sodium from 'libsodium-wrappers';

await sodium.ready;

/**
 * XChaCha20-Poly1305 encryption (as specified in VOTER Protocol)
 */
export class XChaCha20Encryption {
  /**
   * Generate sovereign key (32 bytes)
   * Must be cleared from memory after use
   */
  static generateSovereignKey(): Uint8Array {
    return sodium.randombytes_buf(32);
  }

  /**
   * Generate nonce (24 bytes for XChaCha20)
   */
  static generateNonce(): Uint8Array {
    return sodium.randombytes_buf(24);
  }

  /**
   * Encrypt PII with XChaCha20-Poly1305
   * Returns ciphertext with authentication tag
   */
  static encrypt(
    plaintext: string,
    nonce: Uint8Array,
    sovereignKey: Uint8Array
  ): Uint8Array {
    if (nonce.length !== 24) {
      throw new Error('Nonce must be 24 bytes for XChaCha20');
    }
    if (sovereignKey.length !== 32) {
      throw new Error('Sovereign key must be 32 bytes');
    }

    const plaintextBytes = sodium.from_string(plaintext);

    // XChaCha20-Poly1305 authenticated encryption
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintextBytes,
      null, // No additional data
      null, // No secret nonce
      nonce,
      sovereignKey
    );

    return ciphertext;
  }

  /**
   * Decrypt ciphertext
   */
  static decrypt(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    sovereignKey: Uint8Array
  ): string {
    if (nonce.length !== 24) {
      throw new Error('Nonce must be 24 bytes');
    }
    if (sovereignKey.length !== 32) {
      throw new Error('Sovereign key must be 32 bytes');
    }

    const plaintextBytes = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, // No secret nonce
      ciphertext,
      null, // No additional data
      nonce,
      sovereignKey
    );

    return sodium.to_string(plaintextBytes);
  }

  /**
   * Clear sensitive data from memory
   */
  static clearKey(key: Uint8Array): void {
    sodium.memzero(key);
  }
}
```

#### Task 2.3: Poseidon Commitments (3 hours)
**File:** `packages/crypto/src/commitments.ts`

```typescript
import { buildPoseidon } from 'circomlibjs';
import { createHash } from 'crypto';

/**
 * Poseidon hash for ZK commitments
 * Used to prove district membership without revealing address
 */
export class PoseidonCommitment {
  private static poseidon: any;

  /**
   * Initialize Poseidon hasher (call once)
   */
  static async init(): Promise<void> {
    if (!this.poseidon) {
      this.poseidon = await buildPoseidon();
    }
  }

  /**
   * Generate Poseidon commitment for ZK proof
   * Commits to: district_id, address, nonce
   */
  static async generate(
    districtId: string,
    address: string,
    nonce: Uint8Array
  ): Promise<string> {
    await this.init();

    // Hash inputs to field elements
    const districtHash = this.hashToFieldElement(districtId);
    const addressHash = this.hashToFieldElement(address);
    const nonceHash = this.hashToFieldElement(Buffer.from(nonce).toString('hex'));

    // Poseidon hash
    const commitment = this.poseidon([districtHash, addressHash, nonceHash]);

    // Convert to hex string
    return this.poseidon.F.toString(commitment, 16).padStart(64, '0');
  }

  /**
   * Hash string to field element
   * Uses SHA256 then modulo field prime
   */
  private static hashToFieldElement(input: string): bigint {
    const hash = createHash('sha256').update(input).digest('hex');
    const hashBigInt = BigInt('0x' + hash);

    // Poseidon field prime (BN254)
    const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

    return hashBigInt % FIELD_PRIME;
  }

  /**
   * Verify commitment matches inputs
   */
  static async verify(
    commitment: string,
    districtId: string,
    address: string,
    nonce: Uint8Array
  ): Promise<boolean> {
    const generated = await this.generate(districtId, address, nonce);
    return generated === commitment;
  }
}
```

#### Task 2.4: NEAR Key Derivation (2 hours)
**File:** `packages/crypto/src/near-keys.ts`

```typescript
import { createHash, createHmac, pbkdf2 } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

/**
 * NEAR account key derivation
 * Used to encrypt sovereign keys
 */
export class NEARKeyDerivation {
  /**
   * Derive encryption key from NEAR account
   * Uses account ID as entropy
   */
  static async deriveAccountKey(
    accountId: string,
    salt: string = 'voter-protocol-v1'
  ): Promise<Uint8Array> {
    // Use PBKDF2 to derive key from account ID
    const key = await pbkdf2Async(
      accountId,
      salt,
      100000,
      32,
      'sha256'
    );

    return new Uint8Array(key);
  }

  /**
   * Encrypt sovereign key with NEAR-derived key
   * Uses AES-256-GCM
   */
  static async encryptSovereignKey(
    sovereignKey: Uint8Array,
    nearAccountId: string
  ): Promise<{
    encrypted: Uint8Array;
    iv: Uint8Array;
    authTag: Uint8Array;
  }> {
    // Import Web Crypto API
    const crypto = globalThis.crypto;

    // Derive account key
    const accountKey = await this.deriveAccountKey(nearAccountId);

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      accountKey,
      'AES-GCM',
      false,
      ['encrypt']
    );

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      sovereignKey
    );

    // AES-GCM appends 16-byte auth tag
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    return {
      encrypted: ciphertext,
      iv,
      authTag
    };
  }

  /**
   * Decrypt sovereign key
   */
  static async decryptSovereignKey(
    encrypted: Uint8Array,
    iv: Uint8Array,
    authTag: Uint8Array,
    nearAccountId: string
  ): Promise<Uint8Array> {
    const crypto = globalThis.crypto;

    // Derive account key
    const accountKey = await this.deriveAccountKey(nearAccountId);

    // Import key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      accountKey,
      'AES-GCM',
      false,
      ['decrypt']
    );

    // Combine ciphertext and auth tag
    const combined = new Uint8Array(encrypted.length + authTag.length);
    combined.set(encrypted);
    combined.set(authTag, encrypted.length);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      combined
    );

    return new Uint8Array(decrypted);
  }
}
```

**File:** `packages/crypto/src/index.ts`
```typescript
export * from './encryption';
export * from './commitments';
export * from './near-keys';
```

### Day 5-6: Client SDK (@voter-protocol/client)

#### Task 3.1: CipherVault Client (6 hours)
**File:** `packages/client/src/ciphervault.ts`

```typescript
import { connect, Contract, keyStores, Near } from 'near-api-js';
import { XChaCha20Encryption, PoseidonCommitment, NEARKeyDerivation } from '@voter-protocol/crypto';
import { CipherEnvelope, PIIData, EnvelopeOptions, EnvelopeResult } from '@voter-protocol/types';

/**
 * CipherVault client for encrypted PII storage on NEAR
 */
export class CipherVault {
  private near: Near;
  private contractId: string;
  private contract: Contract;

  constructor(config: {
    networkId: 'testnet' | 'mainnet';
    contractId?: string;
    keyStore?: keyStores.KeyStore;
  }) {
    this.contractId = config.contractId ||
      (config.networkId === 'mainnet' ? 'ciphervault.near' : 'ciphervault.testnet');
  }

  /**
   * Initialize NEAR connection
   */
  async init(accountId: string): Promise<void> {
    // Connect to NEAR
    this.near = await connect({
      networkId: this.contractId.includes('testnet') ? 'testnet' : 'mainnet',
      nodeUrl: `https://rpc.${this.contractId.includes('testnet') ? 'testnet' : 'mainnet'}.near.org`,
      keyStore: new keyStores.BrowserLocalStorageKeyStore()
    });

    // Get contract
    const account = await this.near.account(accountId);
    this.contract = new Contract(account, this.contractId, {
      viewMethods: ['get_envelope', 'envelope_exists'],
      changeMethods: ['store_envelope', 'update_envelope', 'delete_envelope']
    });
  }

  /**
   * Store encrypted PII in CipherVault
   * Returns envelope_id for PostgreSQL reference
   */
  async storeEnvelope(
    pii: PIIData,
    nearAccountId: string,
    options?: EnvelopeOptions
  ): Promise<string> {
    // 1. Generate sovereign key (client-side only, never transmitted)
    const sovereignKey = XChaCha20Encryption.generateSovereignKey();

    try {
      // 2. Encrypt PII with XChaCha20-Poly1305
      const nonce = XChaCha20Encryption.generateNonce();
      const plaintext = JSON.stringify(pii);
      const ciphertext = XChaCha20Encryption.encrypt(plaintext, nonce, sovereignKey);

      // 3. Generate Poseidon commitment (for ZK proofs)
      const commitment = await PoseidonCommitment.generate(
        pii.district_id || '',
        pii.address || '',
        nonce
      );

      // 4. Encrypt sovereign key with NEAR account-derived key
      const { encrypted: encryptedSovKey, iv, authTag } =
        await NEARKeyDerivation.encryptSovereignKey(sovereignKey, nearAccountId);

      // Combine encrypted sovereign key with IV and auth tag
      const sovereignKeyBundle = new Uint8Array(
        encryptedSovKey.length + iv.length + authTag.length
      );
      sovereignKeyBundle.set(encryptedSovKey, 0);
      sovereignKeyBundle.set(iv, encryptedSovKey.length);
      sovereignKeyBundle.set(authTag, encryptedSovKey.length + iv.length);

      // 5. Store in CipherVault contract
      const envelopeId = await (this.contract as any).store_envelope({
        args: {
          encrypted_data: Array.from(ciphertext),
          nonce: Array.from(nonce),
          poseidon_commit: commitment,
          encrypted_sovereign_key: Array.from(sovereignKeyBundle),
          guardians: options?.guardians || null
        },
        gas: '30000000000000' // 30 TGas
      });

      return envelopeId;

    } finally {
      // 6. CRITICAL: Clear plaintext sovereign key from memory
      XChaCha20Encryption.clearKey(sovereignKey);
    }
  }

  /**
   * Retrieve and decrypt PII from CipherVault
   */
  async getEnvelope(
    envelopeId: string,
    nearAccountId: string
  ): Promise<EnvelopeResult> {
    // 1. Retrieve envelope from contract
    const envelope: CipherEnvelope = await (this.contract as any).get_envelope({
      envelope_id: envelopeId
    });

    // 2. Extract encrypted sovereign key components
    const sovereignKeyBundle = new Uint8Array(envelope.encrypted_sovereign_key);
    const encryptedSovKey = sovereignKeyBundle.slice(0, -28); // Everything except IV and auth tag
    const iv = sovereignKeyBundle.slice(-28, -16);
    const authTag = sovereignKeyBundle.slice(-16);

    // 3. Decrypt sovereign key with NEAR-derived key
    const sovereignKey = await NEARKeyDerivation.decryptSovereignKey(
      encryptedSovKey,
      iv,
      authTag,
      nearAccountId
    );

    try {
      // 4. Decrypt PII
      const plaintext = XChaCha20Encryption.decrypt(
        new Uint8Array(envelope.encrypted_data),
        new Uint8Array(envelope.nonce),
        sovereignKey
      );

      // 5. Parse JSON
      const pii: PIIData = JSON.parse(plaintext);

      return {
        envelope_id: envelopeId,
        data: pii,
        metadata: {
          created_at: new Date(envelope.created_at / 1000000), // NEAR uses nanoseconds
          version: envelope.version,
          guardians: envelope.guardians
        }
      };

    } finally {
      // 6. Clear sovereign key from memory
      XChaCha20Encryption.clearKey(sovereignKey);
    }
  }

  /**
   * Update existing envelope (creates new version)
   */
  async updateEnvelope(
    envelopeId: string,
    pii: PIIData,
    nearAccountId: string
  ): Promise<string> {
    // Same as storeEnvelope but calls update_envelope
    const sovereignKey = XChaCha20Encryption.generateSovereignKey();

    try {
      const nonce = XChaCha20Encryption.generateNonce();
      const plaintext = JSON.stringify(pii);
      const ciphertext = XChaCha20Encryption.encrypt(plaintext, nonce, sovereignKey);

      const commitment = await PoseidonCommitment.generate(
        pii.district_id || '',
        pii.address || '',
        nonce
      );

      const { encrypted: encryptedSovKey, iv, authTag } =
        await NEARKeyDerivation.encryptSovereignKey(sovereignKey, nearAccountId);

      const sovereignKeyBundle = new Uint8Array(
        encryptedSovKey.length + iv.length + authTag.length
      );
      sovereignKeyBundle.set(encryptedSovKey, 0);
      sovereignKeyBundle.set(iv, encryptedSovKey.length);
      sovereignKeyBundle.set(authTag, encryptedSovKey.length + iv.length);

      await (this.contract as any).update_envelope({
        args: {
          envelope_id: envelopeId,
          encrypted_data: Array.from(ciphertext),
          nonce: Array.from(nonce),
          poseidon_commit: commitment,
          encrypted_sovereign_key: Array.from(sovereignKeyBundle)
        },
        gas: '30000000000000'
      });

      return envelopeId;

    } finally {
      XChaCha20Encryption.clearKey(sovereignKey);
    }
  }

  /**
   * Delete envelope
   */
  async deleteEnvelope(envelopeId: string): Promise<void> {
    await (this.contract as any).delete_envelope({
      args: { envelope_id: envelopeId },
      gas: '10000000000000'
    });
  }

  /**
   * Check if envelope exists
   */
  async envelopeExists(envelopeId: string): Promise<boolean> {
    return await (this.contract as any).envelope_exists({
      envelope_id: envelopeId
    });
  }
}
```

**File:** `packages/client/src/index.ts`
```typescript
export * from './ciphervault';
// TODO: Export reputation, challenges, outcome markets clients
```

### Day 7: Testing & Documentation

#### Task 4.1: Contract Tests (3 hours)
**File:** `contracts/near/ciphervault/tests/test_basic.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: String) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor.parse().unwrap());
        builder
    }

    #[test]
    fn test_store_and_retrieve_envelope() {
        let context = get_context("alice.near".to_string());
        testing_env!(context.build());

        let mut contract = CipherVault::new();

        // Store envelope
        let envelope_id = contract.store_envelope(
            vec![1, 2, 3, 4], // encrypted_data
            vec![0; 24],      // nonce
            "a".repeat(64),   // poseidon_commit
            vec![5, 6, 7, 8], // encrypted_sovereign_key
            None              // guardians
        );

        assert!(envelope_id.contains("alice.near"));

        // Retrieve envelope
        let envelope = contract.get_envelope(envelope_id.clone()).unwrap();
        assert_eq!(envelope.encrypted_data, vec![1, 2, 3, 4]);
        assert_eq!(envelope.version, 1);
    }

    #[test]
    #[should_panic(expected = "Only owner can retrieve envelope")]
    fn test_unauthorized_retrieve() {
        let mut context = get_context("alice.near".to_string());
        testing_env!(context.build());

        let mut contract = CipherVault::new();

        let envelope_id = contract.store_envelope(
            vec![1, 2, 3],
            vec![0; 24],
            "a".repeat(64),
            vec![4, 5, 6],
            None
        );

        // Try to retrieve as different user
        context.predecessor_account_id("bob.near".parse().unwrap());
        testing_env!(context.build());

        contract.get_envelope(envelope_id);
    }
}
```

#### Task 4.2: Integration Tests (3 hours)
**File:** `packages/client/tests/ciphervault.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { CipherVault } from '../src/ciphervault';
import { PIIData } from '@voter-protocol/types';

describe('CipherVault Integration', () => {
  let vault: CipherVault;
  const testAccountId = 'test.testnet';

  beforeAll(async () => {
    vault = new CipherVault({
      networkId: 'testnet',
      contractId: 'ciphervault.testnet'
    });

    await vault.init(testAccountId);
  });

  it('should store and retrieve PII', async () => {
    const pii: PIIData = {
      legal_name: 'Alice Smith',
      address: '123 Main St, Austin TX 78701',
      district_id: 'TX-21',
      phone: '+1-555-0123'
    };

    // Store
    const envelopeId = await vault.storeEnvelope(pii, testAccountId);
    expect(envelopeId).toContain(testAccountId);

    // Retrieve
    const result = await vault.getEnvelope(envelopeId, testAccountId);
    expect(result.data.legal_name).toBe('Alice Smith');
    expect(result.data.address).toBe('123 Main St, Austin TX 78701');
  });

  it('should encrypt data client-side', async () => {
    // This test verifies that plaintext never leaves the client
    // We'll check that the on-chain data is actually encrypted

    const pii: PIIData = {
      legal_name: 'Secret Name',
      address: 'Secret Address'
    };

    const envelopeId = await vault.storeEnvelope(pii, testAccountId);

    // Query contract directly to verify encryption
    const exists = await vault.envelopeExists(envelopeId);
    expect(exists).toBe(true);

    // If we could read the raw contract storage, we'd verify
    // that "Secret Name" doesn't appear in plaintext
  });
});
```

#### Task 4.3: Documentation (2 hours)
**File:** `packages/client/README.md`

```markdown
# @voter-protocol/client

Official TypeScript client for VOTER Protocol.

## Installation

```bash
npm install @voter-protocol/client @voter-protocol/crypto @voter-protocol/types
```

## Usage

### Store Encrypted PII

```typescript
import { CipherVault } from '@voter-protocol/client';

const vault = new CipherVault({
  networkId: 'testnet',
  contractId: 'ciphervault.testnet'
});

await vault.init('alice.testnet');

const envelopeId = await vault.storeEnvelope(
  {
    legal_name: 'Alice Smith',
    address: '123 Main St',
    district_id: 'TX-21'
  },
  'alice.testnet'
);

// Store envelope_id in your database
await db.user.update({
  ciphervault_envelope_id: envelopeId
});
```

### Retrieve PII

```typescript
const result = await vault.getEnvelope(envelopeId, 'alice.testnet');
console.log(result.data.legal_name); // "Alice Smith"
```

## Security

- **Client-side encryption**: All PII encrypted in browser with XChaCha20-Poly1305
- **Sovereign keys**: Generated client-side, never transmitted
- **NEAR key derivation**: Sovereign keys encrypted with NEAR account keys
- **Memory safety**: Sensitive keys cleared after use

## Architecture

See [VOTER Protocol Architecture](../../ARCHITECTURE.md) for details.
```

### Day 8-9: Deployment & Publishing

#### Task 5.1: Deploy Contract to Testnet (2 hours)
```bash
# Build contract
cd contracts/near/ciphervault
./build.sh

# Deploy to testnet
near create-account ciphervault.testnet --masterAccount your-account.testnet
near deploy ciphervault.testnet ../../out/ciphervault.wasm --initFunction new --initArgs '{}'

# Test deployment
near view ciphervault.testnet get_envelope_count '{}'
```

#### Task 5.2: Publish NPM Packages (2 hours)
```bash
cd packages/types
npm version 0.1.0
npm publish --access public

cd ../crypto
npm version 0.1.0
npm publish --access public

cd ../client
npm version 0.1.0
npm publish --access public
```

#### Task 5.3: Create Integration Guide (2 hours)
**File:** `voter-protocol/docs/INTEGRATION-GUIDE.md`

```markdown
# VOTER Protocol Integration Guide

## For Application Developers

### Step 1: Install Dependencies

```bash
npm install @voter-protocol/client @voter-protocol/crypto @voter-protocol/types near-api-js
```

### Step 2: Initialize CipherVault

```typescript
import { CipherVault } from '@voter-protocol/client';

const vault = new CipherVault({
  networkId: 'testnet', // or 'mainnet'
  contractId: 'ciphervault.testnet'
});

// Initialize with user's NEAR account
await vault.init(userNearAccountId);
```

### Step 3: Store PII

```typescript
// Store encrypted PII
const envelopeId = await vault.storeEnvelope(
  {
    legal_name: user.name,
    address: user.address,
    phone: user.phone
  },
  userNearAccountId
);

// Store reference in your database
await yourDatabase.user.update({
  where: { id: userId },
  data: { ciphervault_envelope_id: envelopeId }
});
```

### Step 4: Retrieve PII

```typescript
// Get envelope ID from your database
const user = await yourDatabase.user.findUnique({ where: { id: userId } });

// Retrieve and decrypt PII
const result = await vault.getEnvelope(
  user.ciphervault_envelope_id,
  user.near_account_id
);

console.log(result.data.legal_name);
```

## Database Schema

Your application should NEVER store PII directly. Only store references:

```prisma
model User {
  id                        String   @id
  email                     String?

  // VOTER Protocol integration
  near_account_id           String?
  ciphervault_envelope_id   String?  // Reference only

  // Public/pseudonymous data only
  display_name              String?
  created_at                DateTime
}
```

## Security Checklist

- [ ] No PII stored in your database (only references)
- [ ] All encryption happens client-side
- [ ] Sovereign keys never transmitted to server
- [ ] Memory cleared after cryptographic operations
- [ ] NEAR account ID privacy-safe (not linkable to real identity)

## Examples

See [examples/](../examples/) directory for complete integration examples.
```

---

## Phase 2: Communique Integration (3-4 days)

### Day 10-11: Install & Wrap Protocol SDK

#### Task 6.1: Install Dependencies (30 minutes)
```bash
cd /Users/noot/Documents/communique

npm install @voter-protocol/client @voter-protocol/crypto @voter-protocol/types near-api-js
```

#### Task 6.2: Create Integration Wrapper (4 hours)
**File:** `communique/src/lib/core/integrations/voter-protocol/ciphervault-wrapper.ts`

```typescript
import { CipherVault } from '@voter-protocol/client';
import type { PIIData, EnvelopeResult } from '@voter-protocol/types';
import { db } from '$lib/core/db';
import { env } from '$env/dynamic/private';

/**
 * Communique-specific wrapper for CipherVault
 * Handles database updates alongside protocol operations
 */
export class CommuniqueCipherVault {
  private vault: CipherVault;

  constructor() {
    this.vault = new CipherVault({
      networkId: env.NEAR_NETWORK_ID as 'testnet' | 'mainnet',
      contractId: env.CIPHERVAULT_CONTRACT_ID
    });
  }

  /**
   * Store user profile PII
   * Updates database with envelope reference
   */
  async storeUserProfile(
    userId: string,
    nearAccountId: string,
    pii: {
      legal_name?: string;
      address?: string;
      phone?: string;
      district_id?: string;
    }
  ): Promise<string> {
    // Initialize vault with user's account
    await this.vault.init(nearAccountId);

    // Store in CipherVault
    const envelopeId = await this.vault.storeEnvelope(pii, nearAccountId);

    // Update database with reference
    await db.user.update({
      where: { id: userId },
      data: {
        ciphervault_envelope_id: envelopeId,
        updated_at: new Date()
      }
    });

    return envelopeId;
  }

  /**
   * Store template personalization (personal stories)
   */
  async storePersonalization(
    userId: string,
    templateId: string,
    nearAccountId: string,
    personalStory: string,
    additionalPII?: Partial<PIIData>
  ): Promise<string> {
    await this.vault.init(nearAccountId);

    // Combine personal story with any additional PII
    const pii: PIIData = {
      personal_story: personalStory,
      ...additionalPII
    };

    // Store in CipherVault
    const envelopeId = await this.vault.storeEnvelope(pii, nearAccountId);

    // Update template_personalization with reference
    await db.template_personalization.create({
      data: {
        user_id: userId,
        template_id: templateId,
        custom_value: '[See CipherVault]', // Public placeholder
        ciphervault_ref: envelopeId,
        created_at: new Date()
      }
    });

    return envelopeId;
  }

  /**
   * Retrieve user profile PII
   */
  async getUserProfile(userId: string): Promise<PIIData | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        ciphervault_envelope_id: true,
        near_account_id: true
      }
    });

    if (!user?.ciphervault_envelope_id || !user?.near_account_id) {
      return null;
    }

    await this.vault.init(user.near_account_id);

    const result = await this.vault.getEnvelope(
      user.ciphervault_envelope_id,
      user.near_account_id
    );

    return result.data;
  }

  /**
   * Retrieve template personalization
   */
  async getPersonalization(personalizationId: string, nearAccountId: string): Promise<PIIData | null> {
    const personalization = await db.template_personalization.findUnique({
      where: { id: personalizationId },
      select: { ciphervault_ref: true }
    });

    if (!personalization?.ciphervault_ref) {
      return null;
    }

    await this.vault.init(nearAccountId);

    const result = await this.vault.getEnvelope(
      personalization.ciphervault_ref,
      nearAccountId
    );

    return result.data;
  }
}

// Singleton instance
export const ciphervault = new CommuniqueCipherVault();
```

### Day 12: Update Data Flows

#### Task 7.1: Update User Profile API (2 hours)
**File:** `communique/src/routes/api/user/profile/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import { ciphervault } from '$lib/core/integrations/voter-protocol/ciphervault-wrapper';

export async function POST({ request, locals }) {
  const { name, address, phone, district_id } = await request.json();
  const userId = locals.user.id;
  const nearAccountId = locals.user.near_account_id;

  if (!nearAccountId) {
    return json({ error: 'NEAR account required' }, { status: 400 });
  }

  // Store PII in CipherVault, get reference
  const envelopeId = await ciphervault.storeUserProfile(
    userId,
    nearAccountId,
    {
      legal_name: name,
      address,
      phone,
      district_id
    }
  );

  return json({
    success: true,
    envelope_id: envelopeId
  });
}

export async function GET({ locals }) {
  const userId = locals.user.id;

  // Retrieve PII from CipherVault
  const pii = await ciphervault.getUserProfile(userId);

  if (!pii) {
    return json({ error: 'Profile not found' }, { status: 404 });
  }

  return json({
    name: pii.legal_name,
    address: pii.address,
    phone: pii.phone,
    district_id: pii.district_id
  });
}
```

#### Task 7.2: Update Template Personalization (2 hours)
**File:** `communique/src/routes/api/templates/personalize/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import { ciphervault } from '$lib/core/integrations/voter-protocol/ciphervault-wrapper';

export async function POST({ request, locals }) {
  const { template_id, personal_story } = await request.json();
  const userId = locals.user.id;
  const nearAccountId = locals.user.near_account_id;

  if (!nearAccountId) {
    return json({ error: 'NEAR account required' }, { status: 400 });
  }

  // Store personal story in CipherVault
  const envelopeId = await ciphervault.storePersonalization(
    userId,
    template_id,
    nearAccountId,
    personal_story
  );

  return json({
    success: true,
    envelope_id: envelopeId
  });
}
```

### Day 13: Testing & Verification

#### Task 8.1: End-to-End Tests (4 hours)
```typescript
// Test full flow: store PII → retrieve PII → verify PostgreSQL has no plaintext
```

#### Task 8.2: Database Audit (2 hours)
```sql
-- Verify NO PII in PostgreSQL
SELECT id, ciphervault_envelope_id
FROM "User"
WHERE ciphervault_envelope_id IS NOT NULL
LIMIT 10;

-- Should show envelope IDs, NOT plaintext PII
-- ✅ CORRECT: "alice.testnet-1"
-- ❌ WRONG: Actual names/addresses
```

---

## Phase 3: Production Deployment (2-3 days)

### Day 14-15: Deploy to Mainnet

1. Deploy CipherVault contract to `ciphervault.near`
2. Update communique environment variables
3. Run production tests
4. Launch

---

## Timeline Summary

| Phase | Days | Description |
|-------|------|-------------|
| Phase 1 | 6-9 | Build protocol stack (contracts + SDKs) |
| Phase 2 | 3-4 | Integrate into communique |
| Phase 3 | 2-3 | Production deployment |
| **Total** | **11-16 days** | **~2-3 weeks to production** |

---

## Success Criteria

- ✅ CipherVault contract deployed and tested
- ✅ Crypto SDK published to NPM
- ✅ Client SDK published to NPM
- ✅ Communique integration complete
- ✅ No PII in PostgreSQL (verified)
- ✅ All PII stored in CipherVault (verified)
- ✅ End-to-end encryption working
- ✅ Documentation complete

---

**Next Step:** Begin Phase 1, Day 1 - Set up monorepo structure and start CipherVault contract.
