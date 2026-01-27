import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addressLookupService } from '$lib/core/congress/address-lookup';

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

		return json({
			verified: true,
			corrected: correctedAddress !== fullAddress,
			originalAddress: fullAddress,
			correctedAddress,
			representatives,
			district,
			special_status: specialStatus,
			message: 'Address  verified successfully'
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
