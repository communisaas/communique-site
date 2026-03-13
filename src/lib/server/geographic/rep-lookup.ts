/**
 * International representative lookup service.
 *
 * Routes to the correct data source based on country code:
 * - US: Shadow Atlas officials
 * - GB/CA/AU: InternationalRepresentative table
 */

import { db } from '$lib/core/db';
import type { CountryCode, InternationalRepresentativeData } from './types';
import { SUPPORTED_RESOLVER_COUNTRIES } from './types';

export interface RepresentativeResult {
	id: string;
	name: string;
	party: string | null;
	chamber: string | null;
	office: string | null;
	phone: string | null;
	email: string | null;
	websiteUrl: string | null;
	countryCode: string;
	constituencyId: string;
	constituencyName: string;
}

/**
 * Look up representatives for a given country + district.
 *
 * For US, delegates to Shadow Atlas getOfficials().
 * For international countries, queries the InternationalRepresentative table.
 */
export async function lookupRepresentatives(
	countryCode: string,
	districtId: string
): Promise<RepresentativeResult[]> {
	const code = countryCode.toUpperCase() as CountryCode;

	if (!SUPPORTED_RESOLVER_COUNTRIES.includes(code)) {
		return [];
	}

	if (code === 'US') {
		return lookupUSRepresentatives(districtId);
	}

	return lookupInternationalRepresentatives(code, districtId);
}

/**
 * US representative lookup via Shadow Atlas.
 */
async function lookupUSRepresentatives(districtCode: string): Promise<RepresentativeResult[]> {
	try {
		const { getOfficials } = await import('$lib/core/shadow-atlas/client');
		const officials = await getOfficials(districtCode);

		if (!officials.officials || officials.officials.length === 0) {
			return [];
		}

		return officials.officials.map((o) => ({
			id: `us-${districtCode}-${o.bioguide_id || o.name}`.toLowerCase().replace(/\s+/g, '-'),
			name: o.name,
			party: o.party ?? null,
			chamber: o.chamber ?? null,
			office: o.office ?? null,
			phone: o.phone ?? null,
			email: null,
			websiteUrl: o.website_url ?? null,
			countryCode: 'US',
			constituencyId: districtCode,
			constituencyName: officials.district_code
		}));
	} catch (err) {
		console.error('[rep-lookup] US lookup failed:', err instanceof Error ? err.message : err);
		return [];
	}
}

/**
 * International representative lookup from the database.
 */
async function lookupInternationalRepresentatives(
	countryCode: CountryCode,
	constituencyId: string
): Promise<RepresentativeResult[]> {
	const reps = await db.internationalRepresentative.findMany({
		where: {
			countryCode,
			constituencyId
		}
	});

	return reps.map((r): RepresentativeResult => ({
		id: r.id,
		name: r.name,
		party: r.party,
		chamber: r.chamber,
		office: r.office,
		phone: r.phone,
		email: r.email,
		websiteUrl: r.websiteUrl,
		countryCode: r.countryCode,
		constituencyId: r.constituencyId,
		constituencyName: r.constituencyName
	}));
}

/**
 * List all representatives for a country, optionally filtered by constituency.
 */
export async function listRepresentatives(
	countryCode: string,
	constituencyId?: string,
	cursor?: string | null,
	limit = 50
): Promise<{ data: InternationalRepresentativeData[]; nextCursor: string | null; hasMore: boolean }> {
	const where: Record<string, unknown> = { countryCode: countryCode.toUpperCase() };
	if (constituencyId) where.constituencyId = constituencyId;

	const findArgs: Record<string, unknown> = {
		where,
		take: limit + 1,
		orderBy: { name: 'asc' as const }
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

	const data: InternationalRepresentativeData[] = items.map((r) => ({
		id: r.id,
		countryCode: r.countryCode as CountryCode,
		constituencyId: r.constituencyId,
		constituencyName: r.constituencyName,
		name: r.name,
		party: r.party,
		chamber: r.chamber,
		office: r.office,
		phone: r.phone,
		email: r.email,
		websiteUrl: r.websiteUrl
	}));

	return { data, nextCursor, hasMore };
}
