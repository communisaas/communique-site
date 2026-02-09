/**
 * Coordination Metrics Computation (Wave 15d)
 *
 * Computes derived anti-astroturf metrics from subgraph data:
 * - GDS (Geographic Diversity Score) = districtCount / participantCount
 * - ALD (Authority Level Distribution) = weighted average authority
 * - Temporal Entropy = Shannon entropy over hourly submission bins
 * - Velocity = rate of participation change
 *
 * Data source: The Graph subgraph (voter-protocol indexer)
 */

import { env } from '$env/dynamic/private';

const SUBGRAPH_URL =
	env.SUBGRAPH_URL || 'https://api.thegraph.com/subgraphs/name/voter-protocol/district-gate';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
	data: T;
	cachedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
		return entry.data as T;
	}
	return null;
}

function setCache<T>(key: string, data: T): void {
	cache.set(key, { data, cachedAt: Date.now() });
}

async function querySubgraph<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
	const response = await fetch(SUBGRAPH_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, variables })
	});

	if (!response.ok) {
		throw new Error(`Subgraph query failed: ${response.status}`);
	}

	const result = await response.json();
	if (result.errors) {
		throw new Error(`Subgraph error: ${result.errors[0].message}`);
	}

	return result.data as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// METRIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CampaignMetrics {
	campaignId: string;
	participantCount: number;
	districtCount: number;
	gds: number; // Geographic Diversity Score (0-1)
	ald: number; // Average Authority Level (1-5)
	authorityDistribution: Record<number, number>; // level → count
	temporalEntropy: number; // Shannon entropy (0 = all at once, higher = spread out)
	velocity: number; // participations per hour (last 24h)
}

export interface ActionMetrics {
	actionDomain: string;
	participantCount: number;
	districtCount: number;
	authorityDistribution: Record<number, number>;
}

export interface GlobalMetrics {
	totalSubmissions: number;
	activeCampaigns: number;
	totalCampaigns: number;
	averageGds: number;
	totalDistricts: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute Shannon entropy over hourly bins.
 * Higher entropy = more evenly distributed over time (organic).
 * Lower entropy = concentrated in few hours (potentially coordinated).
 */
function computeTemporalEntropy(timestamps: number[]): number {
	if (timestamps.length <= 1) return 0;

	// Bin into hours (last 30 days)
	const hourBins = new Map<number, number>();
	for (const ts of timestamps) {
		const hourBin = Math.floor(ts / 3600);
		hourBins.set(hourBin, (hourBins.get(hourBin) || 0) + 1);
	}

	const total = timestamps.length;
	let entropy = 0;
	for (const count of hourBins.values()) {
		const p = count / total;
		if (p > 0) {
			entropy -= p * Math.log2(p);
		}
	}

	return entropy;
}

/**
 * Get coordination metrics for a specific campaign.
 */
export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
	const cacheKey = `campaign:${campaignId}`;
	const cached = getCached<CampaignMetrics>(cacheKey);
	if (cached) return cached;

	const data = await querySubgraph<{
		campaign: {
			participantCount: string;
			districtCount: string;
			participations: Array<{ timestamp: string; districtRoot: string }>;
		} | null;
		actions: Array<{ authorityLevel: number; timestamp: string }>;
	}>(
		`query CampaignMetrics($campaignId: ID!) {
			campaign(id: $campaignId) {
				participantCount
				districtCount
				participations(first: 1000, orderBy: timestamp, orderDirection: desc) {
					timestamp
					districtRoot
				}
			}
			actions(where: { actionDomain: $campaignId }, first: 1000) {
				authorityLevel
				timestamp
			}
		}`,
		{ campaignId }
	);

	if (!data.campaign) {
		throw new Error(`Campaign not found: ${campaignId}`);
	}

	const participantCount = parseInt(data.campaign.participantCount);
	const districtCount = parseInt(data.campaign.districtCount);

