import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './+server';
import { TEST_ADDRESSES } from '../../../../test/setup';

// Mock SvelteKit error function
vi.mock('@sveltejs/kit', () => ({
	json: vi.fn((data) => ({
		json: async () => data,
		status: 200
	})),
	error: vi.fn((status, message) => {
		const error = new Error(message) as any;
		error.status = status;
		error.body = { message };
		throw error;
	})
}));

// Mock the address lookup service
vi.mock('$lib/congress/address-lookup', () => ({
	addressLookup: {
		lookupRepsByAddress: vi.fn()
	}
}));

describe('/api/address/lookup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST', () => {
		it('should lookup representatives for valid address', async () => {
			const { addressLookup } = await import('$lib/congress/address-lookup');

			// Mock successful lookup
			(addressLookup.lookupRepsByAddress as any).mockResolvedValue({
				house: {
					name: 'Eleanor Holmes Norton',
					party: 'Democratic',
					state: 'DC',
					district: '00',
					chamber: 'house',
					officeCode: 'N000147'
				},
				senate: [
					{
						name: 'Senior Senator',
						party: 'Democratic',
						state: 'DC',
						chamber: 'senate',
						officeCode: 'DCS1'
					}
				],
				district: {
					state: 'DC',
					district: '00'
				}
			});

			const request = new Request('http://localhost/api/address/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: TEST_ADDRESSES.VALID_DC.street,
					city: TEST_ADDRESSES.VALID_DC.city,
					state: TEST_ADDRESSES.VALID_DC.state,
					zip: TEST_ADDRESSES.VALID_DC.zip
				})
			});

			const response = await POST({ request } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toEqual({
				success: true,
				address: {
					street: '1600 Pennsylvania Avenue NW',
					city: 'Washington',
					state: 'DC',
					zip: '20500'
				},
				representatives: {
					house: expect.objectContaining({
						name: 'Eleanor Holmes Norton',
						chamber: 'house'
					}),
					senate: expect.arrayContaining([
						expect.objectContaining({
							chamber: 'senate'
						})
					])
				},
				district: {
					state: 'DC',
					district: '00'
				},
				message: 'Found 2 representatives for Washington, DC'
			});
		});

		it('should throw error for missing required fields', async () => {
			const request = new Request('http://localhost/api/address/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					street: '123 Main St',
					city: 'New York'
					// Missing state and zip
				})
			});

			await expect(POST({ request } as any)).rejects.toThrow('Missing required address fields: street, city, state, zip');
		});

		it('should throw error for invalid state code format', async () => {
			const request = new Request('http://localhost/api/address/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...TEST_ADDRESSES.VALID_NY,
					state: 'New York' // Invalid - should be 2 letters
				})
			});

			await expect(POST({ request } as any)).rejects.toThrow('State must be a valid 2-letter state code (e.g., CA, NY, TX)');
		});

		it('should throw error for invalid ZIP code format', async () => {
			const request = new Request('http://localhost/api/address/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...TEST_ADDRESSES.VALID_NY,
					zip: '123' // Invalid ZIP
				})
			});

			await expect(POST({ request } as any)).rejects.toThrow('ZIP code must be in format 12345 or 12345-6789');
		});

		it('should throw error for lookup service errors', async () => {
			const { addressLookup } = await import('$lib/congress/address-lookup');

			// Mock lookup failure
			(addressLookup.lookupRepsByAddress as any).mockRejectedValue(
				new Error('Congress API error')
			);

			const request = new Request('http://localhost/api/address/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(TEST_ADDRESSES.VALID_DC)
			});

			await expect(POST({ request } as any)).rejects.toThrow('Congressional data service is temporarily unavailable');
		});
	});

	describe('GET (test endpoint)', () => {
		it('should return mock representatives for testing', async () => {
			const url = new URL('http://localhost/api/address/lookup?state=TX&district=05');
			
			const response = await GET({ url } as any);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toEqual({
				success: true,
				test: true,
				representatives: {
					house: expect.objectContaining({
						name: 'Representative for TX-05',
						state: 'TX',
						district: '05'
					}),
					senate: expect.arrayContaining([
						expect.objectContaining({
							name: 'Senior Senator for TX',
							state: 'TX'
						})
					])
				},
				district: {
					state: 'TX',
					district: '05'
				},
				message: 'Mock representatives for TX-05'
			});
		});

		it('should throw error for missing state parameter', async () => {
			const url = new URL('http://localhost/api/address/lookup?district=05');
			
			await expect(GET({ url } as any)).rejects.toThrow('state parameter is required');
		});

		it('should throw error for missing district parameter', async () => {
			const url = new URL('http://localhost/api/address/lookup?state=TX');
			
			await expect(GET({ url } as any)).rejects.toThrow('district parameter is required');
		});
	});
});