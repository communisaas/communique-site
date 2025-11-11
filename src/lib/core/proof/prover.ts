/**
 * Browser-native Halo2 ZK Proof Generation
 *
 * Wraps @voter-protocol/halo2-browser-prover for district membership proofs.
 *
 * Flow:
 * 1. Initialize prover once on app startup (5-10s keygen)
 * 2. Cache prover instance in memory
 * 3. Generate proofs on-demand (1-2s desktop, 8-15s mobile)
 * 4. Return proof + public inputs for verification
 *
 * Performance:
 * - First initialization: 5-10 seconds (keygen)
 * - Cached initialization: instant
 * - Proof generation: 1-2s desktop, 8-15s mobile
 * - Memory usage: 600-800MB WASM
 */

import type { Prover } from '@voter-protocol/halo2-browser-prover';

// ============================================================================
// Types
// ============================================================================

/** Chrome's non-standard performance.memory API */
interface PerformanceMemory {
	usedJSHeapSize: number;
	jsHeapSizeLimit: number;
	totalJSHeapSize: number;
}

/** Extended Performance interface with memory API */
interface PerformanceWithMemory extends Performance {
	memory?: PerformanceMemory;
}

export interface ProofGenerationResult {
	/** ZK proof bytes (~4.6KB) */
	proof: Uint8Array;
	/** Public inputs for verification */
	publicInputs: {
		districtRoot: string; // Hex string
		nullifier: string; // Hex string
		actionId: string; // Hex string
	};
	/** Congressional district proven */
	district: string;
	/** Proof generation time (ms) */
	generationTime: number;
}

export interface ProverInitMetrics {
	/** Initialization time (ms) */
	initTime: number;
	/** Circuit size parameter */
	k: number;
	/** Memory usage estimate (MB) */
	memoryUsageMB: number;
}

// ============================================================================
// Prover Instance Management
// ============================================================================

let proverInstance: Prover | null = null;
let initializationPromise: Promise<Prover> | null = null;
let initMetrics: ProverInitMetrics | null = null;

/**
 * Initialize Halo2 prover (call once on app startup)
 *
 * This performs key generation (5-10 seconds) and caches the result.
 * Subsequent calls return the cached instance instantly.
 *
 * @param progressCallback - Optional progress callback (0-100)
 * @param k - Circuit size parameter (default: 14)
 * @returns Prover instance
 */
export async function initializeProver(
	progressCallback?: (progress: number) => void,
	k: number = 14
): Promise<Prover> {
	// Return cached instance if available
	if (proverInstance) {
		console.log('[Prover] Using cached prover instance');
		return proverInstance;
	}

	// Return in-progress initialization if already started
	if (initializationPromise) {
		console.log('[Prover] Waiting for in-progress initialization');
		return initializationPromise;
	}

	console.log(`[Prover] Initializing K=${k} circuit...`);
	const startTime = performance.now();

	// Start initialization
	initializationPromise = (async () => {
		try {
			// Dynamic import to avoid bundling issues
			progressCallback?.(10);
			const wasmModule = await import('@voter-protocol/halo2-browser-prover');

			// CRITICAL: Initialize WASM before instantiating Prover
			// This loads the WASM binary and sets up the runtime
			console.log('[Prover] Loading WASM module...');
			progressCallback?.(30);
			await wasmModule.default(); // Call default export (init function)

			// Extract Prover class from module
			const { Prover } = wasmModule;

			console.log('[Prover] Creating prover instance (keygen)...');
			progressCallback?.(60);

			// Create prover (performs keygen)
			const prover = new Prover(k);
			progressCallback?.(100);

			const endTime = performance.now();
			const initTime = endTime - startTime;

			// Estimate memory usage (WASM heap + prover state)
			const memoryUsageMB =
				Math.round((performance as PerformanceWithMemory).memory?.usedJSHeapSize / 1024 / 1024) ||
				700;

			initMetrics = {
				initTime,
				k,
				memoryUsageMB
			};

			console.log('[Prover] Initialization complete:', {
				initTime: `${initTime.toFixed(0)}ms`,
				k,
				memoryUsageMB: `${memoryUsageMB}MB`
			});

			proverInstance = prover;
			return prover;
		} catch (error) {
			console.error('[Prover] Initialization failed:', error);
			initializationPromise = null; // Allow retry
			throw error;
		}
	})();

	return initializationPromise;
}

