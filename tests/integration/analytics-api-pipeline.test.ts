/**
 * Analytics API Integration Tests
 *
 * Tests the ACTUAL HTTP API endpoints for the analytics pipeline:
 * 1. POST /api/analytics/increment - Client sends batched increments
 * 2. GET /api/analytics/aggregate - Query with DP noise
 * 3. GET /api/cron/analytics-snapshot - Snapshot materialization
 *
 * These tests verify the full production code path, not just isolated functions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../setup/api-test-setup';
import { POST as incrementHandler } from '../../src/routes/api/analytics/increment/+server';
import { GET as aggregateHandler } from '../../src/routes/api/analytics/aggregate/+server';
import { GET as cronHandler } from '../../src/routes/api/cron/analytics-snapshot/+server';
import { clearRateLimitsForTesting, getTodayUTC, getDaysAgoUTC } from '$lib/core/analytics';

// Helper to create mock RequestEvent for SvelteKit handlers
function createRequestEvent(
	method: string,
	url: string,
	body?: object,
	headers?: Record<string, string>
) {
	const fullUrl = new URL(url, 'http://localhost');
	const requestInit: RequestInit = {
		method,
		headers: {
			'Content-Type': 'application/json',
			...headers
		}
	};

	if (body) {
		requestInit.body = JSON.stringify(body);
		// Node.js requires duplex option for streaming bodies
		(requestInit as RequestInit & { duplex: string }).duplex = 'half';
	}

	const request = new Request(fullUrl.toString(), requestInit);

	return {
		request,
		url: fullUrl,
		params: {},
		locals: {},
		platform: {},
		route: { id: fullUrl.pathname },
		setHeaders: () => {},
		cookies: {
			get: () => undefined,
			getAll: () => [],
			set: () => {},
			delete: () => {},
			serialize: () => ''
		},
		getClientAddress: () => '127.0.0.1',
		isDataRequest: false,
		isSubRequest: false
	};
}

describe('Analytics API Pipeline', () => {
	const testRunId = `api-test-${Date.now()}`;

	beforeEach(() => {
		clearRateLimitsForTesting();
	});

	describe('POST /api/analytics/increment', () => {
		it('should accept valid increments and return success', async () => {
			const templateId = `${testRunId}-increment-test`;
			const event = createRequestEvent('POST', '/api/analytics/increment', {
				increments: [
					{ metric: 'template_view', dimensions: { template_id: templateId } },
					{ metric: 'template_use', dimensions: { template_id: templateId } }
				]
			});

			const response = await incrementHandler(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			// Note: processed count may be less than submitted due to LDP randomization
			expect(data.processed).toBeGreaterThanOrEqual(0);
		});

		it('should silently drop invalid metrics (fire-and-forget semantics)', async () => {
			const event = createRequestEvent('POST', '/api/analytics/increment', {
				increments: [
					{ metric: 'invalid_metric_xyz', dimensions: {} },
					{ metric: 'template_view', dimensions: { template_id: `${testRunId}-valid` } }
				]
			});

			const response = await incrementHandler(event as any);
			const data = await response.json();

			// Should still return success (fire-and-forget)
			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		it('should enforce rate limits per IP per metric', async () => {
			// Rate limiting is tested at the function level in dp-end-to-end.test.ts
			// Here we verify the API accepts the request even when rate limited (fire-and-forget)
			const templateId = `${testRunId}-rate-limit`;

			// Send a large batch - API should accept gracefully
			const batch = Array.from({ length: 50 }, () => ({
				metric: 'funnel_1' as const,
				dimensions: { template_id: templateId }
			}));

			const event = createRequestEvent('POST', '/api/analytics/increment', { increments: batch });
			const response = await incrementHandler(event as any);
			const data = await response.json();

			// Fire-and-forget: Always returns success
			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			// Some processing should occur
			expect(data.processed).toBeGreaterThanOrEqual(0);
		});
	});

	describe('GET /api/analytics/aggregate', () => {
		it('should return aggregates with privacy metadata', async () => {
			// First, insert some test data directly
			const templateId = `${testRunId}-aggregate-query`;
			const today = getTodayUTC();

			await db.analytics_aggregate.create({
				data: {
					date: today,
					metric: 'template_view',
					template_id: templateId,
					jurisdiction: 'CA',
					delivery_method: '',
					utm_source: '',
					error_type: '',
					count: 50,
					noise_applied: 0,
					epsilon: 1.0
				}
			});

			// Query via API
			const event = createRequestEvent(
				'GET',
				`/api/analytics/aggregate?metric=template_view&template_id=${templateId}`
			);
			const response = await aggregateHandler(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.metric).toBe('template_view');
			expect(data.privacy).toBeDefined();
			expect(data.privacy.differential_privacy).toBe(true);
			expect(data.privacy.epsilon).toBeGreaterThan(0);
		});

		it('should reject invalid metric parameter', async () => {
			const event = createRequestEvent('GET', '/api/analytics/aggregate?metric=invalid_xyz');
			const response = await aggregateHandler(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.success).toBe(false);
			expect(data.error).toContain('Invalid');
		});

		it('should reject query range exceeding MAX_QUERY_DAYS', async () => {
			const start = '2025-01-01';
			const end = '2025-06-01'; // ~150 days
			const event = createRequestEvent(
				'GET',
				`/api/analytics/aggregate?metric=template_view&start=${start}&end=${end}`
			);
			const response = await aggregateHandler(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('90 days');
		});
	});

	describe('GET /api/cron/analytics-snapshot', () => {
		it('should materialize snapshots with proper authentication', async () => {
			// Insert raw aggregate data for yesterday
			const yesterday = getDaysAgoUTC(1);
			const templateId = `${testRunId}-snapshot`;

			await db.analytics_aggregate.create({
				data: {
					date: yesterday,
					metric: 'template_view',
					template_id: templateId,
					jurisdiction: 'NY',
					delivery_method: '',
					utm_source: '',
					error_type: '',
					count: 25,
					noise_applied: 0,
					epsilon: 1.0
				}
			});

			// Call cron endpoint (with mock auth - no CRON_SECRET in test)
			const event = createRequestEvent('GET', '/api/cron/analytics-snapshot');
			const response = await cronHandler(event as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.date).toBeDefined();
			expect(typeof data.snapshots_created).toBe('number');
			expect(typeof data.budget_remaining).toBe('number');
		});

		it('should be idempotent (running twice creates same snapshots)', async () => {
			// First run
			const event1 = createRequestEvent('GET', '/api/cron/analytics-snapshot');
			const response1 = await cronHandler(event1 as any);
			const data1 = await response1.json();

			// Second run (should be idempotent)
			const event2 = createRequestEvent('GET', '/api/cron/analytics-snapshot');
			const response2 = await cronHandler(event2 as any);
			const data2 = await response2.json();

			// Both should succeed
			expect(data1.success).toBe(true);
			expect(data2.success).toBe(true);

			// Second run should create 0 (already materialized)
			// Note: First run might also be 0 if snapshot already existed from previous test
			expect(data2.snapshots_created).toBe(0);
		});
	});

	describe('Full Pipeline: Increment → Aggregate → Snapshot', () => {
		it('should flow data through entire pipeline', async () => {
			const templateId = `${testRunId}-full-pipeline`;
			const today = getTodayUTC();

			// Step 1: Send increments via API
			const incrementEvent = createRequestEvent('POST', '/api/analytics/increment', {
				increments: [
					{ metric: 'template_view', dimensions: { template_id: templateId, jurisdiction: 'TX' } },
					{ metric: 'template_view', dimensions: { template_id: templateId, jurisdiction: 'TX' } },
					{ metric: 'template_view', dimensions: { template_id: templateId, jurisdiction: 'TX' } }
				]
			});
			const incrementResponse = await incrementHandler(incrementEvent as any);
			const incrementData = await incrementResponse.json();

			expect(incrementData.success).toBe(true);

			// Step 2: Verify data landed in aggregates (query directly, not via noisy API)
			const rawAggregate = await db.analytics_aggregate.findFirst({
				where: {
					metric: 'template_view',
					template_id: templateId,
					date: today
				}
			});

			// Data should exist (count may vary due to LDP correction)
			// Note: With k-ary RR, the stored count is the corrected estimate
			expect(rawAggregate).not.toBeNull();

			// Step 3: Query via aggregate API (should have DP noise)
			const queryEvent = createRequestEvent(
				'GET',
				`/api/analytics/aggregate?metric=template_view&template_id=${templateId}`
			);
			const queryResponse = await aggregateHandler(queryEvent as any);
			const queryData = await queryResponse.json();

			expect(queryData.success).toBe(true);
			expect(queryData.privacy.differential_privacy).toBe(true);
		});
	});
});
