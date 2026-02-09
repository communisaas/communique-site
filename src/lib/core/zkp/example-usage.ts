/**
 * Example Usage - ZK Proof Generation
 *
 * This file demonstrates the complete flow for generating ZK proofs
 * in the Communique frontend. Copy and adapt for your use case.
 */

import { buildWitness } from './witness-builder';
import { generateProof, initializeProver } from './prover-client';
import type { UserRegistration } from './witness-builder';

/**
 * Example 1: Basic proof generation
 *
 * Prerequisites:
 * - User has registered (registration data stored in backend)
 * - User has userSecret stored securely (localStorage, IndexedDB, etc.)
 * - Contract provides actionDomain and merkleRoot
 */
export async function exampleBasicProofGeneration() {
	// ───────────────────────────────────────────────────────────────────────
	// PHASE 1: Warm up prover (optional, but recommended for UX)
	// ───────────────────────────────────────────────────────────────────────

	console.log('Warming up prover...');
	await initializeProver(20, (progress) => {
		console.log(`[${progress.stage}] ${progress.percent}% - ${progress.message}`);
	});

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 2: Fetch registration data from backend
	// ───────────────────────────────────────────────────────────────────────

	// In production, fetch from your API:
	// const response = await fetch('/api/user/registration');
	// const registration = await response.json();

	const registration: UserRegistration = {
		identityCommitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
		merkleRoot: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
		merklePath: [
			// 20 siblings (depth-20 tree)
			'0x0000000000000000000000000000000000000000000000000000000000000001',
			'0x0000000000000000000000000000000000000000000000000000000000000002',
			'0x0000000000000000000000000000000000000000000000000000000000000003',
			'0x0000000000000000000000000000000000000000000000000000000000000004',
			'0x0000000000000000000000000000000000000000000000000000000000000005',
			'0x0000000000000000000000000000000000000000000000000000000000000006',
			'0x0000000000000000000000000000000000000000000000000000000000000007',
			'0x0000000000000000000000000000000000000000000000000000000000000008',
			'0x0000000000000000000000000000000000000000000000000000000000000009',
			'0x000000000000000000000000000000000000000000000000000000000000000a',
			'0x000000000000000000000000000000000000000000000000000000000000000b',
			'0x000000000000000000000000000000000000000000000000000000000000000c',
			'0x000000000000000000000000000000000000000000000000000000000000000d',
			'0x000000000000000000000000000000000000000000000000000000000000000e',
			'0x000000000000000000000000000000000000000000000000000000000000000f',
			'0x0000000000000000000000000000000000000000000000000000000000000010',
			'0x0000000000000000000000000000000000000000000000000000000000000011',
			'0x0000000000000000000000000000000000000000000000000000000000000012',
			'0x0000000000000000000000000000000000000000000000000000000000000013',
			'0x0000000000000000000000000000000000000000000000000000000000000014'
		],
		leafIndex: 42,
		districtId: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
		registrationSalt: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba'
	};

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 3: Get user secret (from secure storage)
	// ───────────────────────────────────────────────────────────────────────

	// In production, retrieve from secure storage:
	// const userSecret = await getFromSecureStorage('userSecret');

	const userSecret = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 4: Get action domain from contract
	// ───────────────────────────────────────────────────────────────────────

	// In production, fetch from contract:
	// const contract = await ethers.getContract('DistrictGate');
	// const actionDomain = await contract.getCurrentActionDomain();

	const actionDomain = '0x1111111111111111111111111111111111111111111111111111111111111111';

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 5: Build witness data
	// ───────────────────────────────────────────────────────────────────────

	const witness = await buildWitness(
		registration,
		userSecret,
		actionDomain,
		1 // authorityLevel: 1 = basic voter
	);

	console.log('Witness built:', witness);

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 6: Generate proof
	// ───────────────────────────────────────────────────────────────────────

	console.log('Generating proof...');
	const result = await generateProof(witness, (progress) => {
		console.log(`[${progress.stage}] ${progress.percent}% - ${progress.message}`);
	});

	console.log('Proof generated!');
	console.log('Proof (hex):', result.proof.slice(0, 40) + '...');
	console.log('Public inputs:', result.publicInputs);

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 7: Submit proof to contract
	// ───────────────────────────────────────────────────────────────────────

	// In production, submit to contract:
	// const tx = await contract.submitProof(
	//   result.proof,
	//   result.publicInputs.merkleRoot,
	//   result.publicInputs.nullifier,
	//   result.publicInputs.authorityLevel,
	//   result.publicInputs.actionDomain,
	//   result.publicInputs.districtId
	// );
	// await tx.wait();

	return result;
}

