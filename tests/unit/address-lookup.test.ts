import { describe, it, expect } from 'vitest';
import { addressFactory } from '../fixtures/factories';
import mockRegistry from '../mocks/registry';

describe('Address Lookup Unit Tests', () => {
	it('should lookup representatives by address', async () => {
		const mocks = mockRegistry.setupMocks();
		const { addressLookup } = mocks['$lib/core/congress/address-lookup'];

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

		const result = await addressLookup.lookupRepsByAddress(properAddress);

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

		expect(addressLookup.lookupRepsByAddress).toHaveBeenCalledWith(properAddress);
	});

	it('should validate representatives', async () => {
		const mocks = mockRegistry.setupMocks();
		const { addressLookup } = mocks['$lib/core/congress/address-lookup'];

		const userReps = {
			house: { bioguideId: 'S001234', name: 'Rep. Smith' },
			senate: [{ bioguideId: 'P000145', name: 'Sen. Padilla' }]
		};

		const result = await addressLookup.validateReps(userReps);

		expect(result).toEqual({
			valid: true,
			errors: []
		});

		expect(addressLookup.validateReps).toHaveBeenCalledWith(userReps);
	});

	it('should handle address lookup errors gracefully', async () => {
		const mocks = mockRegistry.setupMocks();
		const { addressLookup } = mocks['$lib/core/congress/address-lookup'];

		// Override mock to simulate error
		addressLookup.lookupRepsByAddress.mockRejectedValue(new Error('Census API error'));

		const address = {
			street: 'Invalid Address',
			city: 'Nowhere',
			state: 'XX',
			zip: '00000'
		};

		await expect(addressLookup.lookupRepsByAddress(address)).rejects.toThrow('Census API error');
	});
});
