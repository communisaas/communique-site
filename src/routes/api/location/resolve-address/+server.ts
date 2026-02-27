import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { resolveAddress, getOfficials, lookupDistrict } from '$lib/core/shadow-atlas/client';

/**
 * POST /api/location/resolve-address
 *
 * Authenticated proxy to Shadow Atlas's self-hosted address resolution.
 * All geocoding, district lookup, and officials resolution happens server-side
 * in Shadow Atlas (Nominatim + R-tree + SQLite). Zero external government API calls.
 *
 * Fallback: If Shadow Atlas geocoding is unavailable (Nominatim not running),
 * falls back to Census Bureau geocoder. This path logs a warning and should
 * be eliminated once Nominatim is deployed.
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
		// Primary path: Shadow Atlas (fully sovereign — zero external calls)
		// ================================================================
		try {
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
				county_fips: null,
				district_source: 'shadow-atlas' as const,
				officials_source: 'shadow-atlas' as const
			});
		} catch (saError) {
			// Shadow Atlas geocoding unavailable — fall through to Census fallback
			console.warn(
				'[resolve-address] Shadow Atlas unavailable, falling back to Census Bureau:',
				saError instanceof Error ? saError.message : saError
			);
		}

		// ================================================================
		// Fallback: Census Bureau geocoder (degraded mode, US only)
		// This path should be eliminated once Nominatim is deployed.
		// Census Bureau does not handle Canadian addresses.
		// ================================================================
		if (country === 'CA') {
			return json({
				resolved: false,
				error: 'Canadian address resolution requires Shadow Atlas geocoding service. Please try again later.'
			});
		}

		const census = await censusBureauGeocode(street, city, state, zip);

		if (!census) {
			console.info('[resolve-address] No Census match (fallback path)');
			return json({
				resolved: false,
				error: 'Address not found. Please check your address and try again.'
			});
		}

		const { matchedAddress, coordinates, districtCode, districtName, stateCode, cellId, countyFips } = census;

		if (!districtCode || !stateCode) {
			console.info('[resolve-address] Census matched but no district (fallback path)');
			return json({
				resolved: false,
				error: 'Address found but congressional district could not be determined. Please verify your address.'
			});
		}

		const addressParts = parseMatchedAddress(matchedAddress);
		const districtParts = districtCode.split('-');

		// Officials via Shadow Atlas (still sovereign — pre-ingested data)
		let officials: Array<{
			name: string;
			office: string;
			chamber: 'house' | 'senate';
			party: string;
			state: string;
			district: string;
			bioguide_id: string;
			is_voting_member: boolean;
			delegate_type: string | null;
			phone?: string;
			office_code?: string;
		}> = [];

		let specialStatus: {
			type: 'dc' | 'territory';
			message: string;
			has_senators: boolean;
			has_voting_representative: boolean;
		} | null = null;

		try {
			const saResponse = await getOfficials(districtCode);

			if (saResponse.special_status) {
				specialStatus = saResponse.special_status;
			}

			for (const official of saResponse.officials) {
				officials.push({
					name: official.name,
					office: official.office,
					chamber: official.chamber,
					party: official.party,
					state: official.state,
					district:
						official.chamber === 'senate'
							? official.state
							: `${official.state}-${official.district ?? districtParts[1]}`,
					bioguide_id: official.bioguide_id,
					is_voting_member: official.is_voting,
					delegate_type: official.delegate_type,
					phone: official.phone ?? undefined,
					office_code: official.cwc_code ?? undefined
				});
			}
		} catch (err) {
			console.warn(
				'[resolve-address] Officials lookup failed (fallback path):',
				err instanceof Error ? err.message : err
			);
		}

		// Fire-and-forget: warm Shadow Atlas spatial index
		if (coordinates.lat && coordinates.lng) {
			lookupDistrict(coordinates.lat, coordinates.lng).catch(() => {});
		}

		const displayDistrictNumber = districtParts[1] === 'AL' ? 'At Large' : districtParts[1];
		const resolvedDistrictName = districtName || `Congressional District ${displayDistrictNumber}`;

		console.warn(`[resolve-address] Resolved via Census FALLBACK district=${districtCode}`);

		return json({
			resolved: true,
			address: {
				matched: matchedAddress,
				street: addressParts.street,
				city: addressParts.city,
				state: addressParts.state,
				zip: addressParts.zip
			},
			coordinates: {
				lat: coordinates.lat,
				lng: coordinates.lng
			},
			district: {
				code: districtCode,
				name: resolvedDistrictName,
				state: stateCode
			},
			officials,
			special_status: specialStatus,
			cell_id: cellId,
			zk_eligible: cellId != null,
			county_fips: countyFips,
			district_source: 'census-fallback' as const,
			officials_source: 'shadow-atlas' as const
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

// ============================================================================
// Census Bureau fallback (to be removed once Nominatim is deployed)
// ============================================================================

interface CensusAddressMatch {
	matchedAddress: string;
	coordinates: { x: number; y: number };
	geographies: Record<string, Array<Record<string, string>>>;
}

async function censusBureauGeocode(
	street: string,
	city: string,
	state: string,
	zip: string
): Promise<{
	matchedAddress: string;
	coordinates: { lat: number; lng: number };
	districtCode: string | null;
	districtName: string | null;
	stateCode: string | null;
	cellId: string | null;
	countyFips: string | null;
} | null> {
	const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/address');
	url.searchParams.set('street', street);
	url.searchParams.set('city', city);
	url.searchParams.set('state', state);
	url.searchParams.set('zip', zip);
	url.searchParams.set('benchmark', '4');
	url.searchParams.set('vintage', '4');
	url.searchParams.set('format', 'json');

	const res = await fetch(url.toString(), {
		signal: AbortSignal.timeout(15000)
	});

	if (!res.ok) return null;

	const data = await res.json();
	const matches: CensusAddressMatch[] | undefined = data?.result?.addressMatches;

	if (!matches || matches.length === 0) return null;

	const match = matches[0];
	const geographies = match.geographies;

	const coordinates = {
		lat: match.coordinates.y,
		lng: match.coordinates.x
	};

	const districts = geographies?.['119th Congressional Districts'];
	const district = districts?.[0];

	const states = geographies?.['States'];
	const stateGeo = states?.[0];
	const stateCode = stateGeo?.STUSAB || null;

	let districtCode: string | null = null;
	let districtName: string | null = null;
	if (district) {
		const districtNumber = district.CD119 ?? district.GEOID?.slice(2) ?? null;
		districtName = district.NAME || null;
		if (stateCode && districtNumber != null) {
			let paddedDistrict = String(districtNumber).padStart(2, '0');
			if (paddedDistrict === '98') paddedDistrict = '00';
			const normalizedDistrict = paddedDistrict === '00' ? 'AL' : paddedDistrict;
			districtCode = `${stateCode}-${normalizedDistrict}`;
		}
	}

	const blocks = geographies?.['2020 Census Blocks'];
	const block = blocks?.[0];
	const rawCellId = block?.GEOID || null;
	const cellId = rawCellId && rawCellId.length >= 11 ? rawCellId.slice(0, 11) : rawCellId;

	const counties = geographies?.['Counties'];
	const county = counties?.[0];
	const countyFips = county?.GEOID || null;

	return {
		matchedAddress: match.matchedAddress,
		coordinates,
		districtCode,
		districtName,
		stateCode,
		cellId,
		countyFips
	};
}

/**
 * Parse matched address into components.
 * Works with Census format "12 MINT PLZ, SAN FRANCISCO, CA, 94103"
 * and Nominatim display_name format.
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