/**
 * Example 2: Proof generation with Svelte store
 *
 * This example shows how to use the reactive store for UI integration.
 */
export async function exampleWithStore() {
	// Import the store (in actual usage, import at top of file)
	const { getProofState, initProver, generate } = await import(
		'$lib/stores/proof-generation.svelte'
	);

	// Get reactive state
	const state = getProofState();

	// Warm up prover
	await initProver();

	// Build witness (same as Example 1)
	const witness = {
		merkleRoot: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
		actionDomain: '0x1111111111111111111111111111111111111111111111111111111111111111',
		userSecret: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
		districtId: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
		authorityLevel: 1,
		registrationSalt: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
		merklePath: new Array(20).fill('0x0000000000000000000000000000000000000000000000000000000000000000'),
		leafIndex: 42
	};

	// Generate proof (state updates automatically)
	await generate(witness);

	// Access result from state
	console.log('Proof result:', state.result);
	console.log('Is generating:', state.isGenerating);
	console.log('Error:', state.error);
	console.log('Progress:', state.progress);
}

/**
 * Example 3: Integration with Shadow Atlas lookup
 *
 * This example shows the full flow from geolocation to proof.
 */
export async function exampleFullFlow(lat: number, lng: number, userSecret: string) {
	// ───────────────────────────────────────────────────────────────────────
	// PHASE 1: Lookup district via Shadow Atlas
	// ───────────────────────────────────────────────────────────────────────

	const { lookupDistrict } = await import('$lib/core/shadow-atlas/client');

	console.log(`Looking up district for (${lat}, ${lng})...`);
	const lookupResult = await lookupDistrict(lat, lng);

	console.log('District found:', lookupResult.district.name);
	console.log('Merkle root:', lookupResult.merkleProof.root);

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 2: Build registration data from lookup result
	// ───────────────────────────────────────────────────────────────────────

	// Note: In production, you need to:
	// 1. Register the user (generate identityCommitment, store in tree)
	// 2. Get updated merkle proof with user's leaf included
	// For this example, we'll use the lookup result directly (won't verify)

	const registration: UserRegistration = {
		identityCommitment: lookupResult.merkleProof.leaf, // In production, this is user's commitment
		merkleRoot: lookupResult.merkleProof.root,
		merklePath: lookupResult.merkleProof.siblings,
		leafIndex: 0, // In production, this is user's actual position
		districtId: lookupResult.district.id,
		registrationSalt: '0x0000000000000000000000000000000000000000000000000000000000000000' // From registration
	};

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 3: Build witness and generate proof
	// ───────────────────────────────────────────────────────────────────────

	const actionDomain = '0x1111111111111111111111111111111111111111111111111111111111111111';

	const witness = await buildWitness(registration, userSecret, actionDomain, 1);

	const result = await generateProof(witness);

	return result;
}

/**
 * Example 4: Error handling
 *
 * This example shows how to handle common errors.
 */
export async function exampleErrorHandling() {
	try {
		// Invalid input (merkle path wrong length)
		const invalidWitness = {
			merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
			actionDomain: '0x1111111111111111111111111111111111111111111111111111111111111111',
			userSecret: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
			districtId: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
			authorityLevel: 1,
			registrationSalt: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
			merklePath: [], // ERROR: Should have 20 siblings
			leafIndex: 42
		};

		await generateProof(invalidWitness);
	} catch (error) {
		console.error('Validation error:', error);
		// Error: "Merkle path must have 20 siblings for depth-20 circuit, got 0"
	}

	try {
		// Invalid field element (exceeds BN254 modulus)
		const invalidWitness = {
			merkleRoot:
				'0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // ERROR: > BN254 modulus
			actionDomain: '0x1111111111111111111111111111111111111111111111111111111111111111',
			userSecret: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
			districtId: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
			authorityLevel: 1,
			registrationSalt: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
			merklePath: new Array(20).fill('0x0000000000000000000000000000000000000000000000000000000000000000'),
			leafIndex: 42
		};

		await generateProof(invalidWitness);
	} catch (error) {
		console.error('Field validation error:', error);
		// Error: "merkleRoot exceeds BN254 field modulus"
	}

	try {
		// Invalid authority level
		const invalidWitness = {
			merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
			actionDomain: '0x1111111111111111111111111111111111111111111111111111111111111111',
			userSecret: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
			districtId: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
			authorityLevel: 10, // ERROR: Must be 1-5
			registrationSalt: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
			merklePath: new Array(20).fill('0x0000000000000000000000000000000000000000000000000000000000000000'),
			leafIndex: 42
		};

		await generateProof(invalidWitness);
	} catch (error) {
		console.error('Authority level error:', error);
		// Error: "authorityLevel must be 1-5, got 10"
	}
}
