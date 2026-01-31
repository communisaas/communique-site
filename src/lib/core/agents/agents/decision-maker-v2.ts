/**
 * Decision-Maker Resolution Agent v2 — ThoughtStream Integration
 *
 * Enhances the provider-based decision-maker resolution with:
 * - ThoughtEmitter for structured reasoning visualization
 * - AgentMemoryService for contextual intelligence retrieval
 * - Progressive disclosure with citations and research traces
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
import { AgentMemoryService } from '$lib/server/agent-memory/service';
import { decisionMakerRouter } from '../providers/router';
import type { ResolveContext, DecisionMakerResult } from '../providers/types';
import type { ThoughtSegment } from '$lib/core/thoughts/types';

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
					excerpt: top.snippet,
					sourceType: 'intelligence'
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
// Backward Compatibility Bridge
// ============================================================================

/**
 * Bridge function that converts old streaming callbacks to ThoughtSegments.
 *
 * This allows existing code using the v1 API to work with v2 under the hood,
 * while new code can consume ThoughtSegments directly.
 *
 * @deprecated For new code, use resolveDecisionMakersV2 directly
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
