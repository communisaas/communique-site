/**
 * Composite Decision-Maker Provider
 *
 * The DEFAULT provider for ALL target types. Orchestrates intelligent routing:
 *
 * For ORGANIZATIONAL targets (corporate, nonprofit, education, healthcare, labor, media):
 * 1. Map API (Pre-crawl): Discover leadership pages on target website (optional, 5-10s)
 * 2. Firecrawl Agent (Primary): Deep extraction from organization websites (30-60s)
 * 3. Gemini (Verification): Lightweight recency check via Google Search (5-10s)
 *
 * For GOVERNMENT targets (congress, state_legislature, local_government):
 * 1. Gemini (Primary): Two-phase resolution with Google Search grounding
 * 2. Firecrawl (Fallback): Website research if Gemini fails
 *
 * Architecture:
 * - Map API pre-discovers leadership pages for targeted crawling
 * - Firecrawl Agent handles website crawling and leadership extraction
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
	type DecisionMakerVerificationResult,
	type DecisionMakerToVerify
} from './gemini-provider';
import { mapSiteForLeadership, type LeadershipMapResult } from '$lib/server/firecrawl/map';
import type { CompositeThoughtEmitter } from '$lib/core/thoughts/composite-emitter';
import type { ProcessedDecisionMaker } from '$lib/types/template';
import type {
	DecisionMakerProvider,
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerTargetType
} from './types';
import { CONFIDENCE } from './constants';
import { TIMEOUTS } from '$lib/constants';

// ============================================================================
// Constants
// ============================================================================

/** Timeout for Gemini verification phase (ms) */
const VERIFICATION_TIMEOUT_MS = TIMEOUTS.VERIFICATION;

/** Timeout for Map API pre-crawl phase (ms) */
const MAP_API_TIMEOUT_MS = TIMEOUTS.MAP_API;

/** Topic count threshold for complex query detection */
const COMPLEX_QUERY_TOPIC_THRESHOLD = TIMEOUTS.COMPLEX_QUERY.TOPIC_THRESHOLD;

/** Message length threshold for complex query detection */
const COMPLEX_QUERY_MESSAGE_LENGTH_THRESHOLD = TIMEOUTS.COMPLEX_QUERY.MESSAGE_LENGTH_THRESHOLD;

/** Target types that benefit from Map API pre-crawling */
const MAP_ELIGIBLE_TARGET_TYPES: DecisionMakerTargetType[] = [
	'corporate',
	'nonprofit',
	'education',
	'healthcare'
];

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

/**
 * Pre-crawl result from Map API
 * Contains prioritized URLs for leadership discovery
 */
interface PreCrawlResult {
	/** URLs identified as potential leadership/team pages */
	leadershipPages: string[];
	/** URLs identified as about/company pages */
	aboutPages: string[];
	/** Whether result came from cache */
	cached: boolean;
	/** Total links discovered */
	totalDiscovered: number;
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

	// ========================================================================
	// Query Analysis Helpers
	// ========================================================================

	/**
	 * Determine if query complexity warrants Deep Research API
	 * Complex queries involve multiple sectors, cross-referencing, or lengthy analysis needs
	 */
	private isComplexQuery(context: ResolveContext): boolean {
		// Check topic count threshold
		if (context.topics.length > COMPLEX_QUERY_TOPIC_THRESHOLD) {
			return true;
		}

		// Check message length threshold
		if (context.coreMessage.length > COMPLEX_QUERY_MESSAGE_LENGTH_THRESHOLD) {
			return true;
		}

		// Check for cross-sector indicators in topics
		const crossSectorKeywords = [
			'government',
			'regulatory',
			'cross-sector',
			'multi-stakeholder',
			'public-private',
			'coalition',
			'industry-wide'
		];

		const topicsLower = context.topics.map((t) => t.toLowerCase());
		const hasCrossSectorIndicator = crossSectorKeywords.some((keyword) =>
			topicsLower.some((topic) => topic.includes(keyword))
		);

		return hasCrossSectorIndicator;
	}

	/**
	 * Check if target is eligible for Map API pre-crawling
	 */
	private isMapEligible(context: ResolveContext): boolean {
		// Must be an eligible target type
		if (!MAP_ELIGIBLE_TARGET_TYPES.includes(context.targetType)) {
			return false;
		}

		// Must have a target entity to derive URL from
		return !!context.targetEntity;
	}

	/**
	 * Infer website URL from organization name
	 * Uses common domain patterns for corporate/nonprofit entities
	 */
	private inferWebsiteUrl(entityName: string, targetType: DecisionMakerTargetType): string {
		// Clean entity name for URL generation
		const cleaned = entityName
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '')
			.replace(/\s+/g, '')
			.trim();

