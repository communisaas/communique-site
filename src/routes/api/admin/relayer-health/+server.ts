/**
 * Relayer Health Endpoint (Wave 15a)
 *
 * Returns relayer wallet balance, circuit breaker status, and pending retries.
 * Requires admin authentication (trust_score >= 500 or admin role).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRelayerHealth } from '$lib/core/blockchain/district-gate-client';
import { prisma } from '$lib/core/db';

export const GET: RequestHandler = async ({ locals }) => {
	// Require authenticated admin
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	if ((locals.user.trust_score ?? 0) < 500) {
		throw error(403, 'Admin access required');
	}

	const [health, pendingRetries, failedRetries] = await Promise.all([
		getRelayerHealth(),
		prisma.submissionRetry.count({ where: { status: 'pending' } }),
		prisma.submissionRetry.count({ where: { status: 'exhausted' } })
	]);

	return json({
		relayer: health,
		retryQueue: {
			pending: pendingRetries,
			exhausted: failedRetries
		}
	});
};
