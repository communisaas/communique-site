import { error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { FEATURES } from '$lib/config/features';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	if (!FEATURES.NETWORKS) throw error(404, 'Not found');

	const { org, membership } = await parent();

	const [memberships, subscription] = await Promise.all([
		db.orgNetworkMember.findMany({
			where: { orgId: org.id, status: { in: ['active', 'pending'] } },
			include: {
				network: {
					include: {
						ownerOrg: { select: { id: true, name: true, slug: true } },
						_count: { select: { members: { where: { status: 'active' } } } }
					}
				}
			},
			orderBy: { joinedAt: 'desc' }
		}),
		db.subscription.findUnique({ where: { orgId: org.id } })
	]);

	return {
		networks: memberships.map((m) => ({
			id: m.network.id,
			name: m.network.name,
			slug: m.network.slug,
			description: m.network.description,
			status: m.network.status,
			role: m.role,
			membershipStatus: m.status,
			memberCount: m.network._count.members,
			ownerOrg: m.network.ownerOrg,
			isOwner: m.network.ownerOrgId === org.id,
			joinedAt: m.joinedAt.toISOString()
		})),
		canCreate: subscription?.plan === 'coalition' && membership.role === 'owner'
	};
};
