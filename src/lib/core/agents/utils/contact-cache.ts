/**
 * Contact Cache — Persistent email discovery cache across pipeline runs.
 *
 * Keyed on normalized (orgKey, title) pairs.
 * 14-day TTL with upsert semantics.
 * Fire-and-forget writes — never blocks the pipeline.
 */

import { prisma } from '$lib/core/db';

const CACHE_TTL_DAYS = 14;

/**
 * Normalize an organization name into a stable cache key.
 * "The AFL-CIO" → "afl-cio"
 * "U.S. Senate Committee on Finance" → "us-senate-committee-on-finance"
 */
export function normalizeOrgKey(org: string): string {
	return org
		.toLowerCase()
		.replace(/^the\s+/, '')
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Look up cached contacts for a set of (org, title) pairs.
 * Returns only non-expired entries with matching orgKey + title.
 */
export async function getCachedContacts(
	pairs: Array<{ organization: string; title: string }>
): Promise<
	Array<{
		orgKey: string;
		name: string | null;
		title: string | null;
		email: string | null;
		emailSource: string | null;
	}>
> {
	if (pairs.length === 0) return [];

	const orgKeys = [...new Set(pairs.map((p) => normalizeOrgKey(p.organization)))];

	try {
		const rows = await prisma.resolvedContact.findMany({
			where: {
				orgKey: { in: orgKeys },
				expiresAt: { gt: new Date() }
			}
		});

		// JS-filter for exact (orgKey, title) matches
		const pairSet = new Set(
			pairs.map((p) => `${normalizeOrgKey(p.organization)}::${p.title.toLowerCase()}`)
		);

		return rows
			.filter((r) => r.title && pairSet.has(`${r.orgKey}::${r.title.toLowerCase()}`))
			.map((r) => ({
				orgKey: r.orgKey,
				name: r.name,
				title: r.title,
				email: r.email,
				emailSource: r.emailSource
			}));
	} catch (error) {
		console.warn('[contact-cache] getCachedContacts failed:', error);
		return [];
	}
}

/**
 * Upsert resolved contacts into the cache. Fire-and-forget — never blocks pipeline.
 */
export async function upsertResolvedContacts(
	contacts: Array<{
		organization: string;
		title: string;
		name?: string;
		email?: string;
		emailSource?: string;
	}>
): Promise<void> {
	if (contacts.length === 0) return;

	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

	const results = await Promise.allSettled(
		contacts.map((c) => {
			const orgKey = normalizeOrgKey(c.organization);
			return prisma.resolvedContact.upsert({
				where: {
					orgKey_title: { orgKey, title: c.title }
				},
				create: {
					orgKey,
					name: c.name ?? null,
					title: c.title,
					email: c.email ?? null,
					emailSource: c.emailSource ?? null,
					expiresAt
				},
				update: {
					name: c.name ?? undefined,
					email: c.email ?? undefined,
					emailSource: c.emailSource ?? undefined,
					resolvedAt: new Date(),
					expiresAt
				}
			});
		})
	);

	const failed = results.filter((r) => r.status === 'rejected');
	if (failed.length > 0) {
		console.warn(`[contact-cache] ${failed.length}/${contacts.length} upserts failed`);
	} else {
		console.debug(`[contact-cache] Cached ${contacts.length} contacts (TTL: ${CACHE_TTL_DAYS}d)`);
	}
}
