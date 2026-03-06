/**
 * Bounce Report Endpoint
 *
 * POST /api/emails/report-bounce
 *
 * Allows authenticated users to report a bounced email address.
 * Suppresses the address for 1 year so it won't appear in future results.
 *
 * Rate limited: 5 req/min per user (rate-limiter.ts pattern '/api/emails/')
 * Per-user cap: 20 active bounce reports max (prevents mass suppression)
 */

import type { RequestHandler } from './$types';
import { reportBounce } from '$lib/server/email-verification';
import { prisma } from '$lib/core/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_ACTIVE_REPORTS_PER_USER = 20;

export const POST: RequestHandler = async (event) => {
	const session = event.locals.session;
	if (!session?.userId) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	let body: { email?: string };
	try {
		body = (await event.request.json()) as { email?: string };
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const email = body.email?.trim().toLowerCase();
	if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
		return new Response(JSON.stringify({ error: 'Valid email address required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Per-user cap — prevent mass suppression by a single user
	const activeReports = await prisma.suppressedEmail.count({
		where: {
			reportedBy: session.userId,
			source: 'user_report',
			expiresAt: { gt: new Date() }
		}
	});

	if (activeReports >= MAX_ACTIVE_REPORTS_PER_USER) {
		return new Response(
			JSON.stringify({ error: 'Maximum bounce reports reached' }),
			{ status: 429, headers: { 'Content-Type': 'application/json' } }
		);
	}

	try {
		await reportBounce(email, session.userId);
	} catch {
		return new Response(
			JSON.stringify({ error: 'Failed to record bounce report' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};
