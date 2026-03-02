<script lang="ts">
	/**
	 * BubbleTerrain — MapLibre GL JS terrain layer.
	 *
	 * Non-interactive vector map: the terrain is scenery, not the subject.
	 * Fences rendered as native GeoJSON line layers with data-driven opacity.
	 * Exposes project(lng, lat) for SVG overlay coordinate sync.
	 */

	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import { MUTED_TERRAIN_STYLE, FENCE_LAYER_COLORS, FENCE_DEFAULT_COLOR } from './bubble-terrain-style';
	import { bubbleState } from '$lib/core/bubble/bubble-state.svelte';
	import type { ApiFence } from '$lib/core/bubble/geometry';
	import type { Map as MapLibreMap, LngLatLike } from 'maplibre-gl';

	let containerEl = $state<HTMLDivElement | null>(null);
	let map = $state<MapLibreMap | null>(null);
	let mapReady = $state(false);

	/** Project lng/lat to screen pixels (for SVG overlay sync) */
	export function project(lng: number, lat: number): { x: number; y: number } | null {
		if (!map) return null;
		const p = map.project([lng, lat]);
		return { x: p.x, y: p.y };
	}

	/** Pan to a center point */
	export function setView(lng: number, lat: number, zoom?: number): void {
		if (!map) return;
		map.jumpTo({ center: [lng, lat], ...(zoom != null ? { zoom } : {}) });
	}

	/** Get the current map instance (for advanced callers) */
	export function getMap(): MapLibreMap | null {
		return map;
	}

	// Convert fences from bubbleState into GeoJSON FeatureCollection
	const fenceGeoJSON = $derived.by(() => {
		const response = bubbleState.cachedResponse;
		if (!response?.fences) return emptyFC();

		const geo = bubbleState.geometryResult;
		const insideIds = geo?.insideFenceIds ?? new Set<string>();

		return {
			type: 'FeatureCollection' as const,
			features: response.fences.map((f: ApiFence) => ({
				type: 'Feature' as const,
				properties: {
					id: f.id,
					layer: f.layer,
					inside: insideIds.has(f.id) ? 1 : 0,
					landmark: f.landmark ?? ''
				},
				geometry: f.geometry
			}))
		};
	});

	function emptyFC() {
		return { type: 'FeatureCollection' as const, features: [] };
	}

	// Build the fence color expression for MapLibre
	function fenceColorExpression(): unknown[] {
		const expr: unknown[] = ['match', ['get', 'layer']];
		for (const [layer, color] of Object.entries(FENCE_LAYER_COLORS)) {
			expr.push(layer, color);
		}
		expr.push(FENCE_DEFAULT_COLOR);
		return expr;
	}

	// Cleanup refs (can't return from async onMount)
	let resizeObs: ResizeObserver | null = null;
	let intersectionObs: IntersectionObserver | null = null;

	onMount(() => {
		if (!containerEl) return;

		initMap(containerEl);

		return () => {
			resizeObs?.disconnect();
			intersectionObs?.disconnect();
			map?.remove();
		};
	});

	async function initMap(container: HTMLDivElement) {
		// Dynamic import — 262KB off critical path
		const [maplibregl, { Protocol }] = await Promise.all([
			import('maplibre-gl'),
			import('pmtiles')
		]);

		// Register PMTiles protocol (guard against double-registration on remount)
		const protocol = new Protocol();
		try {
			maplibregl.default.addProtocol('pmtiles', protocol.tile);
		} catch {
			// Already registered — safe to continue
		}

		const m = new maplibregl.default.Map({
			container,
			style: MUTED_TERRAIN_STYLE,
			center: bubbleState.center
				? [bubbleState.center.lng, bubbleState.center.lat]
				: [-98.5, 39.8], // Continental US center
			zoom: bubbleState.center ? 12 : 4,
			interactive: false,
			renderWorldCopies: false,
			fadeDuration: 0,
			attributionControl: false
		});

		m.on('load', () => {
			// Fence GeoJSON source
			m.addSource('fences', {
				type: 'geojson',
				data: fenceGeoJSON
			});

			// Fence line layer
			m.addLayer({
				id: 'fence-lines',
				type: 'line',
				source: 'fences',
				paint: {
					'line-color': fenceColorExpression() as unknown as string,
					'line-width': 2,
					'line-opacity': ['case', ['==', ['get', 'inside'], 1], 0.6, 0.15],
					'line-dasharray': [3, 2]
				}
			});

			// Fence landmark labels (only for fences inside bubble)
			m.addLayer({
				id: 'fence-labels',
				type: 'symbol',
				source: 'fences',
				filter: ['all', ['==', ['get', 'inside'], 1], ['!=', ['get', 'landmark'], '']],
				layout: {
					'text-field': ['get', 'landmark'],
					'text-size': 11,
					'text-offset': [0, -0.8],
					'symbol-placement': 'line-center',
					'text-allow-overlap': false
				},
				paint: {
					'text-color': '#64748b',
					'text-halo-color': '#ffffff',
					'text-halo-width': 1.5
				}
			});

			mapReady = true;
		});

		map = m;

		// ResizeObserver for responsive canvas
		resizeObs = new ResizeObserver(() => {
			m.resize();
		});
		resizeObs.observe(container);

		// IntersectionObserver to pause rendering when off-screen
		intersectionObs = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					m.resize();
				}
			},
			{ threshold: 0.1 }
		);
		intersectionObs.observe(container);
	}

	// React to fence data changes — update GeoJSON source
	$effect(() => {
		if (!map || !mapReady) return;
		const src = map.getSource('fences');
		if (src && 'setData' in src) {
			(src as { setData: (data: unknown) => void }).setData(fenceGeoJSON);
		}
	});

	// React to center changes — pan map (guard on mapReady to avoid pre-load jumpTo)
	$effect(() => {
		const c = bubbleState.center;
		if (!map || !mapReady || !c) return;
		map.jumpTo({ center: [c.lng, c.lat] as LngLatLike });
	});
</script>

<div
	bind:this={containerEl}
	class="absolute inset-0 z-0"
	role="img"
	aria-label="Terrain basemap showing your geographic area"
></div>

<style>
	div {
		width: 100%;
		height: 100%;
	}

	div :global(.maplibregl-canvas) {
		outline: none;
	}
</style>
