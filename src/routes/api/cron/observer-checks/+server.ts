/**
 * Observer Checks Cron Endpoint
 *
 * POST /api/cron/observer-checks
 *
 * Runs scheduled checks for all observers that need checking.
 * Called by external cron service (e.g., Cloudflare Cron Triggers).
 *
 * Security: Requires CRON_SECRET header for authentication.
 */

import type { RequestHandler } from './$types';
import { runObserverChecks } from '$lib/server/firecrawl/observer';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	// Verify cron secret
	const cronSecret = request.headers.get('x-cron-secret');
	if (!env.CRON_SECRET || cronSecret !== env.CRON_SECRET) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		console.log('[cron/observer-checks] Starting observer checks...');
		const startTime = Date.now();

		const results = await runObserverChecks();

		const duration = Date.now() - startTime;
		console.log(
			`[cron/observer-checks] Complete: ${results.checked} checked, ${results.changesDetected} changed, ${duration}ms`
		);

		return new Response(
			JSON.stringify({
				success: true,
				checked: results.checked,
				changed: results.changesDetected,
				errors: results.errors,
				durationMs: duration
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('[cron/observer-checks] Failed:', error);
		return new Response(
			JSON.stringify({
				error: 'Observer checks failed',
				message: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
