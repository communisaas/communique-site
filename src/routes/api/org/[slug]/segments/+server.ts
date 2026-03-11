import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { buildSegmentWhere } from '$lib/server/segments/query-builder';
import { getRateLimiter } from '$lib/core/security/rate-limiter';
import { validateSegmentFilter, type SegmentFilter } from '$lib/types/segment';
import type { RequestHandler } from './$types';

/**
 * GET /api/org/[slug]/segments — List saved segments
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const { org } = await loadOrgContext(params.slug, locals.user.id);

	const segments = await db.segment.findMany({
		where: { orgId: org.id },
		orderBy: { updatedAt: 'desc' },
		select: {
			id: true,
			name: true,
			filters: true,
			createdAt: true,
			updatedAt: true
		}
	});

	return json({ segments });
};

/**
 * POST /api/org/[slug]/segments — Save a named segment or count matches
 * Body: { action: 'count', filters: SegmentFilter }
 *     | { action: 'save', name: string, filters: SegmentFilter }
 *     | { action: 'save', id: string, name: string, filters: SegmentFilter }  (update)
 */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);

	const body = await request.json();
	const action = body.action as string;

	if (action === 'count') {
		const limit = await getRateLimiter().check(
			`ratelimit:segment:count:org:${org.id}`,
			{ maxRequests: 60, windowMs: 60_000 }
		);
		if (!limit.allowed) throw error(429, 'Too many requests');

		const filters = body.filters as SegmentFilter;
		const validationError = validateSegmentFilter(filters);
		if (validationError) {
			throw error(400, validationError);
		}

		const where = buildSegmentWhere(org.id, filters);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const count = await db.supporter.count({ where: where as any });
		return json({ count });
	}

	if (action === 'save') {
		requireRole(membership.role, 'editor');

		const name = body.name?.trim();
		const filters = body.filters as SegmentFilter;

		if (!name || name.length > 100) {
			throw error(400, 'Segment name is required (max 100 chars)');
		}
		const validationError = validateSegmentFilter(filters);
		if (validationError) {
			throw error(400, validationError);
		}

		if (body.id) {
			// Update existing
			const existing = await db.segment.findFirst({
				where: { id: body.id, orgId: org.id }
			});
			if (!existing) throw error(404, 'Segment not found');

			const updated = await db.segment.update({
				where: { id: body.id },
				data: {
					name,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					filters: filters as any
				}
			});
			return json({ segment: updated });
		}

		// Create new
		const segment = await db.segment.create({
			data: {
				orgId: org.id,
				name,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				filters: filters as any,
				createdBy: locals.user.id
			}
		});
		return json({ segment }, { status: 201 });
	}

	throw error(400, 'Invalid action');
};

/**
 * DELETE /api/org/[slug]/segments?id=xxx — Delete a segment
 */
export const DELETE: RequestHandler = async ({ url, params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const segmentId = url.searchParams.get('id');
	if (!segmentId) throw error(400, 'Missing segment id');

	const existing = await db.segment.findFirst({
		where: { id: segmentId, orgId: org.id }
	});
	if (!existing) throw error(404, 'Segment not found');

	await db.segment.delete({ where: { id: segmentId } });
	return json({ ok: true });
};
