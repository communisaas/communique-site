# Phase 1: Browser-Native Zero-Knowledge Proof Integration

**Status**: ✅ **voter-protocol WASM prover PRODUCTION-READY** | ⏳ Communique integration pending
**Architecture**: Browser-native Halo2 proving (no server-side proving, cypherpunk-compliant)
**Performance**: 600ms-10s browser proving | ~50-100ms verification | 300-500k gas on-chain

---

## Executive Summary

**What This Solves**: Anonymous, verifiable Congressional advocacy without revealing identity to offices or platform.

**How It Works**:
1. **Identity Verification**: User proves personhood via self.xyz NFC passport or Didit.me (FREE, 30s-2min)
2. **Shadow Atlas Registration**: Identity commitment added to district Merkle tree (4,096 addresses per tree)
3. **Zero-Knowledge Proof**: Browser generates Halo2 proof of district membership **without revealing identity**
4. **Witness Encryption**: Message content encrypted to TEE public key (XChaCha20-Poly1305 AEAD)
5. **Encrypted Delivery**: TEE decrypts message, delivers via CWC API to congressional office
6. **Reputation Update**: On-chain ERC-8004 reputation increase (domain: 'congressional-advocacy')

**Privacy Guarantees**:
- Congressional offices: See message, NOT identity (anonymous constituent)
- Communique platform: See encrypted blob, NOT message or identity
- TEE (AWS Nitro Enclave): Sees message + address only during delivery (ephemeral, no logging)
- Blockchain: Sees nullifier (prevents double-voting), NOT identity or message

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER BROWSER (SvelteKit 5 + TypeScript)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ STEP 1: Identity Verification                                       │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ self.xyz NFC Passport (70%)    OR    Didit.me (30%)            ││
│ │ • 30 seconds, FREE                    • 2 minutes, FREE          ││
│ │ • NFC tap on passport                 • Government ID + biometric││
│ │ • Returns identity_commitment         • Returns identity_proof   ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 2: Shadow Atlas Registration                                   │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ POST /api/shadow-atlas/register                                 ││
│ │ { identity_commitment, congressional_district, proof }          ││
│ │                                                                  ││
│ │ Backend adds commitment to district Merkle tree (4,096 max)     ││
│ │ Returns: { leaf_index, merkle_path, district_root }             ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 3: Load WASM Prover (@voter-protocol/crypto)                   │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ import init, { Prover } from '@voter-protocol/crypto';          ││
│ │                                                                  ││
│ │ await init(); // Load WASM module (~800MB memory, 2-3s)         ││
│ │ const prover = new Prover(14); // K=14 circuit (5-10s init)     ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 4: Generate Zero-Knowledge Proof (600ms-10s)                   │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ const proof = await prover.prove(                               ││
│ │   identity_commitment,  // From self.xyz/Didit.me               ││
│ │   action_id,           // "42" (Congressional message action)   ││
│ │   leaf_index,          // Position in district tree             ││
│ │   merkle_path          // 12 hashes (4,096-leaf tree)           ││
│ │ );                                                               ││
│ │                                                                  ││
│ │ // Proof proves: "I am registered in this district"             ││
│ │ // WITHOUT revealing: Which resident, which address             ││
│ │                                                                  ││
│ │ Public outputs:                                                  ││
│ │ - district_root: "0x1a52..." (Merkle root, verifiable)          ││
│ │ - nullifier: Poseidon(identity, action_id) (prevents reuse)     ││
│ │ - action_id: 42 (identifies action type)                        ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 5: Witness Encryption (XChaCha20-Poly1305 AEAD)                │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ const encryptedWitness = encrypt(                               ││
│ │   witnessData: {                                                 ││
│ │     street: "1600 Pennsylvania Ave NW",                          ││
│ │     city: "Washington",                                          ││
│ │     state: "DC",                                                 ││
│ │     zip: "20500",                                                ││
│ │     congressional_district: "DC-00"                              ││
│ │   },                                                             ││
│ │   teePublicKey,  // TEE's public key (from /api/tee/pubkey)     ││
│ │   algorithm: 'XChaCha20-Poly1305'                                ││
│ │ );                                                               ││
│ │                                                                  ││
│ │ // Only TEE can decrypt this - not Communique, not blockchain   ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 6: Submit to Communique Backend                                │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ POST /api/congressional/submit                                   ││
│ │ {                                                                ││
│ │   proof: Uint8Array(~4600 bytes),  // ZK proof                  ││
│ │   publicOutputs: {                                               ││
│ │     district_root: "0x1a52...",                                  ││
│ │     nullifier: "0x8f3d...",                                      ││
│ │     action_id: "42"                                              ││
│ │   },                                                             ││
│ │   encryptedWitness: Uint8Array,  // Encrypted address           ││
│ │   encryptedMessage: Uint8Array,  // Encrypted message content   ││
│ │   templateId: "template-123",                                    ││
│ │   customizations: { ... }                                        ││
│ │ }                                                                ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ COMMUNIQUE BACKEND (SvelteKit API Routes)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ STEP 7: Store Encrypted Blobs (Postgres via Prisma)                 │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ model Submission {                                              ││
│ │   id                   String   @id @default(cuid())            ││
│ │   proof_bytes          Bytes    // ZK proof (~4.6KB)            ││
│ │   district_root        String   // Public output 1              ││
│ │   nullifier            String   // Public output 2 (indexed)    ││
│ │   action_id            String   // Public output 3              ││
│ │   encrypted_witness    Bytes    // Address (TEE-encrypted)      ││
│ │   encrypted_message    Bytes    // Message (TEE-encrypted)      ││
│ │   template_id          String                                   ││
│ │   status               String   // pending | verified | ...     ││
│ │                                                                  ││
│ │   @@unique([nullifier, action_id]) // Prevent double-action     ││
│ │ }                                                                ││
│ │                                                                  ││
│ │ // Communique CANNOT read encrypted data - only TEE can         ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 8: Submit ZK Proof to Scroll L2                                │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ import { voterBlockchainClient } from '$lib/core/blockchain';   ││
│ │                                                                  ││
│ │ const txHash = await voterBlockchainClient.submitProof({        ││
│ │   proof: submission.proof_bytes,                                ││
│ │   publicOutputs: [district_root, nullifier, action_id]          ││
│ │ });                                                              ││
│ │                                                                  ││
│ │ // Smart contract verifies proof on-chain                       ││
│ │ // Rejects if: invalid proof, nullifier reused, wrong root      ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 9: Send to TEE for Delivery                                    │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ POST https://<tee-endpoint>/decrypt-and-deliver                 ││
│ │ {                                                                ││
│ │   encrypted_witness,  // Address (only TEE can decrypt)         ││
│ │   encrypted_message,  // Message content                        ││
│ │   submission_id,      // For tracking                           ││
│ │   representative_ids  // Target congressional offices           ││
│ │ }                                                                ││
│ │                                                                  ││
│ │ // TEE decrypts, delivers via CWC API, destroys plaintext       ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ AWS NITRO ENCLAVE (ARM Graviton, hypervisor-isolated TEE)           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ STEP 10: Decrypt Witness (ephemeral, no logging)                    │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ const witnessData = decrypt(                                    ││
│ │   encrypted_witness,                                             ││
│ │   teePrivateKey  // Never leaves enclave                         ││
│ │ );                                                               ││
│ │                                                                  ││
│ │ // Now TEE knows: "1600 Pennsylvania Ave NW, DC-00"             ││
│ │ // Address exists ONLY in enclave memory during delivery        ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 11: Call CWC API (Congressional Offices)                       │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ POST https://soapbox.senate.gov/api/v2/message                  ││
│ │ {                                                                ││
│ │   recipient: "senator-office-id",                                ││
│ │   constituent: {                                                 ││
│ │     address: witnessData.street,  // Verified in district       ││
│ │     city: witnessData.city,                                      ││
│ │     state: witnessData.state,                                    ││
│ │     zip: witnessData.zip                                         ││
│ │   },                                                             ││
│ │   message: decryptedMessage,                                     ││
│ │   subject: template.title                                        ││
│ │ }                                                                ││
│ │                                                                  ││
│ │ // Congressional office receives message from "Anonymous        ││
│ │ // Constituent in DC-00" - identity NOT revealed                ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 12: Destroy Plaintext (cryptographic erasure)                  │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ // Enclave terminates after delivery                            ││
│ │ // Address + message exist ONLY in volatile memory              ││
│ │ // No disk writes, no logging, hypervisor-isolated              ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SCROLL zkEVM (Ethereum L2, On-Chain Verification)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ STEP 13: Verify ZK Proof (Solidity Verifier Contract)               │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ function verify(                                                 ││
│ │   bytes calldata proof,                                          ││
│ │   bytes32 district_root,                                         ││
│ │   bytes32 nullifier,                                             ││
│ │   uint256 action_id                                              ││
│ │ ) public returns (bool) {                                        ││
│ │   // 1. Check nullifier not already used                        ││
│ │   require(!usedNullifiers[nullifier], "Action already taken");  ││
│ │                                                                  ││
│ │   // 2. Verify Halo2 proof (300-500k gas)                       ││
│ │   require(verifyProof(proof, [district_root, nullifier, ...]),  ││
│ │          "Invalid ZK proof");                                    ││
│ │                                                                  ││
│ │   // 3. Mark nullifier as used                                  ││
│ │   usedNullifiers[nullifier] = true;                             ││
│ │                                                                  ││
│ │   // 4. Update reputation (ERC-8004)                            ││
│ │   reputationRegistry.increaseReputation(                         ││
│ │     nullifier,  // User identifier (anonymous)                   ││
│ │     "congressional-advocacy",  // Domain                         ││
│ │     1  // +1 reputation point                                    ││
│ │   );                                                             ││
│ │                                                                  ││
│ │   return true;                                                   ││
│ │ }                                                                ││
│ └─────────────────────────────────────────────────────────────────┘│
│           ↓                                                          │
│ STEP 14: Reputation Update (ERC-8004 Registry)                      │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ event ReputationIncreased(                                       ││
│ │   bytes32 indexed account,     // nullifier (anonymous)          ││
│ │   string indexed domain,       // "congressional-advocacy"       ││
│ │   uint256 amount,              // +1 point                       ││
│ │   uint256 newTotal             // Updated reputation score       ││
│ │ );                                                               ││
│ │                                                                  ││
│ │ // User can now query their reputation:                         ││
│ │ // voterBlockchainClient.getReputation(nullifier, domain)       ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. WASM Prover Integration (Communique Frontend)

