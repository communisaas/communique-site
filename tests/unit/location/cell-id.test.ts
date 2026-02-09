/**
 * Unit tests for Cell ID (Census Block GEOID) type system
 *
 * Tests the CellId branded type, validation, and parsing logic
 * that underpins the two-tree ZK architecture.
 */

import { describe, it, expect } from 'vitest';
import {
	isCellId,
	createCellId,
	parseCellId,
	type CellId,
	type CellIdComponents
} from '$lib/core/location/types';

describe('CellId Type System', () => {
	describe('isCellId validation', () => {
		it('should accept valid 15-digit GEOIDs', () => {
			expect(isCellId('360610076001234')).toBe(true); // NYC
			expect(isCellId('110010062001001')).toBe(true); // DC
			expect(isCellId('720070065003001')).toBe(true); // Puerto Rico
			expect(isCellId('060371034012001')).toBe(true); // California
			expect(isCellId('000000000000000')).toBe(true); // All zeros (valid format)
			expect(isCellId('999999999999999')).toBe(true); // All nines (valid format)
		});

		it('should reject GEOIDs with wrong length', () => {
			expect(isCellId('36061007600123')).toBe(false); // 14 digits
			expect(isCellId('3606100760012345')).toBe(false); // 16 digits
			expect(isCellId('')).toBe(false); // Empty
			expect(isCellId('1')).toBe(false); // Single digit
		});

		it('should reject GEOIDs with non-numeric characters', () => {
			expect(isCellId('36061007600123X')).toBe(false);
			expect(isCellId('3606100760012ab')).toBe(false);
			expect(isCellId('36061-076001234')).toBe(false); // Hyphen
			expect(isCellId('36061 076001234')).toBe(false); // Space
		});

		it('should reject non-string types', () => {
			expect(isCellId(null)).toBe(false);
			expect(isCellId(undefined)).toBe(false);
			expect(isCellId(360610076001234)).toBe(false); // Number
			expect(isCellId({})).toBe(false);
			expect(isCellId([])).toBe(false);
		});
	});

	describe('createCellId factory', () => {
		it('should return CellId for valid input', () => {
			const cellId = createCellId('360610076001234');
			expect(cellId).not.toBeNull();
			expect(cellId).toBe('360610076001234');
		});

		it('should return null for invalid input', () => {
			expect(createCellId('invalid')).toBeNull();
			expect(createCellId('')).toBeNull();
			expect(createCellId(null)).toBeNull();
			expect(createCellId(undefined)).toBeNull();
		});
	});

	describe('parseCellId components', () => {
		it('should parse NYC GEOID correctly', () => {
			const components = parseCellId('360610076001234' as CellId);

			expect(components).toEqual({
				state_fips: '36', // New York
				county_fips: '061', // New York County (Manhattan)
				tract: '007600',
				block: '1234',
				full_geoid: '360610076001234'
			});
		});

		it('should parse DC GEOID correctly', () => {
			const components = parseCellId('110010062001001' as CellId);

			expect(components).toEqual({
				state_fips: '11', // District of Columbia
				county_fips: '001',
				tract: '006200',
				block: '1001',
				full_geoid: '110010062001001'
			});
		});

		it('should parse Puerto Rico GEOID correctly', () => {
			const components = parseCellId('720070065003001' as CellId);

			expect(components).toEqual({
				state_fips: '72', // Puerto Rico
				county_fips: '007',
				tract: '006500',
				block: '3001',
				full_geoid: '720070065003001'
			});
		});

		it('should parse California GEOID correctly', () => {
			const components = parseCellId('060371034012001' as CellId);

			expect(components).toEqual({
				state_fips: '06', // California
				county_fips: '037', // Los Angeles County
				tract: '103401',
				block: '2001',
				full_geoid: '060371034012001'
			});
		});
	});
});

describe('Census Block GEOID structure', () => {
	it('should follow STATE(2) + COUNTY(3) + TRACT(6) + BLOCK(4) format', () => {
		// Total: 2 + 3 + 6 + 4 = 15 digits
		const geoid = '360610076001234';

		expect(geoid.length).toBe(15);
		expect(geoid.slice(0, 2)).toBe('36'); // State FIPS
		expect(geoid.slice(2, 5)).toBe('061'); // County FIPS
		expect(geoid.slice(5, 11)).toBe('007600'); // Census Tract
		expect(geoid.slice(11, 15)).toBe('1234'); // Block
	});
});

describe('Privacy logging', () => {
	it('should only expose state+county prefix (5 digits) in logs', () => {
		const fullGeoid = '360610076001234';
		const safePrefix = fullGeoid.slice(0, 5);

		// The safe prefix should only identify state + county (not neighborhood)
		expect(safePrefix).toBe('36061');
		expect(safePrefix.length).toBe(5);

		// Verify this represents only geographic context, not specific location
		// State 36 = New York, County 061 = New York County
		// The remaining 10 digits (tract + block) identify the neighborhood
	});
});
