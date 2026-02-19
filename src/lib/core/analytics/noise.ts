/**
 * Differential Privacy Implementation
 *
 * Two layers:
 * 1. Local DP (client): Randomized response before transmission
 * 2. Central DP (server): Laplace noise on query results
 */

import { PRIVACY, type Metric, type Increment, METRIC_VALUES } from '$lib/types/analytics';

// =============================================================================
// LOCAL DIFFERENTIAL PRIVACY (Client-Side)
// =============================================================================

/**
 * Apply k-ary Randomized Response (proper ε-LDP mechanism)
 *
 * For domain size k=20 and privacy parameter ε=2.0:
 * - P(report true value) = e^ε / (e^ε + k - 1) ≈ 0.28
 * - P(report any OTHER specific value) = 1 / (e^ε + k - 1) ≈ 0.038
 *
 * This satisfies ε-LDP: for any two inputs x, x' and output y:
 * P(M(x) = y) / P(M(x') = y) ≤ e^ε
 *
 * Unlike binary RR (which gives ~235:1 likelihood ratio), this properly
 * bounds the privacy leakage to e^ε ≈ 7.39.
 */
export function applyKaryRR(
	trueMetric: Metric,
	epsilon: number = PRIVACY.CLIENT_EPSILON
): Metric | null {
	const k = METRIC_VALUES.length;
	const expEps = Math.exp(epsilon);

	// Probability of reporting true value
	const pTrue = expEps / (expEps + k - 1);

	const rand = cryptoRandom();

	if (rand < pTrue) {
		return trueMetric; // Report true with probability pTrue
	}

	// Report uniformly random OTHER value
	const otherMetrics = METRIC_VALUES.filter((m: Metric | null) => m !== trueMetric);
	const selectedIndex = Math.floor(cryptoRandom() * otherMetrics.length);
	return otherMetrics[selectedIndex];
}

/**
 * Apply local differential privacy (randomized response)
 *
 * @deprecated Use applyKaryRR directly. This wrapper exists for backward compatibility.
 *
 * IMPORTANT: The old implementation was BROKEN (likelihood ratio ~235:1 for ε=2.0).
 * This now calls applyKaryRR which properly implements k-ary Randomized Response
 * with correct ε-LDP guarantees.
 */
export function applyLocalDP(
	increment: Increment | null,
	enabled: boolean = true
): Increment | null {
	if (!enabled || !increment) return increment;

	const noisyMetric = applyKaryRR(increment.metric, PRIVACY.CLIENT_EPSILON);

	if (noisyMetric === null) {
		return null;
	}

	return {
		metric: noisyMetric,
		dimensions: increment.dimensions
	};
}

// =============================================================================
// CENTRAL DIFFERENTIAL PRIVACY (Server-Side)
// =============================================================================

/**
 * Apply Laplace noise to a count
 *
 * For counting queries with sensitivity=1:
 * noisy_count = true_count + Laplace(0, 1/ε)
 */
export function applyLaplace(trueCount: number, epsilon: number = PRIVACY.SERVER_EPSILON): number {
	const scale = PRIVACY.SENSITIVITY / epsilon;
	const noise = laplaceRandom(scale);

	return Math.max(0, Math.round(trueCount + noise));
}

/**
 * Generate Laplace-distributed random value
 *
 * Laplace(0, scale) distribution
 */
