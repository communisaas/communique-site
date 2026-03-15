import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { resolveAddress } from '$lib/core/shadow-atlas/client';

/**
 * POST /api/location/resolve-address
 *
 * Authenticated proxy to Shadow Atlas's self-hosted address resolution.
 * All geocoding, district lookup, and officials resolution happens server-side
 * in Shadow Atlas (Nominatim + R-tree + SQLite). Zero external government API calls.
 *
 * PRIVACY:
 * - Logs NOTHING about the address itself.
 * - Only logs success/failure + district code (neighborhood-level, not PII).
 */

const addressSchema = z.object({
	street: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	state: z.string().length(2),
	zip: z.string().regex(/^\d{5}(-\d{4})?$|^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/),
	country: z.enum(['US', 'CA']).optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	// ---- Auth ----
	if (!locals.user) {
		return json({ resolved: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const body = await request.json();

		// ---- Validate input ----
		const parseResult = addressSchema.safeParse(body);
		if (!parseResult.success) {
			return json(
				{
					resolved: false,
					error: 'Invalid request',
					details: parseResult.error.issues.map((i) => i.message)
				},
				{ status: 400 }
			);
		}

		const { street, city, state, zip, country } = parseResult.data;

		// ================================================================
		// Shadow Atlas (fully sovereign — zero external calls)
		// ================================================================
		const result = await resolveAddress({ street, city, state, zip, country });

		// Extract district code from Shadow Atlas response
		const districtCode = result.officials?.district_code ?? null;
		const stateCode = result.officials?.state ?? state.toUpperCase();

		// Privacy: log only district code, never address
		console.info(`[resolve-address] Resolved via Shadow Atlas district=${districtCode}`);

		return json({
			resolved: true,
			address: {
				matched: result.geocode.matched_address,
				...parseMatchedAddress(result.geocode.matched_address)
			},
			coordinates: {
				lat: result.geocode.lat,
				lng: result.geocode.lng
			},
			district: districtCode
				? {
						code: districtCode,
						name: result.district?.name ?? `Congressional District`,
						state: stateCode
					}
				: null,
			officials: result.officials?.officials.map((o) => ({
				name: o.name,
				office: o.office,
				chamber: o.chamber,
				party: o.party,
				state: o.state,
				district:
					o.chamber === 'senate'
						? o.state
						: `${o.state}-${o.district ?? ''}`,
				bioguide_id: o.bioguide_id,
				is_voting_member: o.is_voting,
				delegate_type: o.delegate_type,
				phone: o.phone ?? undefined,
				office_code: o.cwc_code ?? undefined
			})) ?? [],
			special_status: result.officials?.special_status ?? null,
			cell_id: result.cell_id,
			zk_eligible: result.cell_id != null,
			county_fips: null
		});
	} catch (error) {
		console.error(
			'[resolve-address] Unhandled error:',
			error instanceof Error ? error.message : 'Unknown error'
		);
		return json(
			{
				resolved: false,
				error: 'Address resolution service temporarily unavailable'
			},
			{ status: 500 }
		);
	}
};

/**
 * Parse matched address into components.
 * Works with Nominatim display_name format and comma-separated address strings.
 */
function parseMatchedAddress(matched: string): {
	street: string;
	city: string;
	state: string;
	zip: string;
} {
	const parts = matched.split(', ');
	return {
		street: parts[0] || '',
		city: parts[1] || '',
		state: parts[2] || '',
		zip: parts[3] || ''
	};
}
