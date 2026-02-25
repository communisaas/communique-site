import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { lookupDistrict, getOfficials, resolveLocation } from '$lib/core/shadow-atlas/client';

/**
 * POST /api/location/resolve
 *
 * Unified coordinate → district resolution endpoint.
 *
 * Architecture:
 *   1. Census Bureau (coordinates → block GEOID / cell_id)
 *   2. Shadow Atlas (cell_id → 24-slot district array + Merkle proof + officials)
 *
 * The client sends ONLY coordinates. This endpoint handles all external calls
 * server-side — Census Bureau for cell_id, Shadow Atlas for everything else.
 *
 * PRIVACY:
 * - Accepts COORDINATES only — never addresses.
 * - Rejects requests containing address-like fields.
 * - Never logs cell_id values.
 * - Does NOT update trust_tier or any user database record.
 */

const resolveSchema = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180),
	signal_type: z.enum(['browser', 'verified']),
	confidence: z.number().min(0).max(1),
	cell_id: z.string().regex(/^\d{11,15}$/).optional(),
	district_code: z.string().regex(/^[A-Z]{2}-(\d{2}|AL|00)$/).optional(),
	country_code: z.string().length(2).optional()
});

/**
 * Resolve cell_id (Census block/tract GEOID) from coordinates via Census Bureau.
 * Returns null on failure — non-fatal, we can still resolve district via Shadow Atlas.
 */
