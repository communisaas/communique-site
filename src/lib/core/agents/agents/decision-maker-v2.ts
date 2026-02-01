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
	executeMultipleDocumentTool,
	MAX_PARALLEL_DOCUMENTS,
	type DocumentAnalysisResult,
	type MultiDocumentAnalysisResult
} from '$lib/core/tools/document';
import { getDocumentTypeColor, getDocumentTypeIcon } from '$lib/core/tools/document-helpers';
import type { DocumentType, ParsedDocument } from '$lib/server/reducto/types';
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
 * Check if a target type uses the two-phase discovery + verification flow.
 *
 * Only organizational targets get the full two-phase streaming experience
 * with CompositeThoughtEmitter:
 * - Discovery phase (Firecrawl): Deep website extraction, emits thoughts with base confidence
 * - Verification phase (Gemini): Recency check, boosts confidence for verified thoughts
 *
 * Government targets (congress, state_legislature, local_government) use
 * Gemini-primary strategy without the two-phase pattern.
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
 * @param documentsCollector - Optional Map to collect parsed documents for L2 previews
 * @returns Tool result for Gemini to continue generation
 *
 * @example
 * ```typescript
 * const documents = new Map<string, ParsedDocument>();
 * const result = await handleDocumentToolCall(
 *   { url: 'https://congress.gov/bill/...', query: 'climate policy' },
 *   emitter,
 *   documents
 * );
 * // Result is sent back to Gemini for continued reasoning
 * // documents Map now contains the parsed document keyed by its ID
 * ```
 */
