/**
 * Debug endpoint to inspect location inference state
 *
 * GET /api/location/debug
 *
 * Returns complete location state from browser storage
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// This endpoint is client-side only - return instructions
	return json({
		message: 'This endpoint requires browser context',
		instructions: 'Open browser console and run: await locationInferenceEngine.export()'
	});
};
