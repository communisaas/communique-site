import { db } from '$lib/core/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();

	const blasts = await db.emailBlast.findMany({
		where: { orgId: org.id },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			subject: true,
			status: true,
			totalRecipients: true,
			totalSent: true,
			totalBounced: true,
			sentAt: true,
			createdAt: true,
			campaignId: true
		}
	});

	// Resolve campaign titles for linked blasts
	const campaignIds = blasts
		.map((b) => b.campaignId)
		.filter((id): id is string => id !== null);

	let campaignMap: Record<string, string> = {};
	if (campaignIds.length > 0) {
		const campaigns = await db.campaign.findMany({
			where: { id: { in: campaignIds } },
			select: { id: true, title: true }
		});
		campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c.title]));
	}

	return {
		blasts: blasts.map((b) => ({
			...b,
			campaignTitle: b.campaignId ? (campaignMap[b.campaignId] ?? null) : null,
			sentAt: b.sentAt?.toISOString() ?? null,
			createdAt: b.createdAt.toISOString()
		}))
	};
};
