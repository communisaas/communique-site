/**
 * Test Addresses for Congressional Delivery Testing
 *
 * Strategic test address selection criteria:
 * 1. Stable public buildings (won't change, no privacy concerns)
 * 2. Known congressional districts (verifiable)
 * 3. Geographic diversity (different states, urban/suburban)
 * 4. Edge cases (district boundaries, at-large states)
 *
 * Usage:
 * - Unit/Integration tests: Use with MSW mocks (no real API calls)
 * - Smoke tests: Use against real Census API (verify address resolution)
 * - E2E: NEVER send to real CWC without explicit dry-run flag
 */

export interface TestAddress {
	street: string;
	city: string;
	state: string;
	zip: string;
	// Expected resolution (for assertions)
	expectedDistrict: string;
	expectedState: string;
	description: string;
	// For test categorization
	category: 'standard' | 'edge-case' | 'at-large' | 'non-voting';
}

export interface TestAddressWithReps extends TestAddress {
	// Known representatives (may change with elections - update periodically)
	expectedSenatorCount: number;
	expectedHouseRepCount: number;
	// Last verified date
	lastVerified: string;
}

/**
 * PRIMARY TEST ADDRESSES
 * These are stable government buildings with known, verifiable districts.
 * Use these for standard happy-path testing.
 */
export const PRIMARY_TEST_ADDRESSES: TestAddressWithReps[] = [
	{
		// San Francisco - Dense urban, well-known district
		street: '1 Dr Carlton B Goodlett Pl',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102',
		expectedDistrict: 'CA-11',
		expectedState: 'CA',
		description: 'San Francisco City Hall - Dense urban California district',
		category: 'standard',
		expectedSenatorCount: 2,
		expectedHouseRepCount: 1,
		lastVerified: '2025-01-08'
	},
	{
		// Austin - Texas urban, different political landscape
		street: '301 W 2nd St',
		city: 'Austin',
		state: 'TX',
		zip: '78701',
		expectedDistrict: 'TX-21',
		expectedState: 'TX',
		description: 'Austin City Hall - Texas urban district',
		category: 'standard',
		expectedSenatorCount: 2,
		expectedHouseRepCount: 1,
		lastVerified: '2025-01-08'
	},
	{
		// New York - East coast metro
		street: 'City Hall Park',
		city: 'New York',
		state: 'NY',
		zip: '10007',
		expectedDistrict: 'NY-10',
		expectedState: 'NY',
		description: 'NYC City Hall - Dense urban New York district',
		category: 'standard',
		expectedSenatorCount: 2,
		expectedHouseRepCount: 1,
		lastVerified: '2025-01-08'
	},
	{
		// Denver - Mountain West
		street: '1437 Bannock St',
		city: 'Denver',
		state: 'CO',
		zip: '80202',
		expectedDistrict: 'CO-01',
		expectedState: 'CO',
		description: 'Denver City Hall - Colorado urban district',
		category: 'standard',
		expectedSenatorCount: 2,
		expectedHouseRepCount: 1,
		lastVerified: '2025-01-08'
	}
];

/**
 * EDGE CASE TEST ADDRESSES
 * For testing boundary conditions and special scenarios.
 */
export const EDGE_CASE_ADDRESSES: TestAddress[] = [
	{
		// At-large state (single House rep for entire state)
		street: '700 E Main St',
		city: 'Richmond',
		state: 'VT',
		zip: '05401',
		expectedDistrict: 'VT-AL',
		expectedState: 'VT',
		description: 'Vermont - At-large state (single House rep)',
		category: 'at-large'
	},
	{
		// Wyoming - Another at-large state
		street: '200 W 24th St',
		city: 'Cheyenne',
		state: 'WY',
		zip: '82001',
		expectedDistrict: 'WY-AL',
		expectedState: 'WY',
		description: 'Wyoming Capitol - At-large state',
		category: 'at-large'
	},
	{
		// Washington DC - Non-voting delegate
		street: '1350 Pennsylvania Ave NW',
		city: 'Washington',
		state: 'DC',
		zip: '20004',
		expectedDistrict: 'DC-00',
		expectedState: 'DC',
		description: 'DC - Non-voting delegate, no senators',
		category: 'non-voting'
	},
	{
		// Puerto Rico - Resident Commissioner
		street: '100 Calle San Francisco',
		city: 'San Juan',
		state: 'PR',
		zip: '00901',
		expectedDistrict: 'PR-00',
		expectedState: 'PR',
		description: 'Puerto Rico - Resident Commissioner (non-voting)',
		category: 'non-voting'
	},
	{
		// US Virgin Islands - Non-voting delegate
		street: '21-22 Kongens Gade',
		city: 'Charlotte Amalie',
		state: 'VI',
		zip: '00802',
		expectedDistrict: 'VI-00',
		expectedState: 'VI',
		description: 'US Virgin Islands - Non-voting delegate',
		category: 'non-voting'
	},
	{
		// Guam - Non-voting delegate
		street: '173 Aspinall Ave',
		city: 'Hagatna',
		state: 'GU',
		zip: '96910',
		expectedDistrict: 'GU-00',
		expectedState: 'GU',
		description: 'Guam - Non-voting delegate',
		category: 'non-voting'
	}
];

