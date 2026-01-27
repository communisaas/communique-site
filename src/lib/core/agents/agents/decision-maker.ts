/**
 * Decision-Maker Resolution Agent — Two-Phase Architecture
 *
 * Phase 1 (Role Discovery): Identify POSITIONS with power over the issue.
 *   - No grounding. Uses responseSchema for guaranteed JSON.
 *   - LLM reasons about institutional power structure without activating name associations.
 *
 * Phase 2 (Person Lookup): Search for who CURRENTLY holds each role.
 *   - Google Search grounding enabled.
 *   - Information flow inverted: search first, extract name from results.
 *   - Eliminates confirmation bias from stale parametric memory.
 *
 * Two calls total (not N+1): Phase 2 is a single batched grounding call.
 */

import { generate, generateWithThoughts } from '../gemini-client';
import {
	ROLE_DISCOVERY_PROMPT,
	PERSON_LOOKUP_PROMPT,
	buildRoleDiscoveryPrompt,
	buildPersonLookupPrompt
} from '../prompts/decision-maker';
import { ROLE_DISCOVERY_SCHEMA } from '../schemas';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import type { DecisionMakerResponse, DecisionMaker, ContactChannel } from '../types';

// ============================================================================
// Types
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
// Public Interface
// ============================================================================

export type PipelinePhase = 'discover' | 'lookup' | 'complete';

export interface StreamingCallbacks {
	onThought?: (thought: string, phase: PipelinePhase) => void;
	onPhase?: (phase: PipelinePhase, message: string) => void;
	onProgress?: (progress: { current: number; total: number; candidateName?: string; status?: string }) => void;
}

export interface ResolveOptions {
	subjectLine: string;
	coreIssue: string;
	topics: string[];
	voiceSample?: string;
	urlSlug?: string;
	streaming?: StreamingCallbacks;
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve decision-makers using two-phase architecture.
 *
 * Phase 1: Identify positions with power (structured output, no grounding)
 * Phase 2: Look up current holders via Google Search (grounding, no schema)
 */
export async function resolveDecisionMakers(
	options: ResolveOptions
): Promise<DecisionMakerResponse> {
	const startTime = Date.now();
	const { subjectLine, coreIssue, topics, voiceSample, streaming } = options;

	console.log('[decision-maker] Starting two-phase resolution...');
	console.log('[decision-maker] Subject:', subjectLine);

	try {
		// ====================================================================
		// Phase 1: Role Discovery — Structural reasoning, no names
		// ====================================================================

		streaming?.onPhase?.('discover', 'Mapping institutional power structure...');

		const rolePrompt = buildRoleDiscoveryPrompt(subjectLine, coreIssue, topics, voiceSample);

		console.log('[decision-maker] Phase 1: Discovering roles...');

		const roleResponse = await generate(rolePrompt, {
			systemInstruction: ROLE_DISCOVERY_PROMPT,
			responseSchema: ROLE_DISCOVERY_SCHEMA,
			temperature: 0.3,
			maxOutputTokens: 4096
		});

		let roles: DiscoveredRole[];
		try {
			const parsed = JSON.parse(roleResponse.text || '{}') as RoleDiscoveryResponse;
			roles = parsed.roles || [];
		} catch {
			console.error('[decision-maker] Phase 1 JSON parse failed, raw:', roleResponse.text?.slice(0, 200));
			throw new Error('Failed to parse role discovery response');
		}

		console.log('[decision-maker] Phase 1 complete:', {
			rolesFound: roles.length,
			positions: roles.map((r) => `${r.position} at ${r.organization}`)
		});

		if (roles.length === 0) {
			streaming?.onPhase?.('complete', 'No relevant positions identified');
			return {
				decision_makers: [],
				research_summary: 'No positions with direct power over this issue were identified. Try refining the subject line to be more specific about the decision being sought.',
				pipeline_stats: {
					candidates_found: 0,
					enrichments_succeeded: 0,
					validations_passed: 0,
					total_latency_ms: Date.now() - startTime
				}
			};
		}

		// ====================================================================
		// Phase 2: Person Lookup — Grounded search for current holders
		// ====================================================================

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

		const systemPrompt = PERSON_LOOKUP_PROMPT
			.replace(/{CURRENT_DATE}/g, currentDate)
			.replace(/{CURRENT_YEAR}/g, currentYear);

		console.log('[decision-maker] Phase 2: Looking up current holders...');

		const lookupResult = await generateWithThoughts<PersonLookupResponse>(
			lookupPrompt,
			{
				systemInstruction: systemPrompt,
				temperature: 0.2,
				thinkingLevel: 'high',
				enableGrounding: true,
				maxOutputTokens: 16384
			},
			streaming?.onThought
				? (thought) => streaming.onThought!(thought, 'lookup')
				: undefined
		);

		const extraction = extractJsonFromGroundingResponse<PersonLookupResponse>(lookupResult.rawText || '{}');

		if (!isSuccessfulExtraction(extraction)) {
			console.error('[decision-maker] Phase 2 JSON extraction failed:', extraction.error);
			throw new Error(`Failed to parse person lookup response: ${extraction.error}`);
		}

		const data = extraction.data;
		console.log('[decision-maker] Phase 2 complete:', {
			candidatesFound: data.decision_makers?.length || 0
		});

		const processed = processDecisionMakers(data.decision_makers || []);

		const latencyMs = Date.now() - startTime;

		if (processed.length === 0) {
			console.log('[decision-maker] No decision-makers found after processing');
			streaming?.onPhase?.('complete', 'No verified decision-makers found');
			return {
				decision_makers: [],
				research_summary:
					data.research_summary ||
					'No verifiable decision-makers found. The positions were identified but current holders could not be verified with recent sources.',
				pipeline_stats: {
					candidates_found: data.decision_makers?.length || 0,
					enrichments_succeeded: 0,
					validations_passed: 0,
					total_latency_ms: latencyMs
				}
			};
		}

		console.log(`[decision-maker] Two-phase resolution complete in ${latencyMs}ms:`, {
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
			decision_makers: processed,
			research_summary: data.research_summary || 'Two-phase research completed.',
			pipeline_stats: {
				candidates_found: data.decision_makers?.length || 0,
				enrichments_succeeded: processed.filter((p) => p.email).length,
				validations_passed: processed.length,
				total_latency_ms: latencyMs
			}
		};
	} catch (error) {
		console.error('[decision-maker] Resolution error:', error);
		throw new Error(
			`Failed to resolve decision-makers: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// ============================================================================
// Processing
// ============================================================================

/**
 * Process candidates into DecisionMaker format.
 * All candidates should have verified emails (agent only returns those).
 */
function processDecisionMakers(candidates: Candidate[]): DecisionMaker[] {
	return candidates
		.filter((c) => c.email && c.reasoning && c.source_url && c.recency_check)
		.map((candidate) => ({
			name: candidate.name,
			title: candidate.title,
			organization: candidate.organization,
			email: candidate.email,
			reasoning: candidate.reasoning,
			sourceUrl: candidate.source_url,
			emailSource: candidate.source_url,
			recencyCheck: candidate.recency_check,
			confidence: 0.8,
			contactChannel: 'email' as ContactChannel
		}));
}