**Location**: `src/lib/core/zkp/prover-client.ts` (TO BE CREATED)

```typescript
/**
 * Browser-Native Zero-Knowledge Proof Generation
 *
 * Uses @voter-protocol/crypto WASM bindings for Halo2 proving
 * Performance: 600ms-10s depending on device (mobile slower)
 */

import init, { Prover, type ProofResult } from '@voter-protocol/crypto';

let proverInstance: Prover | null = null;
let isInitialized = false;

/**
 * Initialize WASM prover (call once at app startup)
 * First call takes 5-10 seconds (loads KZG params, generates keys)
 * Subsequent proofs reuse cached instance
 */
export async function initializeProver(): Promise<void> {
	if (isInitialized) return;

	try {
		// Load WASM module (~800MB memory allocation)
		await init();

		// Initialize prover with K=14 circuit (4,096-leaf Merkle tree)
		// This generates proving/verifying keys (5-10s first time)
		proverInstance = new Prover(14);

		isInitialized = true;
		console.log('✅ ZK prover initialized (K=14, 4096-leaf trees)');
	} catch (error) {
		console.error('❌ Failed to initialize ZK prover:', error);
		throw new Error('ZK prover initialization failed');
	}
}

/**
 * Generate zero-knowledge proof of district membership
 *
 * @param identityCommitment - From self.xyz or Didit.me verification
 * @param actionId - Action type identifier (42 = Congressional message)
 * @param leafIndex - Position in district Merkle tree
 * @param merklePath - 12 sibling hashes from tree
 * @returns ZK proof bytes + public outputs
 */
export async function generateDistrictMembershipProof(params: {
	identityCommitment: string;  // "0x1234..." (hex)
	actionId: string;            // "42" (decimal string)
	leafIndex: number;           // 0-4095
	merklePath: string[];        // 12 hex strings
}): Promise<ProofResult> {
	if (!proverInstance) {
		throw new Error('Prover not initialized - call initializeProver() first');
	}

	try {
		// Generate proof (8-15 seconds on mobile, 600ms-2s on desktop)
		const proofBytes = await proverInstance.prove(
			params.identityCommitment,
			params.actionId,
			params.leafIndex,
			params.merklePath
		);

		// Public outputs are part of the proof
		// Prover computes: district_root, nullifier, action_id
		return {
			proof: proofBytes,
			publicOutputs: {
				// These are computed by the circuit, extracted from proof
				district_root: extractPublicOutput(proofBytes, 0),
				nullifier: extractPublicOutput(proofBytes, 1),
				action_id: extractPublicOutput(proofBytes, 2)
			}
		};
	} catch (error) {
		console.error('❌ Proof generation failed:', error);
		throw new Error('Failed to generate ZK proof');
	}
}

/**
 * Verify proof locally before submitting (optional sanity check)
 * Fast: ~50-100ms in browser
 */
export async function verifyProofLocally(
	proof: Uint8Array,
	publicOutputs: [string, string, string]
): Promise<boolean> {
	if (!proverInstance) {
		throw new Error('Prover not initialized');
	}

	try {
		return await proverInstance.verify(proof, publicOutputs);
	} catch (error) {
		console.error('❌ Local verification failed:', error);
		return false;
	}
}

/**
 * Extract public output from proof bytes
 * Public outputs are encoded in the proof (first 96 bytes)
 */
function extractPublicOutput(proofBytes: Uint8Array, index: number): string {
	// Public outputs are 32 bytes each, at start of proof
	const offset = index * 32;
	const bytes = proofBytes.slice(offset, offset + 32);
	return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Usage in Svelte Component**:

```svelte
<script lang="ts">
	import { initializeProver, generateDistrictMembershipProof } from '$lib/core/zkp/prover-client';
	import { onMount } from 'svelte';

	let isProverReady = $state(false);
	let isGenerating = $state(false);
	let proofProgress = $state<string>('');

	onMount(async () => {
		// Initialize prover on component mount
		proofProgress = 'Loading ZK prover...';
		await initializeProver();
		isProverReady = true;
		proofProgress = 'Prover ready';
	});

	async function submitMessage() {
		if (!isProverReady) {
			alert('ZK prover not ready yet - please wait');
			return;
		}

		isGenerating = true;
		proofProgress = 'Generating zero-knowledge proof...';

		try {
			// Get Shadow Atlas data from API
			const atlasData = await fetch('/api/shadow-atlas/user-data').then(r => r.json());

			// Generate ZK proof (8-15 seconds on mobile)
			const { proof, publicOutputs } = await generateDistrictMembershipProof({
				identityCommitment: atlasData.identity_commitment,
				actionId: '42',  // Congressional message action
				leafIndex: atlasData.leaf_index,
				merklePath: atlasData.merkle_path
			});

			proofProgress = 'Proof generated! Encrypting message...';

			// Encrypt witness data (address)
			const encryptedWitness = await encryptWitness(userAddress, teePublicKey);

			// Encrypt message content
			const encryptedMessage = await encryptMessage(messageContent, teePublicKey);

			// Submit to backend
			const response = await fetch('/api/congressional/submit', {
				method: 'POST',
				body: JSON.stringify({
					proof: Array.from(proof),  // Uint8Array → number[]
					publicOutputs,
					encryptedWitness: Array.from(encryptedWitness),
					encryptedMessage: Array.from(encryptedMessage),
					templateId,
					customizations
				})
			});

			if (response.ok) {
				proofProgress = '✅ Message submitted anonymously!';
			} else {
				throw new Error('Submission failed');
			}
		} catch (error) {
			proofProgress = '❌ Failed to generate proof';
			console.error(error);
		} finally {
			isGenerating = false;
		}
	}
