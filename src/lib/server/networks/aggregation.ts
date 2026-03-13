/**
 * Cross-org aggregation service for coalition networks.
 *
 * Provides aggregate stats, campaign reports, and supporter overlap
 * analysis across all active member orgs in a network.
 */

import { db } from '$lib/core/db';

export interface NetworkStats {
	memberCount: number;
	totalSupporters: number;
	uniqueSupporters: number;
	verifiedSupporters: number;
	totalCampaignActions: number;
	verifiedCampaignActions: number;
	stateDistribution: Record<string, number>;
}

export interface NetworkCampaignReport {
	orgCount: number;
	totalActions: number;
	verifiedActions: number;
	uniqueDistricts: number;
	tierDistribution: Record<number, number>;
	stateDistribution: Record<string, number>;
}

export interface NetworkOverlap {
	totalAcrossOrgs: number;
	uniqueByEmail: number;
	overlapCount: number;
	overlapPercent: number;
}

/** Get active member org IDs for a network. */
async function getActiveMemberOrgIds(networkId: string): Promise<string[]> {
	const members = await db.orgNetworkMember.findMany({
		where: { networkId, status: 'active' },
		select: { orgId: true }
	});
	return members.map((m) => m.orgId);
}

/**
 * Aggregate stats across all active member orgs in a network.
 */
export async function getNetworkStats(networkId: string): Promise<NetworkStats> {
	const orgIds = await getActiveMemberOrgIds(networkId);
	if (orgIds.length === 0) {
		return {
			memberCount: 0,
			totalSupporters: 0,
			uniqueSupporters: 0,
			verifiedSupporters: 0,
			totalCampaignActions: 0,
			verifiedCampaignActions: 0,
			stateDistribution: {}
		};
	}

	const [
		totalSupporters,
		uniqueResult,
		verifiedResult,
		totalActions,
		verifiedActions,
		stateRows
	] = await Promise.all([
		// Total supporters (with duplicates across orgs)
		db.supporter.count({
			where: { orgId: { in: orgIds } }
		}),

		// Unique supporters by email
		db.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(DISTINCT email) as count
			FROM supporter
			WHERE org_id = ANY(${orgIds})
		`,

		// Verified supporters: have identity_commitment or have a verified campaign action
		db.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(DISTINCT s.id) as count
			FROM supporter s
			WHERE s.org_id = ANY(${orgIds})
			AND (
				s.identity_commitment IS NOT NULL
				OR EXISTS (
					SELECT 1 FROM campaign_action ca
					JOIN campaign c ON ca.campaign_id = c.id
					WHERE ca.supporter_id = s.id AND ca.verified = true AND c.org_id = ANY(${orgIds})
				)
			)
		`,

		// Total campaign actions
		db.campaignAction.count({
			where: { campaign: { orgId: { in: orgIds } } }
		}),

		// Verified campaign actions
		db.campaignAction.count({
			where: { campaign: { orgId: { in: orgIds } }, verified: true }
		}),

		// State distribution by postal code prefix (first 2 chars) or country
		db.$queryRaw<{ region: string; count: bigint }[]>`
			SELECT
				COALESCE(LEFT(postal_code, 2), country, 'unknown') as region,
				COUNT(*) as count
			FROM supporter
			WHERE org_id = ANY(${orgIds})
			GROUP BY region
			ORDER BY count DESC
		`
	]);

	const stateDistribution: Record<string, number> = {};
	for (const row of stateRows) {
		stateDistribution[row.region] = Number(row.count);
	}

	return {
		memberCount: orgIds.length,
		totalSupporters,
		uniqueSupporters: Number(uniqueResult[0]?.count ?? 0),
		verifiedSupporters: Number(verifiedResult[0]?.count ?? 0),
		totalCampaignActions: totalActions,
		verifiedCampaignActions: verifiedActions,
		stateDistribution
	};
}

/**
 * Aggregate campaign report across all active member orgs.
 */
export async function getNetworkCampaignReport(networkId: string): Promise<NetworkCampaignReport> {
	const orgIds = await getActiveMemberOrgIds(networkId);
	if (orgIds.length === 0) {
		return {
			orgCount: 0,
			totalActions: 0,
			verifiedActions: 0,
			uniqueDistricts: 0,
			tierDistribution: {},
			stateDistribution: {}
		};
	}

	const [totalActions, verifiedActions, districtResult, tierRows, stateRows] = await Promise.all([
		// Total campaign actions
		db.campaignAction.count({
			where: { campaign: { orgId: { in: orgIds } } }
		}),

		// Verified campaign actions
		db.campaignAction.count({
			where: { campaign: { orgId: { in: orgIds } }, verified: true }
		}),

		// Unique districts
		db.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(DISTINCT ca.district_hash) as count
			FROM campaign_action ca
			JOIN campaign c ON ca.campaign_id = c.id
			WHERE c.org_id = ANY(${orgIds})
			AND ca.district_hash IS NOT NULL
		`,

		// Tier distribution
		db.$queryRaw<{ tier: number; count: bigint }[]>`
			SELECT ca.engagement_tier as tier, COUNT(*) as count
			FROM campaign_action ca
			JOIN campaign c ON ca.campaign_id = c.id
			WHERE c.org_id = ANY(${orgIds})
			GROUP BY ca.engagement_tier
			ORDER BY ca.engagement_tier
		`,

		// State distribution by district hash prefix (first 2 chars)
		db.$queryRaw<{ region: string; count: bigint }[]>`
			SELECT
				COALESCE(LEFT(ca.district_hash, 2), 'unknown') as region,
				COUNT(*) as count
			FROM campaign_action ca
			JOIN campaign c ON ca.campaign_id = c.id
			WHERE c.org_id = ANY(${orgIds})
			AND ca.district_hash IS NOT NULL
			GROUP BY region
			ORDER BY count DESC
		`
	]);

	const tierDistribution: Record<number, number> = {};
	for (const row of tierRows) {
		tierDistribution[row.tier] = Number(row.count);
	}

	const stateDistribution: Record<string, number> = {};
	for (const row of stateRows) {
		stateDistribution[row.region] = Number(row.count);
	}

	return {
		orgCount: orgIds.length,
		totalActions,
		verifiedActions,
		uniqueDistricts: Number(districtResult[0]?.count ?? 0),
		tierDistribution,
		stateDistribution
	};
}

/**
 * Calculate supporter overlap across member orgs in a network.
 */
export async function getNetworkSupporterOverlap(networkId: string): Promise<NetworkOverlap> {
	const orgIds = await getActiveMemberOrgIds(networkId);
	if (orgIds.length === 0) {
		return {
			totalAcrossOrgs: 0,
			uniqueByEmail: 0,
			overlapCount: 0,
			overlapPercent: 0
		};
	}

	const [totalResult, uniqueResult] = await Promise.all([
		db.supporter.count({
			where: { orgId: { in: orgIds } }
		}),
		db.$queryRaw<[{ count: bigint }]>`
			SELECT COUNT(DISTINCT email) as count
			FROM supporter
			WHERE org_id = ANY(${orgIds})
		`
	]);

	const total = totalResult;
	const unique = Number(uniqueResult[0]?.count ?? 0);
	const overlapCount = total - unique;
	const overlapPercent = total > 0 ? (overlapCount / total) * 100 : 0;

	return {
		totalAcrossOrgs: total,
		uniqueByEmail: unique,
		overlapCount,
		overlapPercent: Math.round(overlapPercent * 100) / 100
	};
}