/**
 * Get prover initialization metrics
 */
export function getInitMetrics(): ProverInitMetrics | null {
	return initMetrics;
}

/**
 * Check if prover is initialized
 */
export function isProverInitialized(): boolean {
	return proverInstance !== null;
}

/**
 * Reset prover (for testing or memory cleanup)
 */
export function resetProver(): void {
	proverInstance = null;
	initializationPromise = null;
	initMetrics = null;
	console.log('[Prover] Reset complete');
}

// ============================================================================
// Proof Generation
// ============================================================================

/**
 * Witness data for proof generation
 */
export interface WitnessData {
	identityCommitment: string;
	leafIndex: number;
	merklePath: string[];
	merkleRoot: string;
	actionId: string;
	timestamp: number;
}

/**
 * Simplified proof generation result for ProofGenerator component
 */
export interface ProofResult {
	success: boolean;
	proof?: string; // Hex-encoded proof
	publicInputs?: {
		merkleRoot: string;
		nullifier: string;
		actionId: string;
	};
	nullifier?: string; // Computed nullifier
	error?: string;
}

/**
 * Generate ZK proof with progress callback
 *
 * High-level API used by ProofGenerator component
 *
 * @param witness - Witness data
 * @param progressCallback - Progress callback (0-100)
 * @returns Proof result
 */
export async function generateProof(
	witness: WitnessData,
	progressCallback?: (progress: number) => void
): Promise<ProofResult> {
	try {
		progressCallback?.(0);

		// Ensure prover is initialized
		await initializeProver();
		progressCallback?.(20);

		console.log('[Prover] Generating proof:', {
			leafIndex: witness.leafIndex,
			pathLength: witness.merklePath.length
		});

		// Validate inputs
		if (witness.merklePath.length !== 12) {
			return {
				success: false,
				error: `Invalid Merkle path length: ${witness.merklePath.length} (expected 12)`
			};
		}

		if (witness.leafIndex < 0 || witness.leafIndex > 4095) {
			return {
				success: false,
				error: `Invalid leaf index: ${witness.leafIndex} (must be 0-4095)`
			};
		}

		progressCallback?.(40);

		// Generate proof using prover instance
		const prover = proverInstance!;
		const proofBytes = await prover.prove(
			witness.identityCommitment,
			witness.actionId,
			witness.leafIndex,
			witness.merklePath
		);

		progressCallback?.(80);

		// Compute nullifier (Poseidon(identityCommitment, actionId))
		// TODO: Use actual Poseidon hash from WASM module
		const nullifier = await computeNullifier(witness.identityCommitment, witness.actionId);

		progressCallback?.(90);

		// Convert proof to hex string
		const proofHex = bytesToHex(proofBytes);

		progressCallback?.(100);

		console.log('[Prover] Proof generated successfully:', {
			proofSize: proofBytes.length,
			nullifier: nullifier.slice(0, 10) + '...'
		});

		return {
			success: true,
			proof: proofHex,
			publicInputs: {
				merkleRoot: witness.merkleRoot,
				nullifier,
				actionId: witness.actionId
			},
			nullifier
		};
	} catch (error) {
		console.error('[Prover] Proof generation failed:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error during proof generation'
		};
	}
}

/**
 * Compute nullifier using Poseidon hash
 * TODO: Use actual Poseidon implementation from WASM module
 */
async function computeNullifier(identityCommitment: string, actionId: string): Promise<string> {
	// Temporary implementation using SHA-256
	// In production, use Poseidon(identityCommitment, actionId)
	const input = identityCommitment + actionId;
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
	return (
		'0x' +
		Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
	);
}

/**
 * Generate ZK proof of district membership
 *
 * @param identityCommitment - User's identity commitment (hex string)
 * @param actionId - Action identifier (hex string)
 * @param leafIndex - Position in Merkle tree (0-4095)
 * @param merklePath - Array of 12 sibling hashes (hex strings)
 * @param district - Congressional district (e.g., "CA-12")
 * @returns Proof and public inputs
 */
