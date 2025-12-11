/**
 * PERCOLATION ANALYSIS API
 *
 * Network science endpoint for modeling information cascades through civic engagement networks.
 * Uses percolation theory, Edmonds-Karp max flow, and connected component analysis.
 *
 * GET /api/analytics/percolation
 * - Returns cached analysis if fresh (< 5 minutes old)
 * - Otherwise runs fresh analysis
 *
 * POST /api/analytics/percolation
 * - { action: 'refresh' } forces fresh analysis regardless of cache
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import {
	runPercolationAnalysis,
	formatPercolationResponse
} from '$lib/core/server/percolation-engine';
import type { PercolationData } from '$lib/types/analytics';

// In-memory cache for analysis results
// In production, consider Redis or similar for distributed caching
interface CacheEntry {
	data: PercolationData;
	timestamp: number;
}

let analysisCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if cache is fresh
 */
function isCacheFresh(): boolean {
	if (!analysisCache) return false;
	return Date.now() - analysisCache.timestamp < CACHE_TTL_MS;
}

/**
 * Run analysis and update cache
 */
async function runAnalysisWithTiming(): Promise<PercolationData> {
	const startTime = performance.now();

	try {
		const result = await runPercolationAnalysis();
		const processingTimeMs = Math.round(performance.now() - startTime);
		const response = formatPercolationResponse(result, processingTimeMs);

		// Update cache
		analysisCache = {
			data: response,
			timestamp: Date.now()
		};

		return response;
	} catch (error) {
		const processingTimeMs = Math.round(performance.now() - startTime);
		console.error('[Percolation] Analysis error:', error);

		// Return error response that matches PercolationData structure
		return {
			success: false,
			data: {
				interpretation: {
					cascade_status: 'subcritical',
					confidence: 0,
					threshold_distance: 0
				},
				percolation_threshold: 0,
				largest_component_size: 0,
				total_components: 0,
				activation_probability: 0
			},
			processing_time_ms: processingTimeMs
		};
	}
}

/**
 * GET /api/analytics/percolation
 *
 * Returns percolation analysis, using cache if fresh.
 */
export const GET: RequestHandler = async () => {
	// Return cached data if fresh
	if (isCacheFresh() && analysisCache) {
		return json({
			...analysisCache.data,
			cached: true,
			cache_age_ms: Date.now() - analysisCache.timestamp
		});
	}

	// Run fresh analysis
	const result = await runAnalysisWithTiming();
	return json({
		...result,
		cached: false,
		cache_age_ms: 0
	});
};

/**
 * POST /api/analytics/percolation
 *
 * Force refresh analysis or perform other actions.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: { action?: string } = {};

	try {
		body = await request.json();
	} catch {
		// Empty body is fine, default to refresh
		body = { action: 'refresh' };
	}

	if (body.action === 'refresh') {
		// Force fresh analysis
		const result = await runAnalysisWithTiming();
		return json({
			...result,
			cached: false,
			cache_age_ms: 0,
			forced_refresh: true
		});
	}

	// Unknown action
	return json(
		{
			success: false,
			error: 'Unknown action. Supported actions: refresh',
			data: {
				interpretation: {
					cascade_status: 'subcritical' as const,
					confidence: 0,
					threshold_distance: 0
				},
				percolation_threshold: 0,
				largest_component_size: 0,
				total_components: 0,
				activation_probability: 0
			},
			processing_time_ms: 0
		},
		{ status: 400 }
	);
};
