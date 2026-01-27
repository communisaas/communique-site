/**
 * Message Writer Agent
 *
 * Generates research-backed civic action messages with inline citations
 * and geographic scope using Google Search grounding.
 */

import { z } from 'zod';
import { generateWithThoughts } from '../gemini-client';
import { MESSAGE_WRITER_PROMPT } from '../prompts/message-writer';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import type { MessageResponse, DecisionMaker } from '../types';

// ============================================================================
// Zod Schema for Runtime Validation
// ============================================================================

const SourceSchema = z.object({
	num: z.number(),
	title: z.string(),
	url: z.string(),
	type: z.enum(['journalism', 'research', 'government', 'legal', 'advocacy'])
});

const GeographicScopeSchema = z.object({
	scope_level: z.enum(['local', 'district', 'metro', 'state', 'national', 'international']),
	scope_display: z.string()
});

// Gemini sometimes returns geographic_scope as a plain string instead of an object.
// Coerce strings into the structured format.
const CoercedGeographicScopeSchema = z.preprocess((val) => {
	if (typeof val === 'string' && val.trim()) {
		return { scope_level: 'local' as const, scope_display: val.trim() };
	}
	return val;
}, GeographicScopeSchema);

const MessageResponseSchema = z.object({
	message: z.string(),
	subject: z.string(),
	sources: z.array(SourceSchema),
	research_log: z.array(z.string()).optional(),
	geographic_scope: CoercedGeographicScopeSchema.optional()
});

// ============================================================================
// Types
// ============================================================================

export interface GenerateMessageOptions {
	subjectLine: string;
	coreIssue: string;
	topics: string[];
	decisionMakers: DecisionMaker[];
	voiceSample?: string;
	rawInput?: string;
}

// ============================================================================
// Message Generation
// ============================================================================

/**
 * Generate a research-backed message with citations and geographic scope
 */
export async function generateMessage(options: GenerateMessageOptions): Promise<MessageResponse> {
	// Build decision-maker list for context
	const decisionMakerList = options.decisionMakers
		.map((dm) => `- ${dm.name}, ${dm.title} at ${dm.organization}`)
		.join('\n');

	// Build voice context block if available
	const voiceBlock =
		options.voiceSample || options.rawInput
			? `
## Original Voice

${options.voiceSample ? `Voice Sample (emotional peak):\n"${options.voiceSample}"\n` : ''}${options.rawInput ? `Raw Input (full texture):\n"${options.rawInput}"\n` : ''}
Channel this voice. The message should feel like it came from this person.
`
			: '';

	// Construct the prompt
	const prompt = `Write a compelling message about this issue:

Subject: ${options.subjectLine}
Core Issue: ${options.coreIssue}
Topics: ${options.topics.join(', ')}

Decision-makers to address:
${decisionMakerList}
${voiceBlock}
Research current information and write a message that:
1. States the problem with specific, recent evidence
2. Cites credible sources using [1], [2], [3] notation
3. Makes a clear, actionable ask
4. Maintains a respectful but firm tone
5. Includes geographic_scope identifying where this issue is relevant`;

	// Generate content with grounding enabled
	// NOTE: Google Search grounding is incompatible with responseSchema.
	// We use generateWithThoughts (which appends JSON instructions to the system prompt)
	// and parse manually via extractJsonFromGroundingResponse.
	console.log('[message-writer] Generating message with grounding');
	const result = await generateWithThoughts<MessageResponse>(prompt, {
		systemInstruction: MESSAGE_WRITER_PROMPT,
		temperature: 0.4,
		thinkingLevel: 'high',
		enableGrounding: true,
		maxOutputTokens: 8192
	});

	// Extract JSON from grounding response (handles markdown blocks, surrounding text, etc.)
	const extraction = extractJsonFromGroundingResponse<MessageResponse>(result.rawText || '');

	if (!isSuccessfulExtraction(extraction)) {
		console.error('[message-writer] JSON extraction failed:', extraction.error);
		throw new Error(`Failed to parse message response: ${extraction.error}`);
	}

	// Validate with Zod
	const validationResult = MessageResponseSchema.safeParse(extraction.data);

	if (!validationResult.success) {
		console.error('[message-writer] Invalid response structure:', validationResult.error.flatten());
		throw new Error(
			`Invalid message response: ${validationResult.error.errors[0]?.message || 'Unknown validation error'}`
		);
	}

	const data = validationResult.data as MessageResponse;

	console.log('[message-writer] Message generation complete', {
		messageLength: data.message.length,
		sourceCount: data.sources?.length || 0,
		researchQueries: data.research_log?.length || 0,
		geographicScope: data.geographic_scope?.scope_display || 'none'
	});

	return data;
}
