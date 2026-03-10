import { db } from '$lib/core/db';
import { computeOrgVerificationPacket } from '$lib/server/campaigns/verification';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();

	const [supporterCount, campaignCount, templateCount, packet, endorsedTemplates] = await Promise.all([
		db.supporter.count({ where: { orgId: org.id } }),
		db.campaign.count({ where: { orgId: org.id } }),
		db.template.count({ where: { orgId: org.id } }),
		computeOrgVerificationPacket(org.id),
		db.templateEndorsement.findMany({
			where: { orgId: org.id },
			include: {
				template: {
					select: {
						id: true, slug: true, title: true, description: true,
						verified_sends: true, unique_districts: true
					}
				}
			},
			orderBy: { endorsedAt: 'desc' }
		})
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
		packet,
		endorsedTemplates: endorsedTemplates.map(e => ({
			id: e.id,
			templateId: e.template.id,
			slug: e.template.slug,
			title: e.template.title,
			description: e.template.description,
			sends: e.template.verified_sends,
			districts: e.template.unique_districts,
			endorsedAt: e.endorsedAt.toISOString()
		}))
	};
};
