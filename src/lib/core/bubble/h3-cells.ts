/**
 * Bubble-to-H3 Cell Computation
 *
 * Converts a bubble (center + radius) to a set of H3 cell indices at
 * resolution 7 (~5.16 km²). Client-side computation — the cell list is
 * submitted as a private input to the BubbleMembershipProof circuit.
 *
 * The circuit then proves: "these cells are exactly those intersected by
 * a valid bubble, and I'm a registered user."
 */

import { latLngToCell, gridDisk, cellToLatLng, greatCircleDistance } from 'h3-js';

/** H3 resolution 7: ~5.16 km², ~1.4km edge length. */
export const H3_RESOLUTION = 7;

/** Maximum cells in a BubbleMembershipProof (circuit constraint). */
export const MAX_CELLS = 16;

/** Approximate edge length at resolution 7 in meters. */
const H3_RES7_EDGE_M = 1406.475;

/**
 * Compute H3 cells that intersect a bubble circle.
 *
 * Algorithm:
 * 1. Find the center cell at resolution 7
 * 2. Expand in rings until the bubble radius is covered
 * 3. Filter to cells whose center is within (radius + edge_length) of bubble center
 * 4. Truncate to MAX_CELLS (closest first), then sort deterministically
 *
 * @returns Sorted array of H3 index strings (at most MAX_CELLS)
 */
export function bubbleToH3Cells(
	center: { lat: number; lng: number },
	radiusMeters: number
): string[] {
	const centerCell = latLngToCell(center.lat, center.lng, H3_RESOLUTION);

	// k rings needed to cover the bubble radius.
	// Each ring adds ~edge_length * sqrt(3) meters of reach.
	const k = Math.min(
		Math.ceil(radiusMeters / (H3_RES7_EDGE_M * Math.sqrt(3))) + 1,
		8 // Cap at 8 rings to prevent excessive expansion for large bubbles
	);

	const candidates = gridDisk(centerCell, k);

	// Filter: cell center within (bubble_radius + cell edge length).
	// The edge length buffer accounts for cells partially intersecting the bubble.
	const threshold = radiusMeters + H3_RES7_EDGE_M;

	const filtered = candidates
		.map((cell) => {
			const [lat, lng] = cellToLatLng(cell);
			const dist = greatCircleDistance([center.lat, center.lng], [lat, lng], 'm');
			return { cell, dist };
		})
		.filter(({ dist }) => dist <= threshold)
		.sort((a, b) => a.dist - b.dist)
		.slice(0, MAX_CELLS)
		.map(({ cell }) => cell);

	// Sort deterministically (lexicographic on H3 index) for circuit consistency.
	// The circuit expects cells in a fixed order — sorting ensures the same bubble
	// always produces the same cell list regardless of gridDisk iteration order.
	return filtered.sort();
}

/**
 * Convert an H3 index string to a BN254 field element.
 * H3 indices are 64-bit integers — well within BN254 range (~254 bits).
 */
export function h3ToField(h3Index: string): bigint {
	// h3-js v4 returns indices as hex-encoded 64-bit integers (e.g., "872830828ffffff")
	return BigInt('0x' + h3Index);
}

/**
 * Convert a BN254 field element back to an H3 index string.
 */
export function fieldToH3(field: bigint): string {
	return field.toString(16);
}
