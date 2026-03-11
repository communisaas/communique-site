import { db } from '$lib/core/db';
import { Prisma } from '@prisma/client';

/**
 * Email delivery metrics aggregated from EmailBlast records linked to a campaign.
 */
export interface DeliveryMetrics {
	sent: number;
	delivered: number;
	opened: number;
	clicked: number;
	bounced: number;
	complained: number;
	deliveryRate: number; // 0-100
	openRate: number; // 0-100
	clickRate: number; // 0-100
	bounceRate: number; // 0-100
}

/**
 * A single day bucket for the verification timeline.
 */
export interface TimelineBucket {
	day: string; // ISO date (YYYY-MM-DD)
	total: number;
	verified: number;
}

/**
 * A district's action count for the geographic spread display.
 * District hashes are opaque; ordinal labels are assigned client-side.
 */
export interface DistrictBucket {
	districtHash: string;
	count: number;
}

/**
 * Full analytics payload for the campaign detail page.
 */
export interface CampaignAnalytics {
	delivery: DeliveryMetrics;
	timeline: TimelineBucket[];
	topDistricts: DistrictBucket[];
}

function emptyDeliveryMetrics(): DeliveryMetrics {
	return {
		sent: 0, delivered: 0, opened: 0, clicked: 0,
		bounced: 0, complained: 0,
		deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0
	};
}

/**
 * Load email delivery metrics for a campaign.
 * Aggregates from all EmailBlast records linked via campaignId.
 */
async function loadDeliveryMetrics(campaignId: string): Promise<DeliveryMetrics> {
	const agg = await db.emailBlast.aggregate({
		where: { campaignId },
		_sum: {
			totalSent: true,
			totalBounced: true,
			totalOpened: true,
			totalClicked: true,
			totalComplained: true
		}
	});

	const sent = agg._sum.totalSent ?? 0;
	const bounced = agg._sum.totalBounced ?? 0;
	const opened = agg._sum.totalOpened ?? 0;
	const clicked = agg._sum.totalClicked ?? 0;
	const complained = agg._sum.totalComplained ?? 0;
	const delivered = sent - bounced;

	return {
		sent,
		delivered,
		opened,
		clicked,
		bounced,
		complained,
		deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
		openRate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
		clickRate: sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0,
		bounceRate: sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0
	};
}

/**
 * Load verification timeline: daily buckets of total and verified actions.
 */
async function loadVerificationTimeline(campaignId: string): Promise<TimelineBucket[]> {
	const rows = await db.$queryRaw<Array<{ day: Date; total: bigint; verified: bigint }>>`
		SELECT
			date_trunc('day', "sent_at") AS day,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE verified = true) AS verified
		FROM "campaign_action"
		WHERE "campaign_id" = ${campaignId}
		GROUP BY day
		ORDER BY day
	`;

	return rows.map((r) => ({
		day: r.day.toISOString().slice(0, 10),
		total: Number(r.total),
		verified: Number(r.verified)
	}));
}

/** Minimum k-anonymity threshold. Suppress district aggregates below this. */
const K_THRESHOLD = 5;

/**
 * Load top districts by action count for geographic spread display.
 */
async function loadTopDistricts(campaignId: string): Promise<DistrictBucket[]> {
	const groups = await db.campaignAction.groupBy({
		by: ['districtHash'],
		where: { campaignId, districtHash: { not: null } },
		_count: { id: true },
		orderBy: { _count: { id: 'desc' } },
		take: 10
	});

	// Apply k-anonymity: suppress districts with fewer than K_THRESHOLD actions
	return groups
		.filter((g) => g.districtHash && (g._count?.id ?? 0) >= K_THRESHOLD)
		.map((g) => ({
			districtHash: g.districtHash!,
			count: g._count?.id ?? 0
		}));
}

/**
 * Load the full campaign analytics payload.
 * Requires orgId for tenant isolation.
 */
export async function loadCampaignAnalytics(
	campaignId: string,
	orgId: string
): Promise<CampaignAnalytics> {
	// Verify campaign belongs to org
	const campaign = await db.campaign.findFirst({
		where: { id: campaignId, orgId },
		select: { id: true }
	});

	if (!campaign) {
		return {
			delivery: emptyDeliveryMetrics(),
			timeline: [],
			topDistricts: []
		};
	}

	const [delivery, timeline, topDistricts] = await Promise.all([
		loadDeliveryMetrics(campaignId),
		loadVerificationTimeline(campaignId),
		loadTopDistricts(campaignId)
	]);

	return { delivery, timeline, topDistricts };
}
