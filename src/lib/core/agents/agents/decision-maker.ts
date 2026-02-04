/**
 * Decision-Maker Resolution Agent v2 — ThoughtStream Integration
 *
 * Streams actual model reasoning to the UI instead of fake/hardcoded thoughts.
 *
 * Features:
 * - ThoughtEmitter for structured reasoning visualization
 * - Progressive disclosure with citations
 * - Document tool integration for deep document analysis
 *
 * @example
 * ```typescript
 * const segments: ThoughtSegment[] = [];
 * const result = await resolveDecisionMakersV2(
 *   {
 *     targetType: 'corporate',
 *     targetEntity: 'Apple Inc.',
 *     subjectLine: 'Sustainability leadership',
 *     coreMessage: 'Requesting climate action...',
 *     topics: ['climate', 'sustainability']
 *   },
 *   (segment) => {
 *     segments.push(segment);
 *     console.log('New thought:', segment.content);
 *   }
 * );
 * ```
 */

import { ThoughtEmitter } from '$lib/core/thoughts/emitter';
import { decisionMakerRouter } from '../providers';
import {
	documentToolDefinition,
	executeDocumentTool,
	getDocumentTypeColor,
	getDocumentTypeIcon,
	type DocumentAnalysisResult
} from '$lib/core/tools/document';
import type { DocumentType } from '$lib/server/reducto/types';
import type { ResolveContext, DecisionMakerResult } from '../providers/types';
import type { ThoughtSegment, Citation } from '$lib/core/thoughts/types';
import { cleanThoughtForDisplay } from '../utils/thought-filter';

// ============================================================================
// Document Tool Types for Gemini Function Calling
// ============================================================================

/**
 * Gemini function declaration format for the document tool
 * Used when registering tools with the Gemini API
 */
export const geminiDocumentToolDeclaration = {
	name: documentToolDefinition.name,
	description: documentToolDefinition.description,
	parameters: documentToolDefinition.parameters
};

/**
 * Arguments passed by Gemini when calling the document tool
 */
interface DocumentToolArgs {
	url: string;
	query: string;
	documentType?: DocumentType;
}

/**
 * Function call request from Gemini
 */
interface GeminiFunctionCall {
	name: string;
	args: Record<string, unknown>;
}

// ============================================================================
// Document Tool Handler
// ============================================================================

/**
 * Handle document tool invocation from Gemini function calling.
 *
 * Executes the document analysis and emits L1 citations with document type
 * colors for peripheral visual encoding.
 *
 * @param args - Tool arguments from Gemini
 * @param emitter - ThoughtEmitter for streaming updates
 * @returns Tool result for Gemini to continue generation
 *
 * @example
 * ```typescript
 * const result = await handleDocumentToolCall(
 *   { url: 'https://congress.gov/bill/...', query: 'climate policy' },
 *   emitter
 * );
 * // Result is sent back to Gemini for continued reasoning
 * ```
 */
export async function handleDocumentToolCall(
	args: DocumentToolArgs,
	emitter: ThoughtEmitter
): Promise<DocumentAnalysisResult> {
	const { url, query, documentType } = args;

	// Start action with emitter
	const action = emitter.startAction('analyze', `Analyzing document: ${url}`);

	try {
		// Execute document analysis
		const result = await executeDocumentTool(url, query, documentType, emitter);

		if (!result.success) {
			action.error(result.error || 'Document analysis failed');
			return result;
		}

		// Emit findings
		if (result.document) {
			action.addFinding(`Parsed ${result.document.sections.length} sections`);
			action.addFinding(`Extracted ${result.document.entities.length} entities`);
		}

		// Emit L1 citations with document type colors
		if (result.citations && result.citations.length > 0) {
			const docType = result.document?.type || documentType || 'official';
			emitDocumentCitations(emitter, result.citations, docType);
		}

		// Emit summary as insight
		if (result.summary) {
			emitter.insight(result.summary, {
				icon: getDocumentTypeIcon(result.document?.type || documentType || 'official'),
				pin: true
			});
		}

		action.complete(
			`Document analysis complete: ${result.document?.title || 'Untitled'}`
		);

		return result;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		action.error(errorMessage);
		return {
			success: false,
			error: errorMessage
		};
	}
}

/**
 * Emit L1 citations from document analysis with document type styling.
 *
 * Citations are colored based on document type for peripheral visual encoding:
 * - Legislative: amber
 * - Official: slate
 * - Media: blue
 * - Corporate: emerald
 * - Academic: purple
 *
 * @param emitter - ThoughtEmitter instance
 * @param citations - Citations from document analysis
 * @param documentType - Type of document for color encoding
 */
function emitDocumentCitations(
	emitter: ThoughtEmitter,
	citations: Citation[],
	documentType: DocumentType
): void {
	const color = getDocumentTypeColor(documentType);
	const icon = getDocumentTypeIcon(documentType);

	for (const citation of citations) {
		// Create citation with document metadata
		const enrichedCitation = emitter.cite(citation.label, {
			url: citation.url,
			excerpt: citation.excerpt,
			documentId: citation.documentId
		});

		// Emit thought with citation
		emitter.think(`${icon} ${citation.label}`, {
			citations: [enrichedCitation],
			emphasis: 'normal'
		});
	}

	// Log color usage for debugging
	console.log(`[decision-maker] Emitted ${citations.length} document citations with color: ${color}`);
}