	// GDS: ratio of unique districts to participants
	const gds = participantCount > 0 ? districtCount / participantCount : 0;

	// Authority distribution
	const authorityDistribution: Record<number, number> = {};
	let authoritySum = 0;
	for (const action of data.actions) {
		const level = action.authorityLevel;
		authorityDistribution[level] = (authorityDistribution[level] || 0) + 1;
		authoritySum += level;
	}
	const ald = data.actions.length > 0 ? authoritySum / data.actions.length : 0;

	// Temporal entropy
	const timestamps = data.actions.map((a) => parseInt(a.timestamp));
	const temporalEntropy = computeTemporalEntropy(timestamps);

	// Velocity: participations per hour over last 24h
	const now = Math.floor(Date.now() / 1000);
	const oneDayAgo = now - 86400;
	const recentCount = timestamps.filter((t) => t >= oneDayAgo).length;
	const velocity = recentCount / 24;

	const metrics: CampaignMetrics = {
		campaignId,
		participantCount,
		districtCount,
		gds,
		ald,
		authorityDistribution,
		temporalEntropy,
		velocity
	};

	setCache(cacheKey, metrics);
	return metrics;
}

/**
 * Get metrics for a specific action domain.
 */
export async function getActionMetrics(actionDomain: string): Promise<ActionMetrics> {
	const cacheKey = `action:${actionDomain}`;
	const cached = getCached<ActionMetrics>(cacheKey);
	if (cached) return cached;

	const data = await querySubgraph<{
		actions: Array<{ authorityLevel: number; primaryRoot: string }>;
	}>(
		`query ActionMetrics($domain: Bytes!) {
			actions(where: { actionDomain: $domain }, first: 1000) {
				authorityLevel
				primaryRoot
			}
		}`,
		{ domain: actionDomain }
	);

	const uniqueDistricts = new Set(data.actions.map((a) => a.primaryRoot));
	const authorityDistribution: Record<number, number> = {};
	for (const action of data.actions) {
		const level = action.authorityLevel;
		authorityDistribution[level] = (authorityDistribution[level] || 0) + 1;
	}

	const metrics: ActionMetrics = {
		actionDomain,
		participantCount: data.actions.length,
		districtCount: uniqueDistricts.size,
		authorityDistribution
	};

	setCache(cacheKey, metrics);
	return metrics;
}

/**
 * Get global coordination metrics.
 */
export async function getGlobalMetrics(): Promise<GlobalMetrics> {
	const cacheKey = 'global';
	const cached = getCached<GlobalMetrics>(cacheKey);
	if (cached) return cached;

	const data = await querySubgraph<{
		actions: Array<{ id: string; primaryRoot: string }>;
		campaigns: Array<{ id: string; status: string; districtCount: string; participantCount: string }>;
	}>(
		`{
			actions(first: 1000) {
				id
				primaryRoot
			}
			campaigns(first: 100) {
				id
				status
				districtCount
				participantCount
			}
		}`
	);

	const totalSubmissions = data.actions.length;
	const totalCampaigns = data.campaigns.length;
	const activeCampaigns = data.campaigns.filter((c) => c.status === 'Active').length;
	const totalDistricts = new Set(data.actions.map((a) => a.primaryRoot)).size;

	// Average GDS across campaigns with participants
	const campaignsWithParticipants = data.campaigns.filter(
		(c) => parseInt(c.participantCount) > 0
	);
	const averageGds =
		campaignsWithParticipants.length > 0
			? campaignsWithParticipants.reduce(
					(sum, c) =>
						sum +
						parseInt(c.districtCount) / parseInt(c.participantCount),
					0
				) / campaignsWithParticipants.length
			: 0;

	const metrics: GlobalMetrics = {
		totalSubmissions,
		activeCampaigns,
		totalCampaigns,
		averageGds,
		totalDistricts
	};

	setCache(cacheKey, metrics);
	return metrics;
}
