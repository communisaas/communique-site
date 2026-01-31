/**
 * Composite Decision-Maker Provider
 *
 * The DEFAULT provider for ALL target types. Orchestrates intelligent routing:
 *
 * For ORGANIZATIONAL targets (corporate, nonprofit, education, healthcare, labor, media):
 * 1. Firecrawl (Primary): Deep extraction from organization websites (30-60s)
 * 2. Gemini (Verification): Lightweight recency check via Google Search (5-10s)
 *
 * For GOVERNMENT targets (congress, state_legislature, local_government):
 * 1. Gemini (Primary): Two-phase resolution with Google Search grounding
 * 2. Firecrawl (Fallback): Website research if Gemini fails
 *
 * Architecture:
 * - Firecrawl handles website crawling and leadership extraction
 * - Gemini provides Google Search grounded verification/resolution
 * - Results combined with confidence scoring based on verification
 *
 * Confidence Scoring:
 * - Base discovery confidence: 0.4
 * - Each Gemini verification: +0.15 confidence boost
 * - On verification failure: Return results with lower confidence
 *
 * This is the NEW DEFAULT architecture that unifies all resolution strategies.
 */

import { FirecrawlDecisionMakerProvider } from './firecrawl-provider';
import {
	GeminiDecisionMakerProvider,
	type VerificationResult as GeminiVerificationResult,
	type DecisionMakerToVerify
} from './gemini-provider';
import type { CompositeThoughtEmitter } from '$lib/core/thoughts/composite-emitter';
import type { ProcessedDecisionMaker } from '$lib/types/template';
import type {
	DecisionMakerProvider,
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerTargetType
} from './types';
import { CONFIDENCE } from './constants';

// ============================================================================
// Constants
// ============================================================================

/** Timeout for Gemini verification phase (ms) */
const VERIFICATION_TIMEOUT_MS = 30000;

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Batch verification result adapted from GeminiVerificationResult[]
 * Used internally for confidence boosting and metadata tracking
 */
interface BatchVerificationResult {
	verified: Array<{
		name: string;
		title: string;
		organization: string;
		isCurrentHolder: boolean;
		verificationSource?: string;
		verificationDate?: string;
		notes?: string;
	}>;
	unverified: string[];
	summary: string;
}

// ============================================================================
// Composite Provider Implementation
// ============================================================================

export class CompositeDecisionMakerProvider implements DecisionMakerProvider {
	readonly name = 'composite-firecrawl-gemini';

	/**
	 * Supports ALL target types - this is the unified default provider
	 * Government targets use Gemini-primary strategy
	 * Organizational targets use Firecrawl-primary + Gemini-verification strategy
	 */
	readonly supportedTargetTypes: readonly DecisionMakerTargetType[] = [
		// Government targets (Gemini-primary)
		'congress',
		'state_legislature',
		'local_government',
		// Organizational targets (Firecrawl-primary + Gemini-verification)
		'corporate',
		'nonprofit',
		'education',
		'healthcare',
		'labor',
		'media'
	];

	private firecrawlProvider: FirecrawlDecisionMakerProvider;
	private geminiProvider: GeminiDecisionMakerProvider;

	constructor() {
		this.firecrawlProvider = new FirecrawlDecisionMakerProvider();
		this.geminiProvider = new GeminiDecisionMakerProvider();
	}

	canResolve(context: ResolveContext): boolean {
		// Check if target type is supported
		if (!this.supportedTargetTypes.includes(context.targetType)) {
			return false;
		}

		// Government targets don't require targetEntity
		const governmentTypes: DecisionMakerTargetType[] = [
			'congress',
			'state_legislature',
			'local_government'
		];

		if (governmentTypes.includes(context.targetType)) {
			return true; // Government targets always resolvable
		}

		// Organizational targets require entity name
		return !!context.targetEntity;
	}

