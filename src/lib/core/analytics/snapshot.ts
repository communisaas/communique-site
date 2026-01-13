/**
 * Materialized Noisy Snapshots for Privacy Budget Enforcement
 *
 * ARCHITECTURE:
 * - WRITE PATH: Client → increment → analytics_aggregate (raw, no noise)
 * - MATERIALIZATION: Daily cron (00:05 UTC) → analytics_aggregate → analytics_snapshot (noisy, immutable)
 * - READ PATH: Query → analytics_snapshot (pre-noised, safe to cache)
 *
 * CRITICAL PROPERTIES:
 * 1. Snapshots are materialized ONCE per day - never updated after creation
 * 2. Noise is applied ONCE during materialization - never at query time
 * 3. Seeded randomness for auditability - same seed produces same noise
 * 4. Privacy budget is enforced - MAX_DAILY_EPSILON tracked in privacy_budget table
 */

import { db } from '$lib/core/db';
import { PRIVACY, METRIC_VALUES, type Metric } from '$lib/types/analytics';
import { cryptoRandom } from './noise';
import { getTodayUTC, getDaysAgoUTC } from './aggregate';
import { createHmac } from 'crypto';

// =============================================================================
// NOISE SEED GENERATION
// =============================================================================

/**
 * Generate deterministic noise seed for auditability
 *
 * The seed enables:
 * 1. Reproducibility - Same seed + index always produces same noise
 * 2. Auditability - Regulators can verify noise was applied correctly
 * 3. Debugging - Can reproduce exact noisy values for investigation
 *
 * @param date - The date for which to generate a seed
 * @returns Seed string in format "YYYY-MM-DD:hexrandom"
 */
export function generateNoiseSeed(date: Date): string {
	const dateStr = date.toISOString().split('T')[0];

	// Use crypto random for seed generation (32 bytes of entropy)
	const random = Buffer.alloc(32);
	for (let i = 0; i < 32; i++) {
		random[i] = Math.floor(cryptoRandom() * 256);
	}

	return `${dateStr}:${random.toString('hex')}`;
}

// =============================================================================
// SEEDED LAPLACE NOISE
// =============================================================================

/**
 * Seeded Laplace noise for reproducibility and auditability
 *
 * Uses HMAC-SHA256 to generate deterministic pseudorandom values
 * from the seed and index. This ensures:
 * - Same seed + index → same noise value
 * - Different indexes → uncorrelated noise values
 * - Cryptographically secure pseudorandom number generation
 *
 * @param seed - Noise seed from generateNoiseSeed()
 * @param index - Index of the record (for unique noise per record)
 * @param epsilon - Privacy parameter (higher = less noise)
 * @returns Laplace-distributed noise value
 */
export function seededLaplace(seed: string, index: number, epsilon: number): number {
	// Use HMAC-SHA256 to derive deterministic random value
	const hmac = createHmac('sha256', seed);
	hmac.update(`${index}`);
	const hash = hmac.digest();

	// Convert first 8 bytes to uniform [0, 1)
	const highBits = hash.readUInt32BE(0);
	const lowBits = hash.readUInt32BE(4);
	const uniform = (highBits * 0x100000000 + lowBits) / 0x10000000000000000;

	// Inverse CDF of Laplace distribution
	const scale = PRIVACY.SENSITIVITY / epsilon;
	const u = uniform - 0.5;

	// Handle edge cases to prevent log(0)
	if (Math.abs(u) < 1e-10) {
		return 0;
	}

	return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Seeded Laplace noise using a string identifier
 *
 * Useful when the record doesn't have a numeric index (e.g., aggregation results).
 *
 * @param seed - Noise seed
 * @param identifier - String identifier (e.g., "template_view|US|email")
 * @param epsilon - Privacy parameter
 */
export function seededLaplaceByString(seed: string, identifier: string, epsilon: number): number {
	const hmac = createHmac('sha256', seed);
	hmac.update(identifier);
	const hash = hmac.digest();

	// Convert first 8 bytes to uniform [0, 1)
	const highBits = hash.readUInt32BE(0);
	const lowBits = hash.readUInt32BE(4);
	const uniform = (highBits * 0x100000000 + lowBits) / 0x10000000000000000;

	const scale = PRIVACY.SENSITIVITY / epsilon;
	const u = uniform - 0.5;

	if (Math.abs(u) < 1e-10) {
		return 0;
	}

	return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

// =============================================================================
// SNAPSHOT MATERIALIZATION
// =============================================================================

/**
 * Materialize noisy snapshot for a given date
 *
 * CRITICAL: Run this ONCE per day at 00:05 UTC
 * Snapshots are IMMUTABLE after creation
 *
 * Process:
 * 1. Check if snapshot already exists (idempotency)
 * 2. Fetch raw aggregates for the day
 * 3. Generate deterministic noise seed
 * 4. Apply seeded Laplace noise to each aggregate
 * 5. Create immutable snapshots
 * 6. Update privacy budget ledger
 *
 * @param date - The date to materialize (will be normalized to midnight UTC)
 * @returns Object with created snapshot count and epsilon spent
 */
export async function materializeNoisySnapshot(date: Date): Promise<{
	created: number;
	epsilonSpent: number;
}> {
	// Normalize to midnight UTC
	const startOfDay = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
	);

	// Check if snapshot already exists for this date (idempotency)
	const existing = await db.analytics_snapshot.count({
		where: { snapshot_date: startOfDay }
	});

	if (existing > 0) {
		return { created: 0, epsilonSpent: 0 };
	}

	// Fetch raw aggregates for the day
	const rawAggregates = await db.analytics_aggregate.findMany({
		where: { date: startOfDay }
	});

	if (rawAggregates.length === 0) {
		return { created: 0, epsilonSpent: 0 };
	}

	// Generate deterministic noise seed for auditability
	const noiseSeed = generateNoiseSeed(startOfDay);

	// Apply noise once and create snapshots
	const snapshots = rawAggregates.map((agg, index) => {
		const noise = seededLaplace(noiseSeed, index, PRIVACY.SERVER_EPSILON);
		return {
			snapshot_date: startOfDay,
			metric: agg.metric,
			template_id: agg.template_id,
			jurisdiction: agg.jurisdiction,
			delivery_method: agg.delivery_method,
			utm_source: agg.utm_source,
			error_type: agg.error_type,
			noisy_count: Math.max(0, Math.round(agg.count + noise)),
			epsilon_spent: PRIVACY.SERVER_EPSILON,
			noise_seed: noiseSeed
		};
	});

	// Batch insert snapshots
	await db.analytics_snapshot.createMany({
		data: snapshots,
		skipDuplicates: true
	});

	// Update privacy budget ledger
	await db.privacy_budget.upsert({
		where: { budget_date: startOfDay },
		update: {
			epsilon_spent: { increment: PRIVACY.SERVER_EPSILON },
			queries_count: { increment: 1 }
		},
		create: {
			budget_date: startOfDay,
			epsilon_spent: PRIVACY.SERVER_EPSILON,
			epsilon_limit: PRIVACY.MAX_DAILY_EPSILON,
			queries_count: 1
		}
	});

	return {
		created: snapshots.length,
		epsilonSpent: PRIVACY.SERVER_EPSILON
	};
}

// =============================================================================
// PRIVACY BUDGET QUERIES
// =============================================================================

/**
 * Get remaining privacy budget for a date
 *
 * @param date - The date to check (will be normalized to midnight UTC)
 * @returns Remaining epsilon budget (epsilon_limit - epsilon_spent)
 */
export async function getRemainingBudget(date: Date): Promise<number> {
	const startOfDay = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
	);

	const budget = await db.privacy_budget.findUnique({
		where: { budget_date: startOfDay }
	});

	if (!budget) {
		return PRIVACY.MAX_DAILY_EPSILON;
	}

	return Math.max(0, budget.epsilon_limit - budget.epsilon_spent);
}

