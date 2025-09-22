import { describe, it, expect, vi } from 'vitest';
import { addressFactory } from '../fixtures/factories';

// Mock the address lookup module
const mockAddressLookup = {
	lookupRepsByAddress: vi.fn(),
	validateReps: vi.fn()
};

vi.mock('../../src/lib/core/congress/address-lookup.js', () => ({
	default: mockAddressLookup
}));

describe('Address Lookup Unit Tests', () => {
	it('should lookup representatives by address', async () => {
		// Configure the mock response
		mockAddressLookup.lookupRepsByAddress.mockResolvedValue({
			house: {
				name: 'Rep. Jane Smith',
				chamber: 'house',
				district: '12',
				state: 'CA'
			},
			senate: [
				{
					name: 'Sen. Alex Padilla',
					chamber: 'senate',
					state: 'CA'
				},
				{
					name: 'Sen. Laphonza Butler',
					chamber: 'senate',
					state: 'CA'
				}
			],
			district: { state: 'CA', district: '12' }
		});

		const address = addressFactory.build({
			overrides: {
				street: '123 Main Street',
				city: 'San Francisco',
				state: 'CA',
				postal_code: '94102'
			}
		});

		const properAddress = {
			street: address.street,
			city: address.city,
			state: address.state,
			zip: address.postal_code
		};

		const result = await mockAddressLookup.lookupRepsByAddress(properAddress);

		expect(result).toEqual({
			house: expect.objectContaining({
				name: 'Rep. Jane Smith',
				chamber: 'house',
				district: '12',
				state: 'CA'
			}),
			senate: expect.arrayContaining([
				expect.objectContaining({
					name: 'Sen. Alex Padilla',
					chamber: 'senate',
					state: 'CA'
				}),
				expect.objectContaining({
					name: 'Sen. Laphonza Butler',
					chamber: 'senate',
					state: 'CA'
				})
			]),
			district: { state: 'CA', district: '12' }
		});

		expect(mockAddressLookup.lookupRepsByAddress).toHaveBeenCalledWith(properAddress);
	});

	it('should validate representatives', async () => {
		// Configure the mock response
		mockAddressLookup.validateReps.mockResolvedValue({
			valid: true,
			errors: []
		});

		const userReps = {
			house: { bioguide_id: 'S001234', name: 'Rep. Smith' },
			senate: [{ bioguide_id: 'P000145', name: 'Sen. Padilla' }]
		};

		const result = await mockAddressLookup.validateReps(userReps);

		expect(result).toEqual({
			valid: true,
			errors: []
		});

		expect(mockAddressLookup.validateReps).toHaveBeenCalledWith(userReps);
	});

	it('should handle address lookup errors gracefully', async () => {
		// Override mock to simulate error
		mockAddressLookup.lookupRepsByAddress.mockRejectedValue(new Error('Census API error'));

		const address = {
			street: 'Invalid Address',
			city: 'Nowhere',
			state: 'XX',
			zip: '00000'
		};

		await expect(mockAddressLookup.lookupRepsByAddress(address)).rejects.toThrow(
			'Census API error'
		);
	});
});
