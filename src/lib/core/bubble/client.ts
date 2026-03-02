/**
 * Bubble Query Client
 *
 * Typed wrapper for the Shadow Atlas POST /v1/bubble-query endpoint.
 * Called through the SvelteKit server proxy to keep the Shadow Atlas
 * URL server-side only.
 */

import type { ApiFence, ApiDistrict } from './geometry';

// ============================================================================
// API Response Types
// ============================================================================

export interface BubbleQueryRequest {
	center: { lat: number; lng: number };
	radius: number; // meters
	postal_code?: string;
	layers?: string[];
}

export interface PostalExtent {
	centroid: { lat: number; lng: number };
	bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
	radius: number;
	country: string;
}

export interface BubbleOfficial {
	name: string;
	title: string;
	party: string;
	districtId: string;
}

export interface BubbleQueryResponse {
	center: { lat: number; lng: number };
	queryBbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
	postalExtent?: PostalExtent;
	fences: ApiFence[];
	districts: ApiDistrict[];
	officials?: BubbleOfficial[];
}

// ============================================================================
// Client
// ============================================================================

export class BubbleClient {
	private readonly baseUrl: string;
	private controller: AbortController | null = null;

	constructor(baseUrl = '/api/shadow-atlas/bubble') {
		this.baseUrl = baseUrl;
	}

	/** Abort any in-flight request */
	abort(): void {
		this.controller?.abort();
		this.controller = null;
	}

	async query(req: BubbleQueryRequest): Promise<BubbleQueryResponse> {
		// Cancel any previous in-flight request
		this.abort();
		this.controller = new AbortController();

		const response = await fetch(this.baseUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(req),
			signal: this.controller.signal
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({
				error: { message: response.statusText }
			}));
			throw new Error(
				`Bubble query failed (${response.status}): ${errorData?.error?.message ?? response.statusText}`
			);
		}

		const json = await response.json();
		// The server proxy returns the Shadow Atlas response data directly
		if (json.success === false) {
			throw new Error(`Bubble query error: ${json.error?.message ?? 'Unknown error'}`);
		}
		return json.data ?? json;
	}
}
