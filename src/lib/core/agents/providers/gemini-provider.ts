/**
 * Gemini Decision-Maker Provider
 *
 * Implements two-phase resolution using Gemini + Google Search grounding:
 * - Phase 1: Role Discovery (structural reasoning, no grounding)
 * - Phase 2: Person Lookup (grounded search for current holders)
 *
 * Supports: congress, state_legislature, local_government
 */

import { generateWithThoughts } from '../gemini-client';
import {
	ROLE_DISCOVERY_PROMPT,
	PERSON_LOOKUP_PROMPT,
	buildRoleDiscoveryPrompt,
	buildPersonLookupPrompt
} from '../prompts/decision-maker';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import type { ProcessedDecisionMaker } from '$lib/types/template';
import type {
	DecisionMakerProvider,
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerTargetType
} from './types';

// ============================================================================
// Internal Types
// ============================================================================

/** A discovered role/position from Phase 1 */
interface DiscoveredRole {
	position: string;
	organization: string;
	jurisdiction: string;
	reasoning: string;
	search_query: string;
}

interface RoleDiscoveryResponse {
	roles: DiscoveredRole[];
}

/** A candidate from Phase 2 (person + contact info) */
interface Candidate {
	name: string;
	title: string;
	organization: string;
	reasoning: string;
	source_url: string;
	email: string;
	recency_check: string;
}

interface PersonLookupResponse {
	decision_makers: Candidate[];
	research_summary: string;
}

// ============================================================================
// Gemini Provider Implementation
// ============================================================================

export class GeminiDecisionMakerProvider implements DecisionMakerProvider {
	readonly name = 'gemini-search';

	readonly supportedTargetTypes: readonly DecisionMakerTargetType[] = [
		'congress',
		'state_legislature',
		'local_government'
	];

	canResolve(context: ResolveContext): boolean {
		return this.supportedTargetTypes.includes(context.targetType);
	}

	async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
		const startTime = Date.now();
		const { subjectLine, coreMessage, topics, voiceSample, streaming } = context;

		console.log('[gemini-provider] Starting two-phase resolution...');
		console.log('[gemini-provider] Target type:', context.targetType);
		console.log('[gemini-provider] Subject:', subjectLine);

