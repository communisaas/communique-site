/**
 * Server-side proxy endpoint for submitting VOTER Protocol receipts
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const VOTER_API_URL = env.VOTER_API_URL || 'http://localhost:8000';
const VOTER_API_KEY = env.VOTER_API_KEY || '';
const ENABLE_CERTIFICATION = env.ENABLE_CERTIFICATION === 'true';

export const POST: RequestHandler = async ({ request }) => {
	if (!ENABLE_CERTIFICATION) {
		return json({ verified: false });
	}

	try {
		const body = await request.json();
		
		const response = await fetch(`${VOTER_API_URL}/api/v1/certification/receipt`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': VOTER_API_KEY
			},
			body: JSON.stringify({
				receipt: body.receipt,
				action_type: body.actionType,
				metadata: body.metadata
			})
		});

		if (!response.ok) {
			return json({ verified: false }, { status: response.status });
		}

		const data = await response.json();
		return json({
			verified: data.verified,
			hash: data.receipt_hash
		});

	} catch (error) {
		console.error('[VOTER Proxy] Receipt submission error:', error);
		return json({ verified: false }, { status: 500 });
	}
};
