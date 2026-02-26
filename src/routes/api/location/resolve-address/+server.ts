import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getOfficials, lookupDistrict } from '$lib/core/shadow-atlas/client';

/**
 * POST /api/location/resolve-address
 *
 * Unified address resolution endpoint. Accepts a structured US address and
 * returns everything the client needs in a single call:
 *   - Census-standardized address
 *   - Coordinates (lat/lng)
 *   - Congressional district (STATE-DD format)
 *   - Federal representatives (house + senate)
 *   - Census block GEOID (cell_id) for ZK eligibility
 *   - DC/territory special status
 *
 * Pipeline:
 *   1. Census Bureau Geocoder (address normalization + coordinates + district + cell_id)
 *   2. Shadow Atlas officials lookup (pre-ingested, no government API calls at runtime)
 *   3. Shadow Atlas district lookup (fire-and-forget, for spatial index warming)
 *
 * PRIVACY:
 * - Logs NOTHING about the address itself.
 * - Only logs success/failure + district code (neighborhood-level, not PII).
 */

const addressSchema = z.object({
	street: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	state: z.string().length(2),
	zip: z.string().regex(/^\d{5}(-\d{4})?$/)
});

/** Census Bureau address geocoder response shape (relevant subset) */
interface CensusAddressMatch {
	matchedAddress: string;
	coordinates: { x: number; y: number };
	geographies: Record<string, Array<Record<string, string>>>;
}

/**
 * Call Census Bureau address geocoder and extract all geography data.
 *
 * Uses the structured /address endpoint (not onelineaddress) for better
 * match quality. Returns null on any failure -- caller handles fallback.
 */
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

	// Coordinates -- Census returns {x: longitude, y: latitude}
	const coordinates = {
		lat: match.coordinates.y,
		lng: match.coordinates.x
	};

	// Congressional district
	const districts = geographies?.['119th Congressional Districts'];
	const district = districts?.[0];

	// State
	const states = geographies?.['States'];
	const stateGeo = states?.[0];
	const stateCode = stateGeo?.STUSAB || null;

	// District code (STATE-DD format)
	let districtCode: string | null = null;
	let districtName: string | null = null;
	if (district) {
		const districtNumber = district.CD119 ?? district.GEOID?.slice(2) ?? null;
		districtName = district.NAME || null;
		if (stateCode && districtNumber != null) {
			const paddedDistrict = String(districtNumber).padStart(2, '0');
			// Normalize Census at-large "00" to "AL"
			const normalizedDistrict = paddedDistrict === '00' ? 'AL' : paddedDistrict;
			districtCode = `${stateCode}-${normalizedDistrict}`;
		}
	}

	// Census block GEOID = cell_id
	const blocks = geographies?.['2020 Census Blocks'];
	const block = blocks?.[0];
	const rawCellId = block?.GEOID || null;
	// Use tract-level (first 11 chars) for Shadow Atlas compatibility
	const cellId = rawCellId && rawCellId.length >= 11 ? rawCellId.slice(0, 11) : rawCellId;

	// County FIPS
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
 * Parse Census-standardized matched address into components.
 * Census returns format: "12 MINT PLZ, SAN FRANCISCO, CA, 94103"
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

		const { street, city, state, zip } = parseResult.data;

		// ================================================================
		// Step 1: Census Bureau geocode (address -> everything)
		// ================================================================
		let census: Awaited<ReturnType<typeof censusBureauGeocode>>;
		try {
			census = await censusBureauGeocode(street, city, state, zip);
		} catch (err) {
			console.warn(
				'[resolve-address] Census Bureau geocoder error:',
				err instanceof Error ? err.message : err
			);
			census = null;
		}

		if (!census) {
			// No address match from Census
			console.info('[resolve-address] No Census match');
			return json({
				resolved: false,
				error: 'Address not found. Please check your address and try again.'
			});
		}

		const { matchedAddress, coordinates, districtCode, districtName, stateCode, cellId, countyFips } = census;

		if (!districtCode || !stateCode) {
			console.info('[resolve-address] Census matched address but no district resolved');
			return json({
				resolved: false,
				error: 'Address found but congressional district could not be determined. Please verify your address.'
			});
		}

		// Parse standardized address components
		const addressParts = parseMatchedAddress(matchedAddress);

		const districtParts = districtCode.split('-');

		// ================================================================
		// Step 2: Shadow Atlas officials lookup (pre-ingested, zero gov API calls)
		// ================================================================
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

			// Map Shadow Atlas official records to the existing response contract
			for (const official of saResponse.officials) {
				officials.push({
					name: official.name,
					office: official.office,
					chamber: official.chamber,
					party: official.party,
					state: official.state,
					district: official.chamber === 'senate'
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
			// Shadow Atlas unavailable — still return everything else
			console.warn(
				'[resolve-address] Shadow Atlas officials lookup failed:',
				err instanceof Error ? err.message : err
			);
		}

		// ================================================================
		// Step 3: Shadow Atlas fire-and-forget (non-blocking)
		// ================================================================
		if (coordinates.lat && coordinates.lng) {
			// Fire-and-forget: do not await, do not block response
			lookupDistrict(coordinates.lat, coordinates.lng).catch((err) => {
				console.debug(
					'[resolve-address] Shadow Atlas fire-and-forget:',
					err instanceof Error ? err.message : err
				);
			});
		}

		// ================================================================
		// Build response
		// ================================================================

		// Format district display name
		const displayDistrictNumber = districtParts[1] === 'AL' ? 'At Large' : districtParts[1];
		const resolvedDistrictName =
			districtName || `Congressional District ${displayDistrictNumber}`;

		// Privacy: log only district code, never address
		console.info(`[resolve-address] Resolved district=${districtCode}`);

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
			district_source: 'census' as const,
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
