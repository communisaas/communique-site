import { db } from '$lib/core/db';
import { computeOrgVerificationPacket } from '$lib/server/campaigns/verification';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();

	const [supporterCount, campaignCount, templateCount, packet] = await Promise.all([
		db.supporter.count({ where: { orgId: org.id } }),
		db.campaign.count({ where: { orgId: org.id } }),
		db.template.count({ where: { orgId: org.id } }),
		computeOrgVerificationPacket(org.id)
	]);

	const activeCampaignCount = await db.campaign.count({
		where: { orgId: org.id, status: 'ACTIVE' }
	});

	return {
		stats: {
			supporters: supporterCount,
			campaigns: campaignCount,
			templates: templateCount,
			activeCampaigns: activeCampaignCount
		},
		packet
	};
};
