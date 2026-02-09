/**
 * Gemini Decision-Maker Provider
 *
 * Implements two-phase resolution using Gemini + Exa Search:
 * - Phase 1: Role Discovery (structural reasoning, no search)
 * - Phase 2: Person Lookup (Exa search → Gemini triage → content fetch → extraction)
 *
 * Phase 2 Pipeline:
 * - Step A: Exa metadata-only search (grouped by organization)
 * - Step B: Gemini URL triage (selects most promising pages)
 * - Step C: Exa content resolution (fetches selected pages)
 * - Step D: Gemini extraction (extracts names, emails, verification)
 *
 * Function Calling Integration:
 * - Document tool: Deep document analysis for legislative bills,
 *   corporate filings, etc.
 */

import type { GenerateContentConfig, Content, Part } from '@google/genai';
import { getGeminiClient, generateWithThoughts, GEMINI_CONFIG, extractTokenUsage } from '../gemini-client';
import { sumTokenUsage, type TokenUsage } from '../types';
import {
	ROLE_DISCOVERY_PROMPT,
	buildRoleDiscoveryPrompt,
	URL_TRIAGE_PROMPT,
	CONTENT_EXTRACTION_PROMPT,
	buildUrlTriagePrompt,
	buildContentExtractionPrompt
} from '../prompts/decision-maker';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import { searchForRoleHolders, fetchPageContents } from '../exa-search';
import type { ExaOrgSearchResult, ExaPageContent } from '../exa-search';
import {
	getAgentToolDeclarations,
	processGeminiFunctionCall
} from '../agents/decision-maker';
import { ThoughtEmitter } from '$lib/core/thoughts/emitter';
import type { ThoughtSegment } from '$lib/core/thoughts/types';
import type { ProcessedDecisionMaker } from '$lib/types/template';
import type {
	DecisionMakerProvider,
	ResolveContext,
	DecisionMakerResult
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
	email: string;
	/** LLM-provided URL where email was found (verify against grounding) */
	email_source?: string;
	recency_check: string;
}