function laplaceRandom(scale: number): number {
	const u = cryptoRandom() - 0.5;
	return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Correct server-side counts for k-ary Randomized Response noise
 *
 * When clients apply k-ary RR, the server can estimate true counts
 * using knowledge of the noise parameters.
 *
 * For k-ary RR:
 * E[reported count for metric x] = pTrue * trueCount(x) + pOther * trueCount(not x)
 *
 * Where:
 * - pTrue = e^ε / (e^ε + k - 1)
 * - pOther = 1 / (e^ε + k - 1)
 * - trueCount(not x) = totalReports - trueCount(x)
 *
 * Solving for trueCount(x):
 * trueCount(x) = (reportedCount - pOther * totalReports) / (pTrue - pOther)
 */
export function correctForLDP(
	reportedCount: number,
	totalReports: number,
	epsilon: number = PRIVACY.CLIENT_EPSILON
): number {
	const k = METRIC_VALUES.length;
	const expEps = Math.exp(epsilon);

	// Probability of reporting true value
	const pTrue = expEps / (expEps + k - 1);

	// Probability of reporting any other specific value
	const pOther = 1 / (expEps + k - 1);

	// Maximum likelihood estimation for k-ary RR
	const estimated = (reportedCount - pOther * totalReports) / (pTrue - pOther);

	return Math.max(0, Math.round(estimated));
}

/**
 * Correct observed counts for k-ary Randomized Response bias (batch version)
 *
 * LDP reports are biased toward uniform distribution due to randomization.
 * This function estimates true counts using maximum likelihood estimation.
 *
 * The debiasing formula for k-ary RR is:
 *   n̂_v = (n_v - n·q) / (p - q)
 *
 * Where:
 * - n_v = observed count for value v
 * - n = total reports
 * - p = e^ε / (e^ε + k - 1) = P(report true value)
 * - q = 1 / (e^ε + k - 1) = P(report each false value)
 *
 * CRITICAL: This is a statistical correction that works on aggregates.
 * Corrected values may be negative (clamped to 0) or exceed total (clamped to total).
 *
 * @param observedCounts - Map of observed metric counts
 * @param totalReports - Total number of reports in batch
 * @param epsilon - Privacy parameter (default: CLIENT_EPSILON)
 * @returns Map of corrected metric counts (clamped to [0, totalReports])
 */
export function correctKaryRR(
	observedCounts: Map<Metric, number>,
	totalReports: number,
	epsilon: number = PRIVACY.CLIENT_EPSILON
): Map<Metric, number> {
	const k = METRIC_VALUES.length;
	const expEps = Math.exp(epsilon);

	const p = expEps / (expEps + k - 1); // P(report true)
	const q = 1 / (expEps + k - 1); // P(report each false)

	const corrected = new Map<Metric, number>();

	for (const metric of METRIC_VALUES) {
		const observed = observedCounts.get(metric) ?? 0;
		// Debiasing formula
		const estimated = (observed - totalReports * q) / (p - q);
		// Clamp to valid range [0, totalReports]
		corrected.set(metric, Math.max(0, Math.min(totalReports, Math.round(estimated))));
	}

	return corrected;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Cryptographically Secure Random Number Generation
 *
 * CRITICAL: Differential privacy requires unpredictable randomness.
 * Math.random() uses a PRNG that can be predicted/reconstructed.
 * We MUST use crypto APIs and fail loudly if unavailable.
 */
export function cryptoRandom(): number {
	// Web Crypto API: works in browsers, CF Workers, and Node.js 19+
	if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
		const array = new Uint32Array(1);
		globalThis.crypto.getRandomValues(array);
		return array[0] / 0x100000000; // Divide by 2^32
	}

	// NO FALLBACK - Fail loudly
	// crypto.getRandomValues is available in all target environments:
	// browsers, Cloudflare Workers, and Node.js 19+.
	throw new Error(
		'[Analytics] Cryptographic randomness unavailable. ' +
			'Differential privacy guarantees cannot be met. ' +
			'Ensure crypto API is available in this environment.'
	);
}

/**
 * Get noise statistics for a given epsilon
 */
export function getNoiseStats(epsilon: number): {
	scale: number;
	expectedAbsNoise: number;
	p95Noise: number;
} {
	const scale = PRIVACY.SENSITIVITY / epsilon;
	return {
		scale,
		expectedAbsNoise: scale, // Mean absolute deviation
		p95Noise: scale * Math.log(20) // 95th percentile
	};
}
