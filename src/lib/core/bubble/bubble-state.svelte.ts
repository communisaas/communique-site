/**
 * Bubble State — Svelte 5 reactive state for the Postal Bubble identity object.
 *
 * Manages: center, radius, cached geometry extent, and derived precision.
 * The bubble is the user's privacy boundary — the server knows their bubble,
 * never their exact location.
 *
 * State machine: idle → loading → ready → (resize/move) → ready
 */

import { browser } from '$app/environment';
import {
	computeBubbleState,
	projectFences,
	projectDistricts,
	type ProjectedFence,
	type ProjectedDistrict,
	type BubbleComputeResult
} from './geometry';
import { BubbleClient, type BubbleQueryResponse, type BubbleOfficial } from './client';

// ============================================================================
// Types
// ============================================================================

export type BubblePhase = 'idle' | 'loading' | 'ready' | 'error';

export type PrecisionLevel =
	| 'none' // No data loaded
	| 'postal' // Postal code only, no geometry yet
	| 'ambiguous' // Bubble crosses fences on some layers
	| 'resolved'; // Center is inside exactly one district per layer, no fence crossings

export interface LayerResolution {
	layer: string;
	districtId: string;
	districtName: string;
	resolved: boolean; // true if no fence for this layer touches the bubble
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'communique_bubble';
const DEFAULT_RADIUS = 2000; // 2km initial bubble

// ============================================================================
// State
// ============================================================================

const client = new BubbleClient();

function createBubbleState() {
	// Core mutable state
	let phase = $state<BubblePhase>('idle');
	let center = $state<{ lat: number; lng: number } | null>(null);
	let radius = $state(DEFAULT_RADIUS);
	let postalCode = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	// Generation counter: prevents stale responses from overwriting fresh state
	let generation = 0;

	// Cached API response + projected geometry
	let cachedResponse = $state<BubbleQueryResponse | null>(null);
	let projFences = $state<ProjectedFence[]>([]);
	let projDistricts = $state<ProjectedDistrict[]>([]);
	let officials = $state<BubbleOfficial[]>([]);

	// Derived: per-frame geometry computation
	const geometryResult = $derived.by<BubbleComputeResult | null>(() => {
		if (!center || (projFences.length === 0 && projDistricts.length === 0)) return null;
		return computeBubbleState(projFences, projDistricts, center.lng, center.lat, radius);
	});

	// Derived: per-layer resolution status
	const layerResolutions = $derived.by<LayerResolution[]>(() => {
		if (!geometryResult) return [];
		const resolutions: LayerResolution[] = [];
		for (const [layer, district] of geometryResult.containingDistricts) {
			const hasFence = projFences.some(
				(f) => f.layer === layer && geometryResult.insideFenceIds.has(f.id)
			);
			resolutions.push({
				layer,
				districtId: district.id,
				districtName: district.name,
				resolved: !hasFence
			});
		}
		return resolutions;
	});

	// Derived: overall precision level
	const precision = $derived.by<PrecisionLevel>(() => {
		if (phase === 'idle' || !center) return 'none';
		if (phase === 'loading') return 'postal';
		if (layerResolutions.length === 0) return 'postal';
		return layerResolutions.every((l) => l.resolved) ? 'resolved' : 'ambiguous';
	});

	// Derived: layers that are resolved vs ambiguous
	const resolvedLayers = $derived(layerResolutions.filter((l: LayerResolution) => l.resolved));
	const ambiguousLayers = $derived(layerResolutions.filter((l: LayerResolution) => !l.resolved));

	return {
		// Readonly state accessors
		get phase() {
			return phase;
		},
		get center() {
			return center;
		},
		get radius() {
			return radius;
		},
		get postalCode() {
			return postalCode;
		},
		get errorMessage() {
			return errorMessage;
		},
		get officials() {
			return officials;
		},
		get cachedResponse() {
			return cachedResponse;
		},

		// Derived accessors
		get precision() {
			return precision;
		},
		get layerResolutions() {
			return layerResolutions;
		},
		get resolvedLayers() {
			return resolvedLayers;
		},
		get ambiguousLayers() {
			return ambiguousLayers;
		},
		get geometryResult() {
			return geometryResult;
		},

		// Projected data for MapLibre rendering (Phase 3)
		get projectedFences() {
			return projFences;
		},
		get projectedDistricts() {
			return projDistricts;
		},

		/**
		 * Seed the bubble from a postal code or lat/lng center.
		 * Fires the API call, projects the geometry, updates all derived state.
		 */
		async seedBubble(
			newCenter: { lat: number; lng: number },
			newRadius: number = DEFAULT_RADIUS,
			newPostalCode?: string
		): Promise<void> {
			center = newCenter;
			radius = newRadius;
			postalCode = newPostalCode ?? null;
			phase = 'loading';
			errorMessage = null;

			const gen = ++generation;

			try {
				const response = await client.query({
					center: newCenter,
					radius: newRadius,
					postal_code: newPostalCode
				});

				// Stale response guard: a newer seedBubble was called while we awaited
				if (gen !== generation) return;

				cachedResponse = response;
				projFences = projectFences(response.fences);
				projDistricts = projectDistricts(response.districts);
				officials = response.officials ?? [];
				phase = 'ready';

				// Persist to localStorage
				this.persistBubble();
			} catch (err) {
				// Aborted requests are not errors
				if (err instanceof DOMException && err.name === 'AbortError') return;
				if (gen !== generation) return;
				errorMessage = err instanceof Error ? err.message : String(err);
				phase = 'error';
			}
		},

		/**
		 * Update bubble radius without re-fetching (geometry recomputed via $derived).
		 * Only re-fetches if the new radius exceeds the cached query bbox.
		 */
		async setRadius(newRadius: number): Promise<void> {
			radius = newRadius;

			// If in error state, re-seed to recover (don't just persist stale data)
			if (phase === 'error' && center) {
				await this.seedBubble(center, newRadius, postalCode ?? undefined);
				return;
			}

			// Check if new radius fits within cached query bbox
			if (center && cachedResponse) {
				const bbox = cachedResponse.queryBbox;
				const latSpan = (bbox.maxLat - bbox.minLat) / 2;
				const lngSpan = (bbox.maxLng - bbox.minLng) / 2;
				// Convert bbox half-span to approximate meters (1° lat ≈ 111.32 km)
				const bboxRadiusM = Math.min(latSpan, lngSpan) * 111_320;
				if (newRadius <= bboxRadiusM) {
					this.persistBubble();
					return;
				}
				await this.seedBubble(center, newRadius, postalCode ?? undefined);
			} else {
				this.persistBubble();
			}
		},

		/**
		 * Move the bubble center. Re-fetches if the new center is outside cached bbox.
		 */
		async setCenter(newCenter: { lat: number; lng: number }): Promise<void> {
			center = newCenter;

			// If in error state, re-seed to recover
			if (phase === 'error') {
				await this.seedBubble(newCenter, radius, postalCode ?? undefined);
				return;
			}

			// Check if new center is within cached query bbox
			if (cachedResponse) {
				const bbox = cachedResponse.queryBbox;
				const inBbox =
					newCenter.lat >= bbox.minLat &&
					newCenter.lat <= bbox.maxLat &&
					newCenter.lng >= bbox.minLng &&
					newCenter.lng <= bbox.maxLng;
				if (inBbox) {
					this.persistBubble();
					return;
				}
			}

			// Outside cached extent — re-fetch
			await this.seedBubble(newCenter, radius, postalCode ?? undefined);
		},

		/** Save bubble state to localStorage */
		persistBubble(): void {
			if (!browser || !center) return;
			try {
				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({
						center,
						radius,
						postalCode,
						timestamp: Date.now()
					})
				);
			} catch {
				// localStorage full or unavailable — non-fatal
			}
		},

		/** Restore bubble from localStorage (instant). Does NOT re-fetch geometry. */
		restoreBubble(): boolean {
			if (!browser) return false;
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (!raw) return false;
				const saved = JSON.parse(raw);
				if (typeof saved?.center?.lat !== 'number' || typeof saved?.center?.lng !== 'number') return false;

				center = saved.center;
				radius = saved.radius ?? DEFAULT_RADIUS;
				postalCode = saved.postalCode ?? null;
				phase = 'idle'; // Not "ready" until geometry is loaded
				return true;
			} catch {
				return false;
			}
		},

		/** Clear all bubble state */
		reset(): void {
			phase = 'idle';
			center = null;
			radius = DEFAULT_RADIUS;
			postalCode = null;
			errorMessage = null;
			cachedResponse = null;
			projFences = [];
			projDistricts = [];
			officials = [];
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	};
}

export const bubbleState = createBubbleState();
