import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addressLookup } from '$lib/core/congress/address-lookup';

// POST /api/address/lookup - Find representatives for a given address
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const { street, city, state, zip } = data;

		// Validate required fields
		if (!street || !city || !state || !zip) {
			throw error(400, 'Missing required address fields: street, city, state, zip');
		}

		// Clean and validate inputs
		const address = {
			street: street.trim(),
			city: city.trim(),
			state: state.trim().toUpperCase(),
			zip: zip.trim()
		};

		// Validate state code (should be 2 letters)
		if (!/^[A-Z]{2}$/.test(address.state)) {
			throw error(400, 'State must be a valid 2-letter state code (e.g., CA, NY, TX)');
		}

		// Validate ZIP code (should be 5 or 9 digits)
		if (!/^\d{5}(-?\d{4})?$/.test(address.zip)) {
			throw error(400, 'ZIP code must be in format 12345 or 12345-6789');
		}

		// Perform the lookup
		const userReps = await addressLookup.lookupRepsByAddress(address);

		// Return the user's representatives
		return json({
			success: true,
			address: address,
			representatives: {
				house: {
					name: userReps.house.name,
					party: userReps.house.party,
					state: userReps.house.state,
					district: userReps.house.district,
					chamber: userReps.house.chamber,
					officeCode: userReps.house.officeCode
				},
				senate: userReps.senate.map((senator) => ({
					name: senator.name,
					party: senator.party,
					state: senator.state,
					chamber: senator.chamber,
					officeCode: senator.officeCode
				}))
			},
			district: userReps.district,
			message: `Found ${userReps.senate.length + 1} representatives for ${address.city}, ${address.state}`
		});
	} catch (_error) {
		// Handle specific error types
		if (_error && typeof _error === 'object' && 'status' in _error) {
			throw _error; // Re-throw SvelteKit errors
		}

		if (_error instanceof Error) {
			if (_error.message.includes('Congress API error')) {
				throw error(503, 'Congressional data service is temporarily unavailable');
			}
			if (_error.message.includes('Google Civic API error')) {
				throw error(503, 'Address validation service is temporarily unavailable');
			}
		}

		throw error(500, 'Failed to lookup representatives for this address');
	}
};

// GET /api/address/lookup - Validate a specific district (for testing)
export const GET: RequestHandler = async ({ url }) => {
	try {
		const state = url.searchParams.get('state');
		const district = url.searchParams.get('district');

		if (!state) {
			throw error(400, 'state parameter is required');
		}

		if (!district) {
			throw error(400, 'district parameter is required');
		}

		// Mock lookup for testing purposes
		const mockReps = {
			house: {
				name: `Representative for ${state.toUpperCase()}-${district}`,
				party: 'Unknown',
				state: state.toUpperCase(),
				district: district,
				chamber: 'house' as const,
				officeCode: `${state.toUpperCase()}${district}H`
			},
			senate: [
				{
					name: `Senior Senator for ${state.toUpperCase()}`,
					party: 'Unknown',
					state: state.toUpperCase(),
					chamber: 'senate' as const,
					officeCode: `${state.toUpperCase()}S1`
				},
				{
					name: `Junior Senator for ${state.toUpperCase()}`,
					party: 'Unknown',
					state: state.toUpperCase(),
					chamber: 'senate' as const,
					officeCode: `${state.toUpperCase()}S2`
				}
			]
		};

		return json({
			success: true,
			test: true,
			representatives: mockReps,
			district: {
				state: state.toUpperCase(),
				district: district
			},
			message: `Mock representatives for ${state.toUpperCase()}-${district}`
		});
	} catch (_error) {
		if (_error && typeof _error === 'object' && 'status' in _error) {
			throw _error;
		}

		throw error(500, 'Failed to lookup district information');
	}
};
