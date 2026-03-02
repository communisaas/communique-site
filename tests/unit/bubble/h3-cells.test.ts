import { describe, it, expect } from 'vitest';
import { bubbleToH3Cells, h3ToField, fieldToH3, H3_RESOLUTION, MAX_CELLS } from '$lib/core/bubble/h3-cells';
import { latLngToCell, getResolution } from 'h3-js';

describe('h3-cells', () => {
	describe('bubbleToH3Cells', () => {
		it('returns at least the center cell for a small bubble', () => {
			// Small bubble (100m) in downtown SF
			const cells = bubbleToH3Cells({ lat: 37.7749, lng: -122.4194 }, 100);
			expect(cells.length).toBeGreaterThanOrEqual(1);
			expect(cells.length).toBeLessThanOrEqual(MAX_CELLS);

			// Center cell should be included
			const centerCell = latLngToCell(37.7749, -122.4194, H3_RESOLUTION);
			expect(cells).toContain(centerCell);
		});

		it('returns more cells for larger bubbles', () => {
			const center = { lat: 37.7749, lng: -122.4194 };
			const smallBubble = bubbleToH3Cells(center, 500);
			const largeBubble = bubbleToH3Cells(center, 5000);

			expect(largeBubble.length).toBeGreaterThan(smallBubble.length);
		});

		it('never exceeds MAX_CELLS', () => {
			// Very large bubble (50km) — should still be capped
			const cells = bubbleToH3Cells({ lat: 37.7749, lng: -122.4194 }, 50000);
			expect(cells.length).toBeLessThanOrEqual(MAX_CELLS);
		});

		it('returns sorted cells (deterministic order)', () => {
			const cells = bubbleToH3Cells({ lat: 37.7749, lng: -122.4194 }, 3000);
			const sorted = [...cells].sort();
			expect(cells).toEqual(sorted);
		});

		it('is deterministic for same input', () => {
			const center = { lat: 40.7128, lng: -74.006 }; // NYC
			const radius = 2000;
			const cells1 = bubbleToH3Cells(center, radius);
			const cells2 = bubbleToH3Cells(center, radius);
			expect(cells1).toEqual(cells2);
		});

		it('all cells are at resolution 7', () => {
			const cells = bubbleToH3Cells({ lat: 51.5074, lng: -0.1278 }, 2000); // London
			for (const cell of cells) {
				expect(getResolution(cell)).toBe(H3_RESOLUTION);
			}
		});
	});

	describe('h3ToField', () => {
		it('converts H3 index to bigint', () => {
			const cell = latLngToCell(37.7749, -122.4194, H3_RESOLUTION);
			const field = h3ToField(cell);
			expect(typeof field).toBe('bigint');
			expect(field).toBeGreaterThan(0n);
		});

		it('is within BN254 range (< 2^254)', () => {
			const cell = latLngToCell(37.7749, -122.4194, H3_RESOLUTION);
			const field = h3ToField(cell);
			// H3 indices are 64-bit, so well within BN254 (~254 bits)
			expect(field).toBeLessThan(1n << 254n);
		});
	});

	describe('fieldToH3', () => {
		it('roundtrips with h3ToField', () => {
			const cell = latLngToCell(37.7749, -122.4194, H3_RESOLUTION);
			const field = h3ToField(cell);
			const back = fieldToH3(field);
			expect(back).toBe(cell);
		});
	});
});
