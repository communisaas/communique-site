/**
 * Browser WASM Prover Client
 *
 * Lazy-initialized wrapper around @voter-protocol/noir-prover for in-browser
 * ZK proof generation. Handles singleton management, progress tracking, and
 * error recovery per SA-006 security audit recommendations.
 *
 * SECURITY INVARIANTS:
 * 1. Prover initialized ONCE per depth and cached (SA-006: clear on failure)
 * 2. All field elements validated against BN254 modulus before proving
 * 3. Merkle path must have exactly 20 siblings (depth-20 circuits)
 * 4. Never block main thread - all proving is async via WASM
 *
 * CONTROL FLOW:
 * initializeProver() → getProverForDepth() → NoirProver.init() → cached instance
 * generateProof() → initializeProver() → prover.prove() → ProofResult
 */

import { getProverForDepth, type NoirProver } from '@voter-protocol/noir-prover';
import type {
	CircuitInputs,
	ProofResult as NoirProofResult,
	CircuitDepth
} from '@voter-protocol/noir-prover';

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS TRACKING TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ProverProgress {
	stage: 'loading' | 'initializing' | 'ready' | 'generating' | 'complete' | 'error';
	percent: number;
	message: string;
}

export type ProgressCallback = (progress: ProverProgress) => void;

// ═══════════════════════════════════════════════════════════════════════════
// INPUT/OUTPUT TYPES (simplified interface for browser usage)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Browser-friendly proof inputs
 * Maps to CircuitInputs from @voter-protocol/noir-prover
 */
export interface ProofInputs {
	// Public inputs (contract-controlled)
	merkleRoot: string;
	actionDomain: string;

	// Private inputs (user secrets)
	userSecret: string;
	districtId: string;
	authorityLevel: number;
	registrationSalt: string;

	// Merkle proof data
	merklePath: string[];
	leafIndex: number;
}

/**
 * Browser-friendly proof result
 * Simplified from NoirProofResult for UI consumption
 */
export interface ProofResult {
	proof: string; // hex-encoded proof bytes
	publicInputs: {
		merkleRoot: string;
		nullifier: string;
		authorityLevel: number;
		actionDomain: string;
		districtId: string;
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVER INITIALIZATION (singleton pattern with depth awareness)
// ═══════════════════════════════════════════════════════════════════════════

let proverInstance: NoirProver | null = null;
let initPromise: Promise<NoirProver> | null = null;
let currentDepth: CircuitDepth | null = null;

/**
 * Initialize the prover with lazy circuit loading
 *
 * CONCURRENCY: Safe for concurrent calls - deduplicates initialization
 * CACHING: Singleton per depth - reuses instance across proof generations
 * SA-006 FIX: Clears cache on failure to allow retry
 *
 * @param depth - Circuit depth (default: 20 for state-level trees)
 * @param onProgress - Optional progress callback for UI updates
 */
export async function initializeProver(
	depth: CircuitDepth = 20,
	onProgress?: ProgressCallback
): Promise<NoirProver> {
	// Return cached instance if depth matches
	if (proverInstance && currentDepth === depth) {
		return proverInstance;
	}

	// If depth changed, clear old instance
	if (proverInstance && currentDepth !== depth) {
		console.log(`[ProverClient] Depth changed from ${currentDepth} to ${depth}, reinitializing...`);
		proverInstance = null;
		initPromise = null;
		currentDepth = null;
	}

	// Return in-progress initialization
	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		try {
			onProgress?.({ stage: 'loading', percent: 0, message: 'Loading circuit...' });

			// getProverForDepth() handles singleton management internally
			// It lazy-loads the circuit JSON and initializes the backend
			const prover = await getProverForDepth(depth);

			onProgress?.({ stage: 'initializing', percent: 50, message: 'Initializing backend...' });

			// Prover is already initialized by getProverForDepth()
			// We just need to cache it
			proverInstance = prover;
			currentDepth = depth;

			onProgress?.({ stage: 'ready', percent: 100, message: 'Prover ready' });

			return prover;
		} catch (error) {
			// SA-006 FIX: Clear cache on failure to allow retry
			initPromise = null;
			proverInstance = null;
			currentDepth = null;

			const errorMessage = error instanceof Error ? error.message : String(error);
			onProgress?.({ stage: 'error', percent: 0, message: errorMessage });

			throw error;
		}
	})();

