/**
 * Unit Tests: Representative lookup service
 * Tests lookupRepresentatives routing for US vs international.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const {
	mockDbIntlRepFindMany,
	mockGetOfficials
} = vi.hoisted(() => ({
	mockDbIntlRepFindMany: vi.fn(),
	mockGetOfficials: vi.fn()
}));

vi.mock('$lib/core/db', () => ({
	db: {
		internationalRepresentative: {
			findMany: (...args: any[]) => mockDbIntlRepFindMany(...args)
		}
	}
}));

vi.mock('$lib/core/shadow-atlas/client', () => ({
	getOfficials: (...args: any[]) => mockGetOfficials(...args)
}));

const { lookupRepresentatives } = await import('$lib/server/geographic/rep-lookup');

beforeEach(() => {
	vi.clearAllMocks();
});

// =============================================================================
// lookupRepresentatives
// =============================================================================

describe('lookupRepresentatives', () => {
	it('routes US to Shadow Atlas', async () => {
		mockGetOfficials.mockResolvedValue({
			district_code: 'CA-12',
			officials: [
				{
					name: 'Nancy Pelosi',
					party: 'Democrat',
					chamber: 'House',
					office: '2454 Rayburn HOB',
					phone: '202-225-4965',
					bioguide_id: 'P000197',
					website_url: 'https://pelosi.house.gov'
				}
			]
		});

		const results = await lookupRepresentatives('US', 'CA-12');
		expect(mockGetOfficials).toHaveBeenCalledWith('CA-12');
		expect(results.length).toBe(1);
		expect(results[0].name).toBe('Nancy Pelosi');
		expect(results[0].countryCode).toBe('US');
	});

	it('routes GB to InternationalRepresentative table', async () => {
		mockDbIntlRepFindMany.mockResolvedValue([
			{
				id: 'rep-1',
				countryCode: 'GB',
				constituencyId: 'E14000639',
				constituencyName: 'Cities of London and Westminster',
				name: 'Nickie Aiken',
				party: 'Conservative',
				chamber: 'commons',
				office: null,
				phone: null,
				email: 'nickie.aiken.mp@parliament.uk',
				websiteUrl: null
			}
		]);

		const results = await lookupRepresentatives('GB', 'E14000639');
		expect(mockDbIntlRepFindMany).toHaveBeenCalledWith({
			where: { countryCode: 'GB', constituencyId: 'E14000639' }
		});
		expect(results.length).toBe(1);
		expect(results[0].name).toBe('Nickie Aiken');
		expect(results[0].countryCode).toBe('GB');
	});

	it('routes CA to InternationalRepresentative table', async () => {
		mockDbIntlRepFindMany.mockResolvedValue([
			{
				id: 'rep-2',
				countryCode: 'CA',
				constituencyId: '35075',
				constituencyName: 'Ottawa Centre',
				name: 'Yasir Naqvi',
				party: 'Liberal',
				chamber: null,
				office: null,
				phone: null,
				email: null,
				websiteUrl: null
			}
		]);

		const results = await lookupRepresentatives('CA', '35075');
		expect(results.length).toBe(1);
		expect(results[0].name).toBe('Yasir Naqvi');
	});

	it('returns empty array for unsupported country', async () => {
		const results = await lookupRepresentatives('FR', '75001');
		expect(results).toEqual([]);
		expect(mockGetOfficials).not.toHaveBeenCalled();
		expect(mockDbIntlRepFindMany).not.toHaveBeenCalled();
	});

	it('returns empty array when Shadow Atlas returns no officials', async () => {
		mockGetOfficials.mockResolvedValue({ officials: [] });
		const results = await lookupRepresentatives('US', 'XX-99');
		expect(results).toEqual([]);
	});

	it('returns empty array on Shadow Atlas error', async () => {
		mockGetOfficials.mockRejectedValue(new Error('Network error'));
		const results = await lookupRepresentatives('US', 'CA-12');
		expect(results).toEqual([]);
	});

	it('normalizes country code to uppercase', async () => {
		mockDbIntlRepFindMany.mockResolvedValue([]);
		await lookupRepresentatives('gb', 'E14000639');
		expect(mockDbIntlRepFindMany).toHaveBeenCalledWith({
			where: { countryCode: 'GB', constituencyId: 'E14000639' }
		});
	});
});
