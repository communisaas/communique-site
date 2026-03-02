/**
 * Bubble Geometry Engine
 *
 * Client-side spatial math for the Postal Bubble identity object.
 * Zero external dependencies. All coordinates projected to Web Mercator
 * on load for sub-millisecond per-frame intersection tests.
 *
 * Performance budget: 30 fences × 20 vertices + 20 districts × 40 vertices
 * = ~1,400 segment tests. BBOX cull ~80% → ~350 tests × ~50ns = 0.02ms/frame.
 * 800x headroom within 16.6ms frame budget.
 */

const DEG2RAD = Math.PI / 180;
const R = 6378137; // WGS84 semi-major axis, meters
const MAX_MERC_LAT = 85.051129; // Web Mercator latitude limit

/** Project WGS84 to Web Mercator meters. Clamps lat to ±85.05° (Mercator limit). */
export function toMerc(lng: number, lat: number): [number, number] {
	const clampedLat = Math.max(-MAX_MERC_LAT, Math.min(MAX_MERC_LAT, lat));
	return [lng * DEG2RAD * R, Math.log(Math.tan((90 + clampedLat) * DEG2RAD / 2)) * R];
}

// ============================================================================
// Pre-projected types (stored in Float64Array for cache-friendly iteration)
// ============================================================================

