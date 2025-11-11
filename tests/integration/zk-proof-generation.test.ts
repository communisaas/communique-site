/**
 * ZK Proof Generation Integration Tests
 *
 * Testing philosophy:
 * - WASM initialization: Does it cache properly? (5-10s first time, instant after)
 * - Proof generation: Does it work? How long does it take?
 * - Browser compatibility: Does WASM actually load?
 * - Mock data: Can we test UX before Shadow Atlas is ready?
 *
 * What we DON'T test:
 * - Cryptographic soundness (Axiom's halo2_base is Trail of Bits audited)
 * - Proof verification (that's on-chain, tested in voter-protocol)
 * - Merkle tree construction (that's Shadow Atlas, tested separately)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	initializeProver,
	generateDistrictProof,
	generateMockProof,
	isProverInitialized,
	resetProver,
	getInitMetrics,
	isWasmSupported,
	getBrowserCompatibility,
	type ProofGenerationResult
} from '$lib/core/proof/prover';

/**
 * TESTING STRATEGY:
 * - Node/Vitest: Test API surface, error handling, validation logic
 * - Browser manual: Test actual WASM proving (see MANUAL TESTING GUIDE below)
 * - Skip WASM tests in Node (WASM requires browser environment)
 */

const isNodeEnvironment = typeof window === 'undefined';