	/**
	 * Determine resolution strategy based on target type
	 */
	private getStrategy(
		targetType: DecisionMakerTargetType
	): 'gemini-primary' | 'firecrawl-primary' {
		const governmentTypes: DecisionMakerTargetType[] = [
			'congress',
			'state_legislature',
			'local_government'
		];

		return governmentTypes.includes(targetType) ? 'gemini-primary' : 'firecrawl-primary';
	}

	async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
		const startTime = Date.now();
		const { streaming } = context;
		const strategy = this.getStrategy(context.targetType);

		console.log('[composite-provider] Starting resolution:', {
			targetType: context.targetType,
			targetEntity: context.targetEntity,
			strategy,
			topics: context.topics
		});

		try {
			// Route to appropriate strategy based on target type
			if (strategy === 'gemini-primary') {
				return await this.resolveGovernmentTarget(context, startTime);
			} else {
				return await this.resolveOrganizationalTarget(context, startTime);
			}
		} catch (error) {
			console.error('[composite-provider] Resolution error:', error);

			const errorMessage = error instanceof Error ? error.message : String(error);

			// Provide helpful error messages
			if (errorMessage.includes('API key') || errorMessage.includes('FIRECRAWL_API_KEY')) {
				throw new Error(
					'Firecrawl API is not configured. Please set FIRECRAWL_API_KEY environment variable.'
				);
			}

			if (errorMessage.includes('rate limit')) {
				throw new Error('Service rate limit exceeded. Please try again in a few minutes.');
			}

			throw new Error(`Failed to discover decision-makers: ${errorMessage}`);
		}
	}

	// ========================================================================
	// Government Target Resolution (Gemini-primary)
	// ========================================================================

	/**
	 * Resolve government targets using Gemini as primary provider
	 * Falls back to Firecrawl if Gemini fails and targetUrl is available
	 */
	private async resolveGovernmentTarget(
		context: ResolveContext,
		startTime: number
	): Promise<DecisionMakerResult> {
		const { streaming } = context;

		console.log('[composite-provider] Using gemini-primary strategy for government target');

		if (streaming?.onThought) {
			streaming.onThought(
				'[DISCOVERY] Using AI-powered research with Google Search grounding to find government officials...',
				'discover'
			);
		}

		try {
			// Primary: Gemini two-phase resolution
			const geminiResult = await this.geminiProvider.resolve(context);

			const latencyMs = Date.now() - startTime;

			console.log('[composite-provider] Gemini resolution complete:', {
				decisionMakers: geminiResult.decisionMakers.length,
				latencyMs
			});

			return {
				...geminiResult,
				provider: this.name,
				latencyMs,
				metadata: {
					...geminiResult.metadata,
					strategy: 'gemini-primary',
					originalProvider: geminiResult.provider
				}
			};
		} catch (geminiError) {
			console.error('[composite-provider] Gemini failed for government target:', geminiError);

			// Attempt Firecrawl fallback if targetUrl is available
			if (context.targetUrl && context.targetEntity) {
				console.log('[composite-provider] Attempting Firecrawl fallback for government target');

				if (streaming?.onThought) {
					streaming.onThought(
						'[FALLBACK] Primary resolution failed, attempting website research fallback...',
						'discover'
					);
				}

				try {
					const fallbackResult = await this.firecrawlProvider.resolve(context);
					const latencyMs = Date.now() - startTime;

					return {
						...fallbackResult,
						provider: this.name,
						latencyMs,
						metadata: {
							...fallbackResult.metadata,
							strategy: 'gemini-primary-with-fallback',
							originalProvider: fallbackResult.provider,
							primaryFailed: true,
							primaryError:
								geminiError instanceof Error ? geminiError.message : String(geminiError)
						}
					};
				} catch (fallbackError) {
					console.error('[composite-provider] Firecrawl fallback also failed:', fallbackError);
					// Throw original error
				}
			}

			throw geminiError;
		}
	}

	// ========================================================================
	// Organizational Target Resolution (Firecrawl-primary + Gemini-verification)
	// ========================================================================

	/**
	 * Resolve organizational targets using Firecrawl + Gemini verification
	 */
	private async resolveOrganizationalTarget(
		context: ResolveContext,
		startTime: number
	): Promise<DecisionMakerResult> {
		const { streaming } = context;

		console.log('[composite-provider] Using firecrawl-primary strategy for organizational target');

		// ================================================================
		// Phase 1: Firecrawl Deep Extraction (30-60s expected)
		// ================================================================

		if (streaming?.onThought) {
			streaming.onThought(
				'[DISCOVERY] Beginning deep website research. This phase discovers all relevant leaders and extracts contact information...',
				'discover'
			);
		}

		const firecrawlResult = await this.executeFirecrawlPhase(context);

		console.log('[composite-provider] Firecrawl phase complete:', {
			decisionMakersFound: firecrawlResult.decisionMakers.length,
			latencyMs: firecrawlResult.latencyMs,
			cacheHit: firecrawlResult.cacheHit
		});

		// If no decision-makers found, no point in verification
		if (firecrawlResult.decisionMakers.length === 0) {
			return {
				...firecrawlResult,
				provider: this.name,
				latencyMs: Date.now() - startTime,
				metadata: {
					...firecrawlResult.metadata,
					strategy: 'firecrawl-primary',
					phases: {
						firecrawl: { completed: true, decisionMakersFound: 0 },
						geminiVerification: { skipped: true, reason: 'no_candidates' }
					}
				}
			};
		}

		// Adjust base confidence for all discovered decision-makers
		const withBaseConfidence = this.applyBaseConfidence(firecrawlResult.decisionMakers);

		// ================================================================
		// Phase 2: Gemini Verification (5-10s expected)
		// ================================================================

		if (streaming?.onThought) {
			streaming.onThought(
				`[VERIFICATION] Found ${withBaseConfidence.length} potential decision-makers. Now verifying current positions with live web search...`,
				'lookup'
			);
		}

		streaming?.onPhase?.(
			'lookup',
			`Verifying ${withBaseConfidence.length} decision-makers with live search...`
		);

		let verifiedDecisionMakers: ProcessedDecisionMaker[];
		let verificationSucceeded = false;
		let verificationMetadata: Record<string, unknown> = {};

		try {
			const verificationResult = await this.executeGeminiVerification(
				withBaseConfidence,
				context
			);

			verifiedDecisionMakers = this.applyVerificationBoost(
				withBaseConfidence,
				verificationResult
			);

			verificationSucceeded = true;
			verificationMetadata = {
				verifiedCount: verificationResult.verified.length,
				unverifiedCount: verificationResult.unverified.length,
				summary: verificationResult.summary
			};

			if (streaming?.onThought) {
				streaming.onThought(
					`[VERIFICATION] Complete! Verified ${verificationResult.verified.length} of ${withBaseConfidence.length} decision-makers as current position holders.`,
					'lookup'
				);
			}

			console.log('[composite-provider] Gemini verification complete:', {
				verified: verificationResult.verified.length,
				unverified: verificationResult.unverified.length
			});
		} catch (verificationError) {
			// Graceful degradation: Return Firecrawl results with lower confidence
			console.error(
				'[composite-provider] Gemini verification failed, using Firecrawl results:',
				verificationError
			);

			if (streaming?.onThought) {
				streaming.onThought(
					'[VERIFICATION] Verification service temporarily unavailable. Proceeding with discovered data at reduced confidence.',
					'lookup'
				);
			}

			verifiedDecisionMakers = withBaseConfidence;
			verificationMetadata = {
				verificationFailed: true,
				error:
					verificationError instanceof Error
						? verificationError.message
						: String(verificationError)
			};
		}

		// ================================================================
		// Phase 3: Combine Results
		// ================================================================

		const latencyMs = Date.now() - startTime;

		// Sort by confidence (highest first)
		verifiedDecisionMakers.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

		streaming?.onPhase?.(
			'complete',
			`Found ${verifiedDecisionMakers.length} decision-makers${verificationSucceeded ? ' with verification' : ''}`
		);

		console.log('[composite-provider] Resolution complete:', {
			totalDecisionMakers: verifiedDecisionMakers.length,
			verificationSucceeded,
			latencyMs,
			confidenceRange: verifiedDecisionMakers.length > 0
				? {
						min: Math.min(...verifiedDecisionMakers.map((dm) => dm.confidence ?? 0)),
						max: Math.max(...verifiedDecisionMakers.map((dm) => dm.confidence ?? 0))
					}
				: null
		});

		return {
			decisionMakers: verifiedDecisionMakers,
			provider: this.name,
			orgProfile: firecrawlResult.orgProfile,
			cacheHit: firecrawlResult.cacheHit,
			latencyMs,
			researchSummary: this.buildResearchSummary(
				firecrawlResult,
				verificationSucceeded,
				verificationMetadata
			),
			metadata: {
				...firecrawlResult.metadata,
				strategy: 'firecrawl-primary',
				phases: {
					firecrawl: {
						completed: true,
						decisionMakersFound: firecrawlResult.decisionMakers.length,
						latencyMs: firecrawlResult.latencyMs,
						cacheHit: firecrawlResult.cacheHit
					},
					geminiVerification: {
						completed: verificationSucceeded,
						...verificationMetadata
					}
				}
			}
		};
	}

	// ========================================================================
	// Phase 1: Firecrawl Deep Extraction
	// ========================================================================

	/**
	 * Execute Firecrawl phase with phase-prefixed thoughts
	 */
	private async executeFirecrawlPhase(context: ResolveContext): Promise<DecisionMakerResult> {
		// Wrap streaming to prefix thoughts with phase marker
		const wrappedStreaming = context.streaming
			? {
					...context.streaming,
					onThought: context.streaming.onThought
						? (thought: string, phase: 'discover' | 'lookup' | 'complete') => {
								// Add phase prefix if not already present
								const prefixedThought = thought.startsWith('[')
									? thought
									: `[DISCOVERY] ${thought}`;
								context.streaming!.onThought!(prefixedThought, phase);
							}
						: undefined
				}
			: undefined;

		return this.firecrawlProvider.resolve({
			...context,
			streaming: wrappedStreaming
		});
	}

	// ========================================================================
	// Phase 2: Gemini Verification
	// ========================================================================

	/**
	 * Execute lightweight Gemini verification using Google Search grounding.
	 * Delegates to GeminiDecisionMakerProvider.verifyDecisionMakers() and adapts results.
	 */
	private async executeGeminiVerification(
		decisionMakers: ProcessedDecisionMaker[],
		_context: ResolveContext
	): Promise<BatchVerificationResult> {
		// Convert ProcessedDecisionMaker[] to DecisionMakerToVerify[]
		const toVerify: DecisionMakerToVerify[] = decisionMakers.map((dm, index) => ({
			id: dm.email || `dm-${index}`, // Use email as ID if available, otherwise index
			name: dm.name,
			title: dm.title,
			organization: dm.organization
		}));

		// Call the consolidated verification method with timeout
		const geminiResults = await Promise.race([
			this.geminiProvider.verifyDecisionMakers(toVerify),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Verification timeout')), VERIFICATION_TIMEOUT_MS)
			)
		]);

		// Adapt GeminiVerificationResult[] to BatchVerificationResult
		return this.adaptVerificationResults(decisionMakers, geminiResults);
	}

	/**
	 * Adapt GeminiVerificationResult[] to the BatchVerificationResult format
	 * used by applyVerificationBoost
	 */
	private adaptVerificationResults(
		decisionMakers: ProcessedDecisionMaker[],
		geminiResults: GeminiVerificationResult[]
	): BatchVerificationResult {
		const verified: BatchVerificationResult['verified'] = [];
		const unverified: string[] = [];

		// Create a map for quick lookup by ID
		const resultMap = new Map(geminiResults.map((r) => [r.decisionMakerId, r]));

		for (let i = 0; i < decisionMakers.length; i++) {
			const dm = decisionMakers[i];
			const id = dm.email || `dm-${i}`;
			const result = resultMap.get(id);

			if (result && result.verified && result.confidence >= 0.5) {
				verified.push({
					name: dm.name,
					title: dm.title,
					organization: dm.organization,
					isCurrentHolder: true,
					verificationSource: result.verificationSource,
					verificationDate: result.lastCheckedAt.toISOString().split('T')[0],
					notes: result.notes
				});
			} else {
				unverified.push(dm.name);
			}
		}

		const verifiedCount = verified.length;
		const total = decisionMakers.length;
		const summary =
			verifiedCount === total
				? `All ${total} decision-makers verified as current position holders.`
				: `Verified ${verifiedCount} of ${total} decision-makers. ${unverified.length} could not be confirmed.`;

		return { verified, unverified, summary };
	}

	// ========================================================================
	// Confidence Scoring
	// ========================================================================

	/**
	 * Apply base discovery confidence to all decision-makers
	 */
	private applyBaseConfidence(
		decisionMakers: ProcessedDecisionMaker[]
	): ProcessedDecisionMaker[] {
		return decisionMakers.map((dm) => ({
			...dm,
			// Start with base discovery confidence, but preserve existing if higher
			confidence: Math.max(dm.confidence ?? 0, CONFIDENCE.BASE_DISCOVERY)
		}));
	}

	/**
	 * Apply verification confidence boost to verified decision-makers
	 */
	private applyVerificationBoost(
		decisionMakers: ProcessedDecisionMaker[],
		verificationResult: BatchVerificationResult
	): ProcessedDecisionMaker[] {
		// Build lookup map for verified names
		const verifiedMap = new Map(
			verificationResult.verified
				.filter((v) => v.isCurrentHolder)
				.map((v) => [v.name.toLowerCase(), v])
		);

		return decisionMakers.map((dm) => {
			const verification = verifiedMap.get(dm.name.toLowerCase());

			if (verification) {
				// Apply confidence boost for verification
				const boostedConfidence = Math.min(
					(dm.confidence ?? CONFIDENCE.BASE_DISCOVERY) + CONFIDENCE.VERIFICATION_BOOST,
					CONFIDENCE.MAX
				);

				return {
					...dm,
					confidence: boostedConfidence,
					// Update recency check with verification data
					recencyCheck: verification.notes
						? `Verified ${verification.verificationDate || 'recently'}: ${verification.notes}`
						: dm.recencyCheck,
					// Update provenance with verification source
					provenance: verification.verificationSource
						? `${dm.provenance}\n\nVerification: Confirmed via ${verification.verificationSource}`
						: dm.provenance
				};
			}

			// Not verified - keep original confidence
			return dm;
		});
	}

	// ========================================================================
	// Helpers
	// ========================================================================

	/**
	 * Build combined research summary
	 */
	private buildResearchSummary(
		firecrawlResult: DecisionMakerResult,
		verificationSucceeded: boolean,
		verificationMetadata: Record<string, unknown>
	): string {
		const parts = [firecrawlResult.researchSummary || ''];

		if (verificationSucceeded) {
			const verified = verificationMetadata.verifiedCount as number;
			const total = firecrawlResult.decisionMakers.length;
			parts.push(
				`\n\nVerification: ${verified}/${total} decision-makers confirmed as current position holders via live web search.`
			);
			if (verificationMetadata.summary) {
				parts.push(`${verificationMetadata.summary}`);
			}
		} else {
			parts.push(
				'\n\nNote: Live verification was unavailable. Results reflect discovered data without recency confirmation.'
			);
		}

		return parts.join('');
	}
}
