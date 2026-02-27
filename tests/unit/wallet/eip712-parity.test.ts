/**
 * EIP-712 Parity Tests
 *
 * Proves that the NEW `buildProofAuthorizationData` (wallet/eip712.ts) produces
 * byte-identical EIP-712 struct hashes to the LEGACY `buildEIP712Signature` path
 * in debate-market-client.ts.
 *
 * The legacy function is server-only (imports $env), so we reconstruct its logic
 * inline using the same keccak256 + solidityPacked primitives.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { TypedDataEncoder, keccak256, solidityPacked, randomBytes, hexlify } from 'ethers';

import { buildProofAuthorizationData, THREE_TREE_PUBLIC_INPUT_COUNT } from '$lib/core/wallet/eip712';
import { DISTRICT_GATE_EIP712_TYPES } from '$lib/core/wallet/types';

// ═══════════════════════════════════════════════════════════════════════════
// Legacy EIP-712 types — copied verbatim from debate-market-client.ts L90-98
// ═══════════════════════════════════════════════════════════════════════════

const LEGACY_EIP712_TYPES = {
	SubmitThreeTreeProof: [
		{ name: 'proofHash', type: 'bytes32' },
		{ name: 'publicInputsHash', type: 'bytes32' },
		{ name: 'verifierDepth', type: 'uint8' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' }
	]
};

// ═══════════════════════════════════════════════════════════════════════════
// Helper: reconstruct the legacy buildEIP712Signature path inline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rebuilds the domain, types, and value exactly as buildEIP712Signature does
 * (debate-market-client.ts L314-349), minus the actual signing.
 */
