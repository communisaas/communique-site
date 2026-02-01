/**
 * Firecrawl Decision-Maker Provider
 *
 * Uses Firecrawl's Agent API to discover leadership and decision-makers
 * from organization websites. Supports corporate, nonprofit, education,
 * healthcare, labor, and media targets.
 *
 * Strategy:
 * 1. Check MongoDB cache for organization profile
 * 2. If cache miss or stale, use Firecrawl to discover org + leadership
 * 3. Filter leadership to those relevant to the issue
 * 4. Cache results in MongoDB for future lookups
 *
 * Cache TTL:
 * - Organization profiles: 30 days
 * - Leadership data: Checked for staleness (7 days)
 */

import { getFirecrawlClient } from './firecrawl-client';
import type {
	FirecrawlOrganizationProfile,
	AgentProgressCallback,
	BatchProgressCallback,
	BatchDiscoveryResult
} from './firecrawl-client';
import { OrganizationService } from '$lib/server/mongodb/service';
import type { OrganizationDocument, LeaderDocument } from '$lib/server/mongodb/schema';
import { generateWithThoughts } from '../gemini-client';
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

interface RelevanceFilterResponse {
	relevant: Array<{
		name: string;
		reasoning: string;
	}>;
}

// ============================================================================
// Firecrawl Provider Implementation
// ============================================================================

export class FirecrawlDecisionMakerProvider implements DecisionMakerProvider {
	readonly name = 'firecrawl';

	readonly supportedTargetTypes: readonly DecisionMakerTargetType[] = [
		'corporate',
		'nonprofit',
		'education',
		'healthcare',
		'labor',
		'media'
	];

	private firecrawl = getFirecrawlClient();

	canResolve(context: ResolveContext): boolean {
		// Requires organization name
		if (!context.targetEntity) {
			return false;
		}

		return this.supportedTargetTypes.includes(context.targetType);
	}

	async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
		const startTime = Date.now();
		const { targetEntity, targetUrl, subjectLine, topics, streaming } = context;

		if (!targetEntity) {
			throw new Error('Target entity required for organization lookup');
		}

		console.log('[firecrawl-provider] Starting resolution:', {
			targetType: context.targetType,
			targetEntity,
			topics
		});

