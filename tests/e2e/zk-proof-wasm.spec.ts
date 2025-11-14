/**
 * ZK Proof WASM E2E Test
 *
 * Tests actual WASM proof generation in real browser environment.
 * This replaces the skipped unit tests that couldn't run in Node.
 *
 * What we test:
 * - WASM module loading in browser
 * - Halo2 prover initialization (cold + cached)
 * - Proof generation performance
 * - Browser compatibility
 *
 * Expected performance:
 * - Init time: 5-30s (CI virtualized environment)
 * - Proof generation: 1-15s depending on hardware
 * - Cached init: <100ms
 */

import { test, expect } from '@playwright/test';

test.describe('ZK Proof WASM Generation', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to test page
		await page.goto('/test-zk-proof');

		// Wait for page to load
		await page.waitForLoadState('networkidle');
	});

	test('should support WebAssembly in browser', async ({ page }) => {
		// Check WASM support indicator
		const wasmSupport = page.locator('text=WebAssembly Support:');
		await expect(wasmSupport).toBeVisible();

		// Should show "Supported"
		await expect(page.locator('text=Supported')).toBeVisible({ timeout: 5000 });
	});

	test('should load WASM module successfully', async ({ page }) => {
		// Click "Run Test" button for Test 1
		await page.locator('button:has-text("Run Test")').first().click();

		// Wait for test to complete
		await page.waitForTimeout(2000);

		// Check for success indicator
		const wasmLoaded = page.locator('text=WASM module loaded');
		await expect(wasmLoaded).toBeVisible({ timeout: 10000 });

		// Should not have errors
		const errorSection = page.locator('h2:has-text("Errors")');
		await expect(errorSection).not.toBeVisible();
	});

	test('should initialize prover (cold start)', async ({ page }) => {
		// First load WASM
		await page.locator('button:has-text("Run Test")').first().click();
		await page.waitForTimeout(2000);

		// Then initialize prover
		const initButtons = page.locator('button:has-text("Run Test")');
		await initButtons.nth(1).click();

		// Wait for initialization (can take 5-30s in CI)
		const initTime = page.locator('text=Initialization:').first();
		await expect(initTime).toBeVisible({ timeout: 40000 });

		// Verify performance indicator shows
		const performance = page.locator('text=/Excellent performance|Acceptable performance|Slow performance/');
		await expect(performance).toBeVisible();

		// Should not have errors
		const errorSection = page.locator('h2:has-text("Errors")');
		await expect(errorSection).not.toBeVisible();
	});

	test('should cache prover initialization', async ({ page }) => {
		// Run first 3 tests via "Run All Tests" button
		await page.locator('button:has-text("Run All Tests")').click();

		// Wait for cached init test to complete (should be instant after cold init)
		const cachedTime = page.locator('text=Cached access:');
		await expect(cachedTime).toBeVisible({ timeout: 50000 });

		// Extract cached time and verify it's fast
		const cachedText = await cachedTime.textContent();
		const timeMatch = cachedText?.match(/([\d.]+)ms/);

		if (timeMatch) {
			const time = parseFloat(timeMatch[1]);
			expect(time).toBeLessThan(100); // Should be <100ms
		}
	});

	test('should generate mock proof', async ({ page }) => {
		// Run all tests
		await page.locator('button:has-text("Run All Tests")').click();

		// Wait for proof generation to complete (can take 1-15s)
		const proofGeneration = page.locator('text=Generation:');
		await expect(proofGeneration).toBeVisible({ timeout: 60000 });

		// Verify proof size is shown
		const proofSize = page.locator('text=Proof size:');
		await expect(proofSize).toBeVisible();

		// Extract proof size and verify it's reasonable
		const sizeText = await proofSize.textContent();
		const sizeMatch = sizeText?.match(/(\d+) bytes/);

		if (sizeMatch) {
			const size = parseInt(sizeMatch[1]);
			expect(size).toBeGreaterThan(0);
			expect(size).toBeLessThan(10000); // Should be reasonable size
		}

		// Should not have errors
		const errorSection = page.locator('h2:has-text("Errors")');
		await expect(errorSection).not.toBeVisible();
	});

	test('should run performance benchmark', async ({ page }) => {
		// This test generates 3 proofs sequentially (can take 3-45s)
		test.setTimeout(120000); // 2 minute timeout

		// Run all tests
		await page.locator('button:has-text("Run All Tests")').click();

		// Wait for all 5 tests to complete
		// Benchmark is last, so we wait for average to appear
		const average = page.locator('text=Average:');
		await expect(average).toBeVisible({ timeout: 90000 }); // 1.5 min for all tests

		// Verify all 3 benchmark results are shown
		const proof1 = page.locator('text=Proof 1:');
		const proof2 = page.locator('text=Proof 2:');
		const proof3 = page.locator('text=Proof 3:');

		await expect(proof1).toBeVisible();
		await expect(proof2).toBeVisible();
		await expect(proof3).toBeVisible();

		// Extract average time
		const avgText = await average.textContent();
		const avgMatch = avgText?.match(/(\d+)ms/);

		if (avgMatch) {
			const avgTime = parseInt(avgMatch[1]);
			console.log(`[E2E Test] Average proof generation: ${avgTime}ms`);

			// Should be reasonable (1-30s depending on CI hardware)
			expect(avgTime).toBeGreaterThan(0);
			expect(avgTime).toBeLessThan(30000);
		}

		// Should not have errors
		const errorSection = page.locator('h2:has-text("Errors")');
		await expect(errorSection).not.toBeVisible();
	});

	test('full WASM test suite runs without errors', async ({ page }) => {
		// This test runs all 5 tests including 3-proof benchmark (can take 3-45s)
		test.setTimeout(120000); // 2 minute timeout

		// This is the comprehensive test - run everything
		await page.locator('button:has-text("Run All Tests")').click();

		// Wait for completion (all 5 tests)
		const average = page.locator('text=Average:');
		await expect(average).toBeVisible({ timeout: 90000 });

		// Verify no error section appears
		const errorSection = page.locator('h2:has-text("Errors")');
		await expect(errorSection).not.toBeVisible();

		// Take screenshot on success for debugging
		await page.screenshot({ path: 'tests/e2e/screenshots/zk-proof-success.png', fullPage: true });
	});
});
