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
 * Two-tree: initializeTwoTreeProver() → TwoTreeNoirProver.init() → prover.generateProof() → TwoTreeProofResult
 */

import type { CircuitDepth } from '@voter-protocol/noir-prover';
import {
	getTwoTreeProverForDepth,
	type TwoTreeNoirProver,
	type TwoTreeProofInput,
	type TwoTreeProofResult as NoirTwoTreeProofResult,
	TWO_TREE_PUBLIC_INPUT_COUNT
} from '@voter-protocol/noir-prover';

/** Convert Uint8Array to hex string (CF Workers compatible, no Node.js Buffer) */
function uint8ArrayToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

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
 * Browser-friendly two-tree proof inputs
 * Maps to TwoTreeProofInput from @voter-protocol/noir-prover
 *
 * ARCHITECTURE:
 * - Tree 1 (userRoot): Stable user identity tree
 * - Tree 2 (cellMapRoot): Dynamic cell-to-district mapping tree
 * - This separation eliminates re-registration on redistricting
 */
export interface TwoTreeProofInputs {
	// ═══════════════════════════════════════════════════════════════════════
	// PUBLIC INPUTS (contract-controlled)
	// ═══════════════════════════════════════════════════════════════════════

	/** Root of Tree 1 (user identity Merkle tree) */
	userRoot: string;

	/** Root of Tree 2 (cell-district mapping sparse Merkle tree) */
	cellMapRoot: string;

	/**
	 * All 24 district IDs for this cell.
	 * Matches district-gate-client.ts PUBLIC_INPUT_INDEX: [2-25]
	 * Unused slots MUST be '0' or '0x0'.
	 */
	districts: string[];

	/** Anti-double-vote nullifier = H2(identity_commitment, action_domain) (NUL-001) */
	nullifier: string;

	/** Contract-controlled action scope (matches district-gate-client.ts) */
	actionDomain: string;

	/** User's voting tier (1-5) - matches district-gate-client.ts authorityLevel */
	authorityLevel: number;

	// ═══════════════════════════════════════════════════════════════════════
	// PRIVATE INPUTS (user secrets, never revealed)
	// ═══════════════════════════════════════════════════════════════════════

	/** User's secret key material (must be non-zero per SA-011) */
	userSecret: string;

	/** Census tract cell ID the user is registered in */
	cellId: string;

	/** Random salt assigned during registration */
	registrationSalt: string;

	/**
	 * Identity commitment (SHA-256 mod BN254, deterministic per verified person).
	 * Used for nullifier: H2(identityCommitment, actionDomain) (NUL-001).
	 * Guaranteed < BN254 modulus — safe as circuit Field input.
	 */
	identityCommitment: string;

	// ═══════════════════════════════════════════════════════════════════════
	// TREE 1 PROOF DATA
	// ═══════════════════════════════════════════════════════════════════════

	/** Tree 1 Merkle siblings from leaf to root (length must match circuit depth) */
	userPath: string[];

	/** Leaf position in Tree 1 (determines left/right at each level) */
	userIndex: number;

	// ═══════════════════════════════════════════════════════════════════════
	// TREE 2 PROOF DATA (Sparse Merkle Tree)
	// ═══════════════════════════════════════════════════════════════════════

	/** Tree 2 SMT siblings from leaf to root (length must match circuit depth) */
	cellMapPath: string[];

	/** Tree 2 SMT direction bits: 0 = left, 1 = right */
	cellMapPathBits: number[];
}

/**
 * Browser-friendly two-tree proof result
 * Contains all 29 public inputs from the two-tree circuit
 *
 * PUBLIC INPUT LAYOUT (matches district-gate-client.ts PUBLIC_INPUT_INDEX):
 *   [0]     userRoot
 *   [1]     cellMapRoot
 *   [2-25]  districts[24]
 *   [26]    nullifier
 *   [27]    actionDomain
 *   [28]    authorityLevel
 */
export interface TwoTreeProofResult {
	/** Hex-encoded proof bytes (0x-prefixed) */
	proof: string;