function buildLegacyTypedData(params: {
	proofBytes: string;
	publicInputsAsBigInt: bigint[];
	verifierDepth: number;
	nonce: bigint;
	deadline: number;
	chainId: bigint;
	districtGateAddress: string;
}) {
	const proofHash = keccak256(params.proofBytes);

	const publicInputsPacked = solidityPacked(
		Array(31).fill('uint256'),
		params.publicInputsAsBigInt
	);
	const publicInputsHash = keccak256(publicInputsPacked);

	const domain = {
		name: 'DistrictGate',
		version: '1',
		chainId: params.chainId,
		verifyingContract: params.districtGateAddress
	};

	const value = {
		proofHash,
		publicInputsHash,
		verifierDepth: params.verifierDepth,
		nonce: params.nonce,
		deadline: params.deadline
	};

	return { domain, types: LEGACY_EIP712_TYPES, value };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════════════

const SCROLL_SEPOLIA_CHAIN_ID = 534351n;
const DISTRICT_GATE_ADDRESS = '0x95F878b0c0AF38C445d0F776DF4f37d2660DaFF4';

/** Generate 31 random public inputs as hex strings */
function randomPublicInputs(): string[] {
	return Array.from({ length: 31 }, () => {
		// Random 32-byte value, reduced mod BN254 to stay in-field
		const raw = BigInt(hexlify(randomBytes(32)));
		const BN254_MODULUS = BigInt(
			'21888242871839275222246405745257275088548364400416034343698204186575808495617'
		);
		return (raw % BN254_MODULUS).toString();
	});
}

/** Generate a random proof hex string of given byte length (0x-prefixed) */
function randomProof(byteLength: number = 256): string {
	return hexlify(randomBytes(byteLength));
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE STRUCTURAL PARITY
// ═══════════════════════════════════════════════════════════════════════════

describe('EIP-712 type structural parity', () => {
	it('DISTRICT_GATE_EIP712_TYPES has identical structure to legacy EIP712_TYPES', () => {
		// Same top-level key
		expect(Object.keys(DISTRICT_GATE_EIP712_TYPES)).toEqual(
			Object.keys(LEGACY_EIP712_TYPES)
		);

		// Same fields in SubmitThreeTreeProof
		const newFields = DISTRICT_GATE_EIP712_TYPES.SubmitThreeTreeProof;
		const legacyFields = LEGACY_EIP712_TYPES.SubmitThreeTreeProof;

		expect(newFields.length).toBe(legacyFields.length);

		for (let i = 0; i < legacyFields.length; i++) {
			expect(newFields[i].name).toBe(legacyFields[i].name);
			expect(newFields[i].type).toBe(legacyFields[i].type);
		}
	});

	it('field names match exactly: proofHash, publicInputsHash, verifierDepth, nonce, deadline', () => {
		const expectedNames = ['proofHash', 'publicInputsHash', 'verifierDepth', 'nonce', 'deadline'];
		const actualNames = DISTRICT_GATE_EIP712_TYPES.SubmitThreeTreeProof.map((f) => f.name);
		expect(actualNames).toEqual(expectedNames);
	});

	it('Solidity types match exactly: bytes32, bytes32, uint8, uint256, uint256', () => {
		const expectedTypes = ['bytes32', 'bytes32', 'uint8', 'uint256', 'uint256'];
		const actualTypes = DISTRICT_GATE_EIP712_TYPES.SubmitThreeTreeProof.map((f) => f.type);
		expect(actualTypes).toEqual(expectedTypes);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// STRUCT HASH PARITY
// ═══════════════════════════════════════════════════════════════════════════

describe('EIP-712 struct hash parity — new vs legacy', () => {
	it('basic case: random 256-byte proof, 31 random public inputs', () => {
		const proof = randomProof(256);
		const publicInputs = randomPublicInputs();
		const verifierDepth = 20;
		const nonce = 42n;
		const deadline = 1700000000;

		// NEW path
		const newResult = buildProofAuthorizationData({
			proof,
			publicInputs,
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		// LEGACY path (reconstructed inline)
		const legacyResult = buildLegacyTypedData({
			proofBytes: proof,
			publicInputsAsBigInt: publicInputs.map((v) => BigInt(v)),
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		// Compute EIP-712 struct hashes
		const newHash = TypedDataEncoder.hash(
			newResult.domain,
			newResult.types,
			newResult.value
		);
		const legacyHash = TypedDataEncoder.hash(
			legacyResult.domain,
			legacyResult.types,
			legacyResult.value
		);

		expect(newHash).toBe(legacyHash);
	});

	it('zero public inputs: all 31 elements are "0"', () => {
		const proof = randomProof(256);
		const publicInputs = Array(31).fill('0');
		const verifierDepth = 20;
		const nonce = 0n;
		const deadline = 1700000000;

		const newResult = buildProofAuthorizationData({
			proof,
			publicInputs,
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		const legacyResult = buildLegacyTypedData({
			proofBytes: proof,
			publicInputsAsBigInt: publicInputs.map((v) => BigInt(v)),
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		const newHash = TypedDataEncoder.hash(
			newResult.domain,
			newResult.types,
			newResult.value
		);
		const legacyHash = TypedDataEncoder.hash(
			legacyResult.domain,
			legacyResult.types,
			legacyResult.value
		);

		expect(newHash).toBe(legacyHash);
	});

	it('max BN254 values: public inputs near the field modulus', () => {
		const proof = randomProof(128);
		const BN254_MODULUS = BigInt(
			'21888242871839275222246405745257275088548364400416034343698204186575808495617'
		);
		// Use modulus - 1 (max valid field element) for all inputs
		const maxFieldElement = (BN254_MODULUS - 1n).toString();
		const publicInputs = Array(31).fill(maxFieldElement);
		const verifierDepth = 20;
		const nonce = 999999n;
		const deadline = 2000000000;

		const newResult = buildProofAuthorizationData({
			proof,
			publicInputs,
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		const legacyResult = buildLegacyTypedData({
			proofBytes: proof,
			publicInputsAsBigInt: publicInputs.map((v) => BigInt(v)),
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		const newHash = TypedDataEncoder.hash(
			newResult.domain,
			newResult.types,
			newResult.value
		);
		const legacyHash = TypedDataEncoder.hash(
			legacyResult.domain,
			legacyResult.types,
			legacyResult.value
		);

		expect(newHash).toBe(legacyHash);
	});

	it.each([18, 20, 22, 24] as const)(
		'different verifier depth: %d',
		(depth) => {
			const proof = randomProof(256);
			const publicInputs = randomPublicInputs();
			const nonce = 7n;
			const deadline = 1700000000;

			const newResult = buildProofAuthorizationData({
				proof,
				publicInputs,
				verifierDepth: depth,
				nonce,
				deadline,
				chainId: SCROLL_SEPOLIA_CHAIN_ID,
				districtGateAddress: DISTRICT_GATE_ADDRESS
			});

			const legacyResult = buildLegacyTypedData({
				proofBytes: proof,
				publicInputsAsBigInt: publicInputs.map((v) => BigInt(v)),
				verifierDepth: depth,
				nonce,
				deadline,
				chainId: SCROLL_SEPOLIA_CHAIN_ID,
				districtGateAddress: DISTRICT_GATE_ADDRESS
			});

			const newHash = TypedDataEncoder.hash(
				newResult.domain,
				newResult.types,
				newResult.value
			);
			const legacyHash = TypedDataEncoder.hash(
				legacyResult.domain,
				legacyResult.types,
				legacyResult.value
			);

			expect(newHash).toBe(legacyHash);
		}
	);

	it('proof without 0x prefix: new function normalizes, legacy expects 0x', () => {
		// Generate a proof WITH prefix, then strip it for the new path
		const proofWithPrefix = randomProof(256);
		const proofWithoutPrefix = proofWithPrefix.slice(2); // strip 0x
		const publicInputs = randomPublicInputs();
		const verifierDepth = 20;
		const nonce = 1n;
		const deadline = 1700000000;

		// NEW path: pass proof WITHOUT 0x prefix — buildProofAuthorizationData adds it
		const newResult = buildProofAuthorizationData({
			proof: proofWithoutPrefix,
			publicInputs,
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		// LEGACY path: pass proof WITH 0x prefix (as it would be in the legacy code)
		const legacyResult = buildLegacyTypedData({
			proofBytes: proofWithPrefix,
			publicInputsAsBigInt: publicInputs.map((v) => BigInt(v)),
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		const newHash = TypedDataEncoder.hash(
			newResult.domain,
			newResult.types,
			newResult.value
		);
		const legacyHash = TypedDataEncoder.hash(
			legacyResult.domain,
			legacyResult.types,
			legacyResult.value
		);

		expect(newHash).toBe(legacyHash);
	});

	it('proof with 0x prefix: both paths produce same hash', () => {
		const proof = randomProof(256); // already 0x-prefixed
		const publicInputs = randomPublicInputs();
		const verifierDepth = 22;
		const nonce = 100n;
		const deadline = 1800000000;

		const newResult = buildProofAuthorizationData({
			proof,
			publicInputs,
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		const legacyResult = buildLegacyTypedData({
			proofBytes: proof,
			publicInputsAsBigInt: publicInputs.map((v) => BigInt(v)),
			verifierDepth,
			nonce,
			deadline,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		const newHash = TypedDataEncoder.hash(
			newResult.domain,
			newResult.types,
			newResult.value
		);
		const legacyHash = TypedDataEncoder.hash(
			legacyResult.domain,
			legacyResult.types,
			legacyResult.value
		);

		expect(newHash).toBe(legacyHash);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN + VALUE FIELD PARITY
// ═══════════════════════════════════════════════════════════════════════════

describe('EIP-712 domain and value field parity', () => {
	it('domain fields match exactly between new and legacy', () => {
		const proof = randomProof(256);
		const publicInputs = randomPublicInputs();

		const newResult = buildProofAuthorizationData({
			proof,
			publicInputs,
			verifierDepth: 20,
			nonce: 42n,
			deadline: 1700000000,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		expect(newResult.domain.name).toBe('DistrictGate');
		expect(newResult.domain.version).toBe('1');
		expect(BigInt(newResult.domain.chainId)).toBe(SCROLL_SEPOLIA_CHAIN_ID);
		expect(newResult.domain.verifyingContract).toBe(DISTRICT_GATE_ADDRESS);
	});

	it('value fields (proofHash, publicInputsHash) match legacy computation', () => {
		const proof = randomProof(256);
		const publicInputs = randomPublicInputs();

		const newResult = buildProofAuthorizationData({
			proof,
			publicInputs,
			verifierDepth: 20,
			nonce: 42n,
			deadline: 1700000000,
			chainId: SCROLL_SEPOLIA_CHAIN_ID,
			districtGateAddress: DISTRICT_GATE_ADDRESS
		});

		// Manually compute what the legacy path would produce
		const expectedProofHash = keccak256(proof);
		const expectedPacked = solidityPacked(
			Array(31).fill('uint256'),
			publicInputs.map((v) => BigInt(v))
		);
		const expectedPublicInputsHash = keccak256(expectedPacked);

		expect(newResult.value.proofHash).toBe(expectedProofHash);
		expect(newResult.value.publicInputsHash).toBe(expectedPublicInputsHash);
		expect(newResult.value.verifierDepth).toBe(20);
		expect(newResult.value.nonce).toBe(42n);
		expect(newResult.value.deadline).toBe(1700000000);
	});

	it('THREE_TREE_PUBLIC_INPUT_COUNT is 31', () => {
		expect(THREE_TREE_PUBLIC_INPUT_COUNT).toBe(31);
	});
});