/**
 * INVALID TEST ADDRESSES
 * For testing error handling and validation.
 */
export const INVALID_ADDRESSES = {
	// Missing required fields
	missingStreet: {
		street: '',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102'
	},
	missingCity: {
		street: '123 Main St',
		city: '',
		state: 'CA',
		zip: '94102'
	},
	missingState: {
		street: '123 Main St',
		city: 'San Francisco',
		state: '',
		zip: '94102'
	},
	missingZip: {
		street: '123 Main St',
		city: 'San Francisco',
		state: 'CA',
		zip: ''
	},

	// Invalid formats
	invalidZipFormat: {
		street: '123 Main St',
		city: 'San Francisco',
		state: 'CA',
		zip: 'ABCDE'
	},
	invalidStateCode: {
		street: '123 Main St',
		city: 'San Francisco',
		state: 'XX',
		zip: '94102'
	},

	// Non-existent addresses
	nonExistentAddress: {
		street: '99999 Fake Street',
		city: 'Nowhere',
		state: 'CA',
		zip: '00000'
	}
};

/**
 * Helper to get a random primary test address
 */
export function getRandomTestAddress(): TestAddressWithReps {
	return PRIMARY_TEST_ADDRESSES[Math.floor(Math.random() * PRIMARY_TEST_ADDRESSES.length)];
}

/**
 * Helper to get test address by state
 */
export function getTestAddressByState(stateCode: string): TestAddress | undefined {
	return (
		PRIMARY_TEST_ADDRESSES.find((a) => a.state === stateCode) ||
		EDGE_CASE_ADDRESSES.find((a) => a.state === stateCode)
	);
}

/**
 * Helper to get all addresses for a specific test category
 */
export function getAddressesByCategory(
	category: TestAddress['category']
): TestAddress[] {
	return [
		...PRIMARY_TEST_ADDRESSES.filter((a) => a.category === category),
		...EDGE_CASE_ADDRESSES.filter((a) => a.category === category)
	];
}

/**
 * Default test address for quick tests
 * San Francisco City Hall - stable, well-documented, easy to verify
 */
export const DEFAULT_TEST_ADDRESS = PRIMARY_TEST_ADDRESSES[0];

/**
 * MSW Mock Response Generators
 * Use these to create consistent mock responses that match real API contracts.
 */
export const mockResponses = {
	/**
	 * Generate Census geocoding response for a test address
	 */
	censusGeocode(address: TestAddress) {
		const districtNum = address.expectedDistrict.split('-')[1];
		const is119thFormat = address.category === 'non-voting' || address.state === 'DC' || ['PR', 'VI', 'GU', 'AS', 'MP'].includes(address.state);

		return {
			result: {
				addressMatches: [
					{
						matchedAddress: `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
						coordinates: {
							x: -122.4194, // longitude (SF default)
							y: 37.7749 // latitude (SF default)
						},
						geographies: {
							'119th Congressional Districts': [
								{
									// DC uses special code 98, territories use 98 or their own codes
									CD119: address.state === 'DC' ? '98' : (districtNum === '00' ? '98' : districtNum),
									GEOID: address.expectedDistrict.replace('-', ''),
									NAME: `Congressional District ${districtNum}`,
									STATE: address.expectedState
								}
							]
						}
					}
				]
			}
		};
	},

	/**
	 * Generate CWC submission success response
	 */
	cwcSubmitSuccess(chamber: 'house' | 'senate') {
		const prefix = chamber === 'house' ? 'H' : 'S';
		return {
			success: true,
			submissionId: `${prefix}-${Date.now()}`,
			status: 'queued',
			estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
		};
	},

	/**
	 * Generate CWC submission error response
	 */
	cwcSubmitError(errorType: 'invalid_address' | 'rate_limit' | 'server_error') {
		const errors = {
			invalid_address: {
				success: false,
				error: 'Invalid address: Could not match to congressional district',
				code: 'INVALID_ADDRESS'
			},
			rate_limit: {
				success: false,
				error: 'Rate limit exceeded. Please try again later.',
				code: 'RATE_LIMIT'
			},
			server_error: {
				success: false,
				error: 'Internal server error',
				code: 'SERVER_ERROR'
			}
		};
		return errors[errorType];
	}
};
