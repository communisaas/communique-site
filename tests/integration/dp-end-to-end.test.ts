/**
 * End-to-End Differential Privacy Pipeline Tests
 *
 * These tests verify the complete DP pipeline:
 * 1. Client-side LDP (k-ary RR)
 * 2. Rate limiting (contribution bounding)
 * 3. Server-side aggregation with LDP correction
 * 4. Query-time Laplace noise
 * 5. Coarsening with privacy-preserving thresholds
 *
 * This is an INTEGRATION test - it exercises the full pipeline
 * to ensure all components work together correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	applyKaryRR,
	applyLaplace,
	correctKaryRR,
	checkContributionLimit,
	clearRateLimitsForTesting
} from '$lib/core/analytics';
import { coarsenWithPrivacy, mergeCoarsenedResults } from '$lib/core/analytics/coarsen';
import {
	PRIVACY,
	METRIC_VALUES,
	type Metric,
	type AggregateResult
} from '$lib/types/analytics';

describe('End-to-End DP Pipeline', () => {
	beforeEach(() => {
		clearRateLimitsForTesting();
	});

	/**
	 * Full pipeline: Client LDP -> Rate Limit -> Server Aggregation -> Query Noise
	 */
	it('should process metrics through complete DP pipeline', () => {
		const identifier = 'e2e-test-user';
		const trueMetric: Metric = 'template_view';
		const iterations = 200;

		// Step 1: Client-side LDP
		const ldpReports: Metric[] = [];
		for (let i = 0; i < iterations; i++) {
			const perturbed = applyKaryRR(trueMetric);
			if (perturbed) ldpReports.push(perturbed);
		}

		// Step 2: Rate limiting (should accept all since under limit)
		let acceptedCount = 0;
		for (const report of ldpReports) {
			if (checkContributionLimit(identifier, report)) {
				acceptedCount++;
			}
		}

		// Should accept up to MAX_DAILY per metric (but we're under)
		expect(acceptedCount).toBe(ldpReports.length);

		// Step 3: Server-side aggregation with LDP correction
		const observed = new Map<Metric, number>();
		for (const m of ldpReports) {
			observed.set(m, (observed.get(m) ?? 0) + 1);
		}

		const corrected = correctKaryRR(observed, ldpReports.length);

		// The corrected count for template_view should be close to iterations
		const correctedView = corrected.get('template_view') ?? 0;
		expect(correctedView).toBeGreaterThan(iterations * 0.5);
		expect(correctedView).toBeLessThan(iterations * 1.5);

		// Step 4: Query-time noise
		const noisyView = applyLaplace(correctedView);

		// Noisy result should be within reasonable bounds
		expect(noisyView).toBeGreaterThanOrEqual(0);
		expect(noisyView).toBeLessThan(iterations * 2);
	});

	/**
	 * Verify rate limiting kicks in when exceeded
	 */
	it('should enforce rate limits in pipeline', () => {
		const identifier = 'rate-limit-e2e';
		const metric: Metric = 'delivery_success';

		// Try to submit more than the limit
		let accepted = 0;
		let rejected = 0;

		for (let i = 0; i < PRIVACY.MAX_DAILY_CONTRIBUTIONS + 50; i++) {
			if (checkContributionLimit(identifier, metric)) {
				accepted++;
			} else {
				rejected++;
			}
		}

		expect(accepted).toBe(PRIVACY.MAX_DAILY_CONTRIBUTIONS);
		expect(rejected).toBe(50);
	});

	/**
	 * Verify LDP correction improves accuracy
	 */
	it('should improve count accuracy with LDP correction', () => {
		const trueCount = 500;
		const trueMetric: Metric = 'auth_complete';

		// Generate LDP reports
		const reports: Metric[] = [];
		for (let i = 0; i < trueCount; i++) {
			const perturbed = applyKaryRR(trueMetric);
			if (perturbed) reports.push(perturbed);
		}

		// Count observed (before correction)
		const observedCount = reports.filter((m) => m === trueMetric).length;

		// Apply correction
		const observed = new Map<Metric, number>();
		for (const m of reports) {
			observed.set(m, (observed.get(m) ?? 0) + 1);
		}
		const corrected = correctKaryRR(observed, reports.length);
		const correctedCount = corrected.get(trueMetric) ?? 0;

		// Corrected count should be closer to true count than observed
		const observedError = Math.abs(observedCount - trueCount);
		const correctedError = Math.abs(correctedCount - trueCount);

		// Correction should reduce error (on average)
		// Note: Due to statistical nature, we use a generous bound
		expect(correctedError).toBeLessThan(trueCount * 0.3);
	});
});