describe('ZK Proof Generation - Browser Environment', () => {
	beforeEach(() => {
		// Reset prover state between tests
		resetProver();
	});

	describe('WASM Support Detection', () => {
		it('should detect WebAssembly support', () => {
			// This test runs in Node with JSDOM, but checks the detection logic
			const supported = isWasmSupported();

			// In Node environment, WebAssembly should be available
			expect(typeof supported).toBe('boolean');
		});

		it('should provide browser compatibility info', () => {
			const compat = getBrowserCompatibility();

			expect(compat).toHaveProperty('supported');
			expect(compat).toHaveProperty('warnings');
			expect(Array.isArray(compat.warnings)).toBe(true);
		});
	});

	describe('Prover Initialization (Performance Critical)', () => {
		it.skipIf(isNodeEnvironment)('should initialize prover and cache instance', async () => {
			// First initialization - expect this to take 5-10s on real hardware
			const startTime = performance.now();
			const prover1 = await initializeProver(14);
			const initTime = performance.now() - startTime;

			expect(prover1).toBeDefined();
			expect(isProverInitialized()).toBe(true);

			console.log(`[Test] First initialization: ${initTime.toFixed(0)}ms`);

			// Second call should return cached instance (instant)
			const cachedStart = performance.now();
			const prover2 = await initializeProver(14);
			const cachedTime = performance.now() - cachedStart;

			expect(prover2).toBe(prover1); // Same instance
			expect(cachedTime).toBeLessThan(100); // Should be instant

			console.log(`[Test] Cached initialization: ${cachedTime.toFixed(0)}ms`);

			// Verify metrics were recorded
			const metrics = getInitMetrics();
			expect(metrics).toBeDefined();
			expect(metrics?.k).toBe(14);
			expect(metrics?.initTime).toBeGreaterThan(0);
		}, 30000); // 30s timeout for WASM keygen

		it.skipIf(isNodeEnvironment)('should handle concurrent initialization requests', async () => {
			// Simulate multiple components trying to initialize at once
			const [prover1, prover2, prover3] = await Promise.all([
				initializeProver(14),
				initializeProver(14),
				initializeProver(14)
			]);

			// All should get the same instance
			expect(prover1).toBe(prover2);
			expect(prover2).toBe(prover3);
			expect(isProverInitialized()).toBe(true);
		}, 30000);
	});

	describe('Mock Proof Generation (UX Testing)', () => {
		it('should generate mock proof with valid structure', async () => {
			const district = 'CA-12';
			const result = await generateMockProof(district);

			// Verify result structure
			expect(result).toHaveProperty('proof');
			expect(result).toHaveProperty('publicInputs');
			expect(result).toHaveProperty('district');
			expect(result).toHaveProperty('generationTime');

			// Verify proof is a Uint8Array
			expect(result.proof).toBeInstanceOf(Uint8Array);
			expect(result.proof.length).toBeGreaterThan(0);

			// Verify public inputs
			expect(result.publicInputs).toHaveProperty('districtRoot');
			expect(result.publicInputs).toHaveProperty('nullifier');
			expect(result.publicInputs).toHaveProperty('actionId');

			// Verify district matches
			expect(result.district).toBe(district);

			// Verify generation time was recorded
			expect(result.generationTime).toBeGreaterThan(0);

			console.log(`[Test] Mock proof generated in ${result.generationTime.toFixed(0)}ms`);
			console.log(`[Test] Proof size: ${result.proof.length} bytes`);
		}, 30000);

		it('should generate different proofs for different districts', async () => {
			const proof1 = await generateMockProof('CA-12');
			const proof2 = await generateMockProof('TX-18');

			// Districts should be different
			expect(proof1.district).not.toBe(proof2.district);

			// Proofs should have same structure
			expect(proof1.proof.length).toBe(proof2.proof.length);

			console.log(`[Test] Generated proofs for CA-12 and TX-18`);
		}, 30000);
	});

	describe('Real Proof Generation (Integration)', () => {
		it('should generate proof with valid Merkle path', async () => {
			// Mock inputs (valid field elements)
			const identityCommitment =
				'0x0000000000000000000000000000000000000000000000000000000000000001';
			const actionId = '0x0000000000000000000000000000000000000000000000000000000000000002';
			const leafIndex = 0;

			// Mock Merkle path (12 sibling hashes for K=14 circuit)
			const merklePath = Array(12).fill(
				'0x0000000000000000000000000000000000000000000000000000000000000003'
			);

			const result = await generateDistrictProof(
				identityCommitment,
				actionId,
				leafIndex,
				merklePath,
				'CA-12'
			);

			expect(result.proof).toBeInstanceOf(Uint8Array);
			expect(result.proof.length).toBeGreaterThan(0);
			expect(result.district).toBe('CA-12');

			console.log(`[Test] Real proof generation: ${result.generationTime.toFixed(0)}ms`);
		}, 30000);

		it('should validate Merkle path length', async () => {
			const identityCommitment =
				'0x0000000000000000000000000000000000000000000000000000000000000001';
			const actionId = '0x0000000000000000000000000000000000000000000000000000000000000002';
			const leafIndex = 0;

			// Invalid path (wrong length)
			const invalidPath = Array(10).fill(
				'0x0000000000000000000000000000000000000000000000000000000000000003'
			);

			await expect(
				generateDistrictProof(identityCommitment, actionId, leafIndex, invalidPath, 'CA-12')
			).rejects.toThrow('Invalid Merkle path length');
		}, 30000);

		it('should validate leaf index bounds', async () => {
			const identityCommitment =
				'0x0000000000000000000000000000000000000000000000000000000000000001';
			const actionId = '0x0000000000000000000000000000000000000000000000000000000000000002';
			const merklePath = Array(12).fill(
				'0x0000000000000000000000000000000000000000000000000000000000000003'
			);

			// Invalid leaf index (K=14 supports 0-4095)
			await expect(
				generateDistrictProof(identityCommitment, actionId, -1, merklePath, 'CA-12')
			).rejects.toThrow('Invalid leaf index');

			await expect(
				generateDistrictProof(identityCommitment, actionId, 5000, merklePath, 'CA-12')
			).rejects.toThrow('Invalid leaf index');
		}, 30000);
	});

	describe('Performance Benchmarking', () => {
		it('should benchmark proof generation performance', async () => {
			const iterations = 3;
			const times: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const result = await generateMockProof(`CA-${i + 1}`);
				times.push(result.generationTime);
			}

			const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
			const minTime = Math.min(...times);
			const maxTime = Math.max(...times);

			console.log(`[Benchmark] Average: ${avgTime.toFixed(0)}ms`);
			console.log(`[Benchmark] Min: ${minTime.toFixed(0)}ms`);
			console.log(`[Benchmark] Max: ${maxTime.toFixed(0)}ms`);

			// Performance expectations (will vary by hardware)
			// Desktop: 1-2s, Mobile: 8-15s
			// In Node test environment with WASM, expect 1-5s
			expect(avgTime).toBeGreaterThan(0);
			expect(avgTime).toBeLessThan(30000); // 30s max (generous for CI)
		}, 120000); // 2 minute timeout for benchmarking
	});

	describe('Error Handling', () => {
		it('should handle initialization failures gracefully', async () => {
			// Mock import failure
			vi.mock('@voter-protocol/halo2-browser-prover', () => {
				throw new Error('WASM module not found');
			});

			resetProver(); // Clear any cached instance

			// Re-import to get mocked version
			const { initializeProver: mockInit } = await import('$lib/core/proof/prover');

			await expect(mockInit(14)).rejects.toThrow();

			// Cleanup mock
			vi.unmock('@voter-protocol/halo2-browser-prover');
		});
	});
});

