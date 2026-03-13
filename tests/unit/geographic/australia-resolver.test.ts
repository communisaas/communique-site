/**
 * Unit Tests: Australia postcode -> electorate resolver
 * Tests resolveAustraliaPostcode and isValidAustraliaPostcode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
	globalThis.fetch = vi.fn();
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const { resolveAustraliaPostcode, isValidAustraliaPostcode } = await import(
	'$lib/core/location/resolvers/australia-aec'
);

// =============================================================================
// isValidAustraliaPostcode
// =============================================================================

describe('isValidAustraliaPostcode', () => {
	it('accepts valid Australian postcodes', () => {
		expect(isValidAustraliaPostcode('3000')).toBe(true);
		expect(isValidAustraliaPostcode('2000')).toBe(true);
		expect(isValidAustraliaPostcode('0800')).toBe(true);
	});

	it('rejects invalid postcodes', () => {
		expect(isValidAustraliaPostcode('123')).toBe(false);
		expect(isValidAustraliaPostcode('12345')).toBe(false);
		expect(isValidAustraliaPostcode('ABCD')).toBe(false);
		expect(isValidAustraliaPostcode('')).toBe(false);
	});
});

// =============================================================================
// resolveAustraliaPostcode
// =============================================================================

describe('resolveAustraliaPostcode', () => {
	it('resolves a valid postcode to electorate', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify([
					{
						id: 'melbourne',
						name: 'Melbourne',
						state: 'VIC'
					}
				]),
				{ status: 200 }
			)
		);

		const result = await resolveAustraliaPostcode('3000');
		expect(result.electorateId).toBe('melbourne');
		expect(result.electorateName).toBe('Melbourne');
		expect(result.state).toBe('VIC');
	});

	it('throws on invalid postcode format', async () => {
		await expect(resolveAustraliaPostcode('123')).rejects.toThrow(
			'Invalid Australian postcode format'
		);
	});

	it('throws on API error', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response('Error', { status: 500 })
		);

		await expect(resolveAustraliaPostcode('3000')).rejects.toThrow('AEC API returned 500');
	});

	it('throws when no electorate found', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(JSON.stringify([]), { status: 200 })
		);

		await expect(resolveAustraliaPostcode('3000')).rejects.toThrow(
			'No electorate found for postcode'
		);
	});

	it('handles multi-electorate postcodes (returns first)', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify([
					{ id: 'melbourne', name: 'Melbourne', state: 'VIC' },
					{ id: 'melbourne-ports', name: 'Melbourne Ports', state: 'VIC' }
				]),
				{ status: 200 }
			)
		);

		const result = await resolveAustraliaPostcode('3000');
		expect(result.electorateName).toBe('Melbourne');
	});

	it('handles API timeout', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
			new DOMException('The operation was aborted', 'AbortError')
		);

		await expect(resolveAustraliaPostcode('3000')).rejects.toThrow();
	});

	it('handles nested response shape with electorates key', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify({
					electorates: [{ name: 'Sydney', state: 'NSW' }]
				}),
				{ status: 200 }
			)
		);

		const result = await resolveAustraliaPostcode('2000');
		expect(result.electorateName).toBe('Sydney');
		expect(result.state).toBe('NSW');
	});
});