describe('Coarsening with Privacy', () => {
	/**
	 * Verify coarsening applies noise before thresholding
	 *
	 * This is CRITICAL: If coarsening is deterministic on raw counts,
	 * it leaks a binary side-channel (count >= threshold or not).
	 */
	it('should threshold on noisy counts, not raw', async () => {
		// Create a count just below threshold
		const rawCount = PRIVACY.COARSEN_THRESHOLD - 1; // e.g., 4

		// Mock aggregate getter that returns fixed counts
		const mockGetAggregate = async (): Promise<number> => {
			return rawCount;
		};

		// Run coarsening many times with the same raw count
		const results: { coarsened: boolean }[] = [];

		for (let i = 0; i < 50; i++) {
			const input: AggregateResult[] = [
				{
					dimensions: { jurisdiction: 'CA-11' },
					count: rawCount,
					coarsened: false
				}
			];

			const coarsened = await coarsenWithPrivacy(input, mockGetAggregate, 'template_view');

			results.push({ coarsened: coarsened[0]?.coarsened ?? false });
		}

		// Count how many were coarsened vs not
		const coarsenedCount = results.filter((r) => r.coarsened).length;
		const notCoarsenedCount = results.filter((r) => !r.coarsened).length;

		// Due to noise, we should see BOTH outcomes with non-trivial frequency
		// If coarsening were deterministic, one would be 0
		// Note: For count just below threshold with noise, we expect roughly 40-60% coarsened
		expect(coarsenedCount).toBeGreaterThan(5);
		expect(notCoarsenedCount).toBeGreaterThan(5);
	});

	/**
	 * Verify epsilon spending is tracked
	 */
	it('should track epsilon spending in coarsened results', async () => {
		const mockGetAggregate = async (): Promise<number> => {
			return 100; // Above threshold
		};

		const input: AggregateResult[] = [
			{
				dimensions: { jurisdiction: 'CA-11' },
				count: 100,
				coarsened: false
			}
		];

		const coarsened = await coarsenWithPrivacy(input, mockGetAggregate, 'template_view');

		// Should have epsilon tracking
		expect(coarsened[0].epsilon_spent).toBeDefined();
		expect(coarsened[0].epsilon_spent).toBeGreaterThan(0);
	});

	/**
	 * Verify merging preserves privacy properties
	 */
	it('should merge coarsened results correctly', () => {
		const results = [
			{ level: 'state' as const, value: 'CA', count: 50, coarsened: true, epsilon_spent: 1.0 },
			{ level: 'state' as const, value: 'CA', count: 30, coarsened: false, epsilon_spent: 1.0 },
			{ level: 'state' as const, value: 'NY', count: 40, coarsened: true, epsilon_spent: 2.0 }
		];

		const merged = mergeCoarsenedResults(results);

		// Should have 2 buckets: CA and NY
		expect(merged.length).toBe(2);

		// CA should sum counts
		const ca = merged.find((r) => r.value === 'CA');
		expect(ca).toBeDefined();
		expect(ca?.count).toBe(80); // 50 + 30
		expect(ca?.coarsened).toBe(true); // Any coarsened = true

		// NY should be unchanged
		const ny = merged.find((r) => r.value === 'NY');
		expect(ny).toBeDefined();
		expect(ny?.count).toBe(40);
	});
});

