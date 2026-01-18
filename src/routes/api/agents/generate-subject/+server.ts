/**
 * Generate Subject Line API Endpoint
 *
 * POST /api/agents/generate-subject
 *
 * Generates structured subject line metadata from issue descriptions
 * using Gemini 3 Flash with multi-turn refinement and clarification support.
 *
 * Phase 1: Extended to handle clarification questions
 *
 * Rate Limiting: 5/hour for guests, 15/hour for authenticated, 30/hour for verified.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSubjectLine } from '$lib/core/agents/agents/subject-line';
import type { ClarificationAnswers, ConversationContext } from '$lib/core/agents/types';
import {
	enforceLLMRateLimit,
	getUserContext,
	logLLMOperation
} from '$lib/server/llm-cost-protection';

interface RequestBody {
	message: string;
	interactionId?: string;

	/** Full context for clarification turns (new stateless approach) */
	conversationContext?: ConversationContext;

	/** @deprecated Use conversationContext instead */
	clarificationAnswers?: ClarificationAnswers;
}

export const POST: RequestHandler = async (event) => {
	// Rate limit check - throws 429 if exceeded
	await enforceLLMRateLimit(event, 'subject-line');
	const userContext = getUserContext(event);
	const startTime = Date.now();

	// Auth is optional for subject line generation (template creation)
	// Authenticated users get tracked, guests can still use the feature
	const session = event.locals.session;
	const userId = session?.userId || 'guest';

	const body = (await event.request.json()) as RequestBody;

	if (!body.message?.trim()) {
		throw error(400, 'Message is required');
	}

	console.log('[agents/generate-subject] Generating:', {
		userId,
		messageLength: body.message.length,
		hasConversationContext: !!body.conversationContext,
		// Legacy
		isRefinement: !!body.interactionId,
		hasClarificationAnswers: !!body.clarificationAnswers
	});

	try {
		const result = await generateSubjectLine({
			description: body.message,
			conversationContext: body.conversationContext,
			// Legacy support (deprecated)
			previousInteractionId: body.interactionId,
			clarificationAnswers: body.clarificationAnswers
		});

		console.log('[agents/generate-subject] Success:', {
			userId,
			needsClarification: result.data.needs_clarification,
			questionCount: result.data.clarification_questions?.length ?? 0,
			hasOutput: !!result.data.subject_line
		});

		// Log operation for cost tracking
		logLLMOperation('subject-line', userContext, {
			callCount: 1,
			durationMs: Date.now() - startTime,
			success: true
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
