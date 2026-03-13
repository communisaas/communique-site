/**
 * POST /api/org/[slug]/representatives — Import international representatives.
 * GET  /api/org/[slug]/representatives — List representatives by country + constituency.
 * Requires editor+ role for POST, member+ for GET. Organization+ plan for POST.
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { orgMeetsPlan } from '$lib/server/billing/plan-check';
import { VALID_COUNTRY_CODES } from '$lib/server/geographic/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
	requireRole(membership.role, 'editor');

	const meetsPlan = await orgMeetsPlan(org.id, 'organization');
	if (!meetsPlan) throw error(403, 'International representatives require an Organization plan or higher');

	const body = await request.json();
	const { representatives } = body;

	if (!Array.isArray(representatives) || representatives.length === 0) {
		throw error(400, 'representatives array is required');
	}

	if (representatives.length > 100) {
		throw error(400, 'Maximum 100 representatives per request');
	}

	let imported = 0;

	for (const rep of representatives) {
		if (!rep.countryCode || !rep.constituencyId || !rep.constituencyName || !rep.name) {
			continue; // skip invalid entries
		}

		if (!VALID_COUNTRY_CODES.includes(rep.countryCode)) {
			continue;
		}

		await db.internationalRepresentative.upsert({
			where: {
				countryCode_constituencyId_name: {
					countryCode: rep.countryCode,
					constituencyId: rep.constituencyId,
					name: rep.name
				}
			},
			create: {
				countryCode: rep.countryCode,
				constituencyId: rep.constituencyId,
				constituencyName: rep.constituencyName,
				name: rep.name,
				party: rep.party || null,
				chamber: rep.chamber || null,
				office: rep.office || null,
				phone: rep.phone || null,
				email: rep.email || null,
				websiteUrl: rep.websiteUrl || null,
				photoUrl: rep.photoUrl || null
			},
			update: {
				constituencyName: rep.constituencyName,
				party: rep.party || null,
				chamber: rep.chamber || null,
				office: rep.office || null,
				phone: rep.phone || null,
				email: rep.email || null,
				websiteUrl: rep.websiteUrl || null,
				photoUrl: rep.photoUrl || null
			}
		});

		imported++;
	}

	return json({ success: true, data: { imported } }, { status: 201 });
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	await loadOrgContext(params.slug, locals.user.id);

	const countryCode = url.searchParams.get('country');
	const constituencyId = url.searchParams.get('constituency');
	const cursor = url.searchParams.get('cursor');
	const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);

	const where: Record<string, unknown> = {};
	if (countryCode) where.countryCode = countryCode;
	if (constituencyId) where.constituencyId = constituencyId;

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: [
			{ countryCode: 'asc' as const },
			{ constituencyName: 'asc' as const },
			{ name: 'asc' as const }
		]
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1;
	}

	const reps = await db.internationalRepresentative.findMany(
		findArgs as Parameters<typeof db.internationalRepresentative.findMany>[0]
	);

	const hasMore = reps.length > limit;
	const items = reps.slice(0, limit);
	const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

	return json({
		success: true,
		data: items.map((r) => ({
			id: r.id,
			countryCode: r.countryCode,
			constituencyId: r.constituencyId,
			constituencyName: r.constituencyName,
			name: r.name,
			party: r.party,
			chamber: r.chamber,
			office: r.office,
			phone: r.phone,
			email: r.email,
			websiteUrl: r.websiteUrl,
			photoUrl: r.photoUrl,
			createdAt: r.createdAt.toISOString(),
			updatedAt: r.updatedAt.toISOString()
		})),
		meta: {
			count: items.length,
			cursor: nextCursor,
			hasMore
		}
	});
};