export interface ProjectedFence {
	id: string;
	layer: string;
	sides: [{ id: string; name: string }, { id: string; name: string }];
	landmark?: string;
	coords: Float64Array; // [x0, y0, x1, y1, ...] Mercator meters
	vertexCount: number;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface ProjectedRing {
	coords: Float64Array; // [x0, y0, x1, y1, ...]
	vertexCount: number;
	isHole: boolean;
}

export interface ProjectedDistrict {
	id: string;
	name: string;
	display: string;
	layer: string;
	rings: ProjectedRing[]; // exterior ring(s) + holes
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

// ============================================================================
// Core intersection tests
// ============================================================================

/** Test if a line segment intersects a circle. Pure arithmetic. */
function segmentHitsCircle(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number,
	r: number
): boolean {
	const dx = bx - ax,
		dy = by - ay;
	const fx = ax - cx,
		fy = ay - cy;
	const a = dx * dx + dy * dy;
	// Degenerate segment (zero-length): test point-in-circle
	if (a < 1e-12) return fx * fx + fy * fy <= r * r;
	const b = 2 * (fx * dx + fy * dy);
	const c = fx * fx + fy * fy - r * r;
	const disc = b * b - 4 * a * c;
	if (disc < 0) return false;
	const sq = Math.sqrt(disc);
	const t1 = (-b - sq) / (2 * a);
	const t2 = (-b + sq) / (2 * a);
	return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

/** Test if a fence has ANY segment intersecting the bubble circle. */
export function fenceInsideBubble(
	f: ProjectedFence,
	cx: number,
	cy: number,
	r: number
): boolean {
	// BBOX cull (~80% of fences eliminated here)
	if (cx + r < f.minX || cx - r > f.maxX || cy + r < f.minY || cy - r > f.maxY) return false;
	for (let i = 0; i < f.vertexCount - 1; i++) {
		const j = i * 2;
		if (segmentHitsCircle(f.coords[j], f.coords[j + 1], f.coords[j + 2], f.coords[j + 3], cx, cy, r))
			return true;
	}
	return false;
}

/** Winding number for a single ring. */
function windingNumber(coords: Float64Array, vertexCount: number, px: number, py: number): number {
	let winding = 0;
	for (let i = 0; i < vertexCount - 1; i++) {
		const j = i * 2;
		const y0 = coords[j + 1],
			y1 = coords[j + 3];
		if (y0 <= py) {
			if (y1 > py) {
				const cross =
					(coords[j + 2] - coords[j]) * (py - y0) - (px - coords[j]) * (y1 - y0);
				if (cross > 0) winding++;
			}
		} else if (y1 <= py) {
			const cross =
				(coords[j + 2] - coords[j]) * (py - y0) - (px - coords[j]) * (y1 - y0);
			if (cross < 0) winding--;
		}
	}
	return winding;
}

/** Test if the bubble center is inside a district (MultiPolygon + holes aware). */
export function pointInDistrict(d: ProjectedDistrict, px: number, py: number): boolean {
	if (px < d.minX || px > d.maxX || py < d.minY || py > d.maxY) return false;
	for (const ring of d.rings) {
		if (ring.isHole) continue; // check exteriors first
		if (windingNumber(ring.coords, ring.vertexCount, px, py) !== 0) {
			// Inside an exterior ring — check holes
			for (const hole of d.rings) {
				if (!hole.isHole) continue;
				if (windingNumber(hole.coords, hole.vertexCount, px, py) !== 0) {
					return false; // inside a hole → not in this district
				}
			}
			return true;
		}
	}
	return false;
}

// ============================================================================
// Projection from API response to pre-computed structures
// ============================================================================

/** API fence shape (from BubbleQueryResponse) */
export interface ApiFence {
	id: string;
	layer: string;
	geometry: { type: 'LineString'; coordinates: number[][] };
	sides: [{ districtId: string; name: string }, { districtId: string; name: string }];
	landmark?: string;
	landmarkSource?: string;
}

/** API district shape (from BubbleQueryResponse) */
export interface ApiDistrict {
	id: string;
	name: string;
	display: string;
	layer: string;
	clipGeometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

/** Project API fences into pre-computed Float64Array structures. Called once on load. */
export function projectFences(fences: ApiFence[]): ProjectedFence[] {
	return fences.map((f) => {
		const rawCoords = f.geometry.coordinates;
		const coords = new Float64Array(rawCoords.length * 2);
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		for (let i = 0; i < rawCoords.length; i++) {
			const [mx, my] = toMerc(rawCoords[i][0], rawCoords[i][1]);
			coords[i * 2] = mx;
			coords[i * 2 + 1] = my;
			if (mx < minX) minX = mx;
			if (mx > maxX) maxX = mx;
			if (my < minY) minY = my;
			if (my > maxY) maxY = my;
		}

		return {
			id: f.id,
			layer: f.layer,
			sides: [
				{ id: f.sides[0].districtId, name: f.sides[0].name },
				{ id: f.sides[1].districtId, name: f.sides[1].name }
			],
			landmark: f.landmark,
			coords,
			vertexCount: rawCoords.length,
			minX,
			minY,
			maxX,
			maxY
		};
	});
}

/** Project a single ring (exterior or hole) to Mercator. */
function projectRing(ring: number[][], isHole: boolean): { projected: ProjectedRing; minX: number; minY: number; maxX: number; maxY: number } {
	const coords = new Float64Array(ring.length * 2);
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (let i = 0; i < ring.length; i++) {
		const [mx, my] = toMerc(ring[i][0], ring[i][1]);
		coords[i * 2] = mx;
		coords[i * 2 + 1] = my;
		if (mx < minX) minX = mx;
		if (mx > maxX) maxX = mx;
		if (my < minY) minY = my;
		if (my > maxY) maxY = my;
	}
	return { projected: { coords, vertexCount: ring.length, isHole }, minX, minY, maxX, maxY };
}

/** Project API districts into pre-computed structures. Handles MultiPolygon + holes. */
export function projectDistricts(districts: ApiDistrict[]): ProjectedDistrict[] {
	return districts.map((d) => {
		const rings: ProjectedRing[] = [];
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		// Normalize to array of polygons (each polygon = [exterior, hole1, hole2, ...])
		const polygons: number[][][][] = d.clipGeometry.type === 'MultiPolygon'
			? (d.clipGeometry.coordinates as number[][][][])
			: [d.clipGeometry.coordinates as number[][][]];

		for (const polygon of polygons) {
			for (let ringIdx = 0; ringIdx < polygon.length; ringIdx++) {
				const { projected, minX: rMinX, minY: rMinY, maxX: rMaxX, maxY: rMaxY } =
					projectRing(polygon[ringIdx], ringIdx > 0);
				rings.push(projected);
				// BBOX covers all rings (including holes — for BBOX cull correctness)
				if (rMinX < minX) minX = rMinX;
				if (rMinY < minY) minY = rMinY;
				if (rMaxX > maxX) maxX = rMaxX;
				if (rMaxY > maxY) maxY = rMaxY;
			}
		}

		return { id: d.id, name: d.name, display: d.display, layer: d.layer, rings, minX, minY, maxX, maxY };
	});
}

// ============================================================================
// Per-frame computation (called on every bubble move/resize)
// ============================================================================

export interface BubbleComputeResult {
	/** Fence IDs that intersect the bubble circle */
	insideFenceIds: Set<string>;
	/** District IDs whose polygon contains the bubble center, keyed by layer */
	containingDistricts: Map<string, ProjectedDistrict>;
	/** Radius in Mercator meters (latitude-corrected). Used by MapLibre renderer. */
	mercatorRadius: number;
}

export function computeBubbleState(
	projFences: ProjectedFence[],
	projDistricts: ProjectedDistrict[],
	centerLng: number,
	centerLat: number,
	radiusMeters: number
): BubbleComputeResult {
	const [cx, cy] = toMerc(centerLng, centerLat);
	// Scale geographic meters → Mercator meters at this latitude.
	// Mercator scale factor = 1/cos(lat). Without this, the bubble
	// is drawn too small at high latitudes (~30% error at 45°N).
	const clampedLat = Math.max(-MAX_MERC_LAT, Math.min(MAX_MERC_LAT, centerLat));
	const mercatorRadius = radiusMeters / Math.cos(clampedLat * DEG2RAD);

	const insideFenceIds = new Set<string>();
	for (const f of projFences) {
		if (fenceInsideBubble(f, cx, cy, mercatorRadius)) insideFenceIds.add(f.id);
	}

	const containingDistricts = new Map<string, ProjectedDistrict>();
	for (const d of projDistricts) {
		if (pointInDistrict(d, cx, cy)) containingDistricts.set(d.layer, d);
	}

	return { insideFenceIds, containingDistricts, mercatorRadius };
}