		try {
			// ================================================================
			// Phase 1: Role Discovery — Structural reasoning, no names
			// ================================================================

			streaming?.onPhase?.('discover', 'Mapping institutional power structure...');

			const rolePrompt = buildRoleDiscoveryPrompt(subjectLine, coreMessage, topics, voiceSample);

			console.log('[gemini-provider] Phase 1: Discovering roles with thoughts...');

			const roleResult = await generateWithThoughts<RoleDiscoveryResponse>(
				rolePrompt,
				{
					systemInstruction: ROLE_DISCOVERY_PROMPT,
					temperature: 0.3,
					thinkingLevel: 'medium',
					maxOutputTokens: 65536
				},
				streaming?.onThought ? (thought) => streaming.onThought!(thought, 'discover') : undefined
			);

			const extraction = extractJsonFromGroundingResponse<RoleDiscoveryResponse>(
				roleResult.rawText || '{}'
			);

			if (!isSuccessfulExtraction(extraction)) {
				console.error('[gemini-provider] Phase 1 JSON extraction failed:', {
					error: extraction.error,
					rawTextLength: roleResult.rawText?.length,
					rawTextHead: roleResult.rawText?.slice(0, 200),
					rawTextTail: roleResult.rawText?.slice(-200)
				});
				throw new Error('Finding decision-makers hit a snag. Please try again.');
			}

			const roles: DiscoveredRole[] = extraction.data?.roles || [];

			console.log('[gemini-provider] Phase 1 complete:', {
				rolesFound: roles.length,
				positions: roles.map((r) => `${r.position} at ${r.organization}`)
			});

			if (roles.length === 0) {
				streaming?.onPhase?.('complete', 'No relevant positions identified');
				return {
					decisionMakers: [],
					provider: this.name,
					cacheHit: false,
					latencyMs: Date.now() - startTime,
					researchSummary:
						'No positions with direct power over this issue were identified. Try refining the subject line to be more specific about the decision being sought.'
				};
			}

			// Bridging thought: summarize discovered roles
			if (streaming?.onThought) {
				const roleNames = roles.slice(0, 3).map((r) => r.position);
				const suffix = roles.length > 3 ? ` and ${roles.length - 3} more` : '';
				streaming.onThought(
					`Found ${roles.length} key positions: ${roleNames.join(', ')}${suffix}. Now searching for who currently holds each role...`,
					'discover'
				);
			}

			// ================================================================
			// Phase 2: Person Lookup — Grounded search for current holders
			// ================================================================

			streaming?.onPhase?.('lookup', `Verifying current holders of ${roles.length} positions...`);
			streaming?.onProgress?.({ current: 0, total: roles.length, status: 'Searching...' });

			const lookupPrompt = buildPersonLookupPrompt(roles, subjectLine);

			const now = new Date();
			const currentDate = now.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
			const currentYear = now.getFullYear().toString();

			const systemPrompt = PERSON_LOOKUP_PROMPT.replace(/{CURRENT_DATE}/g, currentDate).replace(
				/{CURRENT_YEAR}/g,
				currentYear
			);

			console.log('[gemini-provider] Phase 2: Looking up current holders...');

			const lookupResult = await generateWithThoughts<PersonLookupResponse>(
				lookupPrompt,
				{
					systemInstruction: systemPrompt,
					temperature: 0.2,
					thinkingLevel: 'high',
					enableGrounding: true,
					maxOutputTokens: 65536
				},
				streaming?.onThought ? (thought) => streaming.onThought!(thought, 'lookup') : undefined
			);

			const lookupExtraction = extractJsonFromGroundingResponse<PersonLookupResponse>(
				lookupResult.rawText || '{}'
			);

			if (!isSuccessfulExtraction(lookupExtraction)) {
				console.error('[gemini-provider] Phase 2 JSON extraction failed:', {
					error: lookupExtraction.error,
					rawTextLength: lookupResult.rawText?.length,
					rawTextHead: lookupResult.rawText?.slice(0, 200),
					rawTextTail: lookupResult.rawText?.slice(-200)
				});
				throw new Error('Finding decision-makers hit a snag. Please try again.');
			}

			const data = lookupExtraction.data;
			console.log('[gemini-provider] Phase 2 complete:', {
				candidatesFound: data.decision_makers?.length || 0
			});

			const processed = this.processDecisionMakers(data.decision_makers || []);

			const latencyMs = Date.now() - startTime;

			if (processed.length === 0) {
				console.log('[gemini-provider] No decision-makers found after processing');
				streaming?.onPhase?.('complete', 'No verified decision-makers found');
				return {
					decisionMakers: [],
					provider: this.name,
					cacheHit: false,
					latencyMs,
					researchSummary:
						data.research_summary ||
						'No verifiable decision-makers found. The positions were identified but current holders could not be verified with recent sources.'
				};
			}

			console.log(`[gemini-provider] Two-phase resolution complete in ${latencyMs}ms:`, {
				rolesDiscovered: roles.length,
				candidatesFound: data.decision_makers?.length || 0,
				verified: processed.length,
				withEmail: processed.filter((dm) => dm.email).length,
				names: processed.map((dm) => dm.name)
			});

			streaming?.onPhase?.(
				'complete',
				`Found ${processed.length} decision-makers with verified contact info`
			);

			return {
				decisionMakers: processed,
				provider: this.name,
				cacheHit: false,
				latencyMs,
				researchSummary: data.research_summary || 'Two-phase research completed.',
				metadata: {
					rolesDiscovered: roles.length,
					candidatesFound: data.decision_makers?.length || 0,
					verified: processed.length,
					withEmail: processed.filter((dm) => dm.email).length
				}
			};
		} catch (error) {
			console.error('[gemini-provider] Resolution error:', error);
			throw new Error(
				`Failed to resolve decision-makers: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// ========================================================================
	// Processing Helpers
	// ========================================================================

	/**
	 * Process candidates into ProcessedDecisionMaker format.
	 * All candidates should have verified emails (agent only returns those).
	 */
	private processDecisionMakers(candidates: Candidate[]): ProcessedDecisionMaker[] {
		return candidates
			.filter((c) => c.email && c.reasoning && c.source_url && c.recency_check)
			.map((candidate) => ({
				name: candidate.name,
				title: candidate.title,
				organization: candidate.organization,
				email: candidate.email,
				reasoning: candidate.reasoning,
				source: candidate.source_url,
				provenance: `${candidate.reasoning}\n\nVerified via: ${candidate.source_url}\n${candidate.recency_check}`,
				isAiResolved: true,
				recencyCheck: candidate.recency_check,
				powerLevel: 'primary' as const
			}));
	}
}
