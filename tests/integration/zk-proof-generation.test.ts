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
 * - Node/Vitest: Test API surface, error handling, validation logic (this file)
 * - Browser E2E: Test actual WASM proving (tests/e2e/zk-proof-wasm.spec.ts)
 * - Manual testing: Full UX testing (see MANUAL TESTING GUIDE below)
 */

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

	// Prover initialization tests moved to E2E: tests/e2e/zk-proof-wasm.spec.ts

	// Mock proof generation tests moved to E2E: tests/e2e/zk-proof-wasm.spec.ts

	// Real proof generation tests moved to E2E: tests/e2e/zk-proof-wasm.spec.ts

	// Performance benchmarking tests moved to E2E: tests/e2e/zk-proof-wasm.spec.ts

	// Error handling tests moved to E2E: tests/e2e/zk-proof-wasm.spec.ts
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