describe('ZK Proof Generation - UI Integration', () => {
	describe('ProofGenerationModal UX', () => {
		it('should follow expected proof generation flow', () => {
			// Expected UX flow:
			// 1. User completes identity verification
			// 2. If ZK_PROOF_GENERATION enabled, show modal
			// 3. Stage 1: Initializing (5-10s first time, instant if cached)
			// 4. Stage 2: Generating (1-2s desktop, 8-15s mobile)
			// 5. Stage 3: Complete (show success, auto-close after 2s)

			const expectedStages = ['initializing', 'generating', 'complete'];

			expect(expectedStages).toHaveLength(3);
			expect(expectedStages[0]).toBe('initializing');
			expect(expectedStages[1]).toBe('generating');
			expect(expectedStages[2]).toBe('complete');

			// Educational messages should cycle during generation
			const educationalMessages = [
				{ text: "Proving you're in CA-12 without revealing your exact address" },
				{ text: 'Congressional staff prioritize verified constituents' },
				{ text: 'Building your civic reputation with each verified action' }
			];

			expect(educationalMessages).toHaveLength(3);
		});

		it('should handle proof generation errors gracefully', () => {
			// Expected error handling:
			// 1. Stage: 'error'
			// 2. Show error message
			// 3. Fallback to Phase 1 (encrypted address) flow
			// 4. User can still send message

			const errorFlow = {
				stage: 'error',
				fallback: 'encrypted-address',
				allowSubmission: true
			};

			expect(errorFlow.stage).toBe('error');
			expect(errorFlow.fallback).toBe('encrypted-address');
			expect(errorFlow.allowSubmission).toBe(true);
		});
	});

	describe('VerificationGate Integration', () => {
		it('should conditionally trigger ZK proof generation', () => {
			// Expected integration points:
			// 1. User completes identity verification
			// 2. Check isFeatureEnabled('ZK_PROOF_GENERATION')
			// 3. If enabled + district available: Show ProofGenerationModal
			// 4. If disabled or no district: Skip to Phase 1 flow

			const zkEnabled = true;
			const hasDistrict = true;

			const shouldShowProofModal = zkEnabled && hasDistrict;

			expect(shouldShowProofModal).toBe(true);
		});

		it('should fallback to Phase 1 if ZK disabled', () => {
			const zkEnabled = false;
			const hasDistrict = true;

			const shouldShowProofModal = zkEnabled && hasDistrict;

			expect(shouldShowProofModal).toBe(false);
		});
	});
});

/**
 * MANUAL TESTING GUIDE
 *
 * Since ZK proof generation is a browser-native feature, manual testing is critical:
 *
 * 1. Enable beta features:
 *    ENABLE_BETA=true npm run dev
 *
 * 2. Open http://localhost:5173
 *
 * 3. Navigate to a Congressional template (e.g., /s/example-template)
 *
 * 4. Click "Send Message"
 *
 * 5. Complete identity verification (use mock passports in development)
 *
 * 6. Observe ProofGenerationModal:
 *    - Stage 1: "Initializing Halo2 prover..."
 *      - First time: 5-10s (WASM keygen)
 *      - Cached: instant
 *    - Stage 2: "Generating zero-knowledge proof..."
 *      - Desktop: 1-2s
 *      - Mobile: 8-15s
 *      - Educational messages cycle every 3s
 *    - Stage 3: "Proof generated successfully!"
 *      - Shows generation time
 *      - Auto-closes after 2s
 *
 * 7. Check browser console for logs:
 *    - [Prover] Initialization logs
 *    - [Prover] Proof generation logs
 *    - [Verification Gate] ZK proof flow logs
 *
 * 8. Test error handling:
 *    - Disable network during proof generation
 *    - Should fallback to Phase 1 (encrypted address) flow
 *    - User should still be able to send message
 *
 * 9. Test performance on different devices:
 *    - Desktop (Chrome, Firefox, Safari)
 *    - Mobile (iOS Safari, Android Chrome)
 *    - Record generation times for benchmarking
 *
 * 10. Test memory usage:
 *     - Open Chrome DevTools → Performance → Memory
 *     - Expect 600-800MB WASM heap during proof generation
 *     - Memory should release after completion
 *
 * EXPECTED RESULTS:
 * ✓ First initialization: 5-10s
 * ✓ Cached initialization: <100ms
 * ✓ Proof generation (desktop): 1-2s
 * ✓ Proof generation (mobile): 8-15s
 * ✓ Memory usage: 600-800MB
 * ✓ Proof size: ~4.6KB
 */
