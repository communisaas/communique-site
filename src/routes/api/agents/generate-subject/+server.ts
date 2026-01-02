/**
 * Generate Subject Line API Endpoint
 *
 * POST /api/agents/generate-subject
 *
 * Generates structured subject line metadata from issue descriptions
 * using Gemini 3 Flash with multi-turn refinement and clarification support.
 *
 * Phase 1: Extended to handle clarification questions
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSubjectLine } from '$lib/core/agents/agents/subject-line';
import type { ClarificationAnswers } from '$lib/core/agents/types';

interface RequestBody {
	message: string;
	interactionId?: string;
	clarificationAnswers?: ClarificationAnswers;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth is optional for subject line generation (template creation)
	// Authenticated users get tracked, guests can still use the feature
	const session = locals.session;
	const userId = session?.userId || 'guest';

	const body = (await request.json()) as RequestBody;

	if (!body.message?.trim()) {
		throw error(400, 'Message is required');
	}

	console.log('[agents/generate-subject] Generating:', {
		userId,
		messageLength: body.message.length,
		isRefinement: !!body.interactionId,
		hasClarificationAnswers: !!body.clarificationAnswers
	});

	try {
		const result = await generateSubjectLine({
			description: body.message,
			previousInteractionId: body.interactionId,
			clarificationAnswers: body.clarificationAnswers
		});

		console.log('[agents/generate-subject] Success:', {
			userId,
			needsClarification: result.data.needs_clarification,
			questionCount: result.data.clarification_questions?.length ?? 0,
			hasOutput: !!result.data.subject_line
		});

		return json({
			...result.data,
			interactionId: result.interactionId // Return for next interaction
		});
	} catch (err) {
		console.error('[agents/generate-subject] Error:', err);

		// Pass through SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to generate subject line');
	}
};
