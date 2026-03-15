/**
 * GET /api/subnet/pending-debates
 *
 * Discovery endpoint for the Bittensor subnet validator.
 * Returns debates that are past their deadline, still active,
 * have at least one argument, and haven't been AI-evaluated yet.
 *
 * Auth: Bearer CRON_SECRET or SUBNET_API_KEY.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/core/db';

export const GET: RequestHandler = async ({ request }) => {
	// Auth: CRON_SECRET or SUBNET_API_KEY
	const authHeader = request.headers.get('Authorization');
	const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	const cronSecret = env.CRON_SECRET;
	const subnetKey = env.SUBNET_API_KEY;

	if (!token || (token !== cronSecret && token !== subnetKey)) {
		throw error(403, 'Unauthorized: valid CRON_SECRET or SUBNET_API_KEY required');
	}

	const now = new Date();

	const candidates = await prisma.debate.findMany({
		where: {
			status: 'active',
			deadline: { lt: now },
			argument_count: { gt: 0 }
		},
		select: {
			id: true,
			debate_id_onchain: true,
			proposition_text: true,
			argument_count: true,
			ai_resolution: true
		},
		orderBy: { deadline: 'asc' }
	});

	// Filter out debates that already have AI resolution (JSON null check in code
	// since Prisma JSON field filtering requires Prisma.DbNull)
	const debates = candidates.filter((d) => !d.ai_resolution);

	return json({
		debates: debates.map((d) => ({
			debateId: d.id,
			debateIdOnchain: d.debate_id_onchain,
			proposition: d.proposition_text,
			argumentCount: d.argument_count
		}))
	});
};
