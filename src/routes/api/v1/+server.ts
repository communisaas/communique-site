/**
 * GET /api/v1/ — API root. Returns version info.
 */

import { apiOk } from '$lib/server/api-v1/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return apiOk({
		version: 'v1',
		documentation: '/api/v1/docs'
	});
};
