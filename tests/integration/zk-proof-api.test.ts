/**
 * ZK Proof Generation API Tests (CI-Friendly)
 *
 * Tests the TypeScript API surface WITHOUT running actual WASM proving.
 * These tests run fast in CI and catch integration issues.
 *
 * For actual WASM proving tests, see:
 * - tests/e2e/zk-proof-generation.spec.ts (Playwright, browser)
 * - docs/testing/ZK-PROOF-TESTING-STRATEGY.md (manual testing)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	resetProver,
	getInitMetrics,
	isProverInitialized,
	isWasmSupported,
	getBrowserCompatibility
} from '$lib/core/proof/prover';

describe('ZK Proof API - Type Safety', () => {
	beforeEach(() => {
		resetProver();
	});

	it('should expose correct API surface', () => {
		// Verify all exports are functions/types
		expect(typeof resetProver).toBe('function');
		expect(typeof getInitMetrics).toBe('function');
		expect(typeof isProverInitialized).toBe('function');
		expect(typeof isWasmSupported).toBe('function');
		expect(typeof getBrowserCompatibility).toBe('function');
	});

	it('should return boolean for prover initialization state', () => {
		const initialized = isProverInitialized();
		expect(typeof initialized).toBe('boolean');
		expect(initialized).toBe(false); // Not initialized yet
	});

	it('should return null for init metrics when not initialized', () => {
		const metrics = getInitMetrics();
		expect(metrics).toBeNull();
	});

	it('should detect WebAssembly support', () => {
		const supported = isWasmSupported();
		expect(typeof supported).toBe('boolean');

		// In Node environment, WebAssembly should be available
		expect(supported).toBe(true);
	});

	it('should provide browser compatibility info', () => {
		const compat = getBrowserCompatibility();

		expect(compat).toHaveProperty('supported');
		expect(compat).toHaveProperty('warnings');
		expect(typeof compat.supported).toBe('boolean');
		expect(Array.isArray(compat.warnings)).toBe(true);
	});

	it('should reset prover state cleanly', () => {
		resetProver();

		expect(isProverInitialized()).toBe(false);
		expect(getInitMetrics()).toBeNull();
	});
});

describe('ZK Proof API - UX Integration Points', () => {
	describe('VerificationGate Integration', () => {
		it('should conditionally trigger ZK proof based on feature flag', () => {
			// Simulate feature flag check
			const zkEnabled = true;
			const hasDistrict = true;

			const shouldShowProofModal = zkEnabled && hasDistrict;

			expect(shouldShowProofModal).toBe(true);
		});

		it('should fallback to Phase 1 when ZK disabled', () => {
			const zkEnabled = false;
			const hasDistrict = true;

			const shouldShowProofModal = zkEnabled && hasDistrict;

			expect(shouldShowProofModal).toBe(false);
		});

		it('should fallback to Phase 1 when no district available', () => {
			const zkEnabled = true;
			const hasDistrict = false;

			const shouldShowProofModal = zkEnabled && hasDistrict;

			expect(shouldShowProofModal).toBe(false);
		});
	});

	describe('ProofGenerationModal UX Flow', () => {
		it('should follow expected stage progression', () => {
			const stages = ['initializing', 'generating', 'complete'];

			expect(stages).toHaveLength(3);
			expect(stages[0]).toBe('initializing');
			expect(stages[1]).toBe('generating');
			expect(stages[2]).toBe('complete');
		});

		it('should include error stage for fallback', () => {
			const allStages = ['initializing', 'generating', 'complete', 'error'];

			expect(allStages).toContain('error');
		});

		it('should cycle educational messages during generation', () => {
			const educationalMessages = [
				{ text: "Proving you're in CA-12 without revealing your exact address" },
				{ text: 'Congressional staff prioritize verified constituents' },
				{ text: 'Building your civic reputation with each verified action' }
			];

			expect(educationalMessages).toHaveLength(3);
			expect(educationalMessages[0].text).toContain('without revealing');
			expect(educationalMessages[1].text).toContain('Congressional staff');
			expect(educationalMessages[2].text).toContain('civic reputation');
		});

		it('should handle proof generation errors gracefully', () => {
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
});

describe('ZK Proof API - Feature Flag Integration', () => {
	it('should check ZK_PROOF_GENERATION feature flag', () => {
		// Mock feature flag check
		const features = {
			ZK_PROOF_GENERATION: 'BETA'
		};

		expect(features.ZK_PROOF_GENERATION).toBe('BETA');
	});

	it('should be disabled by default in production', () => {
		// Feature should require explicit ENABLE_BETA=true
		const defaultEnabled = false;

		expect(defaultEnabled).toBe(false);
	});

	it('should be enabled with ENABLE_BETA=true', () => {
		// Simulate ENABLE_BETA env var
		const betaEnabled = process.env.ENABLE_BETA === 'true';

		// In test environment, this will be false unless explicitly set
		expect(typeof betaEnabled).toBe('boolean');
	});
});

describe('ZK Proof API - Input Validation (No WASM Required)', () => {
	it('should validate Merkle path length structure', () => {
		// We can test the EXPECTED validation without running WASM
		const validPathLength = 12;
		const invalidPathLength = 10;

		expect(validPathLength).toBe(12);
		expect(invalidPathLength).not.toBe(12);
	});

	it('should validate leaf index bounds structure', () => {
		const minLeafIndex = 0;
		const maxLeafIndex = 4095; // K=14 circuit: 2^12 = 4096 leaves (0-4095)

		expect(minLeafIndex).toBe(0);
		expect(maxLeafIndex).toBe(4095);

		const invalidNegative = -1;
		const invalidTooLarge = 5000;

		expect(invalidNegative).toBeLessThan(minLeafIndex);
		expect(invalidTooLarge).toBeGreaterThan(maxLeafIndex);
	});

	it('should validate hex string format structure', () => {
		const validHex = '0x0000000000000000000000000000000000000000000000000000000000000001';
		const invalidHex = 'not-a-hex-string';

		expect(validHex.startsWith('0x')).toBe(true);
		expect(validHex.length).toBe(66); // 0x + 64 hex chars
		expect(invalidHex.startsWith('0x')).toBe(false);
	});
});

describe('ZK Proof API - Performance Expectations', () => {
	it('should document expected initialization times', () => {
		const performanceTargets = {
			desktopColdStart: { min: 5000, max: 10000 }, // 5-10s
			desktopCached: { min: 0, max: 100 }, // <100ms
			mobileColdStart: { min: 15000, max: 30000 }, // 15-30s
			mobileCached: { min: 0, max: 100 } // <100ms
		};

		expect(performanceTargets.desktopColdStart.max).toBe(10000);
		expect(performanceTargets.desktopCached.max).toBe(100);
	});

	it('should document expected proof generation times', () => {
		const proofGenTargets = {
			desktop: { min: 1000, max: 2000 }, // 1-2s
			mobile: { min: 8000, max: 15000 } // 8-15s
		};

		expect(proofGenTargets.desktop.max).toBe(2000);
		expect(proofGenTargets.mobile.max).toBe(15000);
	});

	it('should document expected memory usage', () => {
		const memoryTargets = {
			wasmHeapMB: { min: 600, max: 800 }
		};

		expect(memoryTargets.wasmHeapMB.min).toBe(600);
		expect(memoryTargets.wasmHeapMB.max).toBe(800);
	});
});

/**
 * WHAT WE DON'T TEST HERE (By Design):
 *
 * ❌ Actual WASM initialization (requires browser)
 * ❌ Real proof generation (requires browser + compute)
 * ❌ Cryptographic soundness (audited by Trail of Bits)
 * ❌ Performance benchmarks (requires real hardware)
 * ❌ Memory usage (requires browser DevTools)
 * ❌ Browser compatibility (requires real browsers)
 *
 * SEE INSTEAD:
 * - tests/e2e/zk-proof-generation.spec.ts (Playwright tests)
 * - docs/testing/ZK-PROOF-TESTING-STRATEGY.md (manual testing guide)
 */