async function resolveCellId(lat: number, lng: number): Promise<{
	cellId: string | null;
	districtCode: string | null;
	stateCode: string | null;
	countyFips: string | null;
}> {
	try {
		const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates');
		url.searchParams.set('x', String(lng));
		url.searchParams.set('y', String(lat));
		url.searchParams.set('benchmark', '4');
		url.searchParams.set('vintage', '4');
		url.searchParams.set('format', 'json');

		const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
		if (!res.ok) return { cellId: null, districtCode: null, stateCode: null, countyFips: null };

		const data = await res.json();
		const geographies = data?.result?.geographies;
		if (!geographies) return { cellId: null, districtCode: null, stateCode: null, countyFips: null };

		const blocks = geographies['2020 Census Blocks'];
		const block = blocks?.[0];
		const cellId = block?.GEOID || null;

		const districts = geographies['119th Congressional Districts'];
		const district = districts?.[0];
		const states = geographies['States'];
		const state = states?.[0];
		const counties = geographies['Counties'];
		const county = counties?.[0];

		const stateCode = state?.STUSAB || null;
		const districtNumber = district?.GEOID?.slice(2) || null;
		const districtCode = stateCode && districtNumber
			? `${stateCode}-${districtNumber.padStart(2, '0')}`
			: null;

		return {
			cellId,
			districtCode,
			stateCode,
			countyFips: county?.GEOID || null
		};
	} catch (e) {
		console.warn('[resolve] Census coordinate lookup failed:', e instanceof Error ? e.message : e);
		return { cellId: null, districtCode: null, stateCode: null, countyFips: null };
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth check
	if (!locals.user) {
		return json({ resolved: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const body = await request.json();

		// Privacy guard: reject requests containing address fields
		const bodyKeys = Object.keys(body);
		const addressFields = ['street', 'city', 'address', 'zipCode', 'zip_code', 'postal_code', 'zip', 'home_address', 'addr'];
		const leaked = bodyKeys.filter((k) => addressFields.includes(k));
		if (leaked.length > 0) {
			return json(
				{ resolved: false, error: 'Address fields must not be sent to this endpoint' },
				{ status: 400 }
			);
		}

		// Validate request body
		const parseResult = resolveSchema.safeParse(body);
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

		const { lat, lng, signal_type, confidence, country_code: _country_code } = parseResult.data;
		let { cell_id, district_code: rawDistrictCode } = parseResult.data;

		// Resolve cell_id server-side if not provided by client
		if (!cell_id) {
			const census = await resolveCellId(lat, lng);
			if (census.cellId) {
				// Use tract GEOID (first 11 chars) as cell_id for Shadow Atlas
				cell_id = census.cellId.length >= 11 ? census.cellId.slice(0, 11) : census.cellId;
			}
			if (!rawDistrictCode && census.districtCode) {
				rawDistrictCode = census.districtCode;
			}
		}

		// Normalize Census at-large format: XX-00 → XX-AL
		const district_code = rawDistrictCode?.endsWith('-00')
			? rawDistrictCode.replace(/-00$/, '-AL')
			: rawDistrictCode;

		// District resolution
		let resolvedDistrictCode: string | null = null;
		let districtName: string | null = null;
		let districtState: string | null = null;
		let districtSource: 'shadow_atlas' | 'client_census' = 'shadow_atlas';

		// Officials resolution
		let officials: Array<{
			name: string;
			office: string;
			chamber: string;
			party: string;
			state: string;
			district: string;
			bioguide_id: string;
			is_voting_member: boolean;
			delegate_type?: string | null;
		}> = [];
		let specialStatus: {
			type: string;
			message: string;
			has_senators: boolean;
			has_voting_representative: boolean;
		} | null = null;
		let officialsResolved = false;

		if (district_code) {
			// Client provided district from Census geocoding
			resolvedDistrictCode = district_code;
			districtState = district_code.split('-')[0];
			districtSource = 'client_census';
		} else {
			// Try composite call first (saves a round-trip vs. separate lookup + officials)
			try {
				const composite = await resolveLocation(lat, lng);
				resolvedDistrictCode = composite.district.district.id;
				districtName = composite.district.district.name;
				districtSource = 'shadow_atlas';
				const parts = resolvedDistrictCode.split('-');
				if (parts.length >= 2) {
					districtState = parts[0];
				}

				// Officials already resolved in composite response
				if (composite.officials) {
					officialsResolved = true;
					if (composite.officials.special_status) {
						specialStatus = composite.officials.special_status;
					}
					officials = composite.officials.officials.map((official) => ({
						name: official.name,
						office: official.office,
						chamber: official.chamber,
						party: official.party,
						state: official.state,
						district:
							official.chamber === 'house'
								? composite.officials!.district_code ||
									`${official.state}-${official.district || '00'}`
								: official.state,
						bioguide_id: official.bioguide_id,
						is_voting_member: official.is_voting ?? true,
						delegate_type: official.delegate_type,
					}));
					console.log('[Location Resolve] District + officials resolved via composite call');
				}
			} catch {
				// Fallback to separate calls (existing logic)
				try {
					const lookupResult = await lookupDistrict(lat, lng);
					resolvedDistrictCode = lookupResult.district.id;
					districtName = lookupResult.district.name;
					districtSource = 'shadow_atlas';
					const parts = resolvedDistrictCode.split('-');
					if (parts.length >= 2) {
						districtState = parts[0];
					}
				} catch (lookupError) {
					console.warn(
						'[Location Resolve] Shadow Atlas district lookup failed:',
						lookupError instanceof Error ? lookupError.message : lookupError
					);
				}
			}
		}

		if (!resolvedDistrictCode) {
			return json({
				resolved: false,
				district: null,
				officials: [],
				special_status: null,
				zk_eligible: false,
				confidence,
				signal_type,
				district_source: 'shadow_atlas'
			});
		}

		// Fetch officials separately if not already resolved (fallback path or client-provided district)
		if (!officialsResolved) {
			try {
				const officialsResponse = await getOfficials(resolvedDistrictCode);

				if (officialsResponse.special_status) {
					specialStatus = officialsResponse.special_status;
				}

				officials = officialsResponse.officials.map((official) => ({
					name: official.name,
					office: official.office,
					chamber: official.chamber,
					party: official.party,
					state: official.state,
					district:
						official.chamber === 'house'
							? officialsResponse.district_code ||
								`${official.state}-${official.district || '00'}`
							: official.state,
					bioguide_id: official.bioguide_id,
					is_voting_member: official.is_voting ?? true,
					delegate_type: official.delegate_type
				}));
				console.log('[Location Resolve] Officials resolved via Shadow Atlas');
			} catch (officialsError) {
				// Shadow Atlas down — return empty officials rather than failing
				console.warn(
					'[Location Resolve] Shadow Atlas officials unavailable:',
					officialsError instanceof Error ? officialsError.message : officialsError
				);
			}
		}

		// ZK eligibility: requires cell_id
		const zk_eligible = cell_id != null;

		return json({
			resolved: true,
			district: {
				code: resolvedDistrictCode,
				name: districtName || resolvedDistrictCode,
				state: districtState || resolvedDistrictCode.split('-')[0]
			},
			officials,
			special_status: specialStatus,
			zk_eligible,
			...(cell_id ? { cell_id } : {}),
			confidence,
			signal_type,
			district_source: districtSource
		});
	} catch (error) {
		console.error(
			'[Location Resolve] Error:',
			error instanceof Error ? error.message : 'Unknown error'
		);
		return json(
			{ resolved: false, error: 'Location resolution service temporarily unavailable' },
			{ status: 500 }
		);
	}
};