	return initPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROOF GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a ZK proof for district membership
 *
 * SECURITY:
 * - Validates all inputs before passing to circuit
 * - Field elements checked against BN254 modulus
 * - Merkle path length validated (must be 20)
 *
 * CONTROL FLOW:
 * 1. Initialize prover (cached if already initialized)
 * 2. Validate inputs (fail fast on invalid data)
 * 3. Map to circuit inputs (snake_case fields)
 * 4. Generate witness + proof via WASM
 * 5. Extract public inputs and format result
 *
 * @param inputs - Proof inputs (see ProofInputs interface)
 * @param onProgress - Optional progress callback
 * @returns Proof and public inputs
 */
export async function generateProof(
	inputs: ProofInputs,
	onProgress?: ProgressCallback
): Promise<ProofResult> {
	// Validate inputs upfront (fail fast)
	validateProofInputs(inputs);

	// Initialize prover (depth=20 for production)
	const prover = await initializeProver(20, onProgress);

	onProgress?.({ stage: 'generating', percent: 0, message: 'Generating proof...' });

	// Map to circuit inputs (matches CircuitInputs from noir-prover)
	const circuitInputs: CircuitInputs = {
		// Public inputs
		merkleRoot: inputs.merkleRoot,
		actionDomain: inputs.actionDomain,

		// Private inputs
		userSecret: inputs.userSecret,
		districtId: inputs.districtId,
		authorityLevel: inputs.authorityLevel as 1 | 2 | 3 | 4 | 5, // type-safe cast
		registrationSalt: inputs.registrationSalt,

		// Merkle proof
		merklePath: inputs.merklePath,
		leafIndex: inputs.leafIndex
	};

	try {
		// Generate proof via NoirProver
		const result: NoirProofResult = await prover.prove(circuitInputs);

		onProgress?.({ stage: 'complete', percent: 100, message: 'Proof generated' });

		// Convert Uint8Array proof to hex string for browser storage/transmission
		const proofHex = Buffer.from(result.proof).toString('hex');

		return {
			proof: proofHex,
			publicInputs: result.publicInputs
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		onProgress?.({ stage: 'error', percent: 0, message: errorMessage });
		throw error;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

const BN254_MODULUS =
	21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Validate a field element is within BN254 field modulus
 * Prevents circuit errors and potential security issues
 */
function validateFieldElement(value: string, name: string): void {
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
 * Validate all proof inputs before proving
 * Fails fast on invalid data to prevent wasted computation
 */
function validateProofInputs(inputs: ProofInputs): void {
	// Validate field elements
	validateFieldElement(inputs.merkleRoot, 'merkleRoot');
	validateFieldElement(inputs.actionDomain, 'actionDomain');
	validateFieldElement(inputs.userSecret, 'userSecret');
	validateFieldElement(inputs.districtId, 'districtId');
	validateFieldElement(inputs.registrationSalt, 'registrationSalt');

	// Validate authority level
	if (inputs.authorityLevel < 1 || inputs.authorityLevel > 5) {
		throw new Error(`authorityLevel must be 1-5, got ${inputs.authorityLevel}`);
	}
	if (!Number.isInteger(inputs.authorityLevel)) {
		throw new Error(`authorityLevel must be an integer, got ${inputs.authorityLevel}`);
	}

	// Validate Merkle path
	if (!Array.isArray(inputs.merklePath)) {
		throw new Error('merklePath must be an array');
	}
	if (inputs.merklePath.length !== 20) {
		throw new Error(
			`Merkle path must have 20 siblings for depth-20 circuit, got ${inputs.merklePath.length}`
		);
	}

	// Validate each sibling is a field element
	inputs.merklePath.forEach((sibling, i) => {
		validateFieldElement(sibling, `merklePath[${i}]`);
	});

	// Validate leaf index
	if (!Number.isInteger(inputs.leafIndex)) {
		throw new Error(`leafIndex must be an integer, got ${inputs.leafIndex}`);
	}
	if (inputs.leafIndex < 0 || inputs.leafIndex >= 2 ** 20) {
		throw new Error(`leafIndex out of range for depth-20 tree: ${inputs.leafIndex}`);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP (for testing/hot reload)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reset the prover singleton (for testing or hot reload)
 * @internal
 */
export function resetProver(): void {
	proverInstance = null;
	initPromise = null;
	currentDepth = null;
}
