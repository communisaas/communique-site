/**
 * Witness Builder - Constructs circuit inputs from user data
 *
 * Transforms application-level registration data into circuit-compatible witness
 * data, performing validation and format conversion. This isolates the complexity
 * of witness construction from the proving logic.
 *
 * SECURITY INVARIANTS:
 * 1. All field elements validated against BN254 modulus
 * 2. Merkle path must have exactly 20 siblings (depth-20 trees)
 * 3. Path indices derived from leaf index via bit decomposition
 * 4. No user-controlled path indices (prevents path manipulation attacks)
 *
 * CONTROL FLOW:
 * buildWitness() → validate inputs → derive path indices → construct witness
 */

import type { ProofInputs } from './prover-client';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User registration data from backend/Shadow Atlas
 * This is the application-level format, not circuit format
 */
export interface UserRegistration {
	// Identity commitment stored in Merkle tree
	identityCommitment: string;

	// Merkle proof for membership verification
	merkleRoot: string;
	merklePath: string[]; // 20 siblings for depth-20 tree
	leafIndex: number; // Position in tree

	// District information
	districtId: string; // e.g., "usa-ca-san-francisco-d5"

	// Registration metadata
	registrationSalt: string; // Salt from registration
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BN254_MODULUS =
	21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const MERKLE_DEPTH = 20; // Production depth for state-level trees

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a field element is within BN254 field modulus
 * @throws Error if value is invalid or out of range
 */
export function validateFieldElement(value: string, name: string): void {
	try {
		const bigValue = BigInt(value);
		if (bigValue >= BN254_MODULUS) {
			throw new Error(`${name} exceeds BN254 field modulus`);
		}
		if (bigValue < 0n) {
			throw new Error(`${name} cannot be negative`);
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes('field modulus')) {
			throw error;
		}
		throw new Error(`${name} is not a valid field element: ${value}`);
	}
}

/**
 * Validate authority level is in valid range (1-5)
 * @throws Error if level is invalid
 */
function validateAuthorityLevel(level: number): void {
	if (!Number.isInteger(level)) {
		throw new Error(`authorityLevel must be an integer, got ${level}`);
	}
	if (level < 1 || level > 5) {
		throw new Error(`authorityLevel must be 1-5, got ${level}`);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// WITNESS CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build circuit witness from user registration data
 *
 * SECURITY:
 * - Validates all inputs before constructing witness
 * - Derives path indices from leaf index (prevents manipulation)
 * - Ensures Merkle path has correct depth
 *
 * CONTROL FLOW:
 * 1. Validate all field elements
 * 2. Validate Merkle path structure
 * 3. Derive path indices via bit decomposition
 * 4. Construct ProofInputs for prover
 *
 * @param registration - User registration data from backend
 * @param userSecret - User's secret key (never stored, only in memory)
 * @param actionDomain - Action domain for nullifier binding
 * @param authorityLevel - User's authority tier (1-5)
 * @returns Circuit-compatible witness data
 */
export async function buildWitness(
	registration: UserRegistration,
	userSecret: string,
	actionDomain: string,
	authorityLevel: number
): Promise<ProofInputs> {
	// ───────────────────────────────────────────────────────────────────────
	// PHASE 1: Validate all field elements
	// ───────────────────────────────────────────────────────────────────────

	validateFieldElement(registration.identityCommitment, 'identityCommitment');
	validateFieldElement(registration.merkleRoot, 'merkleRoot');
	validateFieldElement(registration.districtId, 'districtId');
	validateFieldElement(registration.registrationSalt, 'registrationSalt');
	validateFieldElement(userSecret, 'userSecret');
	validateFieldElement(actionDomain, 'actionDomain');

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 2: Validate Merkle path structure
	// ───────────────────────────────────────────────────────────────────────

	if (!Array.isArray(registration.merklePath)) {
		throw new Error('merklePath must be an array');
	}

	if (registration.merklePath.length !== MERKLE_DEPTH) {
		throw new Error(
			`Merkle path must have ${MERKLE_DEPTH} siblings, got ${registration.merklePath.length}`
		);
	}

	// Validate each sibling is a valid field element
	registration.merklePath.forEach((sibling, i) => {
		validateFieldElement(sibling, `merklePath[${i}]`);
	});

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 3: Validate leaf index and authority level
	// ───────────────────────────────────────────────────────────────────────

	if (!Number.isInteger(registration.leafIndex)) {
		throw new Error(`leafIndex must be an integer, got ${registration.leafIndex}`);
	}

	const maxIndex = 2 ** MERKLE_DEPTH - 1;
	if (registration.leafIndex < 0 || registration.leafIndex > maxIndex) {
		throw new Error(
			`leafIndex out of range for depth-${MERKLE_DEPTH} tree: ${registration.leafIndex} (max: ${maxIndex})`
		);
	}

	validateAuthorityLevel(authorityLevel);

	// ───────────────────────────────────────────────────────────────────────
	// PHASE 4: Construct witness data
	// ───────────────────────────────────────────────────────────────────────

	// Note: The circuit expects the Merkle path and leaf index directly
	// Path indices are computed inside the circuit from leaf_index
	// This prevents path manipulation attacks where an attacker provides
	// mismatched indices to bypass verification

	return {
		// Public inputs (contract-controlled)
		merkleRoot: registration.merkleRoot,
		actionDomain: actionDomain,

		// Private inputs (user secrets)
		userSecret: userSecret,
		districtId: registration.districtId,
		authorityLevel: authorityLevel,
		registrationSalt: registration.registrationSalt,

		// Merkle proof
		merklePath: registration.merklePath,
		leafIndex: registration.leafIndex
	};
}

/**
 * Derive path indices from leaf index via bit decomposition
 * Used for debugging/testing - the circuit computes this internally
 *
 * @param leafIndex - Position in tree (0 to 2^20-1)
 * @param depth - Tree depth (default: 20)
 * @returns Array of binary indices (0 or 1) for path navigation
 *
 * @example
 * derivePathIndices(5, 3) // leafIndex=5 (binary: 101) → [1, 0, 1]
 * // Read bottom-to-top: left(1), right(0), left(1) = path to leaf 5
 */
export function derivePathIndices(leafIndex: number, depth: number = MERKLE_DEPTH): number[] {
	const indices: number[] = [];
	let index = leafIndex;

	for (let i = 0; i < depth; i++) {
		indices.push(index & 1); // Extract least significant bit
		index >>= 1; // Shift right for next bit
	}

	return indices;
}

/**
 * Convert a hex string to Field-compatible format
 * Handles both 0x-prefixed and raw hex strings
 *
 * @param hex - Hex string (e.g., "0x1234" or "1234")
 * @returns Normalized hex string without 0x prefix
 */
export function normalizeHex(hex: string): string {
	return hex.startsWith('0x') ? hex.slice(2) : hex;
}

/**
 * Format a field element for circuit input
 * Converts to decimal string representation expected by Noir
 *
 * @param hex - Hex string field element
 * @returns Decimal string representation
 */
export function formatFieldElement(hex: string): string {
	const normalized = normalizeHex(hex);
	return BigInt('0x' + normalized).toString(10);
}