/** Result from function calling execution */
interface FunctionCallingResult {
	text: string;
	tokenUsage?: TokenUsage;
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
 * @returns Final response text after all function calls resolved
 */
async function executeWithFunctionCalling(
	prompt: string,
	config: GenerateContentConfig,
	emitter: ThoughtEmitter,
	onThought?: (thought: string) => void
): Promise<FunctionCallingResult> {
	const ai = getGeminiClient();

	// Get document tool declarations
	const agentTools = getAgentToolDeclarations();

	// Build tools array: preserve existing tools and add function declarations
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
	const functionCallUsages: (TokenUsage | undefined)[] = [];

	while (iterations < MAX_FUNCTION_CALL_ITERATIONS) {
		iterations++;

		console.log(`[gemini-provider] Function calling iteration ${iterations}/${MAX_FUNCTION_CALL_ITERATIONS}`);

		try {
			const response = await ai.models.generateContent({
				model: GEMINI_CONFIG.model,
				contents,
				config: configWithTools
			});
			functionCallUsages.push(extractTokenUsage(response));

			// Check if response contains function calls using SDK's built-in getter
			const functionCalls = response.functionCalls;

			if (functionCalls && functionCalls.length > 0) {
				console.log(`[gemini-provider] Received ${functionCalls.length} function call(s):`,
					functionCalls.map(fc => fc.name).filter(Boolean));

				// Add the model's response (with function calls) to history
				if (response.candidates?.[0]?.content) {
					contents.push(response.candidates[0].content);
				}

				// Process each function call and collect results
				const functionResponseParts: Part[] = [];

				for (const functionCall of functionCalls) {
					// Skip if missing required fields
					if (!functionCall.name) {
						console.warn('[gemini-provider] Function call missing name, skipping');
						continue;
					}

					// Emit thought about the function call
					if (onThought) {
						const url = functionCall.args?.url as string | undefined;
						onThought(`Analyzing document: ${url || 'document'}...`);
					}

					try {
						// Execute the function with the emitter for thought streaming
						// Wrap in the expected format for processGeminiFunctionCall
						const result = await processGeminiFunctionCall(
							{
								name: functionCall.name,
								args: functionCall.args || {}
							},
							emitter
						);

						// Create the function response part
						functionResponseParts.push({
							functionResponse: {
								name: functionCall.name,
								response: result
							}
						} as Part);

						console.log(`[gemini-provider] Function ${functionCall.name} completed successfully`);
					} catch (error) {
						// Log error but continue with error response to Gemini
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
			console.log(`[gemini-provider] Function calling complete after ${iterations} iteration(s)`);

			return { text: finalText, tokenUsage: sumTokenUsage(...functionCallUsages) };

		} catch (error) {
			console.error(`[gemini-provider] Error in function calling loop:`, error);
			throw error;
		}
	}

	// Max iterations reached - return what we have
	console.warn(`[gemini-provider] Max function call iterations (${MAX_FUNCTION_CALL_ITERATIONS}) reached`);
	throw new Error('Maximum function call iterations exceeded. The request may be too complex.');
}

// ============================================================================
// Gemini Provider Implementation
// ============================================================================

export class GeminiDecisionMakerProvider implements DecisionMakerProvider {
	readonly name = 'gemini-search';

	readonly supportedTargetTypes: readonly string[] = [];

	canResolve(context: ResolveContext): boolean {
		// Gemini + Exa Search can handle any target type
		return !!context.subjectLine;
	}

	async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
		const startTime = Date.now();
		const { subjectLine, coreMessage, topics, voiceSample, streaming } = context;
		const tokenUsages: (TokenUsage | undefined)[] = [];

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
			tokenUsages.push(roleResult.tokenUsage);

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
						'No positions with direct power over this issue were identified. Try refining the subject line to be more specific about the decision being sought.',
					tokenUsage: sumTokenUsage(...tokenUsages)
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
			// Phase 2: Person Lookup — Exa Search for current holders
			// Four-step pipeline: Search → Triage → Content → Extract
			// ================================================================

			streaming?.onPhase?.('lookup', `Searching for current holders of ${roles.length} positions...`);

			const now = new Date();
			const currentDate = now.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
			const currentYear = now.getFullYear().toString();

			// Create a ThoughtEmitter for search/content streaming
			const documentSegments: ThoughtSegment[] = [];
			const documentEmitter = new ThoughtEmitter((segment) => {
				documentSegments.push(segment);
				if (streaming?.onThought && segment.content) {
					streaming.onThought(segment.content, 'lookup');
				}
			});

			// --- Step A: Exa Search (metadata only) ---
			console.log('[gemini-provider] Step A: Searching Exa for role holders...');
			streaming?.onProgress?.({ current: 0, total: 4, status: 'Searching for candidates...' });

			const searchResults = await searchForRoleHolders(roles, {
				currentYear,
				emitter: documentEmitter
			});

			const totalHits = searchResults.reduce((sum, r) => sum + r.hits.length, 0);
			console.log(`[gemini-provider] Step A complete: ${searchResults.length} searches, ${totalHits} total hits`);

			if (totalHits === 0) {
				console.log('[gemini-provider] No search results found');
				streaming?.onPhase?.('complete', 'No search results found for identified positions');
				return {
					decisionMakers: [],
					provider: this.name,
					cacheHit: false,
					latencyMs: Date.now() - startTime,
					researchSummary: 'No search results found for the identified positions. Try broadening the search or checking the target entities.',
					tokenUsage: sumTokenUsage(...tokenUsages)
				};
			}

			// --- Step B: Gemini Triage (URL selection) ---
			console.log('[gemini-provider] Step B: Gemini triaging URLs...');
			streaming?.onProgress?.({ current: 1, total: 4, status: 'Selecting best sources...' });

			const triagePrompt = buildUrlTriagePrompt(roles, searchResults);
			const triageSystemPrompt = URL_TRIAGE_PROMPT
				.replace(/{CURRENT_DATE}/g, currentDate)
				.replace(/{CURRENT_YEAR}/g, currentYear);

			const triageResult = await generateWithThoughts<{ url_selections: Array<{ role_index: number; selected_urls: string[]; reasoning: string }> }>(
				triagePrompt,
				{
					systemInstruction: triageSystemPrompt,
					temperature: 0.1,
					thinkingLevel: 'low' as const,
					maxOutputTokens: 8192
				},
				streaming?.onThought ? (thought) => streaming.onThought!(thought, 'lookup') : undefined
			);
			tokenUsages.push(triageResult.tokenUsage);

			// Extract selected URLs from triage result
			let selectedUrls: string[] = [];
			if (triageResult.data?.url_selections) {
				selectedUrls = triageResult.data.url_selections.flatMap(s => s.selected_urls);
			} else {
				// Fallback: if triage JSON parsing failed, use top hits from each search
				console.warn('[gemini-provider] Triage JSON parsing failed, using top search hits as fallback');
				selectedUrls = searchResults.flatMap(r => r.hits.slice(0, 3).map(h => h.url));
			}

			// Deduplicate URLs
			selectedUrls = [...new Set(selectedUrls)];

			console.log(`[gemini-provider] Step B complete: ${selectedUrls.length} URLs selected for content fetch`);

			if (selectedUrls.length === 0) {
				console.log('[gemini-provider] No URLs selected by triage');
				streaming?.onPhase?.('complete', 'No promising sources found for identified positions');
				return {
					decisionMakers: [],
					provider: this.name,
					cacheHit: false,
					latencyMs: Date.now() - startTime,
					researchSummary: 'Search returned results but no promising sources were found for contact information.',
					tokenUsage: sumTokenUsage(...tokenUsages)
				};
			}

			// --- Step C: Exa Content Resolution ---
			console.log(`[gemini-provider] Step C: Fetching content from ${selectedUrls.length} pages...`);
			streaming?.onProgress?.({ current: 2, total: 4, status: `Reading ${selectedUrls.length} pages...` });

			const pageContents = await fetchPageContents(selectedUrls, {
				emitter: documentEmitter
			});

			console.log(`[gemini-provider] Step C complete: ${pageContents.length}/${selectedUrls.length} pages fetched successfully`);

			if (pageContents.length === 0) {
				console.log('[gemini-provider] No page content could be retrieved');
				streaming?.onPhase?.('complete', 'Could not retrieve content from selected sources');
				return {
					decisionMakers: [],
					provider: this.name,
					cacheHit: false,
					latencyMs: Date.now() - startTime,
					researchSummary: 'Selected sources could not be retrieved. The pages may be behind authentication or temporarily unavailable.',
					tokenUsage: sumTokenUsage(...tokenUsages)
				};
			}

			// --- Step D: Gemini Extraction ---
			console.log('[gemini-provider] Step D: Extracting contact information...');
			streaming?.onProgress?.({ current: 3, total: 4, status: 'Extracting contact information...' });

			const extractionPrompt = buildContentExtractionPrompt(roles, pageContents, subjectLine);
			const extractionSystemPrompt = CONTENT_EXTRACTION_PROMPT
				.replace(/{CURRENT_DATE}/g, currentDate)
				.replace(/{CURRENT_YEAR}/g, currentYear);

			const extractionResult = await generateWithThoughts<PersonLookupResponse>(
				extractionPrompt,
				{
					systemInstruction: extractionSystemPrompt,
					temperature: 0.2,
					thinkingLevel: 'medium' as const,
					maxOutputTokens: 65536
				},
				streaming?.onThought ? (thought) => streaming.onThought!(thought, 'lookup') : undefined
			);
			tokenUsages.push(extractionResult.tokenUsage);

			const rawText = extractionResult.rawText || '{}';
			const lookupExtraction = extractJsonFromGroundingResponse<PersonLookupResponse>(rawText);

			if (!isSuccessfulExtraction(lookupExtraction)) {
				console.error('[gemini-provider] Step D JSON extraction failed:', {
					error: lookupExtraction.error,
					rawTextLength: rawText.length,
					rawTextHead: rawText.slice(0, 200),
					rawTextTail: rawText.slice(-200)
				});
				throw new Error('Finding decision-makers hit a snag. Please try again.');
			}

			const data = lookupExtraction.data;
			console.log('[gemini-provider] Step D complete:', {
				candidatesFound: data.decision_makers?.length || 0,
				pagesUsed: pageContents.length
			});

			// Process decision-makers with content-based email verification
			const processed = this.processDecisionMakers(
				data.decision_makers || [],
				pageContents
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
						'No verifiable decision-makers found. The positions were identified but current holders could not be verified with recent sources.',
					tokenUsage: sumTokenUsage(...tokenUsages)
				};
			}

			console.log(`[gemini-provider] Two-phase resolution complete in ${latencyMs}ms:`, {
				rolesDiscovered: roles.length,
				candidatesFound: data.decision_makers?.length || 0,
				verified: processed.length,
				withEmail: processed.filter((dm) => dm.email).length,
				names: processed.map((dm) => dm.name)
			});

			// Calculate email grounding stats
			const withEmail = processed.filter((dm) => dm.email);
			const withGroundedEmail = processed.filter((dm) => dm.emailGrounded === true);
			const withUngroundedEmail = withEmail.filter((dm) => dm.emailGrounded === false);

			console.log(`[gemini-provider] Email grounding summary:`, {
				total: processed.length,
				withEmail: withEmail.length,
				groundedEmails: withGroundedEmail.length,
				ungroundedEmails: withUngroundedEmail.length
			});

			// CRITICAL: Only return decision-makers with VERIFIED emails
			// No grounded email = not shown to users
			const filtered = processed.filter((dm) => dm.email && dm.emailGrounded === true);

			console.log(`[gemini-provider] Filtered to ${filtered.length} decision-makers with verified emails`);
			for (const dm of withUngroundedEmail) {
				console.log(`[gemini-provider] Filtered out ${dm.name} - email not grounded: ${dm.email}`);
			}
			for (const dm of processed.filter((dm) => !dm.email)) {
				console.log(`[gemini-provider] Filtered out ${dm.name} - no email found`);
			}

			streaming?.onPhase?.(
				'complete',
				filtered.length > 0
					? `Found ${filtered.length} decision-makers with verified contact information`
					: `No decision-makers with verified email addresses found`
			);

			return {
				decisionMakers: filtered,
				provider: this.name,
				cacheHit: false,
				latencyMs,
				researchSummary: data.research_summary || 'Two-phase research completed.',
				metadata: {
					rolesDiscovered: roles.length,
					candidatesFound: data.decision_makers?.length || 0,
					verified: filtered.length,
					withVerifiedEmail: filtered.length,
					emailsFilteredOut: withUngroundedEmail.length
				},
				tokenUsage: sumTokenUsage(...tokenUsages)
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
	 *
	 * Uses content-based verification: checks if email appears verbatim
	 * in any of the fetched page contents from Exa.
	 *
	 * @param candidates - Raw candidates from LLM response
	 * @param pageContents - Fetched page contents from Exa
	 */
	private processDecisionMakers(
		candidates: Candidate[],
		pageContents: ExaPageContent[]
	): ProcessedDecisionMaker[] {
		return candidates
			.filter((c) => c.reasoning && c.recency_check)
			.map((candidate) => {
				const hasEmail = candidate.email &&
					candidate.email !== 'NO_EMAIL_FOUND' &&
					candidate.email.toUpperCase() !== 'NO_EMAIL_FOUND' &&
					candidate.email.includes('@');

				// ================================================================
				// Content-based email verification
				// Much simpler than grounding segment analysis: check if email
				// appears verbatim in any of the fetched page contents
				// ================================================================
				let emailGrounded = false;
				let emailSource: string | undefined;
				let emailSourceTitle: string | undefined;

				if (hasEmail) {
					const emailLower = candidate.email.toLowerCase();

					// First: check the LLM-reported email_source page
					if (candidate.email_source) {
						const sourcePage = pageContents.find(p => p.url === candidate.email_source);
						if (sourcePage?.text.toLowerCase().includes(emailLower)) {
							emailGrounded = true;
							emailSource = sourcePage.url;
							emailSourceTitle = sourcePage.title;
						}
					}

					// Second: if not found in reported source, check all pages
					if (!emailGrounded) {
						for (const page of pageContents) {
							if (page.text.toLowerCase().includes(emailLower)) {
								emailGrounded = true;
								emailSource = page.url;
								emailSourceTitle = page.title;
								break;
							}
						}
					}

					if (emailGrounded) {
						console.log(`[gemini-provider] ✓ Email VERIFIED for ${candidate.name}: ${candidate.email} from ${emailSource}`);
					} else {
						console.log(`[gemini-provider] ✗ Email NOT verified for ${candidate.name}: ${candidate.email} (not found in page content)`);
					}
				}

				// Person source URL — use the LLM-reported email_source or first page mentioning them
				let verifiedPersonSource = '';
				if (emailSource) {
					verifiedPersonSource = emailSource;
				} else if (candidate.email_source) {
					verifiedPersonSource = candidate.email_source;
				}

				// Build provenance with clear verification status
				const personSourceNote = verifiedPersonSource
					? `Person verified via: ${verifiedPersonSource}`
					: 'Person source: from search results';

				const emailStatusNote = !hasEmail
					? 'Email: Not found in retrieved pages'
					: emailGrounded
						? `Email VERIFIED in page content: ${emailSource}`
						: `Email NOT VERIFIED (not found verbatim in any retrieved page)`;

				const provenance = [
					candidate.reasoning,
					'',
					personSourceNote,
					emailStatusNote,
					'',
					candidate.recency_check
				].join('\n');

				return {
					name: candidate.name,
					title: candidate.title,
					organization: candidate.organization,
					email: hasEmail ? candidate.email : undefined,
					reasoning: candidate.reasoning,
					source: verifiedPersonSource || '',
					provenance,
					isAiResolved: true,
					recencyCheck: candidate.recency_check,
					emailGrounded: hasEmail ? emailGrounded : undefined,
					emailSource: emailGrounded ? emailSource : undefined,
					emailSourceTitle: emailGrounded ? emailSourceTitle : undefined
				};
			});
	}

}
