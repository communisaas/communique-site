/**
 * POST /api/org/[slug]/sms — Create SMS blast
 * GET  /api/org/[slug]/sms — List SMS blasts
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { orgMeetsPlan } from '$lib/server/billing/plan-check';
import { FEATURES } from '$lib/config/features';
import { SMS_MAX_LENGTH, VALID_BLAST_STATUSES } from '$lib/server/sms/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.SMS) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const meetsPlan = await orgMeetsPlan(org.id, 'starter');
	if (!meetsPlan) throw error(403, 'SMS campaigns require a Starter plan or higher');

	const body = await request.json();
	const { body: smsBody, fromNumber, recipientFilter, campaignId } = body;

	// Validate SMS body
	if (!smsBody || typeof smsBody !== 'string' || smsBody.trim().length === 0) {
		throw error(400, 'SMS body is required');
	}
	if (smsBody.length > SMS_MAX_LENGTH) {
		throw error(400, `SMS body must not exceed ${SMS_MAX_LENGTH} characters`);
	}

	const blast = await db.smsBlast.create({
		data: {
			orgId: org.id,
			body: smsBody.trim(),
			fromNumber: fromNumber || null,
			recipientFilter: recipientFilter || null,
			campaignId: campaignId || null,
			status: 'draft'
		}
	});

	return json(
		{
			id: blast.id,
			body: blast.body,
			fromNumber: blast.fromNumber,
			status: blast.status,
			createdAt: blast.createdAt.toISOString()
		},
		{ status: 201 }
	);
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!FEATURES.SMS) throw error(404, 'Not found');
	if (!locals.user) throw error(401, 'Authentication required');

	const { org } = await loadOrgContext(params.slug, locals.user.id);

	const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100);
	const cursor = url.searchParams.get('cursor') || null;
	const statusFilter = url.searchParams.get('status');

	const where: Record<string, unknown> = { orgId: org.id };
	if (statusFilter && VALID_BLAST_STATUSES.includes(statusFilter as any)) {
		where.status = statusFilter;
	}

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { createdAt: 'desc' as const },
		select: {
			id: true,
			body: true,
			fromNumber: true,
			status: true,
			totalRecipients: true,
			sentCount: true,
			failedCount: true,
			sentAt: true,
			createdAt: true,
			updatedAt: true,
			campaignId: true,
			_count: { select: { messages: true } }
		}
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1;
	}

	const blasts = await db.smsBlast.findMany(findArgs as Parameters<typeof db.smsBlast.findMany>[0]);

	const hasMore = blasts.length > limit;
	const items = blasts.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	return json({
		data: items.map((b) => ({
			...b,
			createdAt: b.createdAt.toISOString(),
			updatedAt: b.updatedAt.toISOString(),
			sentAt: b.sentAt?.toISOString() ?? null
		})),
		meta: { cursor: nextCursor, hasMore }
	});
};