export async function handleDocumentToolCall(
	args: DocumentToolArgs,
	emitter: ThoughtEmitter,
	documentsCollector?: Map<string, ParsedDocument>
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

		// Emit findings and collect document for L2 previews
		if (result.document) {
			action.addFinding(`Parsed ${result.document.sections.length} sections`);
			action.addFinding(`Extracted ${result.document.entities.length} entities`);

			// Add to documents collector for L2 preview access
			if (documentsCollector) {
				documentsCollector.set(result.document.id, result.document);
				console.log(`[decision-maker-v2] Collected document for L2 preview: ${result.document.id}`);
			}
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
 * @param documentsCollector - Optional Map to collect parsed documents for L2 previews
 * @returns Result to send back to Gemini
 */
export async function processGeminiFunctionCall(
	functionCall: GeminiFunctionCall,
	emitter: ThoughtEmitter,
	documentsCollector?: Map<string, ParsedDocument>
): Promise<unknown> {
	console.log(`[decision-maker-v2] Processing function call: ${functionCall.name}`);

	switch (functionCall.name) {
		case 'analyze_document': {
			const args = functionCall.args as unknown as DocumentToolArgs;
			return await handleDocumentToolCall(args, emitter, documentsCollector);
		}

		default:
			console.warn(`[decision-maker-v2] Unknown function call: ${functionCall.name}`);
			return { error: `Unknown function: ${functionCall.name}` };
	}
}

/**
 * Process multiple document function calls in parallel.
 *
 * When the agent requests analysis of multiple documents (e.g., via multiple
 * function calls in one response), this method processes them in parallel
 * for significantly faster total time (3 docs = ~35s vs 90s+ sequential).
 *
 * Key features:
 * - Parallel processing with Promise.allSettled
 * - Error isolation (one failure doesn't affect others)
 * - Progress events for perceptual engineering
 * - Automatic prioritization if exceeding MAX_PARALLEL_DOCUMENTS
 *
 * @param functionCalls - Array of document analysis function calls
 * @param emitter - ThoughtEmitter for streaming updates
 * @param documentsCollector - Optional Map to collect parsed documents for L2 previews
 * @returns Array of results in the same order as input
 *
 * @example
 * ```typescript
 * const functionCalls = extractGeminiFunctionCalls(response);
 * const documentCalls = functionCalls.filter(fc => fc.name === 'analyze_document');
 *
 * if (documentCalls.length > 1) {
 *   // Process in parallel for speed
 *   const results = await processMultipleDocumentCalls(
 *     documentCalls,
 *     emitter,
 *     documentsCollector
 *   );
 * }
 * ```
 */
export async function processMultipleDocumentCalls(
	functionCalls: GeminiFunctionCall[],
	emitter: ThoughtEmitter,
	documentsCollector?: Map<string, ParsedDocument>
): Promise<DocumentAnalysisResult[]> {
	// Filter to only document analysis calls
	const documentCalls = functionCalls.filter((fc) => fc.name === 'analyze_document');

	if (documentCalls.length === 0) {
		return [];
	}

	// For single document, use the standard handler
	if (documentCalls.length === 1) {
		const args = documentCalls[0].args as unknown as DocumentToolArgs;
		const result = await handleDocumentToolCall(args, emitter, documentsCollector);
		return [result];
	}

	console.log(`[decision-maker-v2] Processing ${documentCalls.length} document calls in parallel`);

	// Extract URLs and build relevance score map from queries
	const urls: string[] = [];
	const queries: string[] = [];
	const relevanceScores = new Map<string, number>();

	for (const call of documentCalls) {
		const args = call.args as unknown as DocumentToolArgs;
		urls.push(args.url);
		queries.push(args.query);

		// Use query specificity as a proxy for relevance
		// More specific queries (longer, more terms) get higher priority
		const queryWords = args.query.split(/\s+/).length;
		const relevance = Math.min(1, queryWords / 10); // Normalize to 0-1
		relevanceScores.set(args.url, relevance);
	}

	// Combine queries for relevance scoring
	const combinedQuery = queries.join(' ');

	// Use the parallel document tool
	const result = await executeMultipleDocumentTool(urls, {
		query: combinedQuery,
		emitter,
		relevanceScores
	});

	// Collect documents for L2 previews
	if (documentsCollector) {
		for (const doc of result.documents) {
			documentsCollector.set(doc.id, doc);
			console.log(`[decision-maker-v2] Collected document for L2 preview: ${doc.id}`);
		}
	}

	// Convert to individual DocumentAnalysisResult format
	// Map results back to original order
	const results: DocumentAnalysisResult[] = urls.map((url, index) => {
		const doc = result.documents.find((d) => d.metadata.sourceUrl === url);
		const error = result.errors.find((e) => e.url === url);

		if (doc) {
			return {
				success: true,
				document: doc,
				summary: generateCompactSummary(doc),
				citations: buildCompactCitations(doc, queries[index])
			};
		} else {
			return {
				success: false,
				error: error?.error || 'Document analysis failed'
			};
		}
	});

	console.log(`[decision-maker-v2] Parallel processing complete:`, {
		total: urls.length,
		successful: result.stats.successful,
		failed: result.stats.failed,
		timedOut: result.stats.timedOut,
		totalTimeMs: result.stats.totalTimeMs
	});

	return results;
}

/**
 * Generate a compact summary for parallel-processed documents
 */
function generateCompactSummary(doc: ParsedDocument): string {
	const parts: string[] = [];
	parts.push(`**${doc.title}**`);
	parts.push(`${doc.sections.length} sections, ${doc.entities.length} entities`);

	if (doc.queryRelevance?.summary) {
		parts.push(doc.queryRelevance.summary);
	}

	return parts.join(' | ');
}

/**
 * Build compact citations for parallel-processed documents
 */
function buildCompactCitations(doc: ParsedDocument, query: string): Citation[] {
	const citations: Citation[] = [];

	// Add top relevant passages as citations
	if (doc.queryRelevance?.passages) {
		for (const passage of doc.queryRelevance.passages.slice(0, 2)) {
			citations.push({
				id: `doc-${doc.id}-${passage.sectionId}`,
				label: `${doc.title} - ${passage.sectionId}`,
				url: doc.source.url,
				excerpt: passage.text.slice(0, 150) + (passage.text.length > 150 ? '...' : ''),
				sourceType: 'document',
				documentId: doc.id
			});
		}
	}

	// Fallback citation
	if (citations.length === 0) {
		citations.push({
			id: `doc-${doc.id}`,
			label: doc.title,
			url: doc.source.url,
			excerpt: doc.sections[0]?.content.slice(0, 150) || 'Document analyzed',
			sourceType: 'document',
			documentId: doc.id
		});
	}

	return citations;
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

		if (context.targetEntity) {
			emitter.think(
				`Searching for decision-makers at ${context.targetEntity} who can address this issue.`
			);
		} else {
			emitter.think(`Identifying decision-makers with power over this issue.`);
		}

		// ========================================================================
		// Phase 2: Context — Use core issue as context (simplified for demo)
		// ========================================================================

		// Simplified: Just use the core message from subject line agent as context
		// No external intelligence retrieval needed
		emitter.think(`Core issue: ${context.coreMessage}`);

		// ========================================================================
		// Phase 3: Research — Delegate to provider
		// ========================================================================

		emitter.startPhase('research');

		const research = emitter.startResearch(
			context.targetEntity || 'decision-makers',
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

		if (context.targetEntity) {
			regularEmitter.think(
				`Searching for decision-makers at ${context.targetEntity} who can address this issue.`
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
