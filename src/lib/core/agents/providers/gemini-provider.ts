/**
 * Gemini Decision-Maker Provider — Parallel Orchestration
 *
 * Three-phase resolution using Gemini + Exa Search + Firecrawl:
 * - Phase 1: Role Discovery (structural reasoning, no search)
 * - Phase 2a: Parallel Identity Resolution (direct Exa searches + 1 extraction call)
 * - Phase 2b: Per-Identity Parallel Contact Hunting (N concurrent mini-agents)
 *
 * Phase 2a is NOT agentic — search queries are derived from Phase 1 roles,
 * run as direct parallel Exa API calls, then a single Gemini extraction call
 * pulls names from search result titles.
 *
 * Phase 2b fans out one mini-agent per uncached identity. Each gets its own
 * isolated AgenticToolContext (1 search + 2 reads) and ThoughtEmitter.
 * Promise.allSettled runs them concurrently; results are merged for email verification.
 *
 * Includes a ResolvedContact cache (14-day TTL) to skip repeat lookups.
 */

import type { GenerateContentConfig, Content, Part } from '@google/genai';
import { getGeminiClient, generateWithThoughts, GEMINI_CONFIG, extractTokenUsage } from '../gemini-client';
import { sumTokenUsage, type TokenUsage } from '../types';
import {
	ROLE_DISCOVERY_PROMPT,
	buildRoleDiscoveryPrompt,
	IDENTITY_EXTRACTION_PROMPT,
	buildIdentityExtractionPrompt,
	SINGLE_CONTACT_PROMPT,
	buildSingleContactPrompt,
	generateDomainHintForOrg,
	type ResolvedIdentity,
	type CachedContactInfo,
} from '../prompts/decision-maker';
import { getCachedContacts, upsertResolvedContacts } from '../utils/contact-cache';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import { searchWeb, type ExaPageContent } from '../exa-search';
import {
	getAgentToolDeclarations,
	processGeminiFunctionCall
} from '../agents/decision-maker';
import type { AgenticToolContext } from '../agents/decision-maker';
import { ThoughtEmitter } from '$lib/core/thoughts/emitter';
import type { ProcessedDecisionMaker } from '$lib/types/template';
import type {
	DecisionMakerProvider,
	ResolveContext,
	DecisionMakerResult,
	StreamingCallbacks
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
	/** URL of the page where the agent read the email */
	email_source?: string;
	recency_check: string;
	/** Alternative contact info when no email found */
	contact_notes?: string;
}