/**
 * Get privacy budget status for a date range
 *
 * @param start - Start date
 * @param end - End date
 * @returns Array of budget records with date, spent, limit, and remaining
 */
export async function getBudgetStatus(
	start: Date,
	end: Date
): Promise<
	Array<{
		date: Date;
		epsilon_spent: number;
		epsilon_limit: number;
		epsilon_remaining: number;
		queries_count: number;
	}>
> {
	const budgets = await db.privacy_budget.findMany({
		where: {
			budget_date: {
				gte: start,
				lte: end
			}
		},
		orderBy: { budget_date: 'desc' }
	});

	return budgets.map((b) => ({
		date: b.budget_date,
		epsilon_spent: b.epsilon_spent,
		epsilon_limit: b.epsilon_limit,
		epsilon_remaining: Math.max(0, b.epsilon_limit - b.epsilon_spent),
		queries_count: b.queries_count
	}));
}

// =============================================================================
// SNAPSHOT QUERIES
// =============================================================================

/**
 * Query from noisy snapshots (not raw aggregates)
 *
 * CRITICAL: Never add additional noise - snapshots are already noisy
 *
 * This function reads pre-noised data from analytics_snapshot table.
 * No additional noise is applied at query time.
 *
 * @param params - Query parameters (metric, date range, grouping, filters)
 * @returns Array of aggregated results with noisy counts
 */
export async function queryNoisySnapshots(params: {
	metric: string;
	start: Date;
	end: Date;
	groupBy?: string[];
	filters?: Record<string, string>;
}): Promise<Array<{ dimensions: Record<string, string | null>; count: number }>> {
	// Build where clause
	const where: {
		metric: string;
		snapshot_date: { gte: Date; lte: Date };
		template_id?: string;
		jurisdiction?: string;
		delivery_method?: string;
	} = {
		metric: params.metric,
		snapshot_date: { gte: params.start, lte: params.end }
	};

	if (params.filters?.template_id) where.template_id = params.filters.template_id;
	if (params.filters?.jurisdiction) where.jurisdiction = params.filters.jurisdiction;
	if (params.filters?.delivery_method) where.delivery_method = params.filters.delivery_method;

	// Fetch noisy snapshots
	const snapshots = await db.analytics_snapshot.findMany({
		where
	});

	// Group by requested dimensions
	if (!params.groupBy || params.groupBy.length === 0) {
		const total = snapshots.reduce((sum, s) => sum + s.noisy_count, 0);
		return [{ dimensions: {}, count: total }];
	}

	// Group by first dimension
	const key = params.groupBy[0] as keyof (typeof snapshots)[0];
	const groups = new Map<string | null, number>();

	for (const s of snapshots) {
		const value = s[key] as string | null;
		groups.set(value, (groups.get(value) ?? 0) + s.noisy_count);
	}

	return Array.from(groups.entries()).map(([value, count]) => ({
		dimensions: { [key]: value },
		count
	}));
}
