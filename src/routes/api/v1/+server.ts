/**
 * GET /api/v1/ — API root. Returns version info.
 */

import { requirePublicApi } from '$lib/server/api-v1/gate';
import { apiOk } from '$lib/server/api-v1/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	requirePublicApi();
	return apiOk({
		version: 'v1',
		documentation: '/api/v1/docs'
	});
};
