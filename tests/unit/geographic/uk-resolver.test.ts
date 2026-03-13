/**
 * Unit Tests: UK postcode -> constituency resolver
 * Tests resolveUKPostcode and isValidUKPostcode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
	globalThis.fetch = vi.fn();
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const { resolveUKPostcode, isValidUKPostcode } = await import(
	'$lib/core/location/resolvers/uk-postcodes'
);

// =============================================================================
// isValidUKPostcode
// =============================================================================

describe('isValidUKPostcode', () => {
	it('accepts valid UK postcodes', () => {
		expect(isValidUKPostcode('SW1A 1AA')).toBe(true);
		expect(isValidUKPostcode('EC1A 1BB')).toBe(true);
		expect(isValidUKPostcode('W1A 0AX')).toBe(true);
		expect(isValidUKPostcode('M1 1AE')).toBe(true);
		expect(isValidUKPostcode('B33 8TH')).toBe(true);
	});

	it('accepts postcodes without space', () => {
		expect(isValidUKPostcode('SW1A1AA')).toBe(true);
	});

	it('accepts lowercase postcodes', () => {
		expect(isValidUKPostcode('sw1a 1aa')).toBe(true);
	});

	it('rejects invalid postcodes', () => {
		expect(isValidUKPostcode('12345')).toBe(false);
		expect(isValidUKPostcode('INVALID')).toBe(false);
		expect(isValidUKPostcode('')).toBe(false);
		expect(isValidUKPostcode('123 ABC')).toBe(false);
	});
});

// =============================================================================
// resolveUKPostcode
// =============================================================================

describe('resolveUKPostcode', () => {
	it('resolves a valid postcode to constituency', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify({
					status: 200,
					result: {
						parliamentary_constituency: 'Cities of London and Westminster',
						admin_district: 'Westminster',
						region: 'London',
						codes: {
							parliamentary_constituency: 'E14000639'
						}
					}
				}),
				{ status: 200 }
			)
		);

		const result = await resolveUKPostcode('SW1A 1AA');
		expect(result.constituencyId).toBe('E14000639');
		expect(result.constituencyName).toBe('Cities of London and Westminster');
		expect(result.council).toBe('Westminster');
		expect(result.region).toBe('London');
	});

	it('throws on invalid postcode format', async () => {
		await expect(resolveUKPostcode('12345')).rejects.toThrow('Invalid UK postcode format');
	});

	it('throws on API error', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response('Not Found', { status: 404 })
		);

		await expect(resolveUKPostcode('SW1A 1AA')).rejects.toThrow('postcodes.io returned 404');
	});

	it('throws when postcode not found', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify({ status: 404, result: null }),
				{ status: 200 }
			)
		);

		await expect(resolveUKPostcode('SW1A 1AA')).rejects.toThrow('Postcode not found');
	});

	it('handles API timeout', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
			new DOMException('The operation was aborted', 'AbortError')
		);

		await expect(resolveUKPostcode('SW1A 1AA')).rejects.toThrow();
	});

	it('normalizes postcode for API call', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify({
					status: 200,
					result: {
						parliamentary_constituency: 'Test',
						admin_district: 'Test',
						region: 'Test',
						codes: { parliamentary_constituency: 'E14000001' }
					}
				}),
				{ status: 200 }
			)
		);

		await resolveUKPostcode('  sw1a  1aa  ');
		const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(url).toContain('SW1A+1AA');
	});
});
