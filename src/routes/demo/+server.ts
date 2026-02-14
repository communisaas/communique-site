/**
 * Demo Mode Entry Point
 *
 * GET /demo — Creates a session for the pre-seeded demo user and redirects to /.
 * The demo user experiences the full platform exactly as a real user would.
 *
 * Feature-flagged: always available in dev, requires DEMO_MODE=true in production.
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