		// Use .org for nonprofits, .com for others
		const tld = targetType === 'nonprofit' ? 'org' : 'com';

		return `https://www.${cleaned}.${tld}`;
	}

	async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
		const startTime = Date.now();
		const { streaming } = context;
		const strategy = this.getStrategy(context.targetType);

		console.log('[composite-provider] Starting resolution:', {
			targetType: context.targetType,
			targetEntity: context.targetEntity,
			strategy,
			topics: context.topics,
			isComplexQuery: this.isComplexQuery(context),
			isMapEligible: this.isMapEligible(context)
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
	// Expansion API Methods (Map + Deep Research)
	// ========================================================================

	/**
	 * Execute Map API pre-crawling to discover leadership pages
	 * Runs before Firecrawl Agent to identify priority URLs
	 *
	 * @param context - Resolution context with target entity
	 * @param compositeEmitter - Optional emitter for progress events
	 * @returns Pre-crawl result with prioritized URLs, or null if skipped/failed
	 */
	private async executeMapApiPreCrawl(
		context: ResolveContext,
		compositeEmitter?: CompositeThoughtEmitter
	): Promise<PreCrawlResult | null> {
		// Only proceed if eligible
		if (!this.isMapEligible(context) || !context.targetEntity) {
			return null;
		}

		// Derive website URL
		const websiteUrl = context.targetUrl || this.inferWebsiteUrl(context.targetEntity, context.targetType);
		const domain = this.extractDomain(websiteUrl);

		console.log('[composite-provider] Starting Map API pre-crawl:', {
			entity: context.targetEntity,
			url: websiteUrl
		});

		// Emit discovery event
		if (compositeEmitter) {
			compositeEmitter.emitDiscovery(`Mapping ${domain} for leadership pages...`);
		} else if (context.streaming?.onThought) {
			context.streaming.onThought(
				`[DISCOVERY] Mapping ${domain} to find leadership and team pages...`,
				'discover'
			);
		}

		try {
			// Execute Map API with timeout
			const mapResult = await Promise.race([
				mapSiteForLeadership({
					url: websiteUrl,
					limit: 100
				}),
				new Promise<LeadershipMapResult>((_, reject) =>
					setTimeout(() => reject(new Error('Map API timeout')), MAP_API_TIMEOUT_MS)
				)
			]);

			if (!mapResult.success) {
				console.warn('[composite-provider] Map API returned unsuccessful:', mapResult.error);
				return null;
			}

			const result: PreCrawlResult = {
				leadershipPages: mapResult.leadershipPages,
				aboutPages: mapResult.aboutPages,
				cached: mapResult.cached ?? false,
				totalDiscovered: mapResult.totalDiscovered ?? mapResult.links.length
			};

			// Emit cache/discovery status
			if (result.cached) {
				const message = `Using cached site map (${result.leadershipPages.length} leadership pages, ${result.aboutPages.length} about pages)`;
				if (compositeEmitter) {
					compositeEmitter.emitDiscovery(message);
				} else if (context.streaming?.onThought) {
					context.streaming.onThought(`[DISCOVERY] ${message}`, 'discover');
				}
			} else {
				const message = `Discovered ${result.totalDiscovered} URLs: ${result.leadershipPages.length} leadership pages, ${result.aboutPages.length} about pages`;
				if (compositeEmitter) {
					compositeEmitter.emitDiscovery(message);
				} else if (context.streaming?.onThought) {
					context.streaming.onThought(`[DISCOVERY] ${message}`, 'discover');
				}
			}

			console.log('[composite-provider] Map API pre-crawl complete:', {
				leadershipPages: result.leadershipPages.length,
				aboutPages: result.aboutPages.length,
				cached: result.cached
			});

			return result;
		} catch (error) {
			console.error('[composite-provider] Map API pre-crawl failed:', error);

			// Emit failure notice but don't block main flow
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (compositeEmitter) {
				compositeEmitter.emitDiscovery(`Site mapping skipped: ${errorMessage}`);
			} else if (context.streaming?.onThought) {
				context.streaming.onThought(
					`[DISCOVERY] Site mapping unavailable, proceeding with standard research...`,
					'discover'
				);
			}

			return null;
		}
	}

	/**
	 * Extract domain from URL for display purposes
	 */
	private extractDomain(url: string): string {
		try {
			const parsed = new URL(url);
			return parsed.hostname.replace(/^www\./, '');
		} catch {
			return url;
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
				'[DISCOVERY] Researching decision-makers and contact information...',
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
	 * Resolve organizational targets using Firecrawl + Gemini verification.
	 *
	 * Enhanced flow with expansion APIs:
	 * 1. Map API Pre-crawl (optional): Discover leadership pages for targeted crawling
	 * 2. Firecrawl Agent: Primary website extraction
	 * 3. Gemini Verification: Recency check with Google Search
	 *
	 * When a CompositeThoughtEmitter is provided via context.compositeEmitter,
	 * this method will use the proper state machine:
	 * - startDiscovery() at phase start
	 * - emitDiscovery() for each finding
	 * - transitionToVerification() at phase boundary
	 * - emitVerification() for each verified item
	 * - complete() or degraded() at end
	 */
	private async resolveOrganizationalTarget(
		context: ResolveContext,
		startTime: number
	): Promise<DecisionMakerResult> {
		const { streaming, compositeEmitter } = context;
		const useCompositeEmitter = !!compositeEmitter;

		console.log('[composite-provider] Using firecrawl-primary strategy for organizational target', {
			useCompositeEmitter,
			mapEligible: this.isMapEligible(context)
		});

		// Track thought IDs for verification phase if using composite emitter
		const discoveryThoughtIds: Map<string, string> = new Map();

		// Track expansion API results for metadata
		let preCrawlResult: PreCrawlResult | null = null;

		// ================================================================
		// Phase 0: Start Discovery + Expansion APIs
		// ================================================================

		if (useCompositeEmitter) {
			// Use CompositeThoughtEmitter's state machine
			compositeEmitter.startDiscovery();
			compositeEmitter.emitDiscovery(
				'Beginning deep website research. Discovering all relevant leaders and extracting contact information...'
			);
		} else if (streaming?.onThought) {
			// Fallback to legacy streaming
			streaming.onThought(
				'[DISCOVERY] Beginning deep website research. This phase discovers all relevant leaders and extracts contact information...',
				'discover'
			);
		}

		// ================================================================
		// Phase 0a: Map API Pre-crawl (optional)
		// ================================================================
		// Run Map API to discover leadership pages before main crawl

		// Map API pre-crawl for eligible targets
		if (this.isMapEligible(context)) {
			preCrawlResult = await this.executeMapApiPreCrawl(context, compositeEmitter);

			if (preCrawlResult) {
				console.log('[composite-provider] Map API pre-crawl complete:', {
					leadershipPages: preCrawlResult.leadershipPages.length,
					aboutPages: preCrawlResult.aboutPages.length,
					cached: preCrawlResult.cached
				});
			}
		}

		// ================================================================
		// Phase 1: Firecrawl Deep Extraction (30-60s expected)
		// ================================================================
		// Pass priority URLs from Map API if available

		const firecrawlResult = await this.executeFirecrawlPhaseWithEmitter(
			context,
			compositeEmitter,
			discoveryThoughtIds,
			preCrawlResult
		);

		console.log('[composite-provider] Firecrawl phase complete:', {
			decisionMakersFound: firecrawlResult.decisionMakers.length,
			latencyMs: firecrawlResult.latencyMs,
			cacheHit: firecrawlResult.cacheHit
		});

		// If no decision-makers found, no point in verification
		if (firecrawlResult.decisionMakers.length === 0) {
			if (useCompositeEmitter) {
				compositeEmitter.emitDiscovery('No decision-makers found. Consider refining your search.');
				compositeEmitter.degraded();
			}

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

		// Emit discovery findings for each decision-maker
		if (useCompositeEmitter) {
			for (const dm of firecrawlResult.decisionMakers) {
				const thoughtId = compositeEmitter.emitDiscovery(
					`Found: ${dm.name} — ${dm.title}${dm.organization ? ` at ${dm.organization}` : ''}`
				);
				// Track thought ID by decision-maker name for verification phase
				discoveryThoughtIds.set(dm.name.toLowerCase(), thoughtId);
			}
		}

		// Adjust base confidence for all discovered decision-makers
		const withBaseConfidence = this.applyBaseConfidence(firecrawlResult.decisionMakers);

		// ================================================================
		// Phase 2: Gemini Verification (5-10s expected)
		// ================================================================

		if (useCompositeEmitter) {
			// Transition to verification phase (includes 500ms settling pause)
			await compositeEmitter.transitionToVerification();
		} else {
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
		}

		let verifiedDecisionMakers: ProcessedDecisionMaker[];
		let verificationSucceeded = false;
		let verificationMetadata: Record<string, unknown> = {};

		try {
			const verificationResult = await this.executeGeminiVerification(
				withBaseConfidence,
				context
			);

			// Emit verification results through CompositeThoughtEmitter
			if (useCompositeEmitter) {
				for (const verified of verificationResult.verified) {
					if (verified.isCurrentHolder) {
						const thoughtId = discoveryThoughtIds.get(verified.name.toLowerCase());
						if (thoughtId) {
							// Boost confidence for verified thoughts
							compositeEmitter.emitVerification(
								thoughtId,
								true,
								verified.notes ? `Verified: ${verified.notes}` : undefined
							);
						}
					}
				}

				// Mark unverified as not verified (no confidence boost)
				for (const name of verificationResult.unverified) {
					const thoughtId = discoveryThoughtIds.get(name.toLowerCase());
					if (thoughtId) {
						compositeEmitter.emitVerification(thoughtId, false);
					}
				}
			}

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

			if (useCompositeEmitter) {
				compositeEmitter.complete(true);
			} else if (streaming?.onThought) {
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

			if (useCompositeEmitter) {
				compositeEmitter.degraded();
			} else if (streaming?.onThought) {
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

		if (!useCompositeEmitter) {
			streaming?.onPhase?.(
				'complete',
				`Found ${verifiedDecisionMakers.length} decision-makers${verificationSucceeded ? ' with verification' : ''}`
			);
		}

		console.log('[composite-provider] Resolution complete:', {
			totalDecisionMakers: verifiedDecisionMakers.length,
			verificationSucceeded,
			latencyMs,
			useCompositeEmitter,
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
				useCompositeEmitter,
				phases: {
					mapApi: preCrawlResult
						? {
								completed: true,
								leadershipPagesFound: preCrawlResult.leadershipPages.length,
								aboutPagesFound: preCrawlResult.aboutPages.length,
								totalDiscovered: preCrawlResult.totalDiscovered,
								cached: preCrawlResult.cached
							}
						: { skipped: true, reason: 'not_eligible_or_failed' },
					firecrawl: {
						completed: true,
						decisionMakersFound: firecrawlResult.decisionMakers.length,
						latencyMs: firecrawlResult.latencyMs,
						cacheHit: firecrawlResult.cacheHit,
						usedPriorityUrls: !!preCrawlResult
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
	 * Execute Firecrawl phase with CompositeThoughtEmitter support.
	 *
	 * When compositeEmitter is provided, emits discovery thoughts through
	 * the state machine instead of raw streaming callbacks. This enables:
	 * - Per-thought confidence tracking
	 * - Proper phase transitions
	 * - Verification boost on verified thoughts
	 *
	 * @param context - Resolution context
	 * @param compositeEmitter - Optional CompositeThoughtEmitter for two-phase streaming
	 * @param discoveryThoughtIds - Map to track thought IDs by decision-maker name
	 * @param preCrawlResult - Optional pre-crawl result from Map API with priority URLs
	 */
	private async executeFirecrawlPhaseWithEmitter(
		context: ResolveContext,
		compositeEmitter: CompositeThoughtEmitter | undefined,
		discoveryThoughtIds: Map<string, string>,
		preCrawlResult?: PreCrawlResult | null
	): Promise<DecisionMakerResult> {
		// If we have pre-crawl results, emit info about priority URLs
		if (preCrawlResult && preCrawlResult.leadershipPages.length > 0) {
			const priorityUrls = [...preCrawlResult.leadershipPages, ...preCrawlResult.aboutPages];

			if (compositeEmitter) {
				compositeEmitter.emitDiscovery(
					`Prioritizing ${priorityUrls.length} discovered pages for targeted research...`
				);
			} else if (context.streaming?.onThought) {
				context.streaming.onThought(
					`[DISCOVERY] Prioritizing ${priorityUrls.length} discovered leadership and about pages for targeted research...`,
					'discover'
				);
			}

			// Update context with priority URLs if we have a target URL
			// The Firecrawl Agent can use these as hints for navigation
			if (priorityUrls.length > 0 && !context.targetUrl && context.targetEntity) {
				// Use the first leadership page as the target URL hint
				context = {
					...context,
					targetUrl: preCrawlResult.leadershipPages[0] || preCrawlResult.aboutPages[0]
				};
			}
		}

		// Create wrapped streaming that routes to CompositeThoughtEmitter when available
		const wrappedStreaming = context.streaming
			? {
					...context.streaming,
					onThought: (thought: string, phase: 'discover' | 'lookup' | 'complete') => {
						if (compositeEmitter && phase === 'discover') {
							// Route discovery thoughts through CompositeThoughtEmitter
							// Skip phase prefix markers that start with [
							if (!thought.startsWith('[')) {
								compositeEmitter.emitDiscovery(thought);
							}
						} else if (context.streaming?.onThought) {
							// Fallback to legacy streaming with phase prefix
							const prefixedThought = thought.startsWith('[')
								? thought
								: `[DISCOVERY] ${thought}`;
							context.streaming.onThought(prefixedThought, phase);
						}
					},
					onProgress: context.streaming.onProgress
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
		geminiResults: DecisionMakerVerificationResult[]
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
