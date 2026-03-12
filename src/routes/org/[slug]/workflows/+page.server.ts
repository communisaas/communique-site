import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { FEATURES } from '$lib/config/features';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!FEATURES.AUTOMATION) throw error(404, 'Not found');

	if (!locals.user) throw redirect(302, '/auth/login');

	const org = await db.organization.findUnique({
		where: { slug: params.slug },
		select: { id: true, name: true, slug: true }
	});

	if (!org) throw error(404, 'Organization not found');

	const membership = await db.orgMembership.findUnique({
		where: { orgId_userId: { orgId: org.id, userId: locals.user.id } }
	});

	if (!membership) throw error(403, 'Not a member of this organization');

	const workflows = await db.workflow.findMany({
		where: { orgId: org.id },
		orderBy: { createdAt: 'desc' },
		take: 50,
		include: {
			_count: { select: { executions: true } }
		}
	});

	return {
		org: { name: org.name, slug: org.slug },
		workflows: workflows.map((w) => ({
			id: w.id,
			name: w.name,
			description: w.description,
			trigger: w.trigger as { type: string; tagId?: string; campaignId?: string },
			stepCount: (w.steps as unknown[]).length,
			enabled: w.enabled,
			executionCount: w._count.executions,
			createdAt: w.createdAt.toISOString(),
			updatedAt: w.updatedAt.toISOString()
		}))
	};
};
