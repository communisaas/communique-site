/**
 * POST /api/geographic/infer-scope — Fuzzy geographic scope inference.
 * Auth required (session). Rate limit 20 req/min.
 * Used by template creator to auto-detect jurisdiction from message text.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const body = await request.json();
	const { text, countryCode } = body;

	if (!text || typeof text !== 'string') {
		return json({ error: 'text is required' }, { status: 400 });
	}

	try {
		const { fuzzyMatch } = await import('$lib/utils/fuzzy-scope-matcher');
		const match = fuzzyMatch(text, countryCode);

		return json({
			success: true,
			data: {
				match,
				input: text.slice(0, 200) // truncate for safety
			}
		});
	} catch {
		return json({ error: 'Scope inference failed' }, { status: 500 });
	}
};
