import { db } from '$lib/core/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();

	const [campaigns, statusCounts] = await Promise.all([
		db.campaign.findMany({
			where: { orgId: org.id },
			orderBy: { updatedAt: 'desc' },
			select: {
				id: true,
				title: true,
				type: true,
				status: true,
				body: true,
				templateId: true,
				debateEnabled: true,
				debateThreshold: true,
				updatedAt: true
			}
		}),
		db.campaign.groupBy({
			by: ['status'],
			where: { orgId: org.id },
			_count: { id: true }
		})
	]);

	// Resolve template titles for campaigns that have templateId
	const templateIds = campaigns
		.map((c) => c.templateId)
		.filter((id): id is string => id !== null);

	let templateMap: Record<string, string> = {};
	if (templateIds.length > 0) {
		const templates = await db.template.findMany({
			where: { id: { in: templateIds } },
			select: { id: true, title: true }
		});
		templateMap = Object.fromEntries(templates.map((t) => [t.id, t.title]));
	}

	// Build status count map
	const counts: Record<string, number> = { ALL: 0, DRAFT: 0, ACTIVE: 0, PAUSED: 0, COMPLETE: 0 };
	for (const row of statusCounts) {
		counts[row.status] = row._count.id;
		counts.ALL += row._count.id;
	}

	return {
		campaigns: campaigns.map((c) => ({
			...c,
			templateTitle: c.templateId ? (templateMap[c.templateId] ?? null) : null,
			updatedAt: c.updatedAt.toISOString()
		})),
		counts
	};
};