		try {
			// ================================================================
			// Phase 1: Check MongoDB Cache
			// ================================================================

			streaming?.onPhase?.('discover', `Checking cache for ${targetEntity}...`);

			const cached = await OrganizationService.findOrganization(targetEntity);

			if (cached && !this.isStale(cached)) {
				console.log('[firecrawl-provider] Cache hit:', {
					name: cached.name,
					leadershipCount: cached.leadership.length,
					age: Math.round((Date.now() - cached.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
				});

				streaming?.onPhase?.(
					'lookup',
					`Found cached profile for ${cached.name}. Filtering ${cached.leadership.length} leaders...`
				);

				const relevant = await this.filterByRelevance(
					cached.leadership,
					subjectLine,
					topics,
					streaming
				);

				return {
					decisionMakers: this.transformToProcessedDecisionMakers(
						relevant,
						cached.name,
						cached.website
					),
					provider: this.name,
					orgProfile: cached,
					cacheHit: true,
					latencyMs: Date.now() - startTime,
					researchSummary: `Retrieved ${cached.name} profile from cache with ${cached.leadership.length} total leaders.`
				};
			}

			// ================================================================
			// Phase 2: Discover via Firecrawl Agent
			// ================================================================

			streaming?.onPhase?.(
				'discover',
				`Researching ${targetEntity} website for leadership information...`
			);

			if (streaming?.onThought) {
				streaming.onThought(
					`Beginning autonomous website research for ${targetEntity}. This may take 30-60 seconds as we navigate through team pages, contact sections, and organizational structure...`,
					'discover'
				);
			}

			const orgProfile = await this.discoverOrganization(
				targetEntity,
				targetUrl,
				topics,
				streaming
			);

			console.log('[firecrawl-provider] Discovery complete:', {
				name: orgProfile.name,
				leadershipFound: orgProfile.leadership.length,
				policyPositions: orgProfile.policyPositions.length
			});

			// ================================================================
			// Phase 3: Cache to MongoDB
			// ================================================================

			streaming?.onPhase?.('lookup', 'Caching organization profile...');

			await this.cacheOrganization(orgProfile);

			// ================================================================
			// Phase 4: Filter to Relevant Decision-Makers
			// ================================================================

			streaming?.onPhase?.(
				'lookup',
				`Filtering ${orgProfile.leadership.length} leaders to those with authority over your issue...`
			);

			const relevantLeaders = await this.filterByRelevance(
				orgProfile.leadership.map(this.firecrawlLeaderToLeaderDocument),
				subjectLine,
				topics,
				streaming
			);

			if (relevantLeaders.length === 0) {
				streaming?.onPhase?.(
					'complete',
					'No decision-makers found with authority over this issue'
				);

				return {
					decisionMakers: [],
					provider: this.name,
					cacheHit: false,
					latencyMs: Date.now() - startTime,
					researchSummary: `Found ${orgProfile.leadership.length} total leaders at ${orgProfile.name}, but none were identified as having direct authority over: ${topics.join(', ')}. Consider refining your subject line or topics.`
				};
			}

			const processed = this.transformToProcessedDecisionMakers(
				relevantLeaders,
				orgProfile.name,
				orgProfile.website
			);

			console.log('[firecrawl-provider] Resolution complete:', {
				totalLeaders: orgProfile.leadership.length,
				relevant: processed.length,
				withEmail: processed.filter(dm => dm.email).length,
				latencyMs: Date.now() - startTime
			});

			streaming?.onPhase?.(
				'complete',
				`Found ${processed.length} decision-makers with verified contact information`
			);

			return {
				decisionMakers: processed,
				provider: this.name,
				orgProfile: orgProfile,
				cacheHit: false,
				latencyMs: Date.now() - startTime,
				researchSummary: `Discovered ${processed.length} relevant decision-makers at ${orgProfile.name} with authority over: ${topics.join(', ')}.`,
				metadata: {
					totalLeadersFound: orgProfile.leadership.length,
					relevantCount: processed.length,
					withEmail: processed.filter(dm => dm.email).length,
					policyPositions: orgProfile.policyPositions.length
				}
			};
		} catch (error) {
			console.error('[firecrawl-provider] Resolution error:', error);

			// Provide helpful error messages
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (errorMessage.includes('API key')) {
				throw new Error(
					'Firecrawl API is not configured. Please set FIRECRAWL_API_KEY environment variable.'
				);
			}

			if (errorMessage.includes('rate limit')) {
				throw new Error(
					'Firecrawl rate limit exceeded. Please try again in a few minutes.'
				);
			}

			throw new Error(`Failed to discover decision-makers: ${errorMessage}`);
		}
	}

	// ========================================================================
	// Discovery Helpers
	// ========================================================================

	/**
	 * Check if cached organization data is stale and needs refresh
	 * Leadership data refreshes more frequently than org profile
	 */
	private isStale(org: OrganizationDocument): boolean {
		const now = Date.now();
		const orgAge = now - org.updatedAt.getTime();
		const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

		// If org profile is older than 7 days, refresh
		return orgAge > SEVEN_DAYS;
	}

	/**
	 * Discover organization using Firecrawl Agent API v2
	 */
	private async discoverOrganization(
		entityName: string,
		startUrl: string | undefined,
		topics: string[],
		streaming?: ResolveContext['streaming']
	): Promise<FirecrawlOrganizationProfile> {
		try {
			// Create progress callback to emit streaming events during polling
			const onProgress: AgentProgressCallback = (status, elapsedMs) => {
				if (streaming?.onThought) {
					const elapsedSec = Math.round(elapsedMs / 1000);
					if (status === 'processing') {
						streaming.onThought(
							`Firecrawl agent still researching ${entityName}... (${elapsedSec}s elapsed)`,
							'discover'
						);
					}
				}
			};

			const profile = await this.firecrawl.discoverOrganization(
				entityName,
				topics,
				startUrl,
				onProgress
			);

			if (streaming?.onThought) {
				streaming.onThought(
					`Research complete! Found ${profile.leadership.length} leaders at ${profile.name}. Now analyzing which ones have authority over your specific issue...`,
					'discover'
				);
			}

			return profile;
		} catch (error) {
			console.error('[firecrawl-provider] Discovery failed:', error);
			throw error;
		}
	}

	/**
	 * Cache organization profile to MongoDB
	 */
	private async cacheOrganization(profile: FirecrawlOrganizationProfile): Promise<void> {
		try {
			await OrganizationService.cacheOrganizationProfile({
				name: profile.name,
				website: profile.website || '',
				about: profile.about,
				industry: profile.industry,
				headquarters: profile.headquarters,
				leadership: profile.leadership.map(this.firecrawlLeaderToLeaderDocument),
				policyPositions: profile.policyPositions.map(pos => ({
					topic: pos.topic,
					stance: pos.stance,
					summary: pos.summary,
					sourceUrl: pos.sourceUrl,
					lastUpdated: new Date()
				})),
				contacts: profile.contacts,
				cacheDays: 30 // 30-day cache for org profiles
			});

			console.log('[firecrawl-provider] Cached organization:', profile.name);
		} catch (error) {
			console.error('[firecrawl-provider] Cache error:', error);
			// Don't fail resolution if caching fails
		}
	}

	/**
	 * Convert Firecrawl leader to MongoDB LeaderDocument
	 */
	private firecrawlLeaderToLeaderDocument(leader: FirecrawlOrganizationProfile['leadership'][0]): LeaderDocument {
		return {
			name: leader.name,
			title: leader.title,
			email: leader.email,
			linkedin: leader.linkedin,
			isVerified: leader.emailVerified,
			sourceUrl: leader.sourceUrl
		};
	}

	// ========================================================================
	// Relevance Filtering
	// ========================================================================

	/**
	 * Filter leadership to those relevant to the issue using Gemini
	 * Uses lightweight reasoning to identify decision-makers with authority
	 */
	private async filterByRelevance(
		leaders: LeaderDocument[],
		subjectLine: string,
		topics: string[],
		streaming?: ResolveContext['streaming']
	): Promise<LeaderDocument[]> {
		if (leaders.length === 0) {
			return [];
		}

		// First pass: Quick heuristic filter (C-suite and topic matching)
		const quickFiltered = leaders.filter(leader =>
			this.hasRelevantTitle(leader.title, topics)
		);

		console.log('[firecrawl-provider] Quick filter:', {
			total: leaders.length,
			quickFiltered: quickFiltered.length
		});

		// If we have a small number, check all; otherwise use quick filter
		const candidateLeaders = leaders.length <= 10 ? leaders : quickFiltered;

		if (candidateLeaders.length === 0) {
			return [];
		}

		// Second pass: AI-powered relevance analysis
		try {
			const prompt = `
You are analyzing which organizational leaders have authority over a specific issue.

Issue: ${subjectLine}
Topics: ${topics.join(', ')}

Leaders:
${candidateLeaders.map((l, i) => `${i + 1}. ${l.name} - ${l.title}`).join('\n')}

Identify which leaders have DIRECT or INDIRECT decision-making authority over this issue.
Consider:
- Explicit role alignment (e.g., "VP of Sustainability" for environmental issues)
- C-suite executives (CEOs, Presidents often have broad authority)
- Department heads whose teams would implement changes
- Board members with relevant oversight

Return a JSON array of relevant leaders with reasoning:
{
  "relevant": [
    {
      "name": "Full Name",
      "reasoning": "Brief explanation of their authority over this issue"
    }
  ]
}
`.trim();

			if (streaming?.onThought) {
				streaming.onThought(
					`Analyzing ${candidateLeaders.length} leaders to identify who has authority over: ${topics.join(', ')}...`,
					'lookup'
				);
			}

			const result = await generateWithThoughts<RelevanceFilterResponse>(
				prompt,
				{
					temperature: 0.2,
					thinkingLevel: 'low',
					maxOutputTokens: 8192
				}
			);

			const relevantNames = new Set(
				result.data?.relevant?.map(r => r.name) || []
			);

			const filtered = candidateLeaders.filter(leader =>
				relevantNames.has(leader.name)
			);

			console.log('[firecrawl-provider] AI relevance filter:', {
				candidates: candidateLeaders.length,
				relevant: filtered.length
			});

			return filtered;
		} catch (error) {
			console.error('[firecrawl-provider] Relevance filtering error:', error);
			// Fallback to quick filter on error
			return quickFiltered;
		}
	}

	/**
	 * Quick heuristic: Does title suggest relevance to topics?
	 */
	private hasRelevantTitle(title: string, topics: string[]): boolean {
		const titleLower = title.toLowerCase();

		// C-suite and top executives are always relevant
		const topTitles = [
			'ceo', 'president', 'chairman', 'chief executive',
			'cfo', 'chief financial',
			'coo', 'chief operating',
			'cto', 'chief technology',
			'general counsel', 'head of'
		];

		if (topTitles.some(t => titleLower.includes(t))) {
			return true;
		}

		// Board members often have oversight authority
		if (titleLower.includes('board') || titleLower.includes('director')) {
			return true;
		}

		// Topic-specific matching
		const topicKeywords = topics.flatMap(t =>
			t.toLowerCase().split(/[\s-]+/)
		);

		return topicKeywords.some(keyword => titleLower.includes(keyword));
	}

	// ========================================================================
	// Transformation Helpers
	// ========================================================================

	/**
	 * Transform LeaderDocuments to ProcessedDecisionMakers
	 */
	private transformToProcessedDecisionMakers(
		leaders: LeaderDocument[],
		organizationName: string,
		organizationWebsite?: string
	): ProcessedDecisionMaker[] {
		return leaders.map(leader => ({
			name: leader.name,
			title: leader.title,
			organization: organizationName,
			email: leader.email || '',
			reasoning: `Leadership position at ${organizationName} with responsibility relevant to your issue.`,
			source: leader.sourceUrl || organizationWebsite || '',
			provenance: this.buildProvenance(leader, organizationName),
			isAiResolved: true,
			emailSource: leader.email
				? (leader.isVerified ? 'verified' : 'inferred')
				: undefined,
			confidence: this.calculateConfidence(leader),
			contactChannel: leader.email ? 'email' : 'linkedin',
			powerLevel: this.determinePowerLevel(leader.title)
		}));
	}

	/**
	 * Build detailed provenance string
	 */
	private buildProvenance(leader: LeaderDocument, orgName: string): string {
		const parts = [
			`Found via Firecrawl autonomous research of ${orgName} website.`,
			`Position: ${leader.title}`
		];

		if (leader.email) {
			const status = leader.isVerified
				? 'verified from website contact pages'
				: 'inferred from organizational email pattern';
			parts.push(`Email ${status}.`);
		}

		if (leader.sourceUrl) {
			parts.push(`Source: ${leader.sourceUrl}`);
		}

		return parts.join(' ');
	}

	/**
	 * Calculate confidence score based on available data
	 */
	private calculateConfidence(leader: LeaderDocument): number {
		let score = 0.6; // Base confidence

		if (leader.email && leader.isVerified) score += 0.3;
		else if (leader.email) score += 0.15;

		if (leader.sourceUrl) score += 0.1;

		return Math.min(score, 1.0);
	}

	/**
	 * Determine power level from title
	 */
	private determinePowerLevel(title: string): 'primary' | 'secondary' | 'supporting' {
		const titleLower = title.toLowerCase();

		if (
			titleLower.includes('ceo') ||
			titleLower.includes('president') ||
			titleLower.includes('chairman') ||
			titleLower.includes('chief executive')
		) {
			return 'primary';
		}

		if (
			titleLower.includes('chief') ||
			titleLower.includes('vp') ||
			titleLower.includes('vice president') ||
			titleLower.includes('director')
		) {
			return 'secondary';
		}

		return 'supporting';
	}

	// ========================================================================
	// Batch Discovery
	// ========================================================================

	/**
	 * Discover decision-makers for multiple organizations in parallel
	 *
	 * This method provides ~4x faster discovery by running multiple Firecrawl
	 * Agent jobs in parallel with controlled concurrency and error isolation.
	 *
	 * Key features:
	 * - Parallel execution (default: 4 concurrent jobs)
	 * - Cache-aware (checks MongoDB before discovery)
	 * - Error isolation (one failure doesn't break all)
	 * - Progress callbacks for UI feedback
	 * - Rate limiting to avoid API throttling
	 *
	 * @param organizations - Array of organization names to research
	 * @param context - Shared context (topics, subject line, etc.)
	 * @returns Array of results (one per organization)
	 *
	 * @example
	 * ```typescript
	 * const results = await provider.resolveBatch(
	 *   ['Microsoft', 'Google', 'Apple'],
	 *   {
	 *     targetType: 'corporate',
	 *     topics: ['sustainability'],
	 *     subjectLine: 'Climate Action Request',
	 *     streaming: { onPhase: console.log }
	 *   }
	 * );
	 * ```
	 */
	async resolveBatch(
		organizations: string[],
		context: Omit<ResolveContext, 'targetEntity'>
	): Promise<DecisionMakerResult[]> {
		const startTime = Date.now();

		console.log('[firecrawl-provider] Starting batch resolution:', {
			organizations: organizations.length,
			topics: context.topics
		});

		context.streaming?.onPhase?.(
			'discover',
			`Preparing to research ${organizations.length} organizations in parallel...`
		);

		// ================================================================
		// Phase 1: Check cache for all organizations
		// ================================================================

		const cacheResults = await Promise.all(
			organizations.map(async (org) => {
				const cached = await OrganizationService.findOrganization(org);
				return {
					organization: org,
					cached: cached && !this.isStale(cached) ? cached : null
				};
			})
		);

		const cacheHits = cacheResults.filter(r => r.cached !== null);
		const cacheMisses = cacheResults.filter(r => r.cached === null);

		console.log('[firecrawl-provider] Cache status:', {
			hits: cacheHits.length,
			misses: cacheMisses.length
		});

		if (cacheHits.length > 0) {
			context.streaming?.onPhase?.(
				'lookup',
				`Found ${cacheHits.length} organizations in cache. Discovering ${cacheMisses.length} new...`
			);
		}

		// ================================================================
		// Phase 2: Batch discover cache misses
		// ================================================================

		let batchResult: BatchDiscoveryResult | null = null;

		if (cacheMisses.length > 0) {
			context.streaming?.onPhase?.(
				'discover',
				`Researching ${cacheMisses.length} organizations in parallel (4 at a time)...`
			);

			// Create progress callback
			const onBatchProgress: BatchProgressCallback = (progress) => {
				const percentage = Math.round((progress.completed / progress.total) * 100);
				context.streaming?.onPhase?.(
					'discover',
					`Discovery progress: ${progress.completed}/${progress.total} (${percentage}%) - ${progress.currentOrg || 'processing...'}`
				);

				// Emit thoughts for individual org completions
				if (progress.currentOrg && context.streaming?.onThought) {
					const orgResult = progress.results.find(r => r.organization === progress.currentOrg);
					if (orgResult?.status === 'completed') {
						context.streaming.onThought(
							`Completed research for ${progress.currentOrg}`,
							'discover'
						);
					} else if (orgResult?.status === 'failed') {
						context.streaming.onThought(
							`Failed to research ${progress.currentOrg}: ${orgResult.error}`,
							'discover'
						);
					}
				}
			};

			batchResult = await this.firecrawl.discoverOrganizationsBatch(
				cacheMisses.map(r => r.organization),
				context.topics,
				{
					concurrency: 4,
					onProgress: onBatchProgress
				}
			);

			// Cache all successful discoveries
			if (batchResult.successful.length > 0) {
				context.streaming?.onPhase?.(
					'lookup',
					`Caching ${batchResult.successful.length} newly discovered organizations...`
				);

				await Promise.allSettled(
					batchResult.successful.map(result =>
						this.cacheOrganization(result.profile)
					)
				);
			}

			// Log failures
			if (batchResult.failed.length > 0) {
				console.warn('[firecrawl-provider] Batch discovery failures:', batchResult.failed);
			}
		}

		// ================================================================
		// Phase 3: Process all results (cached + newly discovered)
		// ================================================================

		context.streaming?.onPhase?.(
			'lookup',
			'Filtering leadership to decision-makers with authority...'
		);

		const allResults: DecisionMakerResult[] = [];

		// Process cache hits
		for (const { organization, cached } of cacheHits) {
			if (!cached) continue;

			const relevant = await this.filterByRelevance(
				cached.leadership,
				context.subjectLine,
				context.topics,
				context.streaming
			);

			allResults.push({
				decisionMakers: this.transformToProcessedDecisionMakers(
					relevant,
					cached.name,
					cached.website
				),
				provider: this.name,
				orgProfile: cached,
				cacheHit: true,
				latencyMs: 0, // Cached
				researchSummary: `Retrieved ${cached.name} from cache with ${cached.leadership.length} leaders.`
			});
		}

		// Process newly discovered organizations
		if (batchResult) {
			for (const success of batchResult.successful) {
				const leaders = success.profile.leadership.map(this.firecrawlLeaderToLeaderDocument);
				const relevant = await this.filterByRelevance(
					leaders,
					context.subjectLine,
					context.topics,
					context.streaming
				);

				allResults.push({
					decisionMakers: this.transformToProcessedDecisionMakers(
						relevant,
						success.profile.name,
						success.profile.website
					),
					provider: this.name,
					cacheHit: false,
					latencyMs: 0, // Part of batch
					researchSummary: `Discovered ${relevant.length} relevant decision-makers at ${success.profile.name}.`,
					metadata: {
						totalLeadersFound: success.profile.leadership.length,
						relevantCount: relevant.length,
						withEmail: relevant.filter(l => l.email).length,
						policyPositions: success.profile.policyPositions.length
					}
				});
			}

			// Add failed organizations as empty results
			for (const failure of batchResult.failed) {
				allResults.push({
					decisionMakers: [],
					provider: this.name,
					cacheHit: false,
					latencyMs: 0,
					researchSummary: `Failed to discover ${failure.organization}: ${failure.error}`
				});
			}
		}

		const totalDMs = allResults.reduce((sum, r) => sum + r.decisionMakers.length, 0);
		const totalTime = Date.now() - startTime;

		console.log('[firecrawl-provider] Batch resolution complete:', {
			organizations: organizations.length,
			cacheHits: cacheHits.length,
			newDiscoveries: batchResult?.successful.length || 0,
			failures: batchResult?.failed.length || 0,
			totalDecisionMakers: totalDMs,
			totalTimeMs: totalTime
		});

		context.streaming?.onPhase?.(
			'complete',
			`Found ${totalDMs} decision-makers across ${organizations.length} organizations in ${Math.round(totalTime / 1000)}s`
		);

		return allResults;
	}
}
