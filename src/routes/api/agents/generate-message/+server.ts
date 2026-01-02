/**
 * Generate Message API Endpoint
 *
 * Generates research-backed civic action messages with inline citations
 * using the Gemini Message Writer agent.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateMessage } from '$lib/core/agents/agents/message-writer';

// ============================================================================
// Request/Response Types
// ============================================================================

import type { DecisionMaker } from '$lib/core/agents';

interface RequestBody {
	subject_line: string;
	core_issue: string;
	topics: string[];
	decision_makers: DecisionMaker[];
	voice_sample?: string;
	raw_input?: string;
}

// ============================================================================
// POST Handler
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth check
	const session = locals.session;
	if (!session?.userId) {
		console.error('[agents/generate-message] Unauthorized request');
		throw error(401, 'Authentication required');
	}

	// Parse request body
	let body: RequestBody;
	try {
		body = (await request.json()) as RequestBody;
	} catch (err) {
		console.error('[agents/generate-message] Invalid JSON:', err);
		throw error(400, 'Invalid request body');
	}

	// Validate required fields
	if (!body.subject_line || !body.core_issue) {
		console.error('[agents/generate-message] Missing required fields');
		throw error(400, 'Subject line and core issue are required');
	}

	console.log('[agents/generate-message] Generating message:', {
		userId: session.userId,
		subject: body.subject_line.substring(0, 50),
		topics: body.topics,
		decisionMakerCount: body.decision_makers?.length || 0,
		hasVoiceSample: !!body.voice_sample,
		hasRawInput: !!body.raw_input
	});

	try {
		// Generate message with 180-second timeout (research + generation is slow)
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('Generation timeout')), 180000);
		});

		const messagePromise = generateMessage({
			subjectLine: body.subject_line,
			coreIssue: body.core_issue,
			topics: body.topics || [],
			decisionMakers: body.decision_makers || [],
			voiceSample: body.voice_sample,
			rawInput: body.raw_input
		});

		const result = await Promise.race([messagePromise, timeoutPromise]);

		console.log('[agents/generate-message] Message generated successfully:', {
			userId: session.userId,
			messageLength: result.message.length,
			sourceCount: result.sources.length,
			researchQueries: result.research_log.length
		});

		return json(result);
	} catch (err) {
		console.error('[agents/generate-message] Generation error:', err);

		// Handle specific error types
		if (err instanceof Error) {
			if (err.message.includes('timeout')) {
				throw error(504, 'Message generation timed out. Please try again.');
			}
			if (err.message.includes('GEMINI_API_KEY')) {
				throw error(500, 'Service configuration error');
			}
		}

		throw error(500, 'Failed to generate message');
	}
};
