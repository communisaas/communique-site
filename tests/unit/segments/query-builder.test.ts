import { describe, it, expect } from 'vitest';
import { buildSegmentWhere } from '$lib/server/segments/query-builder';
import type { SegmentFilter, SegmentCondition } from '$lib/types/segment';

const ORG_ID = 'org_test123';

function makeFilter(logic: 'AND' | 'OR', conditions: SegmentCondition[]): SegmentFilter {
	return { logic, conditions };
}

function cond(
	field: SegmentCondition['field'],
	operator: SegmentCondition['operator'],
	value: SegmentCondition['value']
): SegmentCondition {
	return { id: `cond_${Math.random().toString(36).slice(2)}`, field, operator, value };
}

describe('buildSegmentWhere', () => {
	describe('base behavior', () => {
		it('should always include orgId', () => {
			const result = buildSegmentWhere(ORG_ID, makeFilter('AND', []));
			expect(result).toEqual({ orgId: ORG_ID });
		});

		it('should return only orgId for empty conditions', () => {
			const result = buildSegmentWhere(ORG_ID, makeFilter('OR', []));
			expect(result).toEqual({ orgId: ORG_ID });
		});
	});

	describe('AND logic', () => {
		it('should wrap multiple conditions in AND', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [
					cond('source', 'equals', 'csv'),
					cond('verification', 'equals', 'verified')
				])
			);
			expect(result.orgId).toBe(ORG_ID);
			expect(result.AND).toHaveLength(2);
		});

		it('should wrap single condition in AND', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('source', 'equals', 'csv')])
			);
			expect(result.AND).toHaveLength(1);
		});
	});

	describe('OR logic', () => {
		it('should wrap multiple conditions in OR', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('OR', [
					cond('source', 'equals', 'csv'),
					cond('source', 'equals', 'organic')
				])
			);
			expect(result.orgId).toBe(ORG_ID);
			expect(result.OR).toHaveLength(2);
		});
	});

	describe('tag conditions', () => {
		it('should build includes query for tag', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('tag', 'includes', ['tag1', 'tag2'])])
			);
			expect(result.AND).toEqual([
				{ tags: { some: { tagId: { in: ['tag1', 'tag2'] } } } }
			]);
		});

		it('should build excludes query for tag', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('tag', 'excludes', ['tag1'])])
			);
			expect(result.AND).toEqual([
				{ tags: { none: { tagId: { in: ['tag1'] } } } }
			]);
		});

		it('should handle single tag value wrapped in array', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('tag', 'includes', 'single_tag')])
			);
			expect(result.AND).toEqual([
				{ tags: { some: { tagId: { in: ['single_tag'] } } } }
			]);
		});

		it('should skip empty tag array', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('tag', 'includes', [])])
			);
			expect(result).toEqual({ orgId: ORG_ID });
		});
	});

	describe('verification conditions', () => {
		it('should build query for verified status', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('verification', 'equals', 'verified')])
			);
			expect(result.AND).toEqual([
				{ verified: true, identityCommitment: { not: null } }
			]);
		});

		it('should build query for postal status', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('verification', 'equals', 'postal')])
			);
			expect(result.AND).toEqual([
				{
					postalCode: { not: null },
					OR: [{ verified: false }, { identityCommitment: null }]
				}
			]);
		});

		it('should build query for unverified status', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('verification', 'equals', 'unverified')])
			);
			expect(result.AND).toEqual([
				{
					postalCode: null,
					OR: [{ verified: false }, { identityCommitment: null }]
				}
			]);
		});

		it('should skip unknown verification value', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('verification', 'equals', 'unknown_status')])
			);
			expect(result).toEqual({ orgId: ORG_ID });
		});
	});

	describe('engagementTier conditions', () => {
		it('should build equals query for tier', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('engagementTier', 'equals', 2)])
			);
			expect(result.AND).toEqual([
				{ actions: { some: { engagementTier: 2 } } }
			]);
		});

		it('should build gte query for tier', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('engagementTier', 'gte', 3)])
			);
			expect(result.AND).toEqual([
				{ actions: { some: { engagementTier: { gte: 3 } } } }
			]);
		});

		it('should build lte query for tier', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('engagementTier', 'lte', 1)])
			);
			expect(result.AND).toEqual([
				{ actions: { some: { engagementTier: { lte: 1 } } } }
			]);
		});

		it('should skip invalid tier values (>4)', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('engagementTier', 'equals', 5)])
			);
			expect(result).toEqual({ orgId: ORG_ID });
		});

		it('should skip negative tier values', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('engagementTier', 'equals', -1)])
			);
			expect(result).toEqual({ orgId: ORG_ID });
		});

		it('should skip NaN tier values', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('engagementTier', 'equals', 'not_a_number')])
			);
			expect(result).toEqual({ orgId: ORG_ID });
		});
	});

	describe('source conditions', () => {
		it('should build equals query for source', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('source', 'equals', 'csv')])
			);
			expect(result.AND).toEqual([{ source: 'csv' }]);
		});

		it('should build excludes query for source', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('source', 'excludes', 'organic')])
			);
			expect(result.AND).toEqual([{ source: { not: 'organic' } }]);
		});
	});

	describe('emailStatus conditions', () => {
		it('should build equals query for email status', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('emailStatus', 'equals', 'subscribed')])
			);
			expect(result.AND).toEqual([{ emailStatus: 'subscribed' }]);
		});

		it('should build excludes query for email status', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('emailStatus', 'excludes', 'bounced')])
			);
			expect(result.AND).toEqual([{ emailStatus: { not: 'bounced' } }]);
		});
	});

	describe('dateRange conditions', () => {
		it('should build before query', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('dateRange', 'before', '2026-01-01')])
			);
			const andClauses = result.AND as Array<Record<string, unknown>>;
			expect(andClauses[0].createdAt).toEqual({ lt: new Date('2026-01-01') });
		});

		it('should build after query', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('dateRange', 'after', '2026-01-01')])
			);
			const andClauses = result.AND as Array<Record<string, unknown>>;
			expect(andClauses[0].createdAt).toEqual({ gt: new Date('2026-01-01') });
		});

		it('should build between query with from and to', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [
					cond('dateRange', 'between', { from: '2026-01-01', to: '2026-03-01' })
				])
			);
			const andClauses = result.AND as Array<Record<string, unknown>>;
			expect(andClauses[0].createdAt).toEqual({
				gte: new Date('2026-01-01'),
				lte: new Date('2026-03-01')
			});
		});

		it('should handle between with only from', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('dateRange', 'between', { from: '2026-01-01' })])
			);
			const andClauses = result.AND as Array<Record<string, unknown>>;
			expect(andClauses[0].createdAt).toEqual({ gte: new Date('2026-01-01') });
		});

		it('should skip between with no from or to', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('dateRange', 'between', {})])
			);
			expect(result).toEqual({ orgId: ORG_ID });
		});
	});

	describe('campaignParticipation conditions', () => {
		it('should build participated query', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('campaignParticipation', 'participated', 'camp_123')])
			);
			expect(result.AND).toEqual([
				{ actions: { some: { campaignId: 'camp_123' } } }
			]);
		});

		it('should build notParticipated query', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [cond('campaignParticipation', 'notParticipated', 'camp_123')])
			);
			expect(result.AND).toEqual([
				{ actions: { none: { campaignId: 'camp_123' } } }
			]);
		});
	});

	describe('parameterization (SQL injection prevention)', () => {
		it('should safely handle malicious tag values', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [
					cond('tag', 'includes', ["'; DROP TABLE supporters; --"])
				])
			);
			// Values are passed to Prisma as parameters, not interpolated
			expect(result.AND).toEqual([
				{ tags: { some: { tagId: { in: ["'; DROP TABLE supporters; --"] } } } }
			]);
		});

		it('should safely handle malicious source values', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [
					cond('source', 'equals', "'; DROP TABLE--")
				])
			);
			expect(result.AND).toEqual([{ source: "'; DROP TABLE--" }]);
		});

		it('should safely handle malicious orgId', () => {
			const result = buildSegmentWhere(
				"' OR 1=1; --",
				makeFilter('AND', [])
			);
			expect(result.orgId).toBe("' OR 1=1; --");
		});
	});

	describe('mixed conditions', () => {
		it('should combine multiple different condition types', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [
					cond('tag', 'includes', ['volunteer']),
					cond('verification', 'equals', 'verified'),
					cond('engagementTier', 'gte', 2),
					cond('source', 'equals', 'organic')
				])
			);
			expect(result.orgId).toBe(ORG_ID);
			expect(result.AND).toHaveLength(4);
		});

		it('should skip invalid conditions and keep valid ones', () => {
			const result = buildSegmentWhere(
				ORG_ID,
				makeFilter('AND', [
					cond('source', 'equals', 'csv'),
					cond('engagementTier', 'equals', 99), // invalid tier
					cond('tag', 'includes', []) // empty tags
				])
			);
			expect(result.AND).toHaveLength(1); // only source is valid
		});
	});
});
