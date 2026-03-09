import { error } from '@sveltejs/kit';
import { db } from '$lib/core/db';

export type OrgRole = 'owner' | 'editor' | 'member';

export interface OrgContext {
	org: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		avatar: string | null;
		max_seats: number;
		max_templates_month: number;
		dm_cache_ttl_days: number;
		identity_commitment: string | null;
		wallet_address: string | null;
		createdAt: Date;
	};
	membership: {
		role: OrgRole;
		joinedAt: Date;
	};
}

/**
 * Load org context for the current user.
 * Throws 404 if org not found, 403 if user is not a member.
 */
export async function loadOrgContext(slug: string, userId: string): Promise<OrgContext> {
	const org = await db.organization.findUnique({
		where: { slug },
		include: {
			memberships: {
				where: { userId },
				select: { role: true, joinedAt: true }
			}
		}
	});

	if (!org) {
		throw error(404, 'Organization not found');
	}

	const membership = org.memberships[0];
	if (!membership) {
		throw error(403, 'You are not a member of this organization');
	}

	return {
		org: {
			id: org.id,
			name: org.name,
			slug: org.slug,
			description: org.description,
			avatar: org.avatar,
			max_seats: org.max_seats,
			max_templates_month: org.max_templates_month,
			dm_cache_ttl_days: org.dm_cache_ttl_days,
			identity_commitment: org.identity_commitment,
			wallet_address: org.wallet_address,
			createdAt: org.createdAt
		},
		membership: {
			role: membership.role as OrgRole,
			joinedAt: membership.joinedAt
		}
	};
}

/**
 * Require a minimum role level. Throws 403 if insufficient.
 * Hierarchy: owner > editor > member
 */
export function requireRole(current: OrgRole, minimum: OrgRole): void {
	const hierarchy: Record<OrgRole, number> = { member: 0, editor: 1, owner: 2 };
	if (hierarchy[current] < hierarchy[minimum]) {
		throw error(403, `Requires ${minimum} role or higher`);
	}
}
