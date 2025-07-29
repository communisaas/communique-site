import { beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
	// Mock console methods for cleaner test output
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// Test data constants
export const TEST_ADDRESSES = {
	VALID_DC: {
		street: '1600 Pennsylvania Avenue NW',
		city: 'Washington',
		state: 'DC',
		zip: '20500',
		zipCode: '20500'  // For verify API
	},
	VALID_NY: {
		street: '350 Fifth Avenue',
		city: 'New York', 
		state: 'NY',
		zip: '10118',
		zipCode: '10118'  // For verify API
	},
	INVALID: {
		street: 'Invalid Street',
		city: 'Nowhere',
		state: 'XX',
		zip: '00000',
		zipCode: '00000'  // For verify API
	}
};

export const MOCK_CENSUS_RESPONSE = {
	result: {
		addressMatches: [{
			matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
			geographies: {
				'119th Congressional Districts': [{
					CD119: '98' // DC delegate district
				}]
			}
		}]
	}
};

export const MOCK_CONGRESS_RESPONSE = {
	members: [{
		bioguideId: 'N000147',
		name: 'Eleanor Holmes Norton',
		partyName: 'Democratic',
		state: 'DC',
		district: '00',
		terms: [{ chamber: 'House' }]
	}]
};