export async function generateDistrictProof(
	identityCommitment: string,
	actionId: string,
	leafIndex: number,
	merklePath: string[],
	district: string
): Promise<ProofGenerationResult> {
	const startTime = performance.now();

	try {
		// Ensure prover is initialized
		const prover = await initializeProver();

		console.log('[Prover] Generating proof:', {
			district,
			leafIndex,
			pathLength: merklePath.length
		});

		// Validate inputs
		if (merklePath.length !== 12) {
			throw new Error(`Invalid Merkle path length: ${merklePath.length} (expected 12)`);
		}

		if (leafIndex < 0 || leafIndex > 4095) {
			throw new Error(`Invalid leaf index: ${leafIndex} (must be 0-4095)`);
		}

		// Generate proof
		const proof = await prover.prove(identityCommitment, actionId, leafIndex, merklePath);

		const endTime = performance.now();
		const generationTime = endTime - startTime;

		console.log('[Prover] Proof generated:', {
			proofSize: proof.length,
			generationTime: `${generationTime.toFixed(0)}ms`
		});

		// TODO: Extract public inputs from proof
		// For now, we'll need to compute them separately
		const publicInputs = {
			districtRoot: merklePath[merklePath.length - 1], // Root is last sibling (for now)
			nullifier: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO: Compute
			actionId
		};

		return {
			proof,
			publicInputs,
			district,
			generationTime
		};
	} catch (error) {
		const endTime = performance.now();
		const generationTime = endTime - startTime;

		console.error('[Prover] Proof generation failed:', {
			error,
			generationTime: `${generationTime.toFixed(0)}ms`
		});

		throw error;
	}
}

// ============================================================================
// Mock Proof Generation (for testing without Shadow Atlas)
// ============================================================================

/**
 * Generate mock proof for testing
 *
 * Uses dummy Merkle path and identity commitment.
 * Useful for UX testing before Shadow Atlas is ready.
 *
 * @param district - Congressional district (e.g., "CA-12")
 * @returns Mock proof result
 */
export async function generateMockProof(district: string): Promise<ProofGenerationResult> {
	console.log('[Prover] Generating MOCK proof for testing:', { district });

	// Mock inputs (valid field elements)
	const identityCommitment = '0x0000000000000000000000000000000000000000000000000000000000000001';
	const actionId = '0x0000000000000000000000000000000000000000000000000000000000000002';
	const leafIndex = 0;

	// Mock Merkle path (12 sibling hashes)
	const merklePath = Array(12).fill(
		'0x0000000000000000000000000000000000000000000000000000000000000003'
	);

	return generateDistrictProof(identityCommitment, actionId, leafIndex, merklePath, district);
}

// ============================================================================
// Browser Compatibility Check
// ============================================================================

/**
 * Check if browser supports WASM proving
 */
export function isWasmSupported(): boolean {
	try {
		if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
			// Test basic WASM instantiation
			const module = new WebAssembly.Module(
				Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
			);
			return module instanceof WebAssembly.Module;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Get browser compatibility info
 */
export function getBrowserCompatibility(): {
	supported: boolean;
	warnings: string[];
} {
	const warnings: string[] = [];

	// Check WASM support
	if (!isWasmSupported()) {
		return {
			supported: false,
			warnings: ['WebAssembly not supported. Please upgrade your browser.']
		};
	}

	// Check memory (estimate)
	const perfWithMemory = performance as PerformanceWithMemory;
	if (typeof performance !== 'undefined' && perfWithMemory.memory) {
		const heapSizeMB = perfWithMemory.memory.jsHeapSizeLimit / 1024 / 1024;
		if (heapSizeMB < 500) {
			warnings.push('Low memory available. Proof generation may be slow.');
		}
	}

	// Check if mobile (heuristic)
	const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
	if (isMobile) {
		warnings.push('Mobile device detected. Expect 8-15 second proof generation.');
	}

	return {
		supported: true,
		warnings
	};
}
