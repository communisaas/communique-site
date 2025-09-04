/**
 * Server-side proxy endpoint for checking VOTER Protocol certification status
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const VOTER_API_URL = env.VOTER_API_URL || 'http://localhost:8000';
const VOTER_API_KEY = env.VOTER_API_KEY || '';
const ENABLE_CERTIFICATION = env.ENABLE_CERTIFICATION === 'true';

export const GET: RequestHandler = async ({ params }) => {
	if (!ENABLE_CERTIFICATION) {
		return json(null);
	}

	try {
		const { hash } = params;
		
		const response = await fetch(
			`${VOTER_API_URL}/api/v1/certification/status/${hash}`,
			{
				headers: {
					'X-API-Key': VOTER_API_KEY
				}
			}
		);

		if (!response.ok) {
			return json(null, { status: response.status });
		}

		const data = await response.json();
		return json(data);

	} catch (error) {
		console.error('[VOTER Proxy] Status check error:', error);
		return json(null, { status: 500 });
	}
};