/**
 * Process a function call from Gemini and return the result.
 *
 * This is the main entry point for handling Gemini function calls.
 * Currently supports the document analysis tool.
 *
 * @param functionCall - Function call from Gemini response
 * @param emitter - ThoughtEmitter for streaming updates
 * @returns Result to send back to Gemini
 */
export async function processGeminiFunctionCall(
	functionCall: GeminiFunctionCall,
	emitter: ThoughtEmitter
): Promise<unknown> {
	console.log(`[decision-maker] Processing function call: ${functionCall.name}`);

	switch (functionCall.name) {
		case 'analyze_document': {
			const args = functionCall.args as unknown as DocumentToolArgs;
			return await handleDocumentToolCall(args, emitter);
		}

		default:
			console.warn(`[decision-maker] Unknown function call: ${functionCall.name}`);
			return { error: `Unknown function: ${functionCall.name}` };
	}
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve decision-makers using ThoughtStream integration.
 *
 * This function wraps the provider architecture with structured thought emission
 * and contextual memory retrieval. It maintains the same resolution logic but
 * emits rich ThoughtSegments instead of raw text.
 *
 * Resolution Flow:
 * 1. Research phase - Delegate to Gemini provider
 * 2. Recommendation phase - Present findings with citations
 *
 * @param context - Resolution context with target info and message content
 * @param onSegment - Callback invoked for each emitted thought segment
 * @returns Decision-maker resolution result
 *
 * @example
 * ```typescript
 * const result = await resolveDecisionMakersV2(
 *   {
 *     targetType: 'corporate',
 *     targetEntity: 'ExxonMobil',
 *     subjectLine: 'Climate accountability',
 *     coreMessage: 'We need action on emissions...',
 *     topics: ['climate', 'fossil fuels'],
 *     geographicScope: { country: 'US' }
 *   },
 *   (segment) => {
 *     if (segment.type === 'insight') {
 *       console.log('Key insight:', segment.content);
 *     }
 *   }
 * );
 * ```
 */
export async function resolveDecisionMakersV2(
	context: ResolveContext,
	onSegment: (segment: ThoughtSegment) => void
): Promise<DecisionMakerResult> {
	const emitter = new ThoughtEmitter(onSegment);

	try {
		// ========================================================================
		// Phase 1: Research — Delegate to provider
		// Skip fake "understanding" and "context" phases - let real model do the work
		// ========================================================================

		emitter.startPhase('research');

		// Bridge streaming callbacks to ThoughtEmitter - only forward real model thoughts
		const enhancedContext: ResolveContext = {
			...context,
			streaming: {
				onThought: (thought, phase) => {
					// Clean thought before emitting - remove markdown and implementation details
					const cleaned = cleanThoughtForDisplay(thought);
					if (cleaned) {
						emitter.think(cleaned);
					}
				}
			}
		};

		const result = await decisionMakerRouter.resolve(enhancedContext);

		// ========================================================================
		// Phase 4: Recommendation — Present findings
		// ========================================================================

		emitter.startPhase('recommendation');

		if (result.decisionMakers.length === 0) {
			emitter.think(
				'No decision-makers could be verified with current contact information. ' +
					'Try refining your search or providing more specific organizational details.',
				{ emphasis: 'highlight' }
			);
		} else {
			emitter.insight(
				`Found ${result.decisionMakers.length} verified decision-maker${result.decisionMakers.length > 1 ? 's' : ''} with contact information.`,
				{ icon: '✅' }
			);

			// Emit recommendations for each decision-maker
			for (const dm of result.decisionMakers) {
				const citations = [];

				// Add source citation if available
				if (dm.source) {
					citations.push(
						emitter.cite(`Source for ${dm.name}`, {
							url: dm.source,
							excerpt: dm.reasoning || 'Verification source'
						})
					);
				}

				const dmLabel = `${dm.name} — ${dm.title}${dm.organization ? ` at ${dm.organization}` : ''}`;

				emitter.recommend(dmLabel, {
					citations: citations.length > 0 ? citations : undefined,
					pin: true,
					icon: '👤'
				});

				// Add reasoning as a muted follow-up
				if (dm.reasoning) {
					emitter.think(`Why ${dm.name}: ${dm.reasoning}`, { emphasis: 'muted' });
				}
			}
		}

		emitter.completePhase();

		return result;
	} catch (error) {
		console.error('[decision-maker] Resolution failed:', error);

		// Emit error thought
		const errorMessage =
			error instanceof Error ? error.message : 'An unexpected error occurred';
		emitter.think(`Error: ${errorMessage}`, { emphasis: 'highlight' });

		throw error;
	}
}

// ============================================================================
// Tool Registration Helpers
// ============================================================================

/**
 * Get all available tool declarations for Gemini function calling.
 *
 * Use this when configuring the Gemini client to enable agent tool usage.
 * Currently includes:
 * - analyze_document: Deep document analysis via Reducto
 *
 * @returns Array of Gemini-compatible function declarations
 *
 * @example
 * ```typescript
 * const config: GenerateContentConfig = {
 *   tools: [{
 *     functionDeclarations: getAgentToolDeclarations()
 *   }],
 *   // ... other config
 * };
 * ```
 */
export function getAgentToolDeclarations() {
	return [geminiDocumentToolDeclaration];
}
