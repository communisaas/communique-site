/**
 * POST /api/org/[slug]/networks/[networkId]/invite — Invite an org to the network
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext } from '$lib/server/org';
import { FEATURES } from '$lib/config/features';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const InviteSchema = z.object({
	orgSlug: z.string().min(1, 'orgSlug is required')
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.NETWORKS) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org } = await loadOrgContext(params.slug, locals.user.id);

	// Verify requesting org is admin in the network
	const callerMembership = await db.orgNetworkMember.findUnique({
		where: {
			networkId_orgId: { networkId: params.networkId, orgId: org.id }
		}
	});
	if (!callerMembership || callerMembership.status !== 'active' || callerMembership.role !== 'admin') {
		throw error(403, 'Network admin role required');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const parsed = InviteSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
	}

	const { orgSlug } = parsed.data;

	// Find target org
	const targetOrg = await db.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true }
	});
	if (!targetOrg) throw error(404, 'Organization not found');

	// Check not already a member
	const existing = await db.orgNetworkMember.findUnique({
		where: {
			networkId_orgId: { networkId: params.networkId, orgId: targetOrg.id }
		}
	});
	if (existing && existing.status !== 'removed') {
		throw error(409, 'Organization is already a member or has a pending invitation');
	}

	// Create or re-activate membership as pending
	let member;
	if (existing && existing.status === 'removed') {
		member = await db.orgNetworkMember.update({
			where: { id: existing.id },
			data: {
				status: 'pending',
				role: 'member',
				invitedBy: locals.user.id,
				joinedAt: new Date()
			}
		});
	} else {
		member = await db.orgNetworkMember.create({
			data: {
				networkId: params.networkId,
				orgId: targetOrg.id,
				role: 'member',
				status: 'pending',
				invitedBy: locals.user.id
			}
		});
	}

	return json({
		data: {
			id: member.id,
			networkId: member.networkId,
			orgId: member.orgId,
			status: member.status,
			joinedAt: member.joinedAt.toISOString()
		}
	}, { status: 201 });
};
