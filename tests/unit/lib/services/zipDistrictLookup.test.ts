import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zipDistrictLookup } from './zipDistrictLookup';

// Mock fetch for testing
global.fetch = vi.fn();

describe('ZipDistrictLookup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset the lookup table for each test
		(zipDistrictLookup as any).isLoaded = false;
		(zipDistrictLookup as any).lookupTable.clear();
	});

	describe('loadData', () => {
		it('should load ZIP-district data from GitHub', async () => {
			const mockCSVData = `state_fips,state_abbr,zcta,cd
01,AL,35004,3
06,CA,90210,30
11,DC,20500,98`;

			(fetch as any).mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(mockCSVData)
			});

			await zipDistrictLookup.loadData();

			expect(fetch).toHaveBeenCalledWith(
				'https://raw.githubusercontent.com/OpenSourceActivismTech/us-zipcodes-congress/master/zccd.csv'
			);
		});

		it('should handle fetch errors gracefully', async () => {
			(fetch as any).mockRejectedValueOnce(new Error('Network error'));

			await expect(zipDistrictLookup.loadData()).rejects.toThrow('Network error');
		});

		it('should not reload data if already loaded', async () => {
			(zipDistrictLookup as any).isLoaded = true;

			await zipDistrictLookup.loadData();

			expect(fetch).not.toHaveBeenCalled();
		});
	});

	describe('lookupDistrict', () => {
		beforeEach(async () => {
			const mockCSVData = `state_fips,state_abbr,zcta,cd
01,AL,35004,3
06,CA,90210,30
06,CA,90210,33
11,DC,20500,98
36,NY,10118,12`;

			(fetch as any).mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(mockCSVData)
			});

			await zipDistrictLookup.loadData();
		});

		it('should return high confidence for single district ZIP', async () => {
			const result = await zipDistrictLookup.lookupDistrict('35004', 'AL');

			expect(result).toEqual({
				state: 'AL',
				district: '03',
				confidence: 'high'
			});
		});

		it('should return medium confidence for multi-district ZIP', async () => {
			const result = await zipDistrictLookup.lookupDistrict('90210', 'CA');

			expect(result).toEqual({
				state: 'CA',
				district: '30', // Most common (appears first)
				confidence: 'medium',
				alternatives: ['33']
			});
		});

		it('should handle DC special case (98 → AL)', async () => {
			const result = await zipDistrictLookup.lookupDistrict('20500', 'DC');

			expect(result).toEqual({
				state: 'DC',
				district: '98',
				confidence: 'high'
			});
		});

		it('should return fallback for unknown ZIP', async () => {
			const result = await zipDistrictLookup.lookupDistrict('00000', 'XX');

			expect(result).toEqual({
				state: 'XX',
				district: '01',
				confidence: 'low'
			});
		});

		it('should clean ZIP+4 format', async () => {
			const result = await zipDistrictLookup.lookupDistrict('10118-0001', 'NY');

			expect(result).toEqual({
				state: 'NY',
				district: '12',
				confidence: 'high'
			});
		});
	});

	describe('getAllDistricts', () => {
		it('should return all districts for a ZIP code', async () => {
			const mockCSVData = `state_fips,state_abbr,zcta,cd
06,CA,90210,30
06,CA,90210,33`;

			(fetch as any).mockResolvedValueOnce({
				ok: true,
				text: () => Promise.resolve(mockCSVData)
			});

			await zipDistrictLookup.loadData();
			const districts = await zipDistrictLookup.getAllDistricts('90210');

			expect(districts).toHaveLength(2);
			expect(districts[0]).toEqual({
				state_fips: '06',
				state_abbr: 'CA',
				zcta: '90210',
				cd: '30'
			});
		});
	});
});