/**
 * Decision-Maker Resolution Agent v2 — ThoughtStream Integration
 *
 * Enhances the provider-based decision-maker resolution with:
 * - ThoughtEmitter for structured reasoning visualization
 * - AgentMemoryService for contextual intelligence retrieval
 * - Progressive disclosure with citations and research traces
 * - Document tool integration for deep document analysis
 *
 * This version emits ThoughtSegments instead of raw text streams,
 * enabling rich UI interaction with expandable thoughts, inline citations,
 * and persistent key moments.
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
import {
	CompositeThoughtEmitter,
	createCompositeEmitter,
	type ConfidentThoughtSegment,
	type PhaseChangeEvent,
	type ConfidenceUpdateEvent
} from '$lib/core/thoughts/composite-emitter';
import { AgentMemoryService } from '$lib/server/agent-memory/service';
import { decisionMakerRouter } from '../providers/router';
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

// ============================================================================
// Composite Streaming Types
// ============================================================================

/**
 * Extended options for composite streaming flow
 * Enables rich phase and confidence tracking when using composite provider
 */
export interface CompositeStreamingOptions {
	/** Callback for confident thought segments (includes confidence score) */
	onSegment: (segment: ThoughtSegment | ConfidentThoughtSegment) => void;
	/** Optional callback for phase changes (discovery -> verification -> complete) */
	onPhaseChange?: (event: PhaseChangeEvent) => void;
	/** Optional callback for confidence updates (verification boosts) */
	onConfidenceUpdate?: (event: ConfidenceUpdateEvent) => void;
}

/**
 * Check if a target type uses the composite provider
 * Composite provider handles both organizational and government targets
 */
function isCompositeProviderTarget(targetType: string): boolean {
	// The composite provider is the default for all target types
	// Government targets use Gemini-primary strategy
	// Organizational targets use Firecrawl-primary + Gemini-verification strategy
	const compositeTargetTypes = [
		'congress',
		'state_legislature',
		'local_government',
		'corporate',
		'nonprofit',
		'education',
		'healthcare',
		'labor',
		'media'
	];
	return compositeTargetTypes.includes(targetType);
}

/**
 * Check if a target type uses the two-phase discovery + verification flow
 * Only organizational targets get the full two-phase streaming experience
 */
