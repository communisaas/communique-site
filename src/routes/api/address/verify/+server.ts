import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { addressLookup } from '$lib/core/congress/address-lookup';

// Real address verification using Census Bureau Geocoding API (primary)
export async function POST({ request }) {
	try {
		const { street, city, state, zipCode } = await request.json();

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
					error: 'Address not found. Please check and try again.'
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
		try {
			const userReps = await addressLookup.lookupRepsByAddress({
				street: street,
				city: city,
				state: state,
				zip: zipCode
			});

			// Format representatives for frontend
			representatives = [
				{
					name: userReps.house.name,
					office: `House Representative, ${userReps.house.state}-${userReps.house.district}`,
					chamber: 'house',
					party: userReps.house.party,
					district: `${userReps.house.state}-${userReps.house.district}`,
					bioguideId: userReps.house.bioguideId
				},
				...userReps.senate.map((senator) => ({
					name: senator.name,
					office: `Senator, ${senator.state}`,
					chamber: 'senate',
					party: senator.party,
					district: senator.state,
					bioguideId: senator.bioguideId
				}))
			];
		} catch (_error) {
			console.error('Failed to get real representatives, using placeholders:', error);
			console.error('Error details:', _error instanceof Error ? error.stack : error);
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
			message: 'Address verified successfully'
		});
	} catch (_error) {
		console.error('Address verification error:', error);
		return json(
			{
				verified: false,
				error: 'Address verification service temporarily unavailable'
			},
			{ status: 500 }
		);
	}
}

/**
 * Extract congressional district from Census Bureau geocoding response
 */
function extractCongressionalDistrictFromCensus(geographies: unknown, state: string): string {
	try {
		// Look for 119th Congressional Districts
		const congressionalDistricts = geographies['119th Congressional Districts'];
		if (congressionalDistricts && congressionalDistricts.length > 0) {
			const cd = congressionalDistricts[0].CD119;
			if (cd === '98') {
				// Special case for DC delegate
				return `${state.toUpperCase()}-AL`;
			}
			return `${state.toUpperCase()}-${cd.padStart(2, '0')}`;
		}

		// Fallback to at-large
		return `${state.toUpperCase()}-AL`;
	} catch (_error) {
		return `${state.toUpperCase()}-01`;
	}
}

/**
 * Create representative data from district and state
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
