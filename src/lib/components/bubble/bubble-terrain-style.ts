/**
 * MapLibre 5-layer muted terrain style.
 *
 * Design principles:
 * - 5 layers vs ~80 in stock styles = fewer GL draw calls = faster mobile
 * - No glyphs, no sprites, no symbols — zero network requests for fonts
 * - Muted palette: the bubble and fences are the visual subject, not the terrain
 * - PMTiles on R2: single static file, HTTP Range Requests, no tile server
 */

import type { StyleSpecification } from 'maplibre-gl';

/** PMTiles source URL — Protomaps public basemap tiles */
const PMTILES_URL = 'pmtiles://https://build.protomaps.com/20250101.pmtiles';

export const MUTED_TERRAIN_STYLE: StyleSpecification = {
	version: 8,
	glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
	sources: {
		protomaps: {
			type: 'vector',
			url: PMTILES_URL,
			attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
		}
	},
	layers: [
		{
			id: 'background',
			type: 'background',
			paint: { 'background-color': '#f8fafc' }
		},
		{
			id: 'earth',
			type: 'fill',
			source: 'protomaps',
			'source-layer': 'earth',
			paint: { 'fill-color': '#f8fafc' }
		},
		{
			id: 'water',
			type: 'fill',
			source: 'protomaps',
			'source-layer': 'water',
			paint: { 'fill-color': '#e2e8f0', 'fill-opacity': 0.35 }
		},
		{
			id: 'roads',
			type: 'line',
			source: 'protomaps',
			'source-layer': 'roads',
			paint: { 'line-color': '#e2e8f0', 'line-width': 0.5, 'line-opacity': 0.3 }
		},
		{
			id: 'boundaries',
			type: 'line',
			source: 'protomaps',
			'source-layer': 'boundaries',
			paint: {
				'line-color': '#cbd5e1',
				'line-width': 0.5,
				'line-opacity': 0.2,
				'line-dasharray': [2, 2]
			}
		}
	]
};

/**
 * Fence layer colors by district type.
 * Used in data-driven MapLibre paint expressions.
 */
export const FENCE_LAYER_COLORS: Record<string, string> = {
	cd: '#60a5fa', // blue-400 — congressional
	sldu: '#34d399', // emerald-400 — state senate
	sldl: '#fbbf24', // amber-400 — state house
	can: '#a78bfa', // violet-400 — Canadian ridings
	county: '#94a3b8' // slate-400 — county
};

/** Default fence color for unknown layers */
export const FENCE_DEFAULT_COLOR = '#94a3b8';