function usesTwoPhaseFlow(targetType: string): boolean {
	const twoPhaseTypes = [
		'corporate',
		'nonprofit',
		'education',
		'healthcare',
		'labor',
		'media'
	];
	return twoPhaseTypes.includes(targetType);
}

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
	console.log(`[decision-maker-v2] Emitted ${citations.length} document citations with color: ${color}`);
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
	console.log(`[decision-maker-v2] Processing function call: ${functionCall.name}`);

	switch (functionCall.name) {
		case 'analyze_document': {
			const args = functionCall.args as unknown as DocumentToolArgs;
			return await handleDocumentToolCall(args, emitter);
		}

		default:
			console.warn(`[decision-maker-v2] Unknown function call: ${functionCall.name}`);
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
 * 1. Understanding phase - Analyze user intent
 * 2. Context phase - Retrieve relevant intelligence from memory
 * 3. Research phase - Delegate to provider (Gemini/Firecrawl)
 * 4. Recommendation phase - Present findings with citations
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
	const startTime = Date.now();
	const emitter = new ThoughtEmitter(onSegment);

	try {
		// ========================================================================
		// Phase 1: Understanding — Comprehend user intent
		// ========================================================================

		emitter.startPhase('understanding');
		emitter.think(`Analyzing your message about: "${context.subjectLine}"`);

		const targetTypeLabels: Record<string, string> = {
			congress: 'Congressional representatives',
			state_legislature: 'State legislators',
			local_government: 'Local government officials',
			corporate: 'Corporate leadership',
			nonprofit: 'Nonprofit leadership',
			education: 'Educational institution leadership',
			healthcare: 'Healthcare system leadership',
			labor: 'Labor organization leadership',
			media: 'Media organization leadership'
		};

		const targetLabel =
			targetTypeLabels[context.targetType] || `${context.targetType} decision-makers`;

		if (context.targetEntity) {
			emitter.think(
				`Searching for ${targetLabel} at ${context.targetEntity} who can address this issue.`
			);
		} else {
			emitter.think(`Identifying ${targetLabel} with power over this issue.`);
		}

		// ========================================================================
		// Phase 2: Context — Retrieve relevant intelligence
		// ========================================================================

		emitter.startPhase('context');
		const retrieval = emitter.startRetrieval(
			context.topics.join(' ') + ' ' + context.subjectLine
		);

		try {
			const memory = await AgentMemoryService.retrieveContext({
				topic: context.coreMessage,
				targetType: context.targetType,
				targetEntity: context.targetEntity,
				location: context.geographicScope,
				limit: 3,
				minRelevanceScore: 0.7
			});

			retrieval.addFinding(
				`Retrieved ${memory.metadata.totalItems} intelligence items (${memory.metadata.method} search)`
			);

			// Emit insights for top intelligence items with citations
			const allIntelligence = [
				...memory.intelligence.news,
				...memory.intelligence.legislative,
				...memory.intelligence.corporate,
				...memory.intelligence.regulatory,
				...memory.intelligence.social
			].sort((a, b) => b.relevanceScore - a.relevanceScore);

			if (allIntelligence.length > 0) {
				const top = allIntelligence[0];
				const citation = emitter.cite(top.title, {
					url: top.sourceUrl,
					excerpt: top.snippet
				});

				const dateStr = top.publishedAt.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				});

				emitter.insight(
					`Recent development (${dateStr}): ${top.title} — ${top.snippet.slice(0, 100)}...`,
					{ citations: [citation], pin: true }
				);

				retrieval.complete(
					`Found ${memory.metadata.totalItems} relevant intelligence items to inform decision-maker selection`
				);
			} else {
				retrieval.complete('No recent intelligence items found for this topic');
			}

			// Add organization context if available
			if (memory.organization) {
				const org = memory.organization;
				emitter.think(`Target organization: ${org.name} (${org.industry || 'Industry unknown'})`);

				if (org.leadership && org.leadership.length > 0) {
					emitter.think(
						`Known leadership: ${org.leadership
							.slice(0, 3)
							.map((l) => `${l.name} (${l.title})`)
							.join(', ')}`
					);
				}
			}
		} catch (error) {
			console.error('[decision-maker-v2] Context retrieval failed:', error);
			retrieval.error(
				`Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			// Continue with resolution even if memory retrieval fails
		}

		// ========================================================================
		// Phase 3: Research — Delegate to provider
		// ========================================================================

		emitter.startPhase('research');

		const research = emitter.startResearch(
			context.targetEntity || targetLabel,
			context.targetType
		);

		// Bridge the old streaming callbacks to ThoughtEmitter
		const enhancedContext: ResolveContext = {
			...context,
			streaming: {
				onPhase: (phase, message) => {
					emitter.think(message, { emphasis: 'muted' });
				},
				onThought: (thought, phase) => {
					// Emit provider thoughts as normal reasoning
					emitter.think(thought);
				},
				onProgress: (progress) => {
					if (progress.candidateName) {
						research.addFinding(`Verifying ${progress.candidateName}...`);
					}
				}
			}
		};

		let result: DecisionMakerResult;
		try {
			result = await decisionMakerRouter.resolve(enhancedContext);

			research.addFinding(`Identified ${result.decisionMakers.length} decision-makers`);
			research.complete(
				`Research complete: Found ${result.decisionMakers.length} verified recipients`
			);
		} catch (error) {
			research.error(error instanceof Error ? error.message : 'Resolution failed');
			throw error;
		}

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

		// Add final summary
		const latencyMs = Date.now() - startTime;
		emitter.think(
			`Resolution completed in ${(latencyMs / 1000).toFixed(1)}s using ${result.provider} provider.`,
			{ emphasis: 'muted' }
		);

		emitter.completePhase();

		return result;
	} catch (error) {
		console.error('[decision-maker-v2] Resolution failed:', error);

		// Emit error thought
		const errorMessage =
			error instanceof Error ? error.message : 'An unexpected error occurred';
		emitter.think(`Error: ${errorMessage}`, { emphasis: 'highlight' });

		throw error;
	}
}

// ============================================================================
// Composite-Aware Resolution (Two-Phase Streaming)
// ============================================================================

/**
 * Resolve decision-makers with full composite streaming support.
 *
 * This is the preferred entry point for organizational targets (corporate, nonprofit,
 * education, healthcare, labor, media) as it provides:
 * - Two-phase streaming (Discovery + Verification)
 * - Per-thought confidence tracking
 * - Phase change events for UI state transitions
 * - Confidence update events for verification boosts
 *
 * For government targets, this delegates to the standard resolution flow
 * since they use Gemini-primary strategy without the two-phase pattern.
 *
 * @param context - Resolution context with target info
 * @param options - Streaming options with callbacks for segments, phases, and confidence
 * @returns Decision-maker resolution result
 *
 * @example
 * ```typescript
 * const result = await resolveDecisionMakersWithCompositeStreaming(
 *   {
 *     targetType: 'corporate',
 *     targetEntity: 'Apple Inc.',
 *     subjectLine: 'Sustainability',
 *     coreMessage: 'Climate action needed',
 *     topics: ['climate']
 *   },
 *   {
 *     onSegment: (segment) => {
 *       // Segment includes confidence for composite flow
 *       console.log(segment.content, segment.confidence);
 *     },
 *     onPhaseChange: (event) => {
 *       // Update UI state: discovery -> verification -> complete
 *       console.log(`Phase: ${event.from} -> ${event.to}`);
 *     },
 *     onConfidenceUpdate: (event) => {
 *       // Animate confidence boost on verified thoughts
 *       console.log(`Thought ${event.thoughtId}: ${event.newConfidence}`);
 *     }
 *   }
 * );
 * ```
 */
export async function resolveDecisionMakersWithCompositeStreaming(
	context: ResolveContext,
	options: CompositeStreamingOptions
): Promise<DecisionMakerResult> {
	const { onSegment, onPhaseChange, onConfidenceUpdate } = options;

	// Check if this target type uses the two-phase flow
	if (!usesTwoPhaseFlow(context.targetType)) {
		// Government targets use standard flow (Gemini-primary, no two-phase)
		console.log('[decision-maker-v2] Using standard flow for government target');
		return resolveDecisionMakersV2(context, onSegment);
	}

	// Two-phase flow for organizational targets
	console.log('[decision-maker-v2] Using composite two-phase flow');
	const startTime = Date.now();

	// Create CompositeThoughtEmitter for two-phase streaming
	const compositeEmitter = createCompositeEmitter(
		(segment) => {
			// Forward confident segments to the callback
			onSegment(segment);
		},
		onPhaseChange,
		onConfidenceUpdate
	);

	// Create regular ThoughtEmitter for understanding/context phases
	const regularEmitter = new ThoughtEmitter(onSegment);

	try {
		// ========================================================================
		// Phase 1: Understanding — Comprehend user intent (regular emitter)
		// ========================================================================

		regularEmitter.startPhase('understanding');
		regularEmitter.think(`Analyzing your message about: "${context.subjectLine}"`);

		const targetTypeLabels: Record<string, string> = {
			corporate: 'Corporate leadership',
			nonprofit: 'Nonprofit leadership',
			education: 'Educational institution leadership',
			healthcare: 'Healthcare system leadership',
			labor: 'Labor organization leadership',
			media: 'Media organization leadership'
		};

		const targetLabel = targetTypeLabels[context.targetType] || `${context.targetType} decision-makers`;

		if (context.targetEntity) {
			regularEmitter.think(
				`Searching for ${targetLabel} at ${context.targetEntity} who can address this issue.`
			);
		}

		// ========================================================================
		// Phase 2: Context — Retrieve relevant intelligence (regular emitter)
		// ========================================================================

		regularEmitter.startPhase('context');
		const retrieval = regularEmitter.startRetrieval(
			context.topics.join(' ') + ' ' + context.subjectLine
		);

		try {
			const memory = await AgentMemoryService.retrieveContext({
				topic: context.coreMessage,
				targetType: context.targetType,
				targetEntity: context.targetEntity,
				location: context.geographicScope,
				limit: 3,
				minRelevanceScore: 0.7
			});

			retrieval.addFinding(
				`Retrieved ${memory.metadata.totalItems} intelligence items (${memory.metadata.method} search)`
			);

			const allIntelligence = [
				...memory.intelligence.news,
				...memory.intelligence.legislative,
				...memory.intelligence.corporate,
				...memory.intelligence.regulatory,
				...memory.intelligence.social
			].sort((a, b) => b.relevanceScore - a.relevanceScore);

			if (allIntelligence.length > 0) {
				const top = allIntelligence[0];
				const citation = regularEmitter.cite(top.title, {
					url: top.sourceUrl,
					excerpt: top.snippet
				});

				const dateStr = top.publishedAt.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				});

				regularEmitter.insight(
					`Recent development (${dateStr}): ${top.title} — ${top.snippet.slice(0, 100)}...`,
					{ citations: [citation], pin: true }
				);

				retrieval.complete(
					`Found ${memory.metadata.totalItems} relevant intelligence items`
				);
			} else {
				retrieval.complete('No recent intelligence items found for this topic');
			}
		} catch (error) {
			console.error('[decision-maker-v2] Context retrieval failed:', error);
			retrieval.error(
				`Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}

		// ========================================================================
		// Phase 3: Research — Delegate to composite provider with CompositeThoughtEmitter
		// ========================================================================

		regularEmitter.completePhase();

		// Pass the CompositeThoughtEmitter to the provider for two-phase streaming
		const enhancedContext: ResolveContext = {
			...context,
			compositeEmitter,
			streaming: {
				// Legacy callbacks for backward compatibility with provider internals
				onPhase: (phase, message) => {
					// Phase changes are now handled by compositeEmitter
					console.log(`[decision-maker-v2] Provider phase: ${phase} - ${message}`);
				},
				onThought: (thought, phase) => {
					// Thoughts are now emitted through compositeEmitter
					console.log(`[decision-maker-v2] Provider thought: ${thought}`);
				},
				onProgress: (progress) => {
					if (progress.candidateName) {
						console.log(`[decision-maker-v2] Verifying: ${progress.candidateName}`);
					}
				}
			}
		};

		let result: DecisionMakerResult;
		try {
			result = await decisionMakerRouter.resolve(enhancedContext);
		} catch (error) {
			// Mark as degraded if resolution fails
			compositeEmitter.degraded();
			throw error;
		}

		// ========================================================================
		// Phase 4: Recommendation — Present findings (regular emitter)
		// ========================================================================

		regularEmitter.startPhase('recommendation');

		if (result.decisionMakers.length === 0) {
			regularEmitter.think(
				'No decision-makers could be verified with current contact information. ' +
					'Try refining your search or providing more specific organizational details.',
				{ emphasis: 'highlight' }
			);
		} else {
			regularEmitter.insight(
				`Found ${result.decisionMakers.length} verified decision-maker${result.decisionMakers.length > 1 ? 's' : ''} with contact information.`,
				{ icon: '✅' }
			);

			for (const dm of result.decisionMakers) {
				const citations = [];
				if (dm.source) {
					citations.push(
						regularEmitter.cite(`Source for ${dm.name}`, {
							url: dm.source,
							excerpt: dm.reasoning || 'Verification source'
						})
					);
				}

				const dmLabel = `${dm.name} — ${dm.title}${dm.organization ? ` at ${dm.organization}` : ''}`;
				regularEmitter.recommend(dmLabel, {
					citations: citations.length > 0 ? citations : undefined,
					pin: true,
					icon: '👤'
				});

				if (dm.reasoning) {
					regularEmitter.think(`Why ${dm.name}: ${dm.reasoning}`, { emphasis: 'muted' });
				}
			}
		}

		const latencyMs = Date.now() - startTime;
		regularEmitter.think(
			`Resolution completed in ${(latencyMs / 1000).toFixed(1)}s using ${result.provider} provider.`,
			{ emphasis: 'muted' }
		);

		// Include composite emitter stats in result metadata
		const compositeStats = {
			averageConfidence: compositeEmitter.getAverageConfidence(),
			verificationRate: compositeEmitter.getVerificationRate(),
			discoveryDuration: compositeEmitter.getPhaseDuration('discovery'),
			verificationDuration: compositeEmitter.getPhaseDuration('verification'),
			finalPhase: compositeEmitter.phase
		};

		regularEmitter.completePhase();

		return {
			...result,
			metadata: {
				...result.metadata,
				compositeStreaming: compositeStats
			}
		};
	} catch (error) {
		console.error('[decision-maker-v2] Composite resolution failed:', error);
		const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
		regularEmitter.think(`Error: ${errorMessage}`, { emphasis: 'highlight' });
		throw error;
	}
}

