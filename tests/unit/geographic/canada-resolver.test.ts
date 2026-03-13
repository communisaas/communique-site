/**
 * Unit Tests: Canada postal code -> riding resolver
 * Tests resolveCanadaPostalCode and isValidCanadaPostalCode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
	globalThis.fetch = vi.fn();
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const { resolveCanadaPostalCode, isValidCanadaPostalCode } = await import(
	'$lib/core/location/resolvers/canada-postal'
);

// =============================================================================
// isValidCanadaPostalCode
// =============================================================================

describe('isValidCanadaPostalCode', () => {
	it('accepts valid Canadian postal codes', () => {
		expect(isValidCanadaPostalCode('K1A 0A6')).toBe(true);
		expect(isValidCanadaPostalCode('V6B 3K9')).toBe(true);
		expect(isValidCanadaPostalCode('M5V 2T6')).toBe(true);
	});

	it('accepts postal codes without space', () => {
		expect(isValidCanadaPostalCode('K1A0A6')).toBe(true);
	});

	it('accepts lowercase postal codes', () => {
		expect(isValidCanadaPostalCode('k1a 0a6')).toBe(true);
	});

	it('rejects invalid postal codes', () => {
		expect(isValidCanadaPostalCode('12345')).toBe(false);
		expect(isValidCanadaPostalCode('INVALID')).toBe(false);
		expect(isValidCanadaPostalCode('')).toBe(false);
		expect(isValidCanadaPostalCode('SW1A 1AA')).toBe(false); // UK format
	});
});

// =============================================================================
// resolveCanadaPostalCode
// =============================================================================

describe('resolveCanadaPostalCode', () => {
	it('resolves a valid postal code to federal riding', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify({
					boundaries_centroid: [
						{
							boundary_set_name: 'Federal electoral district',
							name: 'Ottawa Centre',
							external_id: '35075',
							metadata: { province: 'ON' }
						}
					],
					province: 'ON'
				}),
				{ status: 200 }
			)
		);

		const result = await resolveCanadaPostalCode('K1A 0A6');
		expect(result.ridingId).toBe('35075');
		expect(result.ridingName).toBe('Ottawa Centre');
		expect(result.province).toBe('ON');
	});

	it('throws on invalid postal code format', async () => {
		await expect(resolveCanadaPostalCode('12345')).rejects.toThrow(
			'Invalid Canadian postal code format'
		);
	});

	it('throws on API error', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response('Error', { status: 500 })
		);

		await expect(resolveCanadaPostalCode('K1A 0A6')).rejects.toThrow(
			'represent.opennorth.ca returned 500'
		);
	});

	it('throws when no federal riding found', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify({
					boundaries_centroid: [
						{
							boundary_set_name: 'Provincial electoral district',
							name: 'Some Provincial District',
							external_id: '99999'
						}
					]
				}),
				{ status: 200 }
			)
		);

		await expect(resolveCanadaPostalCode('K1A 0A6')).rejects.toThrow(
			'No federal riding found'
		);
	});

	it('handles API timeout', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
			new DOMException('The operation was aborted', 'AbortError')
		);

		await expect(resolveCanadaPostalCode('K1A 0A6')).rejects.toThrow();
	});

	it('normalizes postal code by removing space', async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			new Response(
				JSON.stringify({
					boundaries_centroid: [
						{
							boundary_set_name: 'Federal electoral district',
							name: 'Test',
							external_id: '99999'
						}
					],
					province: 'ON'
				}),
				{ status: 200 }
			)
		);

		await resolveCanadaPostalCode('k1a 0a6');
		const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(url).toContain('K1A0A6');
	});
});