/** Phase 2a identity resolution response */
interface IdentityResolutionResponse {
	identities: Array<{
		position: string;
		name: string;
		title: string;
		organization: string;
		search_evidence: string;
	}>;
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
const MAX_FUNCTION_CALL_ITERATIONS = 20;

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
 * @param toolContext - Optional agentic tool context for budget tracking (search_web/read_page)
 * @param toolMode - Which tool set to use: 'research' for search_web/read_page, 'document' for analyze_document
 * @returns Final response text after all function calls resolved
 */
async function executeWithFunctionCalling(
	prompt: string,
	config: GenerateContentConfig,
	emitter: ThoughtEmitter,
	onThought?: (thought: string) => void,
	toolContext?: AgenticToolContext,
	toolMode: 'research' | 'search-only' | 'document' = 'document',
	signal?: AbortSignal
): Promise<FunctionCallingResult> {
	const ai = getGeminiClient();

	// Get tool declarations for the appropriate mode
	const agentTools = getAgentToolDeclarations(toolMode);

	// Build tools array: preserve existing tools and add function declarations
	const existingTools = config.tools || [];
	const toolsWithFunctions = [
		...existingTools,
		{ functionDeclarations: agentTools }
	] as GenerateContentConfig['tools'];

	const baseConfig: GenerateContentConfig = {
		...config,
		thinkingConfig: {
			includeThoughts: true,
			thinkingBudget: 4096
		}
	};

	const configWithTools: GenerateContentConfig = {
		...baseConfig,
		tools: toolsWithFunctions
	};

	// Config without tools — forces the model to produce text output
	const configWithoutTools: GenerateContentConfig = { ...baseConfig };

	// Build conversation history for multi-turn function calling
	const contents: Content[] = [
		{
			role: 'user',
			parts: [{ text: prompt }]
		}
	];

	let iterations = 0;
	let lastTextResponse = ''; // Accumulate fallback — always have something to return
	const functionCallUsages: (TokenUsage | undefined)[] = [];

	/**
	 * Determine whether to stop providing tools and force text output.
	 *
	 * Three triggers:
	 * 1. Page read budget exhausted — searching is pointless if we can't read results
	 * 2. Both budgets exhausted
	 * 3. Approaching iteration limit — reserve last 2 iterations for output
	 */
	function shouldForceOutput(): boolean {
		// Near iteration limit — always force output to guarantee we get JSON
		if (iterations >= MAX_FUNCTION_CALL_ITERATIONS - 2) return true;

		if (!toolContext) return false;

		// Search-only mode: force output when searches exhausted
		if (toolContext.maxPageReads === 0) {
			return toolContext.searchCount >= toolContext.maxSearches;
		}

		// Page reads exhausted — can't read any more pages, so searching is pointless
		if (toolContext.pageReadCount >= toolContext.maxPageReads) return true;

		// Both exhausted
		if (toolContext.searchCount >= toolContext.maxSearches &&
			toolContext.pageReadCount >= toolContext.maxPageReads) return true;

		return false;
	}

	while (iterations < MAX_FUNCTION_CALL_ITERATIONS) {
		// Check abort signal at top of each iteration
		if (signal?.aborted) {
			console.warn(`[gemini-provider] Aborted at iteration ${iterations} — attempting forced output`);
			// Attempt one final call WITHOUT tools to salvage results from conversation context.
			// The Gemini API itself doesn't use AbortSignal, so this call still works.
			try {
				const finalResponse = await ai.models.generateContent({
					model: GEMINI_CONFIG.model,
					contents,
					config: configWithoutTools
				});
				functionCallUsages.push(extractTokenUsage(finalResponse));
				const salvaged = finalResponse.text || lastTextResponse || '{}';
				console.debug(`[gemini-provider] Forced output after abort: ${salvaged.length} chars`);
				return { text: salvaged, tokenUsage: sumTokenUsage(...functionCallUsages) };
			} catch (e) {
				console.warn('[gemini-provider] Forced output after abort failed:', e);
				return { text: lastTextResponse || '{}', tokenUsage: sumTokenUsage(...functionCallUsages) };
			}
		}

		iterations++;

		// Remove tools when budget is spent or we're near the iteration limit
		const forceOutput = shouldForceOutput();
		const effectiveConfig = forceOutput ? configWithoutTools : configWithTools;

		if (forceOutput && toolContext) {
			console.debug(`[gemini-provider] Forcing output — iteration ${iterations}/${MAX_FUNCTION_CALL_ITERATIONS}, searches: ${toolContext.searchCount}/${toolContext.maxSearches}, reads: ${toolContext.pageReadCount}/${toolContext.maxPageReads}`);
		}

		console.debug(`[gemini-provider] Function calling iteration ${iterations}/${MAX_FUNCTION_CALL_ITERATIONS}`);

		try {
			const response = await ai.models.generateContent({
				model: GEMINI_CONFIG.model,
				contents,
				config: effectiveConfig
			});
			functionCallUsages.push(extractTokenUsage(response));

			// Extract intermediate text (reasoning) from response parts.
			// Thought parts (thinking) get priority; plain text parts are the fallback.
			if (response.candidates?.[0]?.content?.parts) {
				for (const part of response.candidates[0].content.parts) {
					const isThought = 'thought' in part && (part as Record<string, unknown>).thought === true;
					if (isThought && 'text' in part && part.text) {
						onThought?.(part.text);
					} else if ('text' in part && part.text && !('functionCall' in part)) {
						onThought?.(part.text);
					}
				}
			}

			// Save any text as fallback for graceful degradation
			if (response.text) {
				lastTextResponse = response.text;
			}

			// Check if response contains function calls using SDK's built-in getter
			const functionCalls = response.functionCalls;

			if (functionCalls && functionCalls.length > 0) {
				console.debug(`[gemini-provider] Received ${functionCalls.length} function call(s):`,
					functionCalls.map(fc => fc.name).filter(Boolean));

				// Add the model's response (with function calls) to history
				if (response.candidates?.[0]?.content) {
					contents.push(response.candidates[0].content);
				}

				// Process all function calls concurrently
				const callPromises = functionCalls
					.filter(fc => {
						if (!fc.name) {
							console.warn('[gemini-provider] Function call missing name, skipping');
							return false;
						}
						return true;
					})
					.map(async (functionCall) => {
						try {
							const result = await processGeminiFunctionCall(
								{ name: functionCall.name!, args: functionCall.args || {} },
								emitter,
								toolContext
							);
							console.debug(`[gemini-provider] Function ${functionCall.name} completed successfully`);
							return { name: functionCall.name!, response: result };
						} catch (error) {
							console.error(`[gemini-provider] Function ${functionCall.name} failed:`, error);
							return {
								name: functionCall.name!,
								response: {
									success: false,
									error: error instanceof Error ? error.message : 'Function execution failed'
								}
							};
						}
					});

				const settled = await Promise.allSettled(callPromises);

				const functionResponseParts: Part[] = settled
					.filter((r): r is PromiseFulfilledResult<{ name: string; response: unknown }> =>
						r.status === 'fulfilled')
					.map(r => ({
						functionResponse: {
							name: r.value.name,
							response: r.value.response
						}
					} as Part));

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
			console.debug(`[gemini-provider] Function calling complete after ${iterations} iteration(s)`);

			return { text: finalText, tokenUsage: sumTokenUsage(...functionCallUsages) };

		} catch (error) {
			console.error(`[gemini-provider] Error in function calling iteration ${iterations}:`, error);
			// Don't throw on individual iteration failures — continue if we have budget left
			if (iterations < MAX_FUNCTION_CALL_ITERATIONS) {
				continue;
			}
		}
	}

	// Max iterations reached — make one final call WITHOUT tools to force output.
	// This function NEVER throws — always returns something parseable.
	console.warn(`[gemini-provider] Max iterations (${MAX_FUNCTION_CALL_ITERATIONS}) reached — forcing final output without tools`);

	try {
		const finalResponse = await ai.models.generateContent({
			model: GEMINI_CONFIG.model,
			contents,
			config: configWithoutTools
		});
		functionCallUsages.push(extractTokenUsage(finalResponse));

		const finalText = finalResponse.text || lastTextResponse || '{}';
		console.debug(`[gemini-provider] Forced final output: ${finalText.length} chars`);
		return { text: finalText, tokenUsage: sumTokenUsage(...functionCallUsages) };
	} catch (error) {
		// Even the forced call failed — return accumulated text or empty JSON
		console.error(`[gemini-provider] Forced final output also failed — returning fallback:`, error);
		return { text: lastTextResponse || '{}', tokenUsage: sumTokenUsage(...functionCallUsages) };
	}
}

// ============================================================================
// Phase 2a: Parallel Identity Resolution
// ============================================================================

/**
 * Resolve identities by running parallel Exa searches (one per role)
 * then a single Gemini extraction call to pull names from results.
 *
 * NOT agentic — no function calling loop. Direct API calls + one extraction.
 * Wall clock: ~10s (vs ~40s for the old agentic approach).
 */
async function resolveIdentitiesFromSearch(
	roles: DiscoveredRole[],
	streaming?: StreamingCallbacks,
	signal?: AbortSignal
): Promise<{ identities: ResolvedIdentity[]; tokenUsage?: TokenUsage }> {
	const currentYear = new Date().getFullYear().toString();
	const currentDate = new Date().toLocaleDateString('en-US', {
		year: 'numeric', month: 'long', day: 'numeric'
	});

	// 1. Generate search queries — use Phase 1's search_query, fallback to position+org+year
	const queries = roles.map(r =>
		r.search_query || `${r.position} ${r.organization} ${currentYear}`
	);

	console.debug(`[gemini-provider] Phase 2a: ${queries.length} parallel identity searches`);

	// 2. Parallel Exa searches — rate limiter handles throttling
	const searchResults = await Promise.allSettled(
		queries.map((q, i) =>
			searchWeb(q, { maxResults: 10 }).then(hits => ({
				role: roles[i],
				hits
			}))
		)
	);

	// Pair each role with its results (empty array on failure)
	const roleResults = searchResults.map((result, i) => {
		if (result.status === 'fulfilled') {
			return result.value;
		}
		console.warn(`[gemini-provider] Phase 2a search failed for "${roles[i].position}":`, result.reason);
		return { role: roles[i], hits: [] as { url: string; title: string; publishedDate?: string; score?: number }[] };
	});

	const totalHits = roleResults.reduce((sum, rr) => sum + rr.hits.length, 0);
	console.debug(`[gemini-provider] Phase 2a: ${totalHits} total search hits across ${roles.length} roles`);

	if (signal?.aborted) {
		console.warn('[gemini-provider] Phase 2a aborted after searches');
		return { identities: roles.map(r => ({
			position: r.position, name: 'UNKNOWN', title: r.position,
			organization: r.organization, search_evidence: 'Aborted before extraction'
		})) };
	}

	// 3. Single extraction call — generateWithThoughts, NOT agentic
	const extractionPrompt = buildIdentityExtractionPrompt(roleResults);
	const systemPrompt = IDENTITY_EXTRACTION_PROMPT.replace(/{CURRENT_DATE}/g, currentDate);

	console.debug('[gemini-provider] Phase 2a: Identity extraction call');

	const extractionResult = await generateWithThoughts<IdentityResolutionResponse>(
		extractionPrompt,
		{
			systemInstruction: systemPrompt,
			temperature: 0.1,
			thinkingLevel: 'low',
			maxOutputTokens: 16384
		},
		streaming?.onThought ? (thought) => streaming.onThought!(thought, 'identity') : undefined
	);

	// 4. Parse + fallback
	const extraction = extractJsonFromGroundingResponse<IdentityResolutionResponse>(
		extractionResult.rawText || '{}'
	);

	if (isSuccessfulExtraction(extraction) && extraction.data?.identities?.length > 0) {
		const identities = extraction.data.identities;
		console.debug(`[gemini-provider] Phase 2a extracted ${identities.length} identities:`,
			identities.map(id => `${id.name} (${id.title} at ${id.organization})`));
		return { identities, tokenUsage: extractionResult.tokenUsage };
	}

	// Fallback: UNKNOWN identities from roles
	console.warn('[gemini-provider] Phase 2a extraction failed, falling back to UNKNOWN identities');
	return {
		identities: roles.map(r => ({
			position: r.position,
			name: 'UNKNOWN',
			title: r.position,
			organization: r.organization,
			search_evidence: 'Identity extraction failed — using position from Phase 1'
		})),
		tokenUsage: extractionResult.tokenUsage
	};
}

// ============================================================================
// Phase 2b: Per-Identity Parallel Contact Hunting
// ============================================================================

/**
 * Hunt for ONE person's email. Runs executeWithFunctionCalling with a tiny
 * budget (1 search + 2 reads) in an isolated context.
 *
 * Failures are per-identity — they don't take down the pipeline.
 */
async function huntSingleContact(
	identity: ResolvedIdentity,
	reasoning: string,
	streaming?: StreamingCallbacks,
	signal?: AbortSignal
): Promise<{
	candidates: Candidate[];
	fetchedPages: Map<string, ExaPageContent>;
	tokenUsage?: TokenUsage;
}> {
	const currentDate = new Date().toLocaleDateString('en-US', {
		year: 'numeric', month: 'long', day: 'numeric'
	});
	const domainHint = generateDomainHintForOrg(identity.organization);

	// UNKNOWN identities get a bigger budget — they need to identify the person first
	const isUnknown = identity.name === 'UNKNOWN';
	const MAX_SEARCHES = isUnknown ? 2 : 1;
	const MAX_PAGE_READS = 2;

	// Isolated context — each mini-agent gets its own counters and page map
	const toolContext: AgenticToolContext = {
		fetchedPages: new Map<string, ExaPageContent>(),
		searchCount: 0,
		pageReadCount: 0,
		maxSearches: MAX_SEARCHES,
		maxPageReads: MAX_PAGE_READS
	};

	// Isolated emitter — forwards to shared streaming callback
	const emitter = new ThoughtEmitter((segment) => {
		if (streaming?.onThought && segment.content) {
			streaming.onThought(segment.content, 'contact');
		}
	});

	const systemPrompt = SINGLE_CONTACT_PROMPT
		.replace(/{MAX_SEARCHES}/g, String(MAX_SEARCHES))
		.replace(/{MAX_PAGE_READS}/g, String(MAX_PAGE_READS))
		.replace(/{DOMAIN_HINT}/g, domainHint)
		.replace(/{CURRENT_DATE}/g, currentDate);

	const userPrompt = buildSingleContactPrompt(identity, reasoning);

	console.debug(`[gemini-provider] Mini-agent [${identity.name}]: starting (${MAX_SEARCHES} search${MAX_SEARCHES > 1 ? 'es' : ''}, ${MAX_PAGE_READS} reads${isUnknown ? ', identity resolution mode' : ''})`);

	const result = await executeWithFunctionCalling(
		userPrompt,
		{
			systemInstruction: systemPrompt,
			temperature: 0.2,
			maxOutputTokens: 8192
		},
		emitter,
		undefined, // onThought already handled by emitter
		toolContext,
		'research',
		signal
	);

	console.debug(`[gemini-provider] Mini-agent [${identity.name}]: done — ${toolContext.searchCount} searches, ${toolContext.pageReadCount} reads`);

	// Parse the mini-agent's JSON output
	const extraction = extractJsonFromGroundingResponse<PersonLookupResponse>(result.text || '{}');

	if (isSuccessfulExtraction(extraction) && extraction.data?.decision_makers?.length > 0) {
		return {
			candidates: extraction.data.decision_makers,
			fetchedPages: toolContext.fetchedPages,
			tokenUsage: result.tokenUsage
		};
	}

	// Parse failure — return empty candidates (per-identity degradation, not pipeline failure)
	console.warn(`[gemini-provider] Mini-agent [${identity.name}]: JSON parse failed, returning empty`);
	return {
		candidates: [],
		fetchedPages: toolContext.fetchedPages,
		tokenUsage: result.tokenUsage
	};
}

/**
 * Fan out per-identity parallel contact hunting mini-agents.
 *
 * Cached identities skip agent calls entirely and become pre-verified candidates.
 * Uncached identities each get a dedicated mini-agent via huntSingleContact().
 * Promise.allSettled ensures one failure doesn't kill the batch.
 *
 * Results are merged: all candidates + all fetchedPages for email grounding.
 */
async function huntContactsParallel(
	identities: ResolvedIdentity[],
	cachedContacts: CachedContactInfo[],
	roles: DiscoveredRole[],
	streaming?: StreamingCallbacks,
	signal?: AbortSignal,
	/** Called per-identity as each mini-agent completes (for progressive UI streaming) */
	onCandidateProcessed?: (candidate: Candidate, fetchedPages: ExaPageContent[]) => void
): Promise<{
	candidates: Candidate[];
	fetchedPages: Map<string, ExaPageContent>;
	tokenUsage?: TokenUsage;
}> {
	// Build cache lookup map: orgKey::title → cached contact
	const cacheMap = new Map<string, CachedContactInfo>();
	for (const c of cachedContacts) {
		if (c.title && c.email) {
			cacheMap.set(`${c.orgKey}::${c.title.toLowerCase()}`, c);
		}
	}

	// Separate cached vs uncached identities
	const uncached: Array<{ identity: ResolvedIdentity; reasoning: string }> = [];
	const cachedCandidates: Candidate[] = [];

	for (let i = 0; i < identities.length; i++) {
		const identity = identities[i];
		const orgKey = identity.organization
			.toLowerCase()
			.replace(/^the\s+/, '')
			.replace(/['']/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');

		const cached = cacheMap.get(`${orgKey}::${identity.title.toLowerCase()}`);

		// Match Phase 1 reasoning: try exact match first, then org-only match,
		// then fall back to index correspondence (roles and identities are 1:1
		// from the extraction prompt, though the model may reorder).
		const roleReasoning =
			roles.find(r =>
				r.position.toLowerCase() === identity.position.toLowerCase() &&
				r.organization.toLowerCase() === identity.organization.toLowerCase()
			)?.reasoning ||
			roles.find(r =>
				r.organization.toLowerCase() === identity.organization.toLowerCase()
			)?.reasoning ||
			roles[i]?.reasoning ||
			'';

		if (cached?.email) {
			// Inject cached contact as pre-verified candidate
			cachedCandidates.push({
				name: cached.name || identity.name,
				title: cached.title || identity.title,
				organization: identity.organization,
				reasoning: roleReasoning,
				email: cached.email,
				email_source: cached.emailSource || undefined,
				recency_check: `Cached contact (verified in prior run)`,
				contact_notes: ''
			});
		} else {
			uncached.push({ identity, reasoning: roleReasoning });
		}
	}

	console.debug(`[gemini-provider] Phase 2b: ${cachedCandidates.length} cached, ${uncached.length} uncached → launching ${uncached.length} parallel mini-agents`);

	// Emit cached contacts immediately — no agent call needed
	if (onCandidateProcessed) {
		for (const cached of cachedCandidates) {
			onCandidateProcessed(cached, []);
		}
	}

	// Fan out mini-agents — each emits its candidate immediately on completion.
	// Per-agent timeout prevents one slow Firecrawl/Gemini call from blocking the batch.
	const MINI_AGENT_TIMEOUT_MS = 45_000;

	const settled = await Promise.allSettled(
		uncached.map(async ({ identity, reasoning }) => {
			let result: Awaited<ReturnType<typeof huntSingleContact>>;

			try {
				let timer: ReturnType<typeof setTimeout>;
				const timeout = new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error('timeout')),
						MINI_AGENT_TIMEOUT_MS
					);
				});
				result = await Promise.race([
					huntSingleContact(identity, reasoning, streaming, signal),
					timeout
				]).finally(() => clearTimeout(timer!));
			} catch (err) {
				// Timeout or other failure — emit a placeholder so UI cards update
				const reason = err instanceof Error ? err.message : 'failed';
				console.warn(`[gemini-provider] Mini-agent [${identity.name}]: ${reason}`);
				if (onCandidateProcessed) {
					onCandidateProcessed({
						name: identity.name,
						title: identity.title,
						organization: identity.organization,
						reasoning,
						email: '',
						recency_check: '',
						contact_notes: reason === 'timeout'
							? 'Search timed out — try again later.'
							: 'Contact search failed.'
					}, []);
				}
				return {
					candidates: [] as Candidate[],
					fetchedPages: new Map<string, ExaPageContent>(),
					tokenUsage: undefined
				};
			}

			// Always inject Phase 1 reasoning — the mini-agent's prompt doesn't ask
			// for reasoning (it only hunts contacts), so this field is the sole source
			// of "why this person matters to the issue."
			for (const candidate of result.candidates) {
				candidate.reasoning = reasoning || candidate.reasoning || '';
			}
			// Immediately emit this candidate to the UI
			if (onCandidateProcessed && result.candidates.length > 0) {
				const pages = Array.from(result.fetchedPages.values());
				for (const candidate of result.candidates) {
					onCandidateProcessed(candidate, pages);
				}
			}
			return result;
		})
	);

	// Merge results (still needed for batch email grounding in resolve())
	const allCandidates: Candidate[] = [...cachedCandidates];
	const mergedPages = new Map<string, ExaPageContent>();
	const tokenUsages: (TokenUsage | undefined)[] = [];

	for (const result of settled) {
		if (result.status === 'fulfilled') {
			allCandidates.push(...result.value.candidates);
			for (const [url, page] of result.value.fetchedPages) {
				mergedPages.set(url, page);
			}
			tokenUsages.push(result.value.tokenUsage);
		} else {
			console.warn('[gemini-provider] Mini-agent failed:', result.reason);
		}
	}

	console.debug(`[gemini-provider] Phase 2b merged: ${allCandidates.length} candidates, ${mergedPages.size} pages`);

	return {
		candidates: allCandidates,
		fetchedPages: mergedPages,
		tokenUsage: sumTokenUsage(...tokenUsages)
	};
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

		console.debug('[gemini-provider] Starting parallel resolution...');

		try {
			// ================================================================
			// Phase 1: Role Discovery — Structural reasoning, no names
			// ================================================================

			streaming?.onPhase?.('discover', 'Mapping institutional power structure...');

			const rolePrompt = buildRoleDiscoveryPrompt(subjectLine, coreMessage, topics, voiceSample);

			console.debug('[gemini-provider] Phase 1: Discovering roles with thoughts...');

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

			console.debug('[gemini-provider] Phase 1 complete:', {
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
			// Phase 2a: Parallel Identity Resolution
			// Direct Exa searches (1 per role) + 1 extraction call
			// ================================================================

			streaming?.onPhase?.('identity', `Identifying current holders of ${roles.length} positions...`);

			const identityResult = await resolveIdentitiesFromSearch(roles, streaming, context.signal);
			tokenUsages.push(identityResult.tokenUsage);
			const identities = identityResult.identities;

			console.debug(`[gemini-provider] Phase 2a complete: ${identities.length} identities`);

			// ================================================================
			// Cache Lookup — Pre-populate known emails
			// ================================================================

			const orgTitlePairs = identities.map(id => ({
				organization: id.organization,
				title: id.title
			}));
			const cachedContacts = await getCachedContacts(orgTitlePairs);

			if (cachedContacts.length > 0) {
				const withEmail = cachedContacts.filter(c => c.email);
				console.debug(`[gemini-provider] Cache hit: ${withEmail.length} contacts pre-populated`);
			}

			// Emit identity placeholders to UI — cards appear before contact hunting starts
			if (streaming?.onIdentitiesFound) {
				const placeholders = identities.map(id => {
					const orgKey = id.organization
						.toLowerCase()
						.replace(/^the\s+/, '')
						.replace(/['']/g, '')
						.replace(/[^a-z0-9]+/g, '-')
						.replace(/^-|-$/g, '');
					const cached = cachedContacts.find(
						c => c.email && c.orgKey === orgKey && c.title?.toLowerCase() === id.title.toLowerCase()
					);
					return {
						name: id.name === 'UNKNOWN' ? '' : id.name,
						title: id.title,
						organization: id.organization,
						status: cached?.email ? 'cached' as const : 'pending' as const
					};
				});
				streaming.onIdentitiesFound(placeholders);
			}

			// ================================================================
			// Phase 2b: Per-Identity Parallel Contact Hunting
			// N concurrent mini-agents (1 search + 2 reads each)
			// ================================================================

			streaming?.onPhase?.('contact', `Searching for contact information...`);

			const contactResult = await huntContactsParallel(
				identities, cachedContacts, roles, streaming, context.signal,
				// Per-identity streaming callback — emit as each mini-agent completes
				(candidate, pages) => {
					const nameLower = (candidate.name || '').toLowerCase().trim();
					if (!nameLower || nameLower === 'unknown' || nameLower === 'n/a') return;

					// Cache hits have no pages — email was verified in a prior run.
					// Skip processOneCandidate which would strip the email when it
					// finds no page content to re-verify against.
					if (pages.length === 0 && candidate.email?.includes('@')) {
						streaming?.onCandidateResolved?.({
							name: candidate.name,
							title: candidate.title,
							organization: candidate.organization,
							email: candidate.email,
							emailSource: candidate.email_source,
							reasoning: candidate.reasoning,
							status: 'resolved'
						});
						return;
					}

					const processed = this.processOneCandidate(candidate, pages);
					if (!processed) return;

					// Strip ungrounded email for the streaming preview
					const final = (processed.email && processed.emailGrounded !== true)
						? { ...processed, email: undefined, emailGrounded: undefined }
						: processed;

					streaming?.onCandidateResolved?.({
						name: final.name,
						title: final.title,
						organization: final.organization,
						email: final.email,
						emailSource: final.emailSource,
						reasoning: final.reasoning,
						status: final.email ? 'resolved' : 'no-email'
					});
				}
			);
			tokenUsages.push(contactResult.tokenUsage);

			const data: PersonLookupResponse = {
				decision_makers: contactResult.candidates,
				research_summary: `Searched for ${identities.length} decision-makers across ${contactResult.fetchedPages.size} pages.`
			};
			const pageContents = Array.from(contactResult.fetchedPages.values());
			console.debug('[gemini-provider] Contact hunting results:', {
				candidatesFound: data.decision_makers?.length || 0,
				pagesRead: pageContents.length
			});

			// Process decision-makers with content-based email verification
			const processed = this.processDecisionMakers(
				data.decision_makers || [],
				pageContents
			);

			const latencyMs = Date.now() - startTime;

			if (processed.length === 0) {
				console.debug('[gemini-provider] No decision-makers found after processing');
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

			console.debug(`[gemini-provider] Parallel resolution complete in ${latencyMs}ms:`, {
				rolesDiscovered: roles.length,
				identitiesResolved: identities.filter(id => id.name !== 'UNKNOWN').length,
				cacheHits: cachedContacts.filter(c => c.email).length,
				candidatesFound: data.decision_makers?.length || 0,
				verified: processed.length,
				withEmail: processed.filter((dm) => dm.email).length,
				names: processed.map((dm) => dm.name)
			});

			// Email verification: check if email appears in page content (text + highlights).
			// Highlights capture emails from mailto: links and contact sections that
			// plain text extraction misses. Unverified emails are stripped.
			const withEmail = processed.filter((dm) => dm.email);
			const withGroundedEmail = processed.filter((dm) => dm.emailGrounded === true);
			const withUngroundedEmail = withEmail.filter((dm) => dm.emailGrounded === false);

			console.debug(`[gemini-provider] Email grounding summary:`, {
				total: processed.length,
				withEmail: withEmail.length,
				groundedEmails: withGroundedEmail.length,
				ungroundedEmails: withUngroundedEmail.length
			});

			// Strip emails not found in page content (text + highlights).
			// Keep the candidate, just remove the unverified email.
			const filtered = processed.map(dm => {
				if (dm.email && dm.emailGrounded !== true) {
					console.debug(`[gemini-provider] Stripping ungrounded email for ${dm.name}: ${dm.email}`);
					return { ...dm, email: undefined, emailGrounded: undefined };
				}
				return dm;
			});

			// Deduplicate shared emails: if the same address appears on multiple
			// candidates, it's an office-wide address (mediarelations@, press@, info@).
			// Keep it on the first candidate only — duplicates become "no email found."
			const seenEmails = new Set<string>();
			for (const dm of filtered) {
				if (!dm.email) continue;
				const lower = dm.email.toLowerCase();
				if (seenEmails.has(lower)) {
					console.debug(`[gemini-provider] Dedup: stripping shared email ${dm.email} from ${dm.name} (already assigned)`);
					dm.email = undefined;
					dm.emailGrounded = undefined;
					dm.emailSource = undefined;
					dm.emailSourceTitle = undefined;
				} else {
					seenEmails.add(lower);
				}
			}

			const withVerifiedEmail = filtered.filter(dm => dm.email);
			const withoutEmail = filtered.filter(dm => !dm.email);
			console.debug(`[gemini-provider] Returning ${filtered.length} candidates: ${withVerifiedEmail.length} with verified email, ${withoutEmail.length} without email`);

			// Cache write — fire-and-forget, never blocks the response
			upsertResolvedContacts(
				filtered.map(dm => ({
					organization: dm.organization,
					title: dm.title,
					name: dm.name,
					email: dm.email,
					emailSource: dm.emailSource
				}))
			).catch(err => console.warn('[gemini-provider] Cache write failed:', err));

			streaming?.onPhase?.(
				'complete',
				filtered.length > 0
					? withVerifiedEmail.length > 0
						? `Found ${filtered.length} decision-makers (${withVerifiedEmail.length} with verified email)`
						: `Found ${filtered.length} decision-makers — email addresses not found in public sources`
					: `No decision-makers found`
			);

			return {
				decisionMakers: filtered,
				provider: this.name,
				cacheHit: false,
				latencyMs,
				researchSummary: data.research_summary || 'Parallel resolution completed.',
				metadata: {
					rolesDiscovered: roles.length,
					identitiesResolved: identities.filter(id => id.name !== 'UNKNOWN').length,
					cacheHits: cachedContacts.filter(c => c.email).length,
					candidatesFound: data.decision_makers?.length || 0,
					verified: filtered.length,
					withVerifiedEmail: withVerifiedEmail.length,
					emailsFilteredOut: withUngroundedEmail.length
				},
				tokenUsage: sumTokenUsage(...tokenUsages)
			};
		} catch (error) {
			// Never propagate raw errors to the user. Log fully, return empty results.
			console.error('[gemini-provider] Resolution error:', error);

			const latencyMs = Date.now() - startTime;
			streaming?.onPhase?.('complete', 'Research encountered an issue — returning partial results');

			return {
				decisionMakers: [],
				provider: this.name,
				cacheHit: false,
				latencyMs,
				researchSummary: 'Research encountered an issue. Please try again or refine your subject line.',
				tokenUsage: sumTokenUsage(...tokenUsages)
			};
		}
	}

	// ========================================================================
	// Processing Helpers
	// ========================================================================

	/**
	 * Process candidates into ProcessedDecisionMaker format.
	 * Filters unnamed candidates, then runs per-candidate email verification.
	 */
	private processDecisionMakers(
		candidates: Candidate[],
		pageContents: ExaPageContent[]
	): ProcessedDecisionMaker[] {
		return candidates
			.filter((c) => {
				const nameLower = (c.name || '').toLowerCase().trim();
				if (!nameLower || nameLower === 'unknown' || nameLower === 'n/a') {
					console.debug(`[gemini-provider] Dropping unnamed candidate: ${c.title} at ${c.organization}`);
					return false;
				}
				return true;
			})
			.map(c => this.processOneCandidate(c, pageContents))
			.filter((dm): dm is ProcessedDecisionMaker => dm !== null);
	}

	/**
	 * Process a single candidate with content-based email verification.
	 * The email must appear in a page the agent actually read.
	 * Used both in batch (processDecisionMakers) and per-identity streaming.
	 */
	private processOneCandidate(
		candidate: Candidate,
		pageContents: ExaPageContent[]
	): ProcessedDecisionMaker | null {
		const hasEmail = candidate.email &&
			candidate.email !== 'NO_EMAIL_FOUND' &&
			candidate.email.toUpperCase() !== 'NO_EMAIL_FOUND' &&
			candidate.email.includes('@');

		let emailGrounded = false;
		let emailSource: string | undefined;
		let emailSourceTitle: string | undefined;

		if (hasEmail) {
			const emailLower = candidate.email.toLowerCase();

			if (candidate.email_source) {
				const sourcePage = pageContents.find(p => p.url === candidate.email_source);
				if (sourcePage?.text.toLowerCase().includes(emailLower)) {
					emailGrounded = true;
					emailSource = sourcePage.url;
					emailSourceTitle = sourcePage.title;
				}
			}

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
				console.debug(`[gemini-provider] Email VERIFIED for ${candidate.name}: ${candidate.email} from ${emailSource}`);
			} else {
				console.debug(`[gemini-provider] Email NOT verified for ${candidate.name}: ${candidate.email} (not found in page content)`);
			}
		}

		let verifiedPersonSource = '';
		if (emailSource) {
			verifiedPersonSource = emailSource;
		} else if (candidate.email_source) {
			verifiedPersonSource = candidate.email_source;
		}

		const personSourceNote = verifiedPersonSource
			? `Person verified via: ${verifiedPersonSource}`
			: 'Person source: from search results';

		const emailStatusNote = !hasEmail
			? 'Email: Not found in retrieved pages'
			: emailGrounded
				? `Email VERIFIED in page content: ${emailSource}`
				: `Email NOT VERIFIED (not found in any retrieved page)`;

		const provenance = [
			candidate.reasoning,
			'',
			personSourceNote,
			emailStatusNote,
			...(candidate.recency_check ? ['', candidate.recency_check] : [])
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
			emailSourceTitle: emailGrounded ? emailSourceTitle : undefined,
			contactNotes: candidate.contact_notes || undefined
		};
	}

}