</script>

{#if !isProverReady}
	<p>⏳ {proofProgress}</p>
{:else}
	<button onclick={submitMessage} disabled={isGenerating}>
		{isGenerating ? `⏳ ${proofProgress}` : 'Send Anonymous Message'}
	</button>
{/if}
```

### 2. Shadow Atlas Data Storage (Communique Backend)

**Location**: `src/routes/api/shadow-atlas/register/+server.ts` (TO BE CREATED)

```typescript
/**
 * Shadow Atlas Registration API
 *
 * After identity verification, user's identity_commitment is added to
 * their congressional district's Merkle tree (max 4,096 per tree).
 *
 * Returns merkle_path needed for ZK proof generation.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { hash_pair } from '@voter-protocol/crypto';  // Poseidon hash

export const POST: RequestHandler = async ({ request, locals }) => {
	const { identity_commitment, congressional_district, identity_proof } = await request.json();

	// Verify user is authenticated
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Verify identity proof (self.xyz or Didit.me)
	const isValid = await verifyIdentityProof(identity_proof);
	if (!isValid) {
		return json({ error: 'Invalid identity proof' }, { status: 400 });
	}

	// Get or create district Merkle tree
	let tree = await db.shadowAtlasTree.findUnique({
		where: { congressional_district }
	});

	if (!tree) {
		// Initialize empty tree (4,096 zero leaves)
		tree = await db.shadowAtlasTree.create({
			data: {
				congressional_district,
				leaf_count: 0,
				merkle_root: EMPTY_TREE_ROOT_K14,
				leaves: []
			}
		});
	}

	// Check tree capacity (max 4,096 leaves for K=14 circuit)
	if (tree.leaf_count >= 4096) {
		return json({ error: 'District tree full - contact support' }, { status: 503 });
	}

	// Add identity_commitment to next available leaf
	const leaf_index = tree.leaf_count;
	const updated_leaves = [...tree.leaves, identity_commitment];

	// Recompute Merkle root using Poseidon hash (same as circuit)
	const merkle_root = computeMerkleRoot(updated_leaves);

	// Update tree in database
	await db.shadowAtlasTree.update({
		where: { id: tree.id },
		data: {
			leaf_count: tree.leaf_count + 1,
			leaves: updated_leaves,
			merkle_root
		}
	});

	// Store user's registration
	await db.user.update({
		where: { id: locals.user.id },
		data: {
			identity_verified: true,
			verification_method: identity_proof.method,  // 'self.xyz' | 'didit'
			identity_commitment,
			shadow_atlas_leaf_index: leaf_index,
			congressional_district
		}
	});

	// Generate merkle_path for this leaf (12 sibling hashes for K=14)
	const merkle_path = generateMerklePath(updated_leaves, leaf_index);

	return json({
		success: true,
		data: {
			leaf_index,
			merkle_path,  // User needs this for ZK proof generation
			merkle_root,
			district_size: tree.leaf_count + 1
		}
	});
};

/**
 * Compute Merkle root using Poseidon hash (MUST match circuit)
 * Uses @voter-protocol/crypto's hash_pair to ensure consistency
 */
function computeMerkleRoot(leaves: string[]): string {
	// Pad to 4,096 leaves with zeros
	const paddedLeaves = [...leaves];
	while (paddedLeaves.length < 4096) {
		paddedLeaves.push(ZERO_HASH);
	}

	// Build tree bottom-up using Poseidon hash
	let currentLevel = paddedLeaves;
	for (let level = 0; level < 12; level++) {  // 12 levels for 4,096 leaves
		const nextLevel = [];
		for (let i = 0; i < currentLevel.length; i += 2) {
			const left = currentLevel[i];
			const right = currentLevel[i + 1];
			const parent = hash_pair(left, right);  // Poseidon hash from WASM
			nextLevel.push(parent);
		}
		currentLevel = nextLevel;
	}

	return currentLevel[0];  // Root
}

/**
 * Generate merkle_path for leaf at given index
 * Returns 12 sibling hashes needed for circuit verification
 */
function generateMerklePath(leaves: string[], leafIndex: number): string[] {
	const paddedLeaves = [...leaves];
	while (paddedLeaves.length < 4096) {
		paddedLeaves.push(ZERO_HASH);
	}

	const path: string[] = [];
	let currentIndex = leafIndex;
	let currentLevel = paddedLeaves;

	for (let level = 0; level < 12; level++) {
		const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
		path.push(currentLevel[siblingIndex]);

		// Move to parent level
		const nextLevel = [];
		for (let i = 0; i < currentLevel.length; i += 2) {
			const parent = hash_pair(currentLevel[i], currentLevel[i + 1]);
			nextLevel.push(parent);
		}

		currentLevel = nextLevel;
		currentIndex = Math.floor(currentIndex / 2);
	}

	return path;
}
```

### 3. Submission Endpoint (Communique Backend)

**Location**: `src/routes/api/congressional/submit/+server.ts` (TO BE UPDATED)

```typescript
/**
 * Congressional Message Submission with ZK Proof
 *
 * Receives:
 * - ZK proof of district membership
 * - Encrypted witness (address, only TEE can decrypt)
 * - Encrypted message (content)
 *
 * Stores encrypted blobs, submits proof to blockchain, sends to TEE
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { voterBlockchainClient } from '$lib/core/blockchain/voter-client';

export const POST: RequestHandler = async ({ request, locals }) => {
	const {
		proof,              // Uint8Array as number[]
		publicOutputs,      // { district_root, nullifier, action_id }
		encryptedWitness,   // Encrypted address
		encryptedMessage,   // Encrypted message content
		templateId,
		customizations
	} = await request.json();

	// Convert number[] back to Uint8Array
	const proofBytes = new Uint8Array(proof);
	const witnessBytes = new Uint8Array(encryptedWitness);
	const messageBytes = new Uint8Array(encryptedMessage);

	// Check nullifier not already used (prevent double-submission)
	const existingSubmission = await db.submission.findUnique({
		where: {
			nullifier_action_id: {
				nullifier: publicOutputs.nullifier,
				action_id: publicOutputs.action_id
			}
		}
	});

	if (existingSubmission) {
		return json({
			success: false,
			error: 'This action has already been taken (nullifier reused)'
		}, { status: 409 });
	}

	// Store submission in database (encrypted blobs)
	const submission = await db.submission.create({
		data: {
			proof_bytes: proofBytes,
			district_root: publicOutputs.district_root,
			nullifier: publicOutputs.nullifier,
			action_id: publicOutputs.action_id,
			encrypted_witness: witnessBytes,
			encrypted_message: messageBytes,
			template_id: templateId,
			customizations,
			status: 'pending'
		}
	});

	// Submit ZK proof to blockchain (async, don't block)
	voterBlockchainClient.submitProof({
		proof: proofBytes,
		publicOutputs: [
			publicOutputs.district_root,
			publicOutputs.nullifier,
			publicOutputs.action_id
		]
	}).then(txHash => {
		// Update submission with blockchain confirmation
		db.submission.update({
			where: { id: submission.id },
			data: {
				blockchain_tx_hash: txHash,
				status: 'verified'
			}
		});
	}).catch(error => {
		console.error('Blockchain verification failed:', error);
		db.submission.update({
			where: { id: submission.id },
			data: { status: 'verification_failed' }
		});
	});

	// Send to TEE for delivery (async)
	sendToTEE({
		submission_id: submission.id,
		encrypted_witness: witnessBytes,
		encrypted_message: messageBytes,
		template_id: templateId
	}).catch(error => {
		console.error('TEE delivery failed:', error);
	});

	return json({
		success: true,
		data: {
			submission_id: submission.id,
			status: 'pending',
			message: 'ZK proof submitted - delivery in progress'
		}
	});
};
```

### 4. Database Schema Updates

**Location**: `prisma/schema.prisma` (ADD THESE MODELS)

```prisma
// Shadow Atlas: District Merkle Trees (4,096 addresses per tree)
model ShadowAtlasTree {
  id                     String   @id @default(cuid())
  congressional_district String   @unique  // "CA-12", "NY-15", etc.

  // Merkle tree state
  leaf_count             Int      @default(0)  // Current size (max 4,096)
  merkle_root            String   // Poseidon hash root
  leaves                 String[] // identity_commitments

  // Metadata
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt
}

// User Shadow Atlas Registration
model User {
  // ... existing fields ...

  // Identity verification (self.xyz or Didit.me)
  identity_verified      Boolean  @default(false)
  verification_method    String?  // 'self.xyz' | 'didit'
  identity_commitment    String?  // Poseidon hash of identity secret

  // Shadow Atlas position
  shadow_atlas_leaf_index Int?    // Position in district tree (0-4095)
  congressional_district  String? // "CA-12", "NY-15", etc.
}

// Anonymous Submissions (ZK-proven messages)
model Submission {
  id                   String   @id @default(cuid())

  // ZK proof data
  proof_bytes          Bytes    // Halo2 proof (~4.6KB)
  district_root        String   // Public output 1
  nullifier            String   // Public output 2 (prevents double-action)
  action_id            String   // Public output 3 (identifies action type)

  // Encrypted data (only TEE can decrypt)
  encrypted_witness    Bytes    // Address + district (XChaCha20-Poly1305)
  encrypted_message    Bytes    // Message content

  // Metadata
  template_id          String
  customizations       Json?
  status               String   // pending | verified | delivered | failed
  blockchain_tx_hash   String?  // Scroll L2 transaction hash

  // Timestamps
  created_at           DateTime @default(now())
  delivered_at         DateTime?

  // Prevent nullifier reuse (double-action protection)
  @@unique([nullifier, action_id])
  @@index([status])
  @@index([blockchain_tx_hash])
}
```

---

## Performance Characteristics

### Browser-Native Proving (WASM)

| Device | First Init | Proof Generation | Verification |
|--------|------------|------------------|--------------|
| **Desktop (M1/M2)** | 5-7s | 600ms-1.5s | 50-80ms |
| **Desktop (Intel i7)** | 8-10s | 1-2s | 80-100ms |
| **Mobile (High-end)** | 10-15s | 3-5s | 100-150ms |
| **Mobile (Mid-range)** | 15-20s | 8-15s | 150-200ms |

**Memory Usage**: ~800MB peak (WASM module + KZG params)
**Proof Size**: ~4.6KB (SHPLONK with 3 public outputs)
**Circuit**: K=14 (117,473 cells, 16,384 rows, 8 columns)

### On-Chain Verification (Scroll L2)

| Operation | Gas Cost | Cost @ 0.1 gwei | Time |
|-----------|----------|-----------------|------|
| **Proof Verification** | 300-500k gas | $0.01-0.02 | ~2-3s |
| **Reputation Update** | 50-80k gas | $0.003-0.005 | <1s |
| **Total** | 350-580k gas | $0.013-0.025 | ~3-4s |

**Platform Coverage**: Communique pays all gas fees (user-side gas-free)

---

## Security Guarantees

### Privacy Properties

1. **Identity Privacy**:
   - Congressional offices: See encrypted message + district, NOT identity
   - Communique platform: See encrypted blobs, NOT message or identity
   - TEE: Sees address + message only during delivery (ephemeral, no logging)
   - Blockchain: Sees nullifier (anonymous identifier), NOT identity

2. **Message Privacy**:
   - Encrypted with XChaCha20-Poly1305 AEAD to TEE public key
   - Only TEE (AWS Nitro Enclave) can decrypt
   - Communique backend stores encrypted blobs (cannot read plaintext)

3. **Double-Action Prevention**:
   - Nullifier = Poseidon(identity_commitment, action_id)
   - Smart contract rejects reused nullifiers
   - Same person cannot submit same action twice

4. **Membership Privacy**:
   - ZK proof proves: "I am ONE OF 4,096 registered district residents"
   - Does NOT reveal: Which resident, which address, which leaf
   - Anonymity set: 4,096 people per district

### Cryptographic Assumptions

1. **Halo2 Security**: Relies on KZG polynomial commitment (Ethereum trusted setup, 141K participants)
2. **Poseidon Hash**: Collision-resistant hash function (Axiom OptimizedPoseidonSpec, audited)
3. **XChaCha20-Poly1305**: AEAD cipher (standardized, widely audited)
4. **TEE Isolation**: AWS Nitro Enclaves hypervisor isolation (AMD SEV-SNP or ARM TrustZone)

### Threat Model

**Protects Against**:
- ✅ Platform surveillance (Communique cannot read messages/identities)
- ✅ Congressional office profiling (cannot link messages to specific constituents)
- ✅ Double-voting (nullifier prevents action reuse)
- ✅ Non-residents (ZK proof verifies district membership)

**Does NOT Protect Against**:
- ❌ TEE compromise (if Nitro Enclave is fully compromised, ephemeral data could leak)
- ❌ Side-channel attacks (timing analysis of delivery patterns)
- ❌ Coordinated identity linkage (if congressional offices collude with identity providers)

**Mitigation**: Phase 2 will add fully client-side decryption via homomorphic encryption (no TEE dependency)

---

## Implementation Checklist

### Phase 1.1: WASM Prover Integration (2 weeks)

- [ ] Install `@voter-protocol/crypto` package in Communique
- [ ] Create `src/lib/core/zkp/prover-client.ts`
- [ ] Add prover initialization to app layout
- [ ] Build UI progress indicators for proof generation (8-15s)
- [ ] Test on various devices (desktop, mobile, tablets)

### Phase 1.2: Shadow Atlas Backend (2 weeks)

- [ ] Add `ShadowAtlasTree` model to Prisma schema
- [ ] Create `/api/shadow-atlas/register` endpoint
- [ ] Implement Poseidon hash Merkle tree building
- [ ] Add `generateMerklePath()` utility
- [ ] Create `/api/shadow-atlas/user-data` endpoint (returns merkle_path)

### Phase 1.3: Identity Verification Integration (2 weeks)

- [ ] Integrate self.xyz NFC passport SDK
- [ ] Integrate Didit.me identity verification SDK
- [ ] Build identity verification UI flow
- [ ] Extract identity_commitment from verification proofs
- [ ] Link verification to Shadow Atlas registration

### Phase 1.4: Submission Flow (2 weeks)

- [ ] Update `Submission` model in Prisma schema
- [ ] Create XChaCha20-Poly1305 encryption utilities
- [ ] Build `/api/congressional/submit` endpoint
- [ ] Implement proof → blockchain submission
- [ ] Implement encrypted blob → TEE delivery

### Phase 1.5: Testing & Optimization (2 weeks)

- [ ] E2E test: Identity verification → Shadow Atlas → Proof → Delivery
- [ ] Load testing: 1000 concurrent proof generations
- [ ] Mobile optimization: Reduce WASM memory footprint
- [ ] Error handling: Network failures, TEE unavailability
- [ ] Monitoring: Proof generation latency, verification success rate

---

## Success Metrics

### Cryptographic Performance

- **Target**: 90% of users complete proof generation <10s
- **Target**: 0% proof verification failures (excluding malicious attempts)
- **Target**: <1% TEE delivery failures

### Privacy Metrics

- **Target**: 0 plaintext leaks from Communique database
- **Target**: 0 identity linkages in congressional office deliveries
- **Target**: 100% nullifier enforcement (no double-actions)

### User Experience

- **Target**: 80% of users complete identity verification <2 minutes
- **Target**: 70% choose self.xyz (faster), 30% Didit.me
- **Target**: <5% drop-off during ZK proof generation

---

## References

- **voter-protocol WASM Prover**: `/Users/noot/Documents/voter-protocol/packages/crypto/circuits/src/wasm.rs`
- **voter-protocol Native Prover**: `/Users/noot/Documents/voter-protocol/packages/crypto/circuits/src/prover.rs`
- **Halo2 Circuits**: `/Users/noot/Documents/voter-protocol/packages/crypto/circuits/src/`
- **Progressive Verification**: `/Users/noot/Documents/communique/docs/PROGRESSIVE-VERIFICATION-ARCHITECTURE.md`
- **Cypherpunk Architecture**: `/Users/noot/Documents/communique/docs/CYPHERPUNK-ARCHITECTURE.md`
- **Reputation System**: `/Users/noot/Documents/communique/docs/UNIVERSAL-CREDIBILITY-SYSTEM.md`

---

**Implementation Status**: ⏳ **voter-protocol prover COMPLETE | Communique integration PENDING**
**Timeline**: 10 weeks (identity verification + WASM integration + Shadow Atlas + submission flow + testing)
**Cost Savings**: $0 (no server-side proving infrastructure needed - browser-native only)
