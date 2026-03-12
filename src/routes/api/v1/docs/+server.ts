/**
 * GET /api/v1/docs — Serve the OpenAPI 3.1 specification as JSON.
 *
 * Gated by FEATURES.PUBLIC_API. No authentication required.
 */

import { error } from '@sveltejs/kit';
import { FEATURES } from '$lib/config/features';
import { openApiSpec } from '$lib/server/api-v1/openapi';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	if (!FEATURES.PUBLIC_API) throw error(404, 'Not found');

	return new Response(JSON.stringify(openApiSpec), {
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};

export const OPTIONS: RequestHandler = async () => {
	if (!FEATURES.PUBLIC_API) throw error(404, 'Not found');

	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Max-Age': '86400'
		}
	});
};
