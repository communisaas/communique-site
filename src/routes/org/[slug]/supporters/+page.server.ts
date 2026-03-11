import { db } from '$lib/core/db';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ parent, url }) => {
	const { org } = await parent();

	// Parse filter params
	const q = url.searchParams.get('q')?.trim() || '';
	const status = url.searchParams.get('status') || '';
	const verified = url.searchParams.get('verified') || '';
	const tagId = url.searchParams.get('tag') || '';
	const source = url.searchParams.get('source') || '';
	const cursor = url.searchParams.get('cursor') || '';

	// Build where clause
	const where: Record<string, unknown> = { orgId: org.id };

	if (q) {
		where.OR = [
			{ email: { contains: q, mode: 'insensitive' } },
			{ name: { contains: q, mode: 'insensitive' } }
		];
	}

	if (status && ['subscribed', 'unsubscribed', 'bounced', 'complained'].includes(status)) {
		where.emailStatus = status;
	}

	if (verified === 'true') {
		where.verified = true;
	} else if (verified === 'false') {
		where.verified = false;
	}

	if (source && ['csv', 'action_network', 'organic', 'widget'].includes(source)) {
		where.source = source;
	}

	if (tagId) {
		where.tags = { some: { tagId } };
	}

	// Cursor-based pagination
	const findArgs: Record<string, unknown> = {
		where,
		take: PAGE_SIZE + 1, // fetch one extra to determine hasMore
		orderBy: { createdAt: 'desc' as const },
		include: {
			tags: {
				include: {
					tag: { select: { id: true, name: true } }
				}
			}
		}
	};

	if (cursor) {
		findArgs.cursor = { id: cursor };
		findArgs.skip = 1; // skip the cursor item itself
	}

	const [rawSupporters, total, verifiedCount, postalCount, tags, statusCounts, campaigns] =
		await Promise.all([
			db.supporter.findMany(findArgs as Parameters<typeof db.supporter.findMany>[0]) as Promise<Array<Awaited<ReturnType<typeof db.supporter.findFirst>> & { tags: Array<{ tag: { id: string; name: string } }> }>>,
			db.supporter.count({ where }),
			db.supporter.count({
				where: {
					orgId: org.id,
					verified: true,
					identityCommitment: { not: null }
				}
			}),
			db.supporter.count({
				where: {
					orgId: org.id,
					postalCode: { not: null },
					OR: [{ verified: false }, { identityCommitment: null }]
				}
			}),
			db.tag.findMany({
				where: { orgId: org.id },
				select: { id: true, name: true },
				orderBy: { name: 'asc' }
			}),
			db.supporter.groupBy({
				by: ['emailStatus'],
				where: { orgId: org.id },
				_count: { id: true }
			}),
			db.campaign.findMany({
				where: { orgId: org.id },
				select: { id: true, title: true },
				orderBy: { updatedAt: 'desc' }
			})
		]);

	const hasMore = rawSupporters.length > PAGE_SIZE;
	const supporters = rawSupporters.slice(0, PAGE_SIZE).map((s) => ({
		id: s.id,
		email: s.email,
		name: s.name,
		postalCode: s.postalCode,
		country: s.country,
		phone: s.phone,
		identityCommitment: s.identityCommitment,
		verified: s.verified,
		emailStatus: s.emailStatus,
		source: s.source,
		createdAt: s.createdAt.toISOString(),
		tags: s.tags.map((st: { tag: { id: string; name: string } }) => ({
			id: st.tag.id,
			name: st.tag.name
		}))
	}));

	const nextCursor = hasMore ? supporters[supporters.length - 1]?.id ?? null : null;

	// Imported = total in org minus verified minus postal-resolved
	const totalInOrg = statusCounts.reduce((sum, row) => sum + row._count.id, 0);
	const importedCount = totalInOrg - verifiedCount - postalCount;

	return {
		supporters,
		total,
		hasMore,
		nextCursor,
		tags,
		campaigns,
		summary: {
			verified: verifiedCount,
			postal: postalCount,
			imported: importedCount
		},
		filters: { q, status, verified, tagId, source }
	};
};
