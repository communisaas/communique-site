/**
 * Gemini Decision-Maker Provider
 *
 * Implements two-phase resolution using Gemini + Google Search grounding:
 * - Phase 1: Role Discovery (structural reasoning, no grounding)
 * - Phase 2: Person Lookup (grounded search for current holders)
 *
 * Also supports lightweight verification mode for existing decision-makers.
 *
 * Function Calling Integration:
 * - Document tool: Deep document analysis via Reducto for legislative bills,
 *   corporate filings, etc.
 *
 * Supports: congress, state_legislature, local_government
 */

import type { GenerateContentConfig, Content, Part } from '@google/genai';
import { getGeminiClient, generateWithThoughts, GEMINI_CONFIG } from '../gemini-client';
import {
	ROLE_DISCOVERY_PROMPT,
	PERSON_LOOKUP_PROMPT,
	buildRoleDiscoveryPrompt,
	buildPersonLookupPrompt
} from '../prompts/decision-maker';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import { buildSourceList, findBestGroundedSource } from '../utils/grounding';
import type { GroundingMetadata } from '../types';
import type { Source } from '../types';
import {
	getAgentToolDeclarations,
	processGeminiFunctionCall,
	processMultipleDocumentCalls
} from '../agents/decision-maker-v2';
import { ThoughtEmitter } from '$lib/core/thoughts/emitter';
import type { ThoughtSegment } from '$lib/core/thoughts/types';
import type { ParsedDocument } from '$lib/server/reducto/types';
import type { ProcessedDecisionMaker } from '$lib/types/template';
import type {
	DecisionMakerProvider,
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerTargetType
} from './types';

// ============================================================================
// Verification Types
// ============================================================================

/**
 * Result of verifying a single decision-maker's current status
 */
export interface DecisionMakerVerificationResult {
	/** ID/reference of the decision-maker being verified */
	decisionMakerId: string;
	/** Whether the person is confirmed to still hold their position */
	verified: boolean;
	/** Confidence level 0-1 (1 = highly confident, 0 = uncertain) */
	confidence: number;
	/** URL or description of the source used for verification */
	verificationSource?: string;
	/** Timestamp of when verification was performed */
	lastCheckedAt: Date;
	/** Additional context (e.g., "Resigned Jan 2026" or "Confirmed in press release") */
	notes?: string;
}

/**
 * Input for verification: existing decision-maker data to verify
 */
export interface DecisionMakerToVerify {
	/** Unique identifier for tracking */
	id: string;
	/** Person's name */
	name: string;
	/** Current title/position */
	title: string;
	/** Organization they work for */
	organization: string;
	/** Optional: when was this data originally collected */
	dataAsOf?: Date;
}

/**
 * Internal response structure from Gemini verification
 */
interface VerificationResponse {
	verifications: Array<{
		id: string;
		name: string;
		still_in_position: boolean;
		confidence: number;
		source_url?: string;
		notes: string;
	}>;
}

// ============================================================================
// Verification Prompt
// ============================================================================

const VERIFICATION_SYSTEM_PROMPT = `You are a verification specialist. Your ONLY job is to verify whether people still hold their stated positions.

For each person, search for recent news about:
1. Whether they still hold the position (confirmations, recent activities)
2. Any resignations, retirements, or departures
3. Any elections, appointments, or replacements
4. Recent press releases, news articles, or official announcements

CRITICAL RULES:
- Use Google Search to find the most recent information
- Focus on news from the last 6 months
- If you find no recent information, mark as unverified with low confidence
- If you find conflicting information, note it and use lower confidence
- Be skeptical of outdated sources

Current date: {CURRENT_DATE}

OUTPUT FORMAT (JSON only, no markdown):
{
  "verifications": [
    {
      "id": "the-id-provided",
      "name": "Person Name",
      "still_in_position": true/false,
      "confidence": 0.0-1.0,
      "source_url": "https://...",
      "notes": "Brief explanation of what you found"
    }
  ]
}`;

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
// Function Calling Loop
// ============================================================================

/**
 * Maximum iterations for function calling loop to prevent infinite loops
 */
const MAX_FUNCTION_CALL_ITERATIONS = 5;

/**
 * Result from executeWithFunctionCalling
 */
interface FunctionCallingResult {
	/** Final response text after all function calls resolved */
	text: string;
	/** Parsed documents collected during function calling */
	documents: Map<string, ParsedDocument>;
	/** Grounding metadata from Google Search (for L1 inline citations) */
	groundingMetadata?: {
		webSearchQueries?: string[];
		groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
		groundingSupports?: Array<{
			segment?: { startIndex: number; endIndex: number };
			groundingChunkIndices?: number[];
		}>;
	};
}

/**
 * Execute a Gemini request with function calling support.
 *
 * This function handles the agentic loop:
 * 1. Send request to Gemini with tool declarations
 * 2. If response contains function calls, execute them
 * 3. Send function results back to Gemini
 * 4. Repeat until Gemini produces final text response
 *
 * @param prompt - User prompt to generate from
 * @param config - Gemini generation config (will add tools if not present)
 * @param emitter - ThoughtEmitter for streaming document analysis updates
 * @param onThought - Callback for streaming thoughts to the user
 * @returns Final response text and collected documents after all function calls resolved
 */
async function executeWithFunctionCalling(
	prompt: string,
	config: GenerateContentConfig,
	emitter: ThoughtEmitter,
	onThought?: (thought: string) => void
): Promise<FunctionCallingResult> {
	const ai = getGeminiClient();

	// Create documents collector for L2 previews
	const documentsCollector = new Map<string, ParsedDocument>();

	// Get document tool declarations
	const agentTools = getAgentToolDeclarations();

	// Build tools array: preserve existing tools (like googleSearch) and add function declarations
	const existingTools = config.tools || [];
	const toolsWithFunctions = [
		...existingTools,
		{ functionDeclarations: agentTools }
	] as GenerateContentConfig['tools'];

	const configWithTools: GenerateContentConfig = {
		...config,
		tools: toolsWithFunctions
	};

	// Build conversation history for multi-turn function calling
	const contents: Content[] = [
		{
			role: 'user',
			parts: [{ text: prompt }]
		}
	];

	let iterations = 0;

	while (iterations < MAX_FUNCTION_CALL_ITERATIONS) {
		iterations++;

		console.log(`[gemini-provider] Function calling iteration ${iterations}/${MAX_FUNCTION_CALL_ITERATIONS}`);

		try {
			const response = await ai.models.generateContent({
				model: GEMINI_CONFIG.model,
				contents,
				config: configWithTools
			});

			// Check if response contains function calls using SDK's built-in getter
			const functionCalls = response.functionCalls;

			if (functionCalls && functionCalls.length > 0) {
				console.log(`[gemini-provider] Received ${functionCalls.length} function call(s):`,
					functionCalls.map(fc => fc.name).filter(Boolean));

				// Add the model's response (with function calls) to history
				if (response.candidates?.[0]?.content) {
					contents.push(response.candidates[0].content);
				}

				// Process function calls - use parallel processing for multiple document calls
				const functionResponseParts: Part[] = [];

				// Separate document calls from other calls for parallel processing
				const documentCalls = functionCalls.filter(fc => fc.name === 'analyze_document');
				const otherCalls = functionCalls.filter(fc => fc.name !== 'analyze_document');

				// Process multiple document calls in parallel (significant speedup)
				if (documentCalls.length > 1) {
					console.log(`[gemini-provider] Processing ${documentCalls.length} document calls in parallel`);

					if (onThought) {
						onThought(`Analyzing ${documentCalls.length} documents in parallel...`);
					}

					try {
						const wrappedCalls = documentCalls.map(fc => ({
							name: fc.name!,
							args: fc.args || {}
						}));

						const results = await processMultipleDocumentCalls(
							wrappedCalls,
							emitter,
							documentsCollector
						);

						// Add results to response parts
						documentCalls.forEach((fc, index) => {
							functionResponseParts.push({
								functionResponse: {
									name: fc.name!,
									response: results[index]
								}
							} as Part);
						});

						console.log(`[gemini-provider] Parallel document processing complete`);
					} catch (error) {
						console.error(`[gemini-provider] Parallel document processing failed:`, error);

						// Fall back to individual error responses
						documentCalls.forEach(fc => {
							functionResponseParts.push({
								functionResponse: {
									name: fc.name!,
									response: {
										success: false,
										error: error instanceof Error ? error.message : 'Parallel processing failed'
									}
								}
							} as Part);
						});
					}
				} else if (documentCalls.length === 1) {
					// Single document call - process normally
					const functionCall = documentCalls[0];
					if (onThought) {
						const url = functionCall.args?.url as string | undefined;
						onThought(`Analyzing document: ${url || 'document'}...`);
					}

					try {
						const result = await processGeminiFunctionCall(
							{
								name: functionCall.name!,
								args: functionCall.args || {}
							},
							emitter,
							documentsCollector
						);

						functionResponseParts.push({
							functionResponse: {
								name: functionCall.name!,
								response: result
							}
						} as Part);

						console.log(`[gemini-provider] Document analysis completed successfully`);
					} catch (error) {
						console.error(`[gemini-provider] Document analysis failed:`, error);

						functionResponseParts.push({
							functionResponse: {
								name: functionCall.name!,
								response: {
									success: false,
									error: error instanceof Error ? error.message : 'Function execution failed'
								}
							}
						} as Part);
					}
				}

				// Process other (non-document) function calls sequentially
				for (const functionCall of otherCalls) {
					if (!functionCall.name) {
						console.warn('[gemini-provider] Function call missing name, skipping');
						continue;
					}

					if (onThought) {
						onThought(`Executing ${functionCall.name}...`);
					}

					try {
						const result = await processGeminiFunctionCall(
							{
								name: functionCall.name,
								args: functionCall.args || {}
							},
							emitter,
							documentsCollector
						);

						functionResponseParts.push({
							functionResponse: {
								name: functionCall.name,
								response: result
							}
						} as Part);

						console.log(`[gemini-provider] Function ${functionCall.name} completed successfully`);
					} catch (error) {
						console.error(`[gemini-provider] Function ${functionCall.name} failed:`, error);

						functionResponseParts.push({
							functionResponse: {
								name: functionCall.name,
								response: {
									success: false,
									error: error instanceof Error ? error.message : 'Function execution failed'
								}
							}
						} as Part);
					}
				}

				// Add function results to conversation history
				// Function responses should come from the "function" role according to Gemini API
				contents.push({
					role: 'user',
					parts: functionResponseParts
				});

				// Continue loop to get next response from Gemini
				continue;
			}

			// No function calls - this is the final response
			const finalText = response.text || '';

			// Extract grounding metadata for L1 inline citations
			const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
			if (groundingMetadata?.groundingChunks?.length) {
				console.log(`[gemini-provider] Captured ${groundingMetadata.groundingChunks.length} grounding sources`);
			}

			console.log(`[gemini-provider] Function calling complete after ${iterations} iteration(s), collected ${documentsCollector.size} documents`);
			return {
				text: finalText,
				documents: documentsCollector,
				groundingMetadata: groundingMetadata as FunctionCallingResult['groundingMetadata']
			};

		} catch (error) {
			console.error(`[gemini-provider] Error in function calling loop:`, error);
			throw error;
		}
	}

	// Max iterations reached - return what we have with collected documents
	console.warn(`[gemini-provider] Max function call iterations (${MAX_FUNCTION_CALL_ITERATIONS}) reached, collected ${documentsCollector.size} documents`);
	throw new Error('Maximum function call iterations exceeded. The request may be too complex.');
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
					maxOutputTokens: 65536,
					// Enable caching for role discovery prompt (stable across requests)
					enableCaching: true,
					cacheTTL: 'long', // 24-hour cache
					cacheDisplayName: 'role-discovery-prompt'
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
			// With Document Tool for deep analysis of bills, filings, etc.
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

			console.log('[gemini-provider] Phase 2: Looking up current holders with document tool...');

			// Create a ThoughtEmitter for document analysis streaming
			// This bridges the document tool's thought emissions to the streaming callback
			const documentSegments: ThoughtSegment[] = [];
			const documentEmitter = new ThoughtEmitter((segment) => {
				documentSegments.push(segment);
				// Bridge document analysis thoughts to the streaming callback
				if (streaming?.onThought && segment.content) {
					streaming.onThought(`[Document] ${segment.content}`, 'lookup');
				}
			});

			// Build config for function calling with grounding
			const lookupConfig: GenerateContentConfig = {
				systemInstruction: systemPrompt,
				temperature: 0.2,
				maxOutputTokens: 65536,
				// Enable Google Search grounding
				tools: [{ googleSearch: {} }]
			};

			let rawText: string;
			let collectedDocuments = new Map<string, ParsedDocument>();
			let groundingSources: Source[] = [];
			let groundingMetadata: GroundingMetadata | undefined;

			try {
				// Use function calling loop for document analysis support
				const functionCallingResult = await executeWithFunctionCalling(
					lookupPrompt,
					lookupConfig,
					documentEmitter,
					streaming?.onThought ? (thought) => streaming.onThought!(thought, 'lookup') : undefined
				);
				rawText = functionCallingResult.text;
				collectedDocuments = functionCallingResult.documents;

				// Capture grounding metadata for source mapping
				if (functionCallingResult.groundingMetadata) {
					groundingMetadata = functionCallingResult.groundingMetadata as GroundingMetadata;
					groundingSources = buildSourceList(groundingMetadata);
					if (groundingSources.length > 0) {
						console.log(`[gemini-provider] Extracted ${groundingSources.length} sources from grounding metadata`);
					}
				}

				// Log document analysis activity
				if (documentSegments.length > 0) {
					console.log(`[gemini-provider] Document tool emitted ${documentSegments.length} thought segments`);
				}
				if (collectedDocuments.size > 0) {
					console.log(`[gemini-provider] Collected ${collectedDocuments.size} documents for L2 previews`);
				}
			} catch (functionCallError) {
				// If function calling fails, fall back to standard generation
				console.warn('[gemini-provider] Function calling failed, falling back to standard generation:', functionCallError);

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
				rawText = lookupResult.rawText || '{}';

				// Capture grounding metadata for source mapping
				if (lookupResult.groundingMetadata) {
					groundingMetadata = lookupResult.groundingMetadata as GroundingMetadata;
					groundingSources = buildSourceList(groundingMetadata);
				}
			}

			const lookupExtraction = extractJsonFromGroundingResponse<PersonLookupResponse>(rawText);

			if (!isSuccessfulExtraction(lookupExtraction)) {
				console.error('[gemini-provider] Phase 2 JSON extraction failed:', {
					error: lookupExtraction.error,
					rawTextLength: rawText.length,
					rawTextHead: rawText.slice(0, 200),
					rawTextTail: rawText.slice(-200)
				});
				throw new Error('Finding decision-makers hit a snag. Please try again.');
			}

			const data = lookupExtraction.data;
			console.log('[gemini-provider] Phase 2 complete:', {
				candidatesFound: data.decision_makers?.length || 0,
				groundingSourcesAvailable: groundingSources.length
			});

			// GROUNDING FIX: Use groundingSupports to map text segments to verified sources
			// This prevents hallucinated URLs by finding which grounding chunks actually back each claim
			const processed = this.processDecisionMakers(
				data.decision_makers || [],
				rawText,
				groundingMetadata,
				groundingSources
			);

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
				names: processed.map((dm) => dm.name),
				documentsCollected: collectedDocuments.size
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
				},
				// Include collected documents for L2 previews
				documents: collectedDocuments.size > 0 ? collectedDocuments : undefined,
				// Include grounding sources for L1 inline citations
				sources: groundingSources.length > 0 ? groundingSources : undefined
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
	 *
	 * CRITICAL: We do NOT trust the LLM's source_url field - it can be hallucinated.
	 * Instead, we use groundingSupports to map which grounding chunks actually back
	 * the text mentioning each decision-maker.
	 *
	 * @param candidates - Candidates from LLM JSON response
	 * @param rawResponseText - Raw text response for searching entity mentions
	 * @param groundingMetadata - Full grounding metadata with supports and chunks
	 * @param groundingSources - Extracted source list as fallback
	 */
	private processDecisionMakers(
		candidates: Candidate[],
		rawResponseText: string,
		groundingMetadata: GroundingMetadata | undefined,
		groundingSources: Source[] = []
	): ProcessedDecisionMaker[] {
		return candidates
			.filter((c) => c.email && c.reasoning && c.recency_check)
			.map((candidate) => {
				// GROUNDING FIX: Find verified source by mapping entity text to grounding supports
				// This searches for the candidate's name/title/org in the response and finds
				// which grounding chunks actually back those text segments
				let verifiedSource = '';

				if (groundingMetadata) {
					verifiedSource = findBestGroundedSource(
						[candidate.name, candidate.title, candidate.organization],
						rawResponseText,
						groundingMetadata
					);
					if (verifiedSource) {
						console.log(`[gemini-provider] Grounding-mapped source for ${candidate.name}: ${verifiedSource}`);
					}
				}

				// Fallback: Try matching by organization in source titles
				if (!verifiedSource && groundingSources.length > 0) {
					verifiedSource = this.findSourceByOrgMatch(candidate, groundingSources);
				}

				// Last resort: Use LLM URL only if it's an official domain
				if (!verifiedSource && candidate.source_url && this.isOfficialDomain(candidate.source_url)) {
					console.log(`[gemini-provider] Using official-domain LLM URL for ${candidate.name}: ${candidate.source_url}`);
					verifiedSource = candidate.source_url;
				}

				if (!verifiedSource) {
					console.log(`[gemini-provider] No verified source found for ${candidate.name}`);
				}

				return {
					name: candidate.name,
					title: candidate.title,
					organization: candidate.organization,
					email: candidate.email,
					reasoning: candidate.reasoning,
					source: verifiedSource,
					provenance: verifiedSource
						? `${candidate.reasoning}\n\nVerified via: ${verifiedSource}\n${candidate.recency_check}`
						: `${candidate.reasoning}\n\n${candidate.recency_check}`,
					isAiResolved: true,
					recencyCheck: candidate.recency_check,
					powerLevel: 'primary' as const
				};
			});
	}

	/**
	 * Fallback: Find a source by matching organization name in source titles
	 */
	private findSourceByOrgMatch(candidate: Candidate, groundingSources: Source[]): string {
		const orgLower = candidate.organization.toLowerCase().replace(/[^a-z0-9\s]/g, '');
		const orgParts = orgLower.split(/\s+/).filter(w => w.length > 3);

		const orgMatch = groundingSources.find((s) => {
			const titleLower = (s.title || '').toLowerCase();
			return orgParts.some(part => titleLower.includes(part));
		});

		if (orgMatch) {
			console.log(`[gemini-provider] Org-match source for ${candidate.name}: ${orgMatch.title}`);
			return orgMatch.url;
		}

		return '';
	}

	/**
	 * Check if URL domain looks like an official source
	 */
	private isOfficialDomain(url: string): boolean {
		try {
			const domain = new URL(url).hostname.toLowerCase();
			return /\.(gov|edu|org)$/.test(domain) || domain.includes('.gov.') || domain.includes('.edu.');
		} catch {
			return false;
		}
	}

	// ========================================================================
	// Lightweight Verification Mode
	// ========================================================================

	/**
	 * Verify existing decision-makers are still in their positions.
	 *
	 * This is a LIGHTWEIGHT operation (5-10s) compared to full research (30-60s).
	 * Uses gemini-3-flash-preview with Google Search grounding to quickly verify currency.
	 *
	 * Use cases:
	 * - Verifying Firecrawl results before sending campaigns
	 * - Periodic refresh of cached decision-maker data
	 * - Quick check before re-using stale data
	 *
	 * @param decisionMakers - Existing decision-makers to verify
	 * @returns Array of verification results with status and confidence
	 */
	async verifyDecisionMakers(
		decisionMakers: DecisionMakerToVerify[]
	): Promise<DecisionMakerVerificationResult[]> {
		const startTime = Date.now();

		console.log('[gemini-provider] Starting lightweight verification...');
		console.log('[gemini-provider] Verifying:', decisionMakers.length, 'decision-makers');

		if (decisionMakers.length === 0) {
			return [];
		}

		try {
			const ai = getGeminiClient();

			// Build the verification prompt
			const now = new Date();
			const currentDate = now.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});

			const systemPrompt = VERIFICATION_SYSTEM_PROMPT.replace('{CURRENT_DATE}', currentDate);

			// Build a compact list of people to verify
			const verificationList = decisionMakers
				.map(
					(dm) =>
						`- ID: "${dm.id}" | Name: ${dm.name} | Title: ${dm.title} | Organization: ${dm.organization}`
				)
				.join('\n');

			const userPrompt = `Verify whether these people still hold their stated positions as of ${currentDate}:

${verificationList}

For each person, search for recent news and verify their current status.`;

			// Use gemini-3-flash-preview for speed (lightweight verification)
			const config: GenerateContentConfig = {
				temperature: 0.1, // Low temperature for factual verification
				maxOutputTokens: 8192, // Much smaller than full research
				systemInstruction: systemPrompt,
				tools: [{ googleSearch: {} }] // Enable grounding for real-time search
			};

			console.log('[gemini-provider] Calling gemini-3-flash-preview with grounding...');

			const response = await ai.models.generateContent({
				model: 'gemini-3-flash-preview', // Fast model for lightweight verification
				contents: userPrompt,
				config
			});

			const rawText = response.text || '{}';
			const extraction = extractJsonFromGroundingResponse<VerificationResponse>(rawText);

			if (!isSuccessfulExtraction(extraction)) {
				console.error('[gemini-provider] Verification JSON extraction failed:', {
					error: extraction.error,
					rawTextLength: rawText.length,
					rawTextHead: rawText.slice(0, 200)
				});

				// Return unverified results with low confidence on parse failure
				return decisionMakers.map((dm) => ({
					decisionMakerId: dm.id,
					verified: false,
					confidence: 0,
					lastCheckedAt: now,
					notes: 'Verification failed: unable to parse response'
				}));
			}

			const verifications = extraction.data?.verifications || [];
			const latencyMs = Date.now() - startTime;

			console.log('[gemini-provider] Verification complete in', latencyMs, 'ms');
			console.log('[gemini-provider] Results:', verifications.length);

			// Map responses back to DecisionMakerVerificationResult format
			const results: DecisionMakerVerificationResult[] = decisionMakers.map((dm) => {
				const verification = verifications.find((v) => v.id === dm.id);

				if (verification) {
					return {
						decisionMakerId: dm.id,
						verified: verification.still_in_position,
						confidence: Math.max(0, Math.min(1, verification.confidence)), // Clamp 0-1
						verificationSource: verification.source_url,
						lastCheckedAt: now,
						notes: verification.notes
					};
				}

				// Fallback for missing verifications
				return {
					decisionMakerId: dm.id,
					verified: false,
					confidence: 0,
					lastCheckedAt: now,
					notes: 'No verification data returned for this person'
				};
			});

			// Log summary
			const verified = results.filter((r) => r.verified).length;
			const highConfidence = results.filter((r) => r.confidence >= 0.8).length;
			console.log('[gemini-provider] Verification summary:', {
				total: results.length,
				verified,
				unverified: results.length - verified,
				highConfidence,
				latencyMs
			});

			return results;
		} catch (error) {
			console.error('[gemini-provider] Verification error:', error);

			// Return failed results rather than throwing
			const now = new Date();
			return decisionMakers.map((dm) => ({
				decisionMakerId: dm.id,
				verified: false,
				confidence: 0,
				lastCheckedAt: now,
				notes: `Verification error: ${error instanceof Error ? error.message : String(error)}`
			}));
		}
	}

	/**
	 * Verify a single decision-maker (convenience method)
	 */
	async verifySingleDecisionMaker(decisionMaker: DecisionMakerToVerify): Promise<DecisionMakerVerificationResult> {
		const results = await this.verifyDecisionMakers([decisionMaker]);
		return results[0];
	}
}
