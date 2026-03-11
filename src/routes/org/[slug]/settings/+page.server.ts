import { db } from '$lib/core/db';
import { getOrgUsage } from '$lib/server/billing/usage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();

	const [subscription, usage, members, invites] = await Promise.all([
		db.subscription.findUnique({ where: { orgId: org.id } }),
		getOrgUsage(org.id),
		db.orgMembership.findMany({
			where: { orgId: org.id },
			include: {
				user: { select: { id: true, name: true, email: true, avatar: true } }
			},
			orderBy: { joinedAt: 'asc' }
		}),
		db.orgInvite.findMany({
			where: { orgId: org.id, accepted: false, expiresAt: { gt: new Date() } },
			orderBy: { expiresAt: 'asc' }
		})
	]);

	return {
		subscription: subscription
			? {
					plan: subscription.plan,
					status: subscription.status,
					priceCents: subscription.price_cents,
					currentPeriodEnd: subscription.current_period_end.toISOString()
				}
			: null,
		usage: {
			verifiedActions: usage.verifiedActions,
			maxVerifiedActions: usage.limits.maxVerifiedActions,
			emailsSent: usage.emailsSent,
			maxEmails: usage.limits.maxEmails
		},
		members: members.map((m) => ({
			id: m.id,
			userId: m.user.id,
			name: m.user.name,
			email: m.user.email,
			avatar: m.user.avatar,
			role: m.role,
			joinedAt: m.joinedAt.toISOString()
		})),
		invites: invites.map((i) => ({
			id: i.id,
			email: i.email,
			role: i.role,
			expiresAt: i.expiresAt.toISOString()
		}))
	};
};
