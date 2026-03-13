/**
 * Unit Tests: Network aggregation service
 *
 * Tests the cross-org aggregation functions:
 *   getNetworkStats           — aggregate supporter + action stats
 *   getNetworkCampaignReport  — campaign action aggregation
 *   getNetworkSupporterOverlap — dedup analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
	mockMemberFindMany,
	mockSupporterCount,
	mockActionCount,
	mockQueryRaw
} = vi.hoisted(() => ({
	mockMemberFindMany: vi.fn(),
	mockSupporterCount: vi.fn(),
	mockActionCount: vi.fn(),
	mockQueryRaw: vi.fn()
}));

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock('$lib/core/db', () => ({
	db: {
		orgNetworkMember: {
			findMany: (...args: unknown[]) => mockMemberFindMany(...args)
		},
		supporter: {
			count: (...args: unknown[]) => mockSupporterCount(...args)
		},
		campaignAction: {
			count: (...args: unknown[]) => mockActionCount(...args)
		},
		$queryRaw: (...args: unknown[]) => mockQueryRaw(...args)
	}
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import {
	getNetworkStats,
	getNetworkCampaignReport,
	getNetworkSupporterOverlap
} from '../../../src/lib/server/networks/aggregation';

// =============================================================================
// HELPERS
// =============================================================================

const NETWORK_ID = 'net-test-123';

function setupActiveMembers(orgIds: string[]) {
	mockMemberFindMany.mockResolvedValue(
		orgIds.map((orgId) => ({ orgId }))
	);
}

// =============================================================================
// TESTS: getNetworkStats
// =============================================================================

describe('getNetworkStats', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return correct member count', async () => {
		setupActiveMembers(['org-1', 'org-2', 'org-3']);
		mockSupporterCount.mockResolvedValue(150);
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 120n }]) // unique
			.mockResolvedValueOnce([{ count: 80n }]) // verified
			.mockResolvedValueOnce([]); // state distribution
		mockActionCount
			.mockResolvedValueOnce(500) // total actions
			.mockResolvedValueOnce(300); // verified actions

		const stats = await getNetworkStats(NETWORK_ID);

		expect(stats.memberCount).toBe(3);
	});

	it('should de-duplicate supporters by email across orgs', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockSupporterCount.mockResolvedValue(100); // total with duplicates
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 80n }]) // 80 unique by email
			.mockResolvedValueOnce([{ count: 50n }]) // verified
			.mockResolvedValueOnce([]); // state distribution
		mockActionCount
			.mockResolvedValueOnce(200)
			.mockResolvedValueOnce(150);

		const stats = await getNetworkStats(NETWORK_ID);

		expect(stats.totalSupporters).toBe(100);
		expect(stats.uniqueSupporters).toBe(80);
	});

	it('should count verified supporters correctly', async () => {
		setupActiveMembers(['org-1']);
		mockSupporterCount.mockResolvedValue(50);
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 50n }]) // unique
			.mockResolvedValueOnce([{ count: 30n }]) // 30 verified
			.mockResolvedValueOnce([]); // state distribution
		mockActionCount
			.mockResolvedValueOnce(100)
			.mockResolvedValueOnce(75);

		const stats = await getNetworkStats(NETWORK_ID);

		expect(stats.verifiedSupporters).toBe(30);
	});

	it('should return zeros for empty network (no members)', async () => {
		setupActiveMembers([]);

		const stats = await getNetworkStats(NETWORK_ID);

		expect(stats.memberCount).toBe(0);
		expect(stats.totalSupporters).toBe(0);
		expect(stats.uniqueSupporters).toBe(0);
		expect(stats.verifiedSupporters).toBe(0);
		expect(stats.totalCampaignActions).toBe(0);
		expect(stats.verifiedCampaignActions).toBe(0);
		expect(stats.stateDistribution).toEqual({});
	});

	it('should handle single-org network', async () => {
		setupActiveMembers(['org-1']);
		mockSupporterCount.mockResolvedValue(25);
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 25n }]) // all unique (single org)
			.mockResolvedValueOnce([{ count: 10n }]) // verified
			.mockResolvedValueOnce([
				{ region: 'CA', count: 15n },
				{ region: 'NY', count: 10n }
			]); // state distribution
		mockActionCount
			.mockResolvedValueOnce(40)
			.mockResolvedValueOnce(20);

		const stats = await getNetworkStats(NETWORK_ID);

		expect(stats.memberCount).toBe(1);
		expect(stats.totalSupporters).toBe(25);
		expect(stats.uniqueSupporters).toBe(25);
	});

	it('should return state distribution', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockSupporterCount.mockResolvedValue(100);
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 90n }])
			.mockResolvedValueOnce([{ count: 50n }])
			.mockResolvedValueOnce([
				{ region: 'CA', count: 40n },
				{ region: 'NY', count: 30n },
				{ region: 'TX', count: 20n },
				{ region: 'unknown', count: 10n }
			]);
		mockActionCount
			.mockResolvedValueOnce(200)
			.mockResolvedValueOnce(100);

		const stats = await getNetworkStats(NETWORK_ID);

		expect(stats.stateDistribution).toEqual({
			CA: 40,
			NY: 30,
			TX: 20,
			unknown: 10
		});
	});

	it('should count campaign actions (total + verified)', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockSupporterCount.mockResolvedValue(50);
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 45n }])
			.mockResolvedValueOnce([{ count: 20n }])
			.mockResolvedValueOnce([]);
		mockActionCount
			.mockResolvedValueOnce(1000) // total
			.mockResolvedValueOnce(750); // verified

		const stats = await getNetworkStats(NETWORK_ID);

		expect(stats.totalCampaignActions).toBe(1000);
		expect(stats.verifiedCampaignActions).toBe(750);
	});
});

// =============================================================================
// TESTS: getNetworkCampaignReport
// =============================================================================

describe('getNetworkCampaignReport', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should aggregate actions across multiple orgs', async () => {
		setupActiveMembers(['org-1', 'org-2', 'org-3']);
		mockActionCount
			.mockResolvedValueOnce(500) // total
			.mockResolvedValueOnce(350); // verified
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 42n }]) // unique districts
			.mockResolvedValueOnce([ // tier distribution
				{ tier: 0, count: 100n },
				{ tier: 1, count: 200n },
				{ tier: 2, count: 150n }
			])
			.mockResolvedValueOnce([ // state distribution
				{ region: 'CA', count: 200n },
				{ region: 'NY', count: 100n }
			]);

		const report = await getNetworkCampaignReport(NETWORK_ID);

		expect(report.orgCount).toBe(3);
		expect(report.totalActions).toBe(500);
		expect(report.verifiedActions).toBe(350);
	});

	it('should return correct tier distribution grouping', async () => {
		setupActiveMembers(['org-1']);
		mockActionCount
			.mockResolvedValueOnce(300)
			.mockResolvedValueOnce(200);
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 10n }])
			.mockResolvedValueOnce([
				{ tier: 0, count: 50n },
				{ tier: 1, count: 100n },
				{ tier: 2, count: 100n },
				{ tier: 3, count: 50n }
			])
			.mockResolvedValueOnce([]);

		const report = await getNetworkCampaignReport(NETWORK_ID);

		expect(report.tierDistribution).toEqual({
			0: 50,
			1: 100,
			2: 100,
			3: 50
		});
	});

	it('should return correct unique district count', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockActionCount
			.mockResolvedValueOnce(200)
			.mockResolvedValueOnce(150);
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 87n }]) // 87 unique districts
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const report = await getNetworkCampaignReport(NETWORK_ID);

		expect(report.uniqueDistricts).toBe(87);
	});

	it('should return zeros when no campaigns exist', async () => {
		setupActiveMembers([]);

		const report = await getNetworkCampaignReport(NETWORK_ID);

		expect(report.orgCount).toBe(0);
		expect(report.totalActions).toBe(0);
		expect(report.verifiedActions).toBe(0);
		expect(report.uniqueDistricts).toBe(0);
		expect(report.tierDistribution).toEqual({});
		expect(report.stateDistribution).toEqual({});
	});

	it('should have correct verified vs total action counts', async () => {
		setupActiveMembers(['org-1']);
		mockActionCount
			.mockResolvedValueOnce(1000) // total
			.mockResolvedValueOnce(600); // verified (60%)
		mockQueryRaw
			.mockResolvedValueOnce([{ count: 20n }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const report = await getNetworkCampaignReport(NETWORK_ID);

		expect(report.totalActions).toBe(1000);
		expect(report.verifiedActions).toBe(600);
		expect(report.verifiedActions).toBeLessThanOrEqual(report.totalActions);
	});
});

// =============================================================================
// TESTS: getNetworkSupporterOverlap
// =============================================================================

describe('getNetworkSupporterOverlap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should calculate overlap correctly', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockSupporterCount.mockResolvedValue(100); // total across orgs
		mockQueryRaw.mockResolvedValueOnce([{ count: 80n }]); // 80 unique

		const overlap = await getNetworkSupporterOverlap(NETWORK_ID);

		expect(overlap.totalAcrossOrgs).toBe(100);
		expect(overlap.uniqueByEmail).toBe(80);
		expect(overlap.overlapCount).toBe(20); // 100 - 80
		expect(overlap.overlapPercent).toBe(20); // 20/100 * 100
	});

	it('should handle zero overlap case (all unique)', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockSupporterCount.mockResolvedValue(100);
		mockQueryRaw.mockResolvedValueOnce([{ count: 100n }]); // all unique

		const overlap = await getNetworkSupporterOverlap(NETWORK_ID);

		expect(overlap.overlapCount).toBe(0);
		expect(overlap.overlapPercent).toBe(0);
	});

	it('should handle 100% overlap case (all same supporters)', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockSupporterCount.mockResolvedValue(200); // 100 supporters x 2 orgs
		mockQueryRaw.mockResolvedValueOnce([{ count: 100n }]); // only 100 unique

		const overlap = await getNetworkSupporterOverlap(NETWORK_ID);

		expect(overlap.totalAcrossOrgs).toBe(200);
		expect(overlap.uniqueByEmail).toBe(100);
		expect(overlap.overlapCount).toBe(100);
		expect(overlap.overlapPercent).toBe(50); // 100/200 = 50%
	});

	it('should handle zero total supporters (no division by zero)', async () => {
		setupActiveMembers([]);

		const overlap = await getNetworkSupporterOverlap(NETWORK_ID);

		expect(overlap.totalAcrossOrgs).toBe(0);
		expect(overlap.uniqueByEmail).toBe(0);
		expect(overlap.overlapCount).toBe(0);
		expect(overlap.overlapPercent).toBe(0);
	});

	it('should round overlapPercent to 2 decimal places', async () => {
		setupActiveMembers(['org-1', 'org-2']);
		mockSupporterCount.mockResolvedValue(300);
		mockQueryRaw.mockResolvedValueOnce([{ count: 201n }]);

		const overlap = await getNetworkSupporterOverlap(NETWORK_ID);

		// 99 / 300 * 100 = 33.0
		expect(overlap.overlapPercent).toBe(33);
	});
});
