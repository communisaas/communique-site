import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { getRateLimiter } from '$lib/core/security/rate-limiter';
import { FEATURES } from '$lib/config/features';
import { z } from 'zod';
import type { RequestHandler } from './$types';

/**
 * POST /api/c/[slug]/verify-district
 *
 * Public (unauthenticated) district verification for campaign action flow.
 * Proxies address geocoding to resolve a congressional district code.
 *
 * Gated behind FEATURES.ADDRESS_SPECIFICITY === 'district'.
 * Rate limited: 5 req/min per IP (matches /api/location/ pattern).
 *
 * PRIVACY:
 * - Logs only district code, never address.
 * - Returns only district code — no officials, no coordinates.
 * - Campaign ID validated to prevent blind enumeration.
 */

const addressSchema = z.object({
	street: z.string().min(1).max(200),
	city: z.string().min(1).max(100),
	state: z.string().length(2),
	zip: z.string().regex(/^\d{5}(-\d{4})?$/)
});

export const POST: RequestHandler = async ({ request, params, getClientAddress }) => {
	// Gate: only available when district verification is enabled
	if (FEATURES.ADDRESS_SPECIFICITY !== 'district') {
		return json({ resolved: false, error: 'District verification is not enabled' }, { status: 404 });
	}

	// Rate limit: 5 requests per minute per IP
	const ip = getClientAddress();
	const rlKey = `ratelimit:campaign-verify-district:${ip}`;
	const rl = await getRateLimiter().check(rlKey, { maxRequests: 5, windowMs: 60_000 });
	if (!rl.allowed) {
		return json({ resolved: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	// Validate campaign exists (prevents blind address enumeration)
	const campaign = await db.campaign.findFirst({
		where: { id: params.slug, status: 'ACTIVE' },
		select: { id: true }
	});

	if (!campaign) {
		return json({ resolved: false, error: 'Campaign not found' }, { status: 404 });
	}

	try {
		const body = await request.json();

		const parseResult = addressSchema.safeParse(body);
		if (!parseResult.success) {
			return json(
				{ resolved: false, error: 'Invalid address', details: parseResult.error.issues.map(i => i.message) },
				{ status: 400 }
			);
		}

		const { street, city, state, zip } = parseResult.data;

		// Census Bureau geocoder (public infrastructure, no API key needed)
		const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/address');
		url.searchParams.set('street', street);
		url.searchParams.set('city', city);
		url.searchParams.set('state', state);
		url.searchParams.set('zip', zip);
		url.searchParams.set('benchmark', '4');
		url.searchParams.set('vintage', '4');
		url.searchParams.set('format', 'json');

		const censusRes = await fetch(url.toString(), {
			signal: AbortSignal.timeout(15000)
		});

		if (!censusRes.ok) {
			return json({ resolved: false, error: 'Address resolution service unavailable' }, { status: 502 });
		}

		const censusData = await censusRes.json();
		const matches = censusData?.result?.addressMatches;

		if (!matches || matches.length === 0) {
			return json({ resolved: false, error: 'Address not found. Please check and try again.' });
		}

		const match = matches[0];
		const geographies = match.geographies;

		// Extract congressional district
		const districts = geographies?.['119th Congressional Districts'];
		const district = districts?.[0];
		const states = geographies?.['States'];
		const stateGeo = states?.[0];
		const stateCode = stateGeo?.STUSAB || null;

		if (!district || !stateCode) {
			return json({ resolved: false, error: 'Congressional district could not be determined.' });
		}

		const districtNumber = district.CD119 ?? district.GEOID?.slice(2) ?? null;
		if (districtNumber == null) {
			return json({ resolved: false, error: 'Congressional district could not be determined.' });
		}

		let paddedDistrict = String(districtNumber).padStart(2, '0');
		if (paddedDistrict === '98') paddedDistrict = '00';
		const normalizedDistrict = paddedDistrict === '00' ? 'AL' : paddedDistrict;
		const districtCode = `${stateCode}-${normalizedDistrict}`;

		console.info(`[verify-district] Resolved district=${districtCode} campaign=${params.slug}`);

		return json({
			resolved: true,
			district: {
				code: districtCode,
				state: stateCode
			}
		});
	} catch (err) {
		console.error(
			'[verify-district] Error:',
			err instanceof Error ? err.message : 'Unknown error'
		);
		return json(
			{ resolved: false, error: 'Address resolution service temporarily unavailable' },
			{ status: 500 }
		);
	}
};