	/**
	 * All 29 public inputs as hex strings.
	 * Structured for contract verification and UI consumption.
	 */
	publicInputs: {
		/** [0] Root of Tree 1 (user identity tree) */
		userRoot: string;

		/** [1] Root of Tree 2 (cell-district mapping tree) */
		cellMapRoot: string;

		/** [2-25] All 24 district IDs for this cell */
		districts: string[];

		/** [26] Anti-double-vote nullifier */
		nullifier: string;

		/** [27] Action domain identifier */
		actionDomain: string;

		/** [28] User's authority level (1-5) */
		authorityLevel: number;
	};

	/**
	 * Raw public inputs array (for direct contract submission).
	 * Length: 29 (TWO_TREE_PUBLIC_INPUT_COUNT)
	 */
	publicInputsArray: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVER INITIALIZATION (singleton pattern with depth awareness)
// ═══════════════════════════════════════════════════════════════════════════

// Two-tree prover (current architecture)
let twoTreeProverInstance: TwoTreeNoirProver | null = null;
let twoTreeInitPromise: Promise<TwoTreeNoirProver> | null = null;
let twoTreeCurrentDepth: CircuitDepth | null = null;

/**
 * Initialize the two-tree prover with lazy circuit loading
 *
 * ARCHITECTURE:
 * - Two-tree design eliminates re-registration on redistricting
 * - Tree 1: User identity (stable)
 * - Tree 2: Cell-district mapping (dynamic)
 *
 * CONCURRENCY: Safe for concurrent calls - deduplicates initialization
 * CACHING: Singleton per depth - reuses instance across proof generations
 * SA-006 FIX: Clears cache on failure to allow retry
 *
 * @param depth - Circuit depth (default: 20 for state-level trees)
 * @param onProgress - Optional progress callback for UI updates
 */
export async function initializeTwoTreeProver(
	depth: CircuitDepth = 20,
	onProgress?: ProgressCallback
): Promise<TwoTreeNoirProver> {
	// Return cached instance if depth matches
	if (twoTreeProverInstance && twoTreeCurrentDepth === depth) {
		return twoTreeProverInstance;
	}

	// If depth changed, clear old instance
	if (twoTreeProverInstance && twoTreeCurrentDepth !== depth) {
		console.debug(
			`[ProverClient] Two-tree depth changed from ${twoTreeCurrentDepth} to ${depth}, reinitializing...`
		);
		twoTreeProverInstance = null;
		twoTreeInitPromise = null;
		twoTreeCurrentDepth = null;
	}

	// Return in-progress initialization
	if (twoTreeInitPromise) {
		return twoTreeInitPromise;
	}

	twoTreeInitPromise = (async () => {
		try {
			onProgress?.({ stage: 'loading', percent: 0, message: 'Loading two-tree circuit...' });

			// getTwoTreeProverForDepth() handles singleton management internally
			const prover = await getTwoTreeProverForDepth(depth);

			onProgress?.({
				stage: 'initializing',
				percent: 50,
				message: 'Initializing two-tree backend...'
			});

			// Cache the initialized prover
			twoTreeProverInstance = prover;
			twoTreeCurrentDepth = depth;

			onProgress?.({ stage: 'ready', percent: 100, message: 'Two-tree prover ready' });

			return prover;
		} catch (error) {
			// SA-006 FIX: Clear cache on failure to allow retry
			twoTreeInitPromise = null;
			twoTreeProverInstance = null;
			twoTreeCurrentDepth = null;

			const errorMessage = error instanceof Error ? error.message : String(error);
			onProgress?.({ stage: 'error', percent: 0, message: errorMessage });

			throw error;
		}
	})();

	return twoTreeInitPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROOF GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a two-tree ZK proof for district membership
 *
 * ARCHITECTURE:
 * - Proves user identity in Tree 1 (stable, only changes when user moves)
 * - Proves cell-district mapping in Tree 2 (dynamic, updates on redistricting)
 * - Eliminates need for user re-registration on redistricting
 *
 * SECURITY:
 * - Validates all inputs before passing to circuit
 * - Field elements checked against BN254 modulus
 * - Merkle path lengths validated (must match circuit depth)
 * - Districts array must be exactly 24 elements
 * - SA-011: Rejects zero user_secret
 *
 * CONTROL FLOW:
 * 1. Initialize two-tree prover (cached if already initialized)
 * 2. Validate inputs (fail fast on invalid data)
 * 3. Map to circuit inputs (bigint fields)
 * 4. Generate witness + proof via WASM
 * 5. Extract public inputs and format result
 *
 * @param inputs - Two-tree proof inputs (see TwoTreeProofInputs interface)
 * @param onProgress - Optional progress callback
 * @returns Proof and all 29 public inputs
 */
export async function generateTwoTreeProof(
	inputs: TwoTreeProofInputs,
	onProgress?: ProgressCallback
): Promise<TwoTreeProofResult> {
	// Validate inputs upfront (fail fast)
	validateTwoTreeProofInputs(inputs);

	// Initialize two-tree prover (depth=20 for production)
	const prover = await initializeTwoTreeProver(20, onProgress);

	onProgress?.({ stage: 'generating', percent: 0, message: 'Generating two-tree proof...' });

	// Map to circuit inputs (convert hex strings to bigints)
	const circuitInputs: TwoTreeProofInput = {
		// Public inputs
		userRoot: BigInt(inputs.userRoot),
		cellMapRoot: BigInt(inputs.cellMapRoot),
		districts: inputs.districts.map((d) => BigInt(d)),
		nullifier: BigInt(inputs.nullifier),
		actionDomain: BigInt(inputs.actionDomain),
		authorityLevel: inputs.authorityLevel as 1 | 2 | 3 | 4 | 5,

		// Private inputs
		userSecret: BigInt(inputs.userSecret),
		cellId: BigInt(inputs.cellId),
		registrationSalt: BigInt(inputs.registrationSalt),
		identityCommitment: BigInt(inputs.identityCommitment),

		// Tree 1 proof
		userPath: inputs.userPath.map((p) => BigInt(p)),
		userIndex: inputs.userIndex,

		// Tree 2 proof (SMT)
		cellMapPath: inputs.cellMapPath.map((p) => BigInt(p)),
		cellMapPathBits: inputs.cellMapPathBits
	};

	try {
		// Generate proof via TwoTreeNoirProver
		const result: NoirTwoTreeProofResult = await prover.generateProof(circuitInputs);

		onProgress?.({ stage: 'complete', percent: 100, message: 'Two-tree proof generated' });

		// Convert Uint8Array proof to hex string (0x-prefixed)
		const proofHex = '0x' + uint8ArrayToHex(result.proof);

		// Validate we got exactly 29 public inputs
		if (result.publicInputs.length !== TWO_TREE_PUBLIC_INPUT_COUNT) {
			throw new Error(
				`Expected ${TWO_TREE_PUBLIC_INPUT_COUNT} public inputs, got ${result.publicInputs.length}`
			);
		}

		// Extract structured public inputs (matching district-gate-client.ts layout)
		const publicInputs = {
			userRoot: result.publicInputs[0], // [0]
			cellMapRoot: result.publicInputs[1], // [1]
			districts: result.publicInputs.slice(2, 26), // [2-25] (24 elements)
			nullifier: result.publicInputs[26], // [26]
			actionDomain: result.publicInputs[27], // [27]
			authorityLevel: parseInt(result.publicInputs[28]) as 1 | 2 | 3 | 4 | 5 // [28]
		};

		return {
			proof: proofHex,
			publicInputs,
			publicInputsArray: result.publicInputs
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
 * Validate all two-tree proof inputs before proving
 * Fails fast on invalid data to prevent wasted computation
 *
 * SECURITY:
 * - SA-011: Rejects zero user_secret
 * - Validates 24 district slots exactly
 * - Validates both Tree 1 and Tree 2 Merkle paths
 * - Validates authority level range [1, 5]
 */
function validateTwoTreeProofInputs(inputs: TwoTreeProofInputs): void {
	// Validate field elements (public inputs)
	validateFieldElement(inputs.userRoot, 'userRoot');
	validateFieldElement(inputs.cellMapRoot, 'cellMapRoot');
	validateFieldElement(inputs.nullifier, 'nullifier');
	validateFieldElement(inputs.actionDomain, 'actionDomain');

	// Validate districts array
	if (!Array.isArray(inputs.districts)) {
		throw new Error('districts must be an array');
	}
	if (inputs.districts.length !== 24) {
		throw new Error(`districts array must have exactly 24 elements, got ${inputs.districts.length}`);
	}

	// Validate each district is a field element (0 is allowed for unused slots)
	inputs.districts.forEach((district, i) => {
		validateFieldElement(district, `districts[${i}]`);
	});

	// Validate private inputs
	validateFieldElement(inputs.userSecret, 'userSecret');
	validateFieldElement(inputs.cellId, 'cellId');
	validateFieldElement(inputs.registrationSalt, 'registrationSalt');

	// SA-011: Reject zero user_secret
	if (BigInt(inputs.userSecret) === 0n) {
		throw new Error('userSecret cannot be zero (SA-011 security requirement)');
	}

	// NUL-001: Validate identityCommitment
	validateFieldElement(inputs.identityCommitment, 'identityCommitment');
	if (BigInt(inputs.identityCommitment) === 0n) {
		throw new Error('identityCommitment cannot be zero (NUL-001: required for Sybil prevention)');
	}

	// Validate authority level
	if (inputs.authorityLevel < 1 || inputs.authorityLevel > 5) {
		throw new Error(`authorityLevel must be 1-5, got ${inputs.authorityLevel}`);
	}
	if (!Number.isInteger(inputs.authorityLevel)) {
		throw new Error(`authorityLevel must be an integer, got ${inputs.authorityLevel}`);
	}

	// Validate Tree 1 Merkle path
	if (!Array.isArray(inputs.userPath)) {
		throw new Error('userPath must be an array');
	}
	if (inputs.userPath.length !== 20) {
		throw new Error(
			`userPath must have 20 siblings for depth-20 circuit, got ${inputs.userPath.length}`
		);
	}
	inputs.userPath.forEach((sibling, i) => {
		validateFieldElement(sibling, `userPath[${i}]`);
	});

	// Validate Tree 1 leaf index
	if (!Number.isInteger(inputs.userIndex)) {
		throw new Error(`userIndex must be an integer, got ${inputs.userIndex}`);
	}
	if (inputs.userIndex < 0 || inputs.userIndex >= 2 ** 20) {
		throw new Error(`userIndex out of range for depth-20 tree: ${inputs.userIndex}`);
	}

	// Validate Tree 2 SMT path
	if (!Array.isArray(inputs.cellMapPath)) {
		throw new Error('cellMapPath must be an array');
	}
	if (inputs.cellMapPath.length !== 20) {
		throw new Error(
			`cellMapPath must have 20 siblings for depth-20 circuit, got ${inputs.cellMapPath.length}`
		);
	}
	inputs.cellMapPath.forEach((sibling, i) => {
		validateFieldElement(sibling, `cellMapPath[${i}]`);
	});

	// Validate Tree 2 path bits
	if (!Array.isArray(inputs.cellMapPathBits)) {
		throw new Error('cellMapPathBits must be an array');
	}
	if (inputs.cellMapPathBits.length !== 20) {
		throw new Error(
			`cellMapPathBits must have 20 bits for depth-20 circuit, got ${inputs.cellMapPathBits.length}`
		);
	}
	inputs.cellMapPathBits.forEach((bit, i) => {
		if (bit !== 0 && bit !== 1) {
			throw new Error(`cellMapPathBits[${i}] must be 0 or 1, got ${bit}`);
		}
		if (!Number.isInteger(bit)) {
			throw new Error(`cellMapPathBits[${i}] must be an integer, got ${bit}`);
		}
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP (for testing/hot reload)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reset the two-tree prover singleton (for testing or hot reload)
 * @internal
 */
export function resetTwoTreeProver(): void {
	twoTreeProverInstance = null;
	twoTreeInitPromise = null;
	twoTreeCurrentDepth = null;
}

/**
 * Reset all prover singletons (for testing or hot reload)
 * @internal
 */
export function resetAllProvers(): void {
	resetTwoTreeProver();
}
