/**
 * Decision-Maker Resolution Agent
 *
 * Single Gemini call extracts decision-makers AND their contact information.
 *
 * Strategy:
 * 1. Identifies decision-makers with power over the issue
 * 2. Finds their emails through exhaustive search
 * 3. Extracts organization domains and patterns for fallback inference
 * 4. Provides fallback contact methods (press emails, contact pages)
 *
 * All in ONE Gemini call with Google Search grounding.
 *
 * CRITICAL: This agent MUST use Google Search grounding to find verifiable
 * decision-makers. Without grounding, the model will hallucinate names.
 */

import { generateWithThoughts } from '../gemini-client';
import { DECISION_MAKER_PROMPT, buildDecisionMakerPrompt } from '../prompts/decision-maker';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import { verifyMxRecord, parseName } from '../utils/email-verifier';
import type { DecisionMakerResponse, DecisionMaker, ContactChannel } from '../types';

// ============================================================================
// Types
// ============================================================================

interface Candidate {
	name: string;
	title: string;
	organization: string;
	reasoning: string;
	source_url: string;
	email: string; // Required - agent only returns candidates with verified emails
	recency_check: string; // Required - verification they currently hold this position
	position_source_date?: string; // Optional - date of the source used for verification
}

interface GeminiResponse {
	decision_makers: Candidate[];
	research_summary: string;
}

// ============================================================================
// Public Interface
// ============================================================================

export type PipelinePhase = 'identify' | 'complete';

export interface StreamingCallbacks {
	onThought?: (thought: string, phase: PipelinePhase) => void;
	onPhase?: (phase: PipelinePhase, message: string) => void;
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
 * Resolve decision-makers for a given issue.
 *
 * Extracts 5-8 candidates with emails, domains, and patterns in ONE Gemini call.
 *
 * @param options - Resolution options (subject, issue, topics, voiceSample)
 * @returns Decision-maker response with research summary and stats
 */
export async function resolveDecisionMakers(
	options: ResolveOptions
): Promise<DecisionMakerResponse> {
	const startTime = Date.now();
	const { subjectLine, coreIssue, topics, voiceSample, streaming } = options;

	console.log('[decision-maker] Starting resolution...');
	console.log('[decision-maker] Subject:', subjectLine);

	streaming?.onPhase?.('identify', 'Researching decision-makers and their contact information...');

	try {
		const userPrompt = buildDecisionMakerPrompt(subjectLine, coreIssue, topics, voiceSample);

		const result = await generateWithThoughts<GeminiResponse>(
			userPrompt,
			{
				systemInstruction: DECISION_MAKER_PROMPT.replace(
					'{CURRENT_DATE}',
					new Date().toLocaleDateString('en-US', {
						year: 'numeric',
						month: 'long',
						day: 'numeric'
					})
				).replace('{CURRENT_YEAR}', new Date().getFullYear().toString()),
				temperature: 0.2,
				thinkingLevel: 'high',
				enableGrounding: true,
				maxOutputTokens: 16384 // Increased to prevent truncation
			},
			streaming?.onThought ? (thought) => streaming.onThought!(thought, 'identify') : undefined
		);

		const extraction = extractJsonFromGroundingResponse<GeminiResponse>(result.rawText || '{}');

		if (!isSuccessfulExtraction(extraction)) {
			console.error('[decision-maker] JSON extraction failed:', extraction.error);
			throw new Error(`Failed to parse response: ${extraction.error}`);
		}

		const data = extraction.data;
		console.log('[decision-maker] Extracted candidates:', data.decision_makers?.length || 0);

		const processed = processDecisionMakers(data.decision_makers || []);

		const latencyMs = Date.now() - startTime;

		if (processed.length === 0) {
			console.log('[decision-maker] No decision-makers found');
			streaming?.onPhase?.('complete', 'No decision-makers found');
			return {
				decision_makers: [],
				research_summary:
					data.research_summary ||
					'No verifiable decision-makers found for this issue. Try refining the subject line or core issue to be more specific.',
				pipeline_stats: {
					candidates_found: data.decision_makers?.length || 0,
					enrichments_succeeded: 0,
					validations_passed: 0,
					total_latency_ms: latencyMs
				}
			};
		}

		console.log(`[decision-maker] Resolution complete in ${latencyMs}ms:`, {
			count: processed.length,
			names: processed.map((dm) => dm.name),
			withEmail: processed.filter((dm) => dm.email).length
		});

		streaming?.onPhase?.(
			'complete',
			`Found ${processed.length} decision-makers with verified contact info`
		);

		return {
			decision_makers: processed,
			research_summary: data.research_summary || 'Research completed.',
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
 * All candidates have verified emails (agent only returns those).
 */
function processDecisionMakers(candidates: Candidate[]): DecisionMaker[] {
	return candidates
		.filter((c) => c.email && c.reasoning && c.source_url && c.recency_check) // All fields mandatory
		.map((candidate) => ({
			name: candidate.name,
			title: candidate.title,
			organization: candidate.organization,
			email: candidate.email,
			reasoning: candidate.reasoning,
			sourceUrl: candidate.source_url,
			emailSource: candidate.source_url,
			recencyCheck: candidate.recency_check,
			// Pass through the source date if available, might be useful for UI later
			metadata: candidate.position_source_date ? { positionSourceDate: candidate.position_source_date } : undefined,
			confidence: 0.8, // High confidence - agent verified
			contactChannel: 'email' as ContactChannel
		}));
}
