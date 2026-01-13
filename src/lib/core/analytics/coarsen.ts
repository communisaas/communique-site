/**
 * Privacy-Safe Geographic Coarsening
 *
 * CRITICAL: Apply noise BEFORE making coarsening decisions.
 *
 * The old approach leaked a binary side-channel:
 * - Seeing "CA-12" revealed raw count ≥ 5
 * - Seeing "California" revealed raw count < 5
 *
 * The new approach:
 * 1. Apply Laplace noise to count FIRST
 * 2. Make coarsening decision on NOISY count
 * 3. If coarsened, fetch aggregate at coarser level and apply FRESH noise
 *
 * This ensures the coarsening decision itself doesn't leak information.
 */

import { applyLaplace } from './noise';
import {
	PRIVACY,
	type CoarsenLevel,
	type CoarsenResult,
	type AggregateResult,
	COARSEN_LEVELS,
	parseJurisdiction
} from '$lib/types/analytics';

/**
 * Detect jurisdiction level from string format
 */
function detectLevel(jurisdiction: string): CoarsenLevel {
	if (jurisdiction.includes('-')) return 'district';
	if (jurisdiction.length === 2) return 'state';
	if (jurisdiction === 'US') return 'national';
	return 'region';
}

/**
 * Privacy-Safe Coarsening with Noise-First Thresholding
 *
 * @param results - Raw aggregate results from database
 * @param getAggregateAtLevel - Function to fetch aggregate at coarser level
 * @param metric - Metric name (for aggregate lookups)
 * @param epsilon - Privacy budget per noise application (default: SERVER_EPSILON)
 * @returns Coarsened results with noisy counts
 */
export async function coarsenWithPrivacy(
	results: AggregateResult[],
	getAggregateAtLevel: (metric: string, level: CoarsenLevel, value: string) => Promise<number>,
	metric: string,
	epsilon: number = PRIVACY.SERVER_EPSILON
): Promise<CoarsenResult[]> {
	const coarsened: CoarsenResult[] = [];

	for (const result of results) {
		const jurisdiction = result.dimensions.jurisdiction;

		if (!jurisdiction || jurisdiction === '') {
			// No jurisdiction - treat as national
			const noisyCount = applyLaplace(result.count, epsilon);
			coarsened.push({
				level: 'national',
				value: 'US',
				count: noisyCount,
				coarsened: false,
				epsilon_spent: epsilon
			});
			continue;
		}

		const originalLevel = detectLevel(jurisdiction);

		// CRITICAL: Apply noise FIRST to the original count
		const noisyCount = applyLaplace(result.count, epsilon);

		// Threshold on NOISY count (not raw count)
		if (noisyCount >= PRIVACY.COARSEN_THRESHOLD) {
			// Above threshold - no coarsening needed
			coarsened.push({
				level: originalLevel,
				value: jurisdiction,
				count: noisyCount,
				coarsened: false,
				epsilon_spent: epsilon
			});
			continue;
		}

		// Below threshold - must walk up the hierarchy
		const coarsenResult = await findSufficientLevelWithNoise(
			jurisdiction,
			originalLevel,
			getAggregateAtLevel,
			metric,
			epsilon
		);
		coarsened.push(coarsenResult);
	}

	return coarsened;
}

/**
 * Walk up jurisdiction hierarchy until we find sufficient noisy count
 *
 * CRITICAL: Apply FRESH noise at each level (independent randomness).
 */
async function findSufficientLevelWithNoise(
	jurisdiction: string,
	originalLevel: CoarsenLevel,
	getAggregateAtLevel: (metric: string, level: CoarsenLevel, value: string) => Promise<number>,
	metric: string,
	epsilon: number
): Promise<CoarsenResult> {
	const hierarchy = parseJurisdiction(jurisdiction);

	// Try each coarser level in order
	const levels: CoarsenLevel[] = ['state', 'region', 'national'];

	for (const level of levels) {
		// Skip if not coarser than original
		const originalIndex = COARSEN_LEVELS.indexOf(originalLevel);
		const currentIndex = COARSEN_LEVELS.indexOf(level);
		if (currentIndex <= originalIndex) {
			continue;
		}

		// Get value at this level from hierarchy
		let value: string;
		if (level === 'state') {
			value = hierarchy.state;
		} else if (level === 'region') {
			value = hierarchy.region;
		} else {
			value = 'US';
		}

		// Skip if hierarchy doesn't have this level
		if (!value || value === 'XX' || value === 'Unknown') {
			continue;
		}

		// Get aggregate at coarser level
		const coarseCount = await getAggregateAtLevel(metric, level, value);

		// Apply FRESH noise (different from original)
		const noisyCoarseCount = applyLaplace(coarseCount, epsilon);

		if (noisyCoarseCount >= PRIVACY.COARSEN_THRESHOLD) {
			return {
				level,
				value,
				count: noisyCoarseCount,
				coarsened: true,
				original_level: originalLevel,
				epsilon_spent: epsilon * 2 // Two noise applications
			};
		}
	}

	// Fallback to national with whatever count we have
	const nationalCount = await getAggregateAtLevel(metric, 'national', 'US');
	const noisyNational = applyLaplace(nationalCount, epsilon);

	return {
		level: 'national',
		value: 'US',
		count: noisyNational,
		coarsened: true,
		original_level: originalLevel,
		epsilon_spent: epsilon * 2
	};
}

/**
 * Merge results that coarsened to the same bucket
 *
 * When multiple fine-grained results coarsen to the same region,
 * we sum their noisy counts (already noisy, no additional noise).
 */
export function mergeCoarsenedResults(results: CoarsenResult[]): CoarsenResult[] {
	const merged = new Map<string, CoarsenResult>();

	for (const result of results) {
		const key = `${result.level}:${result.value}`;
		const existing = merged.get(key);

		if (existing) {
			// Sum counts (already noisy)
			existing.count += result.count;
			// Mark as coarsened if any were coarsened
			existing.coarsened = existing.coarsened || result.coarsened;
			// Track maximum epsilon spent
			existing.epsilon_spent = Math.max(existing.epsilon_spent ?? 0, result.epsilon_spent ?? 0);
		} else {
			merged.set(key, { ...result });
		}
	}

	return Array.from(merged.values());
}

/**
 * Get coarsening metadata for API response
 */
export function getCoarseningMetadata(results: CoarsenResult[]): {
	any_coarsened: boolean;
	levels_used: CoarsenLevel[];
	total_epsilon: number;
} {
	const levels = new Set<CoarsenLevel>();
	let totalEpsilon = 0;
	let anyCoarsened = false;

	for (const result of results) {
		levels.add(result.level);
		totalEpsilon += result.epsilon_spent ?? PRIVACY.SERVER_EPSILON;
		if (result.coarsened) anyCoarsened = true;
	}

	return {
		any_coarsened: anyCoarsened,
		levels_used: Array.from(levels),
		total_epsilon: totalEpsilon
	};
}

// Legacy export for backward compatibility
export const coarsenResults = coarsenWithPrivacy;