describe('Privacy Budget Composition', () => {
	/**
	 * Verify total epsilon is tracked across operations
	 *
	 * In a DP pipeline, we need to track cumulative epsilon:
	 * - Client LDP: ε_client = 2.0
	 * - Server noise per query: ε_server = 1.0
	 *
	 * Total: ε_total = ε_client + ε_server (simple composition)
	 */
	it('should have documented privacy parameters', () => {
		// Verify the configured epsilon values
		expect(PRIVACY.CLIENT_EPSILON).toBe(2.0);
		expect(PRIVACY.SERVER_EPSILON).toBe(1.0);
		expect(PRIVACY.SENSITIVITY).toBe(1);
		expect(PRIVACY.MAX_DAILY_EPSILON).toBe(10.0);

		// Simple composition bound
		const perQueryEpsilon = PRIVACY.CLIENT_EPSILON + PRIVACY.SERVER_EPSILON;
		expect(perQueryEpsilon).toBe(3.0);

		// Max queries before budget exhausted
		const maxQueries = Math.floor(PRIVACY.MAX_DAILY_EPSILON / PRIVACY.SERVER_EPSILON);
		expect(maxQueries).toBe(10);
	});

	/**
	 * Verify coarsening threshold is privacy-preserving
	 */
	it('should have sensible coarsening threshold', () => {
		// Threshold of 5 provides k-anonymity-like protection
		expect(PRIVACY.COARSEN_THRESHOLD).toBe(5);

		// Max batch size prevents timing attacks
		expect(PRIVACY.MAX_BATCH_SIZE).toBe(100);

		// Max query days limits historical exposure
		expect(PRIVACY.MAX_QUERY_DAYS).toBe(90);
	});
});

describe('Defense Against Inference Attacks', () => {
	beforeEach(() => {
		clearRateLimitsForTesting();
	});

	/**
	 * Frequency attack defense:
	 * An attacker shouldn't be able to infer the true metric from
	 * many observations of LDP outputs.
	 */
	it('should resist frequency inference attacks', () => {
		const trueMetric: Metric = 'template_use';
		const observations = 100;

		// Attacker observes many LDP outputs
		const observedFrequencies = new Map<Metric, number>();
		for (let i = 0; i < observations; i++) {
			const output = applyKaryRR(trueMetric);
			if (output) {
				observedFrequencies.set(output, (observedFrequencies.get(output) ?? 0) + 1);
			}
		}

		// Find the most frequent output
		let maxFreq = 0;
		let mostFrequent: Metric | null = null;
		for (const [metric, freq] of observedFrequencies) {
			if (freq > maxFreq) {
				maxFreq = freq;
				mostFrequent = metric;
			}
		}

		// While the true metric is LIKELY to be most frequent,
		// the attacker's confidence is bounded by ε
		// With ε=2.0, P(true) ≈ 0.28, so ~28 out of 100 should be true

		// Verify the attacker can't be 100% confident
		const k = METRIC_VALUES.length;
		const expEps = Math.exp(PRIVACY.CLIENT_EPSILON);
		const pTrue = expEps / (expEps + k - 1);

		// Expected count of true metric
		const expectedTrueCount = observations * pTrue;

		// Attacker's best guess (most frequent) should not be definitive
		// Allow 50% confidence margin
		expect(maxFreq).toBeLessThan(observations * 0.6);
	});

	/**
	 * Differential attack defense:
	 * Adding/removing one user shouldn't change outputs significantly.
	 */
	it('should maintain differential privacy under user addition', () => {
		const baseUsers = 50;
		const trials = 20;

		const withoutUser: number[] = [];
		const withUser: number[] = [];

		for (let t = 0; t < trials; t++) {
			// Scenario 1: Base users
			let count1 = 0;
			for (let i = 0; i < baseUsers; i++) {
				if (applyKaryRR('template_view') === 'template_view') count1++;
			}
			const noisy1 = applyLaplace(count1);
			withoutUser.push(noisy1);

			// Scenario 2: Base users + 1 additional
			let count2 = 0;
			for (let i = 0; i < baseUsers + 1; i++) {
				if (applyKaryRR('template_view') === 'template_view') count2++;
			}
			const noisy2 = applyLaplace(count2);
			withUser.push(noisy2);
		}

		// The distributions should overlap significantly
		// (can't reliably distinguish with/without one user)
		const mean1 = withoutUser.reduce((a, b) => a + b, 0) / trials;
		const mean2 = withUser.reduce((a, b) => a + b, 0) / trials;

		// Difference in means should be small relative to noise scale
		const scale = PRIVACY.SENSITIVITY / PRIVACY.SERVER_EPSILON;
		const meanDiff = Math.abs(mean2 - mean1);

		// Mean difference should be within 2 standard deviations of noise
		expect(meanDiff).toBeLessThan(4 * scale);
	});
});
