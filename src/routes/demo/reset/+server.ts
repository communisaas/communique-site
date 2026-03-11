/**
 * Demo Reset Endpoint
 *
 * GET /demo/reset — Resets user to Tier 1, clears all submissions,
 * then redirects back to the page (forces fresh server load).
 *
 * Usage: navigate to /demo/reset?returnTo=/s/congress-broken-housing-math
 * Or just /demo/reset (redirects to /)
 */
import { redirect, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { db } from '$lib/core/db';
import { computePseudonymousId } from '$lib/core/privacy/pseudonymous-id';
import type { RequestHandler } from './$types';

function sanitizeReturnTo(raw: string): string {
	// Only allow relative paths — block protocol-relative and absolute URLs
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
	return raw;
}

async function resetUser(locals: App.Locals, returnTo: string): Promise<never> {
	if (!dev && env.DEMO_MODE !== 'true') {
		throw error(404, 'Not found');
	}
	returnTo = sanitizeReturnTo(returnTo);

	if (!locals.user?.id) {
		throw error(401, 'Not authenticated');
	}

	const userId = locals.user.id;

	// F2: Delete only this user's submissions (clears nullifiers so user can re-submit).
	// Submissions use pseudonymous_id (HMAC of userId), not a direct FK.
	const pseudoId = computePseudonymousId(userId);
	await db.submission.deleteMany({ where: { pseudonymous_id: pseudoId } });

	// Reset ALL verification fields that deriveTrustTier() checks.
	// The trust_tier column is cosmetic — hooks.server.ts recomputes it
	// from identity_commitment, district_verified, address_verified_at every request.
	await db.user.update({
		where: { id: userId },
		data: {
			trust_tier: 1,
			identity_commitment: null,
			is_verified: false,
			verified_at: null,
			verification_method: null,
			document_type: null,
			district_verified: false,
			address_verified_at: null,
			district_hash: null,
			trust_score: 0
		}
	});

	// Redirect forces a full server-side page load — no stale client state
	throw redirect(302, returnTo);
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const returnTo = url.searchParams.get('returnTo') || '/';
	return resetUser(locals, returnTo);
};

export const POST: RequestHandler = async ({ locals, url }) => {
	const returnTo = url.searchParams.get('returnTo') || '/';
	return resetUser(locals, returnTo);
};
