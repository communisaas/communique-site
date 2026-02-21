/**
 * Demo Fresh Start
 *
 * GET /demo/fresh — Resets demo user to trust_tier 1, clears identity fields,
 * creates a fresh session, and redirects to /. Used for re-running the
 * graduated trust demo from the beginning.
 */
import { redirect, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { db } from '$lib/core/db';
import { createSession, sessionCookieName } from '$lib/core/auth/auth';
import type { RequestHandler } from './$types';

const DEMO_USER_ID = 'user-demo-1';

export const GET: RequestHandler = async ({ cookies }) => {
	if (!dev && env.DEMO_MODE !== 'true') {
		throw error(404, 'Not found');
	}

	// Reset demo user to Tier 1 (authenticated but unverified address)
	// Clear all fields that deriveTrustTier() uses to compute trust tier
	await db.user.update({
		where: { id: DEMO_USER_ID },
		data: {
			trust_tier: 1,
			district_verified: false,
			address_verified_at: null,
			identity_commitment: null,
			wallet_address: null,
			district_hash: null
		}
	});

	const user = await db.user.findUnique({ where: { id: DEMO_USER_ID } });
	if (!user) {
		throw error(500, 'Demo user not seeded. Run: npm run db:seed');
	}

	const session = await createSession(user.id);

	cookies.set(sessionCookieName, session.id, {
		path: '/',
		sameSite: 'lax',
		httpOnly: true,
		expires: session.expiresAt,
		secure: !dev
	});

	throw redirect(302, '/');
};
