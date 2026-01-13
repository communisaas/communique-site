/**
 * Analytics Aggregation Integration Tests
 *
 * Tests for the new aggregation-only privacy-preserving analytics system.
 * No surveillance patterns - only aggregate counters with differential privacy.
 */

import { describe, it, expect } from 'vitest';
import { db } from '../setup/api-test-setup';
import { incrementAggregate, processBatch, queryAggregates, getHealthMetrics } from '../../src/lib/core/analytics/aggregate';
import { applyLocalDP, applyLaplace, correctForLDP } from '../../src/lib/core/analytics/noise';
import { coarsenResults, mergeCoarsenedResults } from '../../src/lib/core/analytics/coarsen';
import { sanitizeDimensions, sanitizeJurisdiction, categorizeError } from '../../src/lib/core/analytics/sanitize';
import { METRICS, PRIVACY, isMetric, isDeliveryMethod } from '../../src/lib/types/analytics';

// NOTE: No clearTestDatabase() - tests use unique timestamped IDs for isolation
// Calling clearTestDatabase() in parallel tests causes race conditions (deletes other tests' data)

describe('Analytics Aggregation System', () => {

	describe('Metric Validation', () => {
		it('should validate known metrics', () => {
			expect(isMetric('template_view')).toBe(true);
			expect(isMetric('template_use')).toBe(true);
			expect(isMetric('delivery_success')).toBe(true);
			expect(isMetric('invalid_metric')).toBe(false);
		});

		it('should validate delivery methods', () => {
			expect(isDeliveryMethod('cwc')).toBe(true);
			expect(isDeliveryMethod('email')).toBe(true);
			expect(isDeliveryMethod('invalid')).toBe(false);
		});
	});

	describe('Input Sanitization', () => {
		it('should sanitize dimensions', () => {
			const dirty = {
				template_id: 'tmpl-123',
				jurisdiction: 'CA-12',
				unknown_field: 'should be stripped'
			};
			const clean = sanitizeDimensions(dirty);
			expect(clean.template_id).toBe('tmpl-123');
			// PRIVACY: District stripped → state only
			expect(clean.jurisdiction).toBe('CA');
			expect((clean as Record<string, unknown>).unknown_field).toBeUndefined();
		});

		it('should sanitize jurisdiction to state code only (privacy)', () => {
			// PRIVACY: District identifiers stripped to state only
			expect(sanitizeJurisdiction('CA-12')).toBe('CA');
			expect(sanitizeJurisdiction('CA')).toBe('CA');
			expect(sanitizeJurisdiction('ny')).toBe('NY'); // lowercase normalized
			// US is not a state code
			expect(sanitizeJurisdiction('US')).toBe('US');
			// Invalid formats should be undefined
			expect(sanitizeJurisdiction('<script>')).toBeUndefined();
		});

		it('should categorize errors by type', () => {
			expect(categorizeError(new Error('Network error'))).toBe('error_network');
			expect(categorizeError(new Error('Validation failed'))).toBe('error_validation');
			expect(categorizeError(new Error('Timeout'))).toBe('error_timeout');
			expect(categorizeError(new Error('Random error'))).toBe('error_unknown');
		});
	});

	describe('Differential Privacy - Noise', () => {
		it('should apply Laplace noise within expected bounds', () => {
			const trueCount = 100;
			const results: number[] = [];

			// Run multiple times to verify noise is being applied
			for (let i = 0; i < 100; i++) {
				results.push(applyLaplace(trueCount));
			}

			// With epsilon=1.0 and sensitivity=1, noise should center around 0
			const average = results.reduce((a, b) => a + b, 0) / results.length;
			// Average should be within reasonable bounds of true count
			expect(average).toBeGreaterThan(80);
			expect(average).toBeLessThan(120);

			// Should have variation (not all same value)
			const unique = new Set(results).size;
			expect(unique).toBeGreaterThan(1);
		});

		it('should never return negative counts', () => {
			for (let i = 0; i < 100; i++) {
				const result = applyLaplace(1);
				expect(result).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe('Aggregate Increment', () => {
		it('should increment aggregate counter', async () => {
			const uniqueId = `tmpl-test-${Date.now()}`;
			await incrementAggregate('template_view', { template_id: uniqueId });

			// CRITICAL: Must use UTC midnight to match incrementAggregate's bucketing
			const now = new Date();
			const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

			const record = await db.analytics_aggregate.findFirst({
				where: {
					metric: 'template_view',
					template_id: uniqueId,
					date: todayUTC
				}
			});

			expect(record).not.toBeNull();
			expect(record?.count).toBe(1);
		});

		it('should upsert on multiple increments', async () => {
			// Use unique template ID per test run to avoid cross-test pollution
			const uniqueId = `tmpl-upsert-${Date.now()}`;
			const dimensions = { template_id: uniqueId };

			await incrementAggregate('template_view', dimensions);
			await incrementAggregate('template_view', dimensions);
			await incrementAggregate('template_view', dimensions);

			// CRITICAL: Must use UTC midnight to match incrementAggregate's bucketing
			const now = new Date();
			const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

			const record = await db.analytics_aggregate.findFirst({
				where: {
					metric: 'template_view',
					template_id: uniqueId,
					date: todayUTC
				}
			});

			expect(record?.count).toBe(3);
		});

		it('should process batch of increments', async () => {
			const timestamp = Date.now();
			const increments = [
				{ metric: 'template_view' as const, dimensions: { template_id: `batch-1-${timestamp}` } },
				{ metric: 'template_use' as const, dimensions: { template_id: `batch-2-${timestamp}` } },
				{ metric: 'delivery_success' as const, dimensions: { template_id: `batch-3-${timestamp}` } }
			];

			const result = await processBatch(increments);
			expect(result.processed).toBe(3);
		});
	});

	describe('Geographic Coarsening', () => {
		it('should merge coarsened results to same bucket', () => {
			const results = [
				{ level: 'state' as const, value: 'CA', count: 10, coarsened: true, original_level: 'district' as const },
				{ level: 'state' as const, value: 'CA', count: 5, coarsened: true, original_level: 'district' as const },
				{ level: 'state' as const, value: 'NY', count: 20, coarsened: false }
			];

			const merged = mergeCoarsenedResults(results);

			expect(merged.length).toBe(2);
			const caResult = merged.find(r => r.value === 'CA');
			expect(caResult?.count).toBe(15);
		});
	});

	describe('Privacy Configuration', () => {
		it('should have correct privacy constants', () => {
			expect(PRIVACY.CLIENT_EPSILON).toBe(2.0);
			expect(PRIVACY.SERVER_EPSILON).toBe(1.0);
			expect(PRIVACY.COARSEN_THRESHOLD).toBe(5);
			expect(PRIVACY.MAX_QUERY_DAYS).toBe(90);
			expect(PRIVACY.COHORT_TTL_DAYS).toBe(30);
		});

		it('should have all required metrics defined', () => {
			expect(METRICS.template_view).toBe('template_view');
			expect(METRICS.template_use).toBe('template_use');
			expect(METRICS.delivery_success).toBe('delivery_success');
			expect(METRICS.delivery_fail).toBe('delivery_fail');
			expect(METRICS.auth_start).toBe('auth_start');
			expect(METRICS.auth_complete).toBe('auth_complete');
		});
	});
});
