/**
 * Unit Tests: Unified resolver dispatcher
 * Tests resolveDistrict routing and result normalization.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the individual resolvers
const mockResolveUK = vi.fn();
const mockResolveCA = vi.fn();
const mockResolveAU = vi.fn();

vi.mock('$lib/core/location/resolvers/uk-postcodes', () => ({
	resolveUKPostcode: (...args: any[]) => mockResolveUK(...args),
	isValidUKPostcode: () => true
}));

vi.mock('$lib/core/location/resolvers/canada-postal', () => ({
	resolveCanadaPostalCode: (...args: any[]) => mockResolveCA(...args),
	isValidCanadaPostalCode: () => true
}));

vi.mock('$lib/core/location/resolvers/australia-aec', () => ({
	resolveAustraliaPostcode: (...args: any[]) => mockResolveAU(...args),
	isValidAustraliaPostcode: () => true
}));

const { resolveDistrict } = await import('$lib/core/location/resolvers/index');

beforeEach(() => {
	vi.clearAllMocks();
});

describe('resolveDistrict', () => {
	it('routes GB to UK resolver', async () => {
		mockResolveUK.mockResolvedValue({
			constituencyId: 'E14000639',
			constituencyName: 'Cities of London and Westminster',
			council: 'Westminster',
			region: 'London'
		});

		const result = await resolveDistrict('GB', 'SW1A 1AA');
		expect(mockResolveUK).toHaveBeenCalledWith('SW1A 1AA');
		expect(result.districtId).toBe('E14000639');
		expect(result.districtType).toBe('uk-constituency');
		expect(result.country).toBe('GB');
		expect(result.extra?.council).toBe('Westminster');
	});

	it('routes CA to Canada resolver', async () => {
		mockResolveCA.mockResolvedValue({
			ridingId: '35075',
			ridingName: 'Ottawa Centre',
			province: 'ON'
		});

		const result = await resolveDistrict('CA', 'K1A 0A6');
		expect(mockResolveCA).toHaveBeenCalledWith('K1A 0A6');
		expect(result.districtId).toBe('35075');
		expect(result.districtType).toBe('ca-riding');
		expect(result.country).toBe('CA');
		expect(result.extra?.province).toBe('ON');
	});

	it('routes AU to Australia resolver', async () => {
		mockResolveAU.mockResolvedValue({
			electorateId: 'melbourne',
			electorateName: 'Melbourne',
			state: 'VIC'
		});

		const result = await resolveDistrict('AU', '3000');
		expect(mockResolveAU).toHaveBeenCalledWith('3000');
		expect(result.districtId).toBe('melbourne');
		expect(result.districtType).toBe('au-electorate');
		expect(result.country).toBe('AU');
		expect(result.extra?.state).toBe('VIC');
	});

	it('throws for US (uses Shadow Atlas instead)', async () => {
		await expect(resolveDistrict('US', '20500')).rejects.toThrow('Shadow Atlas');
	});

	it('throws for unsupported country code', async () => {
		await expect(resolveDistrict('FR', '75001')).rejects.toThrow('Unsupported country code');
	});

	it('normalizes country code to uppercase', async () => {
		mockResolveUK.mockResolvedValue({
			constituencyId: 'E14000639',
			constituencyName: 'Test',
			council: 'Test',
			region: 'Test'
		});

		const result = await resolveDistrict('gb', 'SW1A 1AA');
		expect(result.country).toBe('GB');
	});
});
