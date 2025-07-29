import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';
import { TEST_ADDRESSES, MOCK_CENSUS_RESPONSE } from '../../../../test/setup';

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
	env: {
		GOOGLE_CIVIC_API_KEY: 'test-key'
	}
}));

// Mock fetch for Census API
global.fetch = vi.fn();

describe('/api/address/verify', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST', () => {
		it('should verify a valid address', async () => {
			// Mock successful Census API response
			(fetch as any).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(MOCK_CENSUS_RESPONSE)
			});

			const request = new Request('http://localhost/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(TEST_ADDRESSES.VALID_DC)
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toEqual({
				verified: true,
				corrected: true,
				originalAddress: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
				correctedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
				representatives: expect.arrayContaining([
					expect.objectContaining({
						name: 'Representative for DC-AL',
						chamber: 'house',
						district: 'DC-AL'
					})
				]),
				district: 'DC-AL',
				message: 'Address verified successfully'
			});
		});

		it('should return error for invalid address format', async () => {
			const invalidRequest = new Request('http://localhost/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '123 Main St',
					city: 'New York',
					state: 'NY'
					// Missing zipCode
				})
			});

			const response = await POST({ request: invalidRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data).toEqual({
				verified: false,
				error: 'All address fields are required'
			});
		});

		it('should return error for invalid ZIP format', async () => {
			const invalidZipRequest = new Request('http://localhost/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...TEST_ADDRESSES.VALID_NY,
					zipCode: 'invalid-zip'
				})
			});

			const response = await POST({ request: invalidZipRequest } as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data).toEqual({
				verified: false,
				error: 'Invalid ZIP code format'
			});
		});

		it('should handle Census API address not found', async () => {
			// Mock Census API returning no matches
			(fetch as any).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({
					result: {
						addressMatches: []
					}
				})
			});

			const request = new Request('http://localhost/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(TEST_ADDRESSES.INVALID)
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data).toEqual({
				verified: false,
				error: 'Address not found. Please check and try again.'
			});
		});

		it('should handle Census API errors gracefully', async () => {
			// Mock Census API failure
			(fetch as any).mockRejectedValueOnce(new Error('Network error'));

			const request = new Request('http://localhost/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(TEST_ADDRESSES.VALID_NY)
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data).toEqual({
				verified: false,
				error: 'Address verification service temporarily unavailable'
			});
		});

		it('should handle API configuration correctly', async () => {
			// Since we have a mocked API key, test that it doesn't throw configuration error
			const request = new Request('http://localhost/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(TEST_ADDRESSES.VALID_DC)
			});

			// Mock fetch to fail so we test error handling path
			(fetch as any).mockRejectedValueOnce(new Error('Network error'));

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data).toEqual({
				verified: false,
				error: 'Address verification service temporarily unavailable'
			});
		});

		it('should extract congressional district correctly', async () => {
			// Mock NY district response
			const nyResponse = {
				result: {
					addressMatches: [{
						matchedAddress: '350 5TH AVE, NEW YORK, NY, 10118',
						geographies: {
							'119th Congressional Districts': [{
								CD119: '12'
							}]
						}
					}]
				}
			};

			(fetch as any).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(nyResponse)
			});

			const request = new Request('http://localhost/api/address/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(TEST_ADDRESSES.VALID_NY)
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(data.district).toBe('NY-12');
			expect(data.representatives[0].district).toBe('NY-12');
		});
	});
});