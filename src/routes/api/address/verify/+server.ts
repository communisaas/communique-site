import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addressLookupService } from '$lib/core/congress/address-lookup';
import { prisma } from '$lib/core/db';

// Real address verification using Census Bureau Geocoding API (primary)
export const POST: RequestHandler = async ({ request, locals }) => {
	// BA-010: Require authenticated session for address verification (handles PII)
	if (!locals.user) {
		return json({ verified: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			street,
			city,
			state,
			zipCode
		}: { street: string; city: string; state: string; zipCode: string } = body;

		// Basic validation
		if (!street || !city || !state || !zipCode) {
			return json(
				{
					verified: false,
					error: 'All address fields are required'
				},
				{ status: 400 }
			);
		}

		// Validate ZIP code format
		const zipRegex = /^\d{5}(-\d{4})?$/;
		if (!zipRegex.test(zipCode)) {
			return json(
				{
					verified: false,
					error: 'Invalid ZIP code format'
				},
				{ status: 400 }
			);
		}

		// Format address for Google Civic API
		const fullAddress = `${street}, ${city}, ${state} ${zipCode}`;

		// Use Census Bureau Geocoding API for address validation and district lookup
		const censusUrl = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(fullAddress)}&benchmark=4&vintage=4&format=json`;

		const response = await fetch(censusUrl);

		if (!response.ok) {
			throw new Error(`Census geocoding API error: ${response.status}`);
		}

		const censusData = await response.json();

		// Check if address was found
		if (!censusData.result?.addressMatches?.length) {
			return json(
				{
					verified: false,
					error: 'Address  not found. Please check and try again.'
				},
				{ status: 400 }
			);
		}

		const match = censusData.result.addressMatches[0];

		// Extract normalized address
		const correctedAddress = match.matchedAddress || fullAddress;

		// Extract congressional district
		const district = extractCongressionalDistrictFromCensus(match.geographies, state);

		// Extract cell_id (15-digit Census Block GEOID) for three-tree ZK architecture
		// PRIVACY: Neighborhood-level precision (600-3000 people), encrypted at rest
		const cell_id = extractCellIdFromCensus(match.geographies);

		// Get real representatives using Congress.gov API
		let representatives = [];
		let specialStatus = null;
		try {
			const userReps = await addressLookupService.lookupRepsByAddress({
				street: street,
				city: city,
				state: state,
				zip: zipCode
			});

			// Check for DC or territory special status
			if (userReps.special_status) {
				specialStatus = userReps.special_status;
			}

			// Format house representative (delegate for DC/territories)
			const houseRep = {
				name: userReps.house.name,
				office: userReps.house.is_voting_member === false
					? `${userReps.house.delegate_type === 'resident_commissioner' ? 'Resident Commissioner' : 'Non-Voting Delegate'}, ${userReps.house.state}`
					: `House Representative, ${userReps.house.state}-${userReps.house.district}`,
				chamber: 'house',
				party: userReps.house.party,
				state: userReps.house.state,
				district: `${userReps.house.state}-${userReps.house.district}`,
				bioguide_id: userReps.house.bioguide_id,
				office_code: userReps.house.office_code,
				is_voting_member: userReps.house.is_voting_member,
				delegate_type: userReps.house.delegate_type
			};

			// Format representatives for frontend (use snake_case for database consistency)
			representatives = [
				houseRep,
				...userReps.senate.map((senator) => ({
					name: senator.name,
					office: `Senator, ${senator.state}`,
					chamber: 'senate',
					party: senator.party,
					state: senator.state,
					district: senator.state,
					bioguide_id: senator.bioguide_id,
					office_code: senator.office_code,
					is_voting_member: senator.is_voting_member
				}))
			];
		} catch (error_repError) {
			console.error('Failed to get real representatives, using placeholders:', error_repError);
			console.error(
				'Error details:',
				error_repError instanceof Error ? error_repError.stack : error_repError
			);
			// Fallback to placeholders if Congress API fails
			representatives = createRepresentativesFromDistrict(district, state);
		}

		const zk_eligible = cell_id !== null;

		// Real state change: Mark address as verified for trust tier derivation
		// deriveTrustTier() in hooks.server.ts reads district_verified + address_verified_at
		// to compute Tier 2 (address-attested). Also persist trust_tier for direct DB queries.
		if (locals.user?.id) {
			await prisma.user.update({
				where: { id: locals.user.id },
				data: {
					district_verified: true,
					address_verified_at: new Date(),
					district_hash: district,
					trust_tier: 2
				}
			});
			console.log('[Address Verify] Trust tier promoted to 2:', locals.user.id);
		}

		return json({
			verified: true,
			corrected: correctedAddress !== fullAddress,
			originalAddress: fullAddress,
			correctedAddress,
			representatives,
			district,
			cell_id,
			zk_eligible,
			special_status: specialStatus,
			message: 'Address  verified successfully',
			...(zk_eligible
				? {}
				: {
						zk_warning:
							'ZK proofs are not available for this area. Your address is verified, but anonymous proof generation is not supported. District-attested delivery is available as an alternative.'
					})
		});
	} catch (error_verifyError) {
		console.error('Address  verification error:', error_verifyError);
		return json(
			{
				verified: false,
				error: 'Address  verification service temporarily unavailable'
			},
			{ status: 500 }
		);
	}
};

/**
 * Extract congressional district from Census Bureau geocoding response
 */
function extractCongressionalDistrictFromCensus(
	geographies: Record<string, unknown>,
	state: string
): string {
	try {
		// Look for 119th Congressional Districts
		const congressionalDistricts = geographies['119th Congressional Districts'];
		if (Array.isArray(congressionalDistricts) && congressionalDistricts.length > 0) {
			const firstDistrict = congressionalDistricts[0];
			if (firstDistrict && typeof firstDistrict === 'object' && 'CD119' in firstDistrict) {
				const cd = (firstDistrict as { CD119: string }).CD119;
				if (cd === '98') {
					// Special case for DC delegate
					return `${state.toUpperCase()}-AL`;
				}
				return `${state.toUpperCase()}-${cd.padStart(2, '0')}`;
			}
		}

		// Fallback to at-large
		return `${state.toUpperCase()}-AL`;
	} catch (error) {
		return `${state.toUpperCase()}-01`;
	}
}

/**
 * Extract cell_id (Census Block GEOID) from Census Bureau geocoding response
 *
 * PRIVACY: The 15-digit GEOID provides neighborhood-level precision (600-3000 people).
 * This is used as a private witness in the three-tree ZK architecture.
 * Never log the full cell_id value.
 *
 * @returns 15-digit Census Block GEOID or null if not found
 */
function extractCellIdFromCensus(
	geographies: Record<string, unknown>
): string | null {
	try {
		// Primary: Look for 2020 Census Blocks (standard US states)
		const censusBlocks = geographies['2020 Census Blocks'];
		if (Array.isArray(censusBlocks) && censusBlocks.length > 0) {
			const geoid = extractGeoidFromBlock(censusBlocks[0]);
			if (geoid) {
				console.log(`[Address Verify] Cell_id extracted: ${geoid.slice(0, 5)}... (three-tree enabled)`);
				return geoid;
			}
		}

		// Fallback: Iterate over all geography keys for territories/rural areas
		// (e.g. "2020 Census Blocks - PR", "Census Blocks", "Decennial Census Blocks")
		for (const key of Object.keys(geographies)) {
			if (key === '2020 Census Blocks') continue;
			if (/census\s*block/i.test(key)) {
				const blocks = geographies[key];
				if (Array.isArray(blocks) && blocks.length > 0) {
					const geoid = extractGeoidFromBlock(blocks[0]);
					if (geoid) {
						console.warn(`[Address Verify] Cell_id extracted via fallback key "${key}": ${geoid.slice(0, 5)}...`);
						return geoid;
					}
				}
			}
		}

		console.warn(
			'[Address Verify] No Census Block GEOID found. Available geography keys:',
			Object.keys(geographies)
		);
		return null;
	} catch (_error) {
		console.warn('[Address Verify] Failed to extract cell_id from Census data');
		return null;
	}
}

function extractGeoidFromBlock(block: unknown): string | null {
	if (block && typeof block === 'object' && 'GEOID' in block) {
		const geoid = (block as { GEOID: string }).GEOID;
		if (/^\d{15}$/.test(geoid)) {
			return geoid;
		}
	}
	return null;
}

/**
 * Create _representative data from district and state
 * This uses existing Congress.gov API integration
 */
function createRepresentativesFromDistrict(district: string, state: string) {
	// Simplified version - just return basic structure
	// This will be enhanced once the main flow works
	return [
		{
			name: `Representative for ${district}`,
			office: `House Representative, ${district}`,
			chamber: 'house',
			party: 'Unknown',
			district: district
		},
		{
			name: `Senior Senator for ${state.toUpperCase()}`,
			office: `Senator, ${state.toUpperCase()}`,
			chamber: 'senate',
			party: 'Unknown',
			district: state.toUpperCase()
		},
		{
			name: `Junior Senator for ${state.toUpperCase()}`,
			office: `Senator, ${state.toUpperCase()}`,
			chamber: 'senate',
			party: 'Unknown',
			district: state.toUpperCase()
		}
	];
}
