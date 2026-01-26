/**
 * Message Writer Agent
 *
 * Generates research-backed civic action messages with inline citations
 * using Google Search grounding.
 */

import { z } from 'zod';
import { generate } from '../gemini-client';
import { MESSAGE_SCHEMA } from '../schemas';
import { MESSAGE_WRITER_PROMPT } from '../prompts/message-writer';
import { buildSourceList, mergeAndDeduplicateSources } from '../utils/grounding';
import { extractGeographicScopeComplete } from '$lib/server/complete-extraction-pipeline';
import type { MessageResponse, DecisionMaker, Source, GroundingMetadata } from '../types';

// ============================================================================
// Zod Schema for Runtime Validation
// ============================================================================

const SourceSchema = z.object({
	num: z.number(),
	title: z.string(),
	url: z.string(),
	type: z.enum(['journalism', 'research', 'government', 'legal', 'advocacy'])
});

const MessageResponseSchema = z.object({
	message: z.string(),
	subject: z.string(),
	sources: z.array(SourceSchema),
	research_log: z.array(z.string()).optional(),
	geographic_scope: z.unknown().optional() // Will be added by extraction pipeline
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
 * Generate a research-backed message with citations
 *
 * @param options - Message generation options
 * @returns MessageResponse with message, subject, sources, research log, and geographic scope
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
4. Maintains a respectful but firm tone`;

	// Generate content with grounding enabled
	console.log('[message-writer] Generating message with grounding');
	const response = await generate(prompt, {
		systemInstruction: MESSAGE_WRITER_PROMPT,
		responseSchema: MESSAGE_SCHEMA,
		temperature: 0.4,
		thinkingLevel: 'high', // Deep reasoning for research
		enableGrounding: true, // Google Search for real-time research
		maxOutputTokens: 8192
	});

	// Parse and validate the response
	if (!response.text) {
		throw new Error('[message-writer] No response text from Gemini');
	}

	const parsed = JSON.parse(response.text);
	const validationResult = MessageResponseSchema.safeParse(parsed);

	if (!validationResult.success) {
		console.error('[message-writer] Invalid response structure:', validationResult.error.flatten());
		throw new Error(
			`Invalid message response: ${validationResult.error.errors[0]?.message || 'Unknown validation error'}`
		);
	}

	const data = validationResult.data as MessageResponse;

	// Extract grounding metadata for enhanced sources
	const groundingMetadata = response.candidates?.[0]?.groundingMetadata as
		| GroundingMetadata
		| undefined;

	if (groundingMetadata) {
		console.log('[message-writer] Processing grounding metadata');

		// Build source list from grounding chunks
		const groundedSources = buildSourceList(groundingMetadata);

		// Merge with any sources in the response
		data.sources = mergeAndDeduplicateSources(data.sources || [], groundedSources);

		// Add research log from search queries
		if (groundingMetadata.webSearchQueries) {
			const researchLog = groundingMetadata.webSearchQueries.map((q) => `Searched: "${q}"`);
			data.research_log = [...researchLog, ...(data.research_log || [])];
		}
	}

	// Extract geographic scope from message content
	console.log('[message-writer] Extracting geographic scope');
	const geographicScope = await extractGeographicScopeComplete(
		data.message,
		data.subject,
		'US' // Default to US for now
	);

	if (geographicScope) {
		data.geographic_scope = geographicScope;
	}

	console.log('[message-writer] Message generation complete', {
		messageLength: data.message.length,
		sourceCount: data.sources.length,
		researchQueries: data.research_log.length,
		hasGeographicScope: !!data.geographic_scope
	});

	return data;
}