// ============================================================================
// Backward Compatibility Bridge
// ============================================================================

/**
 * Bridge function that converts old streaming callbacks to ThoughtSegments.
 *
 * This allows existing code using the v1 API to work with v2 under the hood,
 * while new code can consume ThoughtSegments directly.
 *
 * @deprecated For new code, use resolveDecisionMakersWithCompositeStreaming
 */
export async function resolveDecisionMakersWithThoughts(
	context: ResolveContext,
	callbacks: {
		onSegment?: (segment: ThoughtSegment) => void;
		onThought?: (thought: string, phase: string) => void;
		onPhase?: (phase: string, message: string) => void;
	}
): Promise<DecisionMakerResult> {
	return resolveDecisionMakersV2(context, (segment) => {
		// Emit segment if callback provided
		callbacks.onSegment?.(segment);

		// Bridge to old callbacks for backward compatibility
		if (callbacks.onThought && segment.type === 'reasoning') {
			callbacks.onThought(segment.content, segment.phase);
		}

		if (callbacks.onPhase && segment.type === 'reasoning' && segment.content === '') {
			// Empty reasoning segments are phase markers
			callbacks.onPhase(segment.phase, `Phase: ${segment.phase}`);
		}
	});
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

/**
 * Check if a Gemini response contains function calls
 *
 * @param response - Gemini API response
 * @returns true if the response contains function calls
 */
export function hasGeminiFunctionCalls(response: {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				functionCall?: unknown;
			}>;
		};
	}>;
}): boolean {
	return response.candidates?.some((candidate) =>
		candidate.content?.parts?.some((part) => part.functionCall !== undefined)
	) ?? false;
}

/**
 * Extract function calls from a Gemini response
 *
 * @param response - Gemini API response
 * @returns Array of function calls
 */
export function extractGeminiFunctionCalls(response: {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				functionCall?: {
					name: string;
					args: Record<string, unknown>;
				};
			}>;
		};
	}>;
}): GeminiFunctionCall[] {
	const calls: GeminiFunctionCall[] = [];

	for (const candidate of response.candidates || []) {
		for (const part of candidate.content?.parts || []) {
			if (part.functionCall) {
				calls.push({
					name: part.functionCall.name,
					args: part.functionCall.args
				});
			}
		}
	}

	return calls;
}

/**
 * Create a function response part for sending back to Gemini
 *
 * @param name - Function name that was called
 * @param response - Result from the function execution
 * @returns Gemini-compatible function response part
 */
export function createFunctionResponsePart(
	name: string,
	response: unknown
): { functionResponse: { name: string; response: unknown } } {
	return {
		functionResponse: {
			name,
			response
		}
	};
}
