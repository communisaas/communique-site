/**
 * Agent Memory Service
 *
 * Provides contextual memory retrieval for agent reasoning.
 * Retrieves relevant intelligence items and organization profiles from MongoDB
 * to enhance agent decision-making with current information.
 *
 * This service is called before agent reasoning to inject context about:
 * - Recent news and developments
 * - Legislative activity
 * - Corporate announcements
 * - Organizational profiles
 *
 * Features:
 * - Semantic vector search using Voyage AI embeddings
 * - Optional Voyage AI reranking for 10-30% precision improvement
 * - Automatic category selection based on target type
 * - Synthesized context ready for prompt injection
 *
 * Usage:
 * ```typescript
 * const context = await AgentMemoryService.retrieveContext({
 *   topic: 'climate change legislation',
 *   targetType: 'congress',
 *   location: { state: 'CA' },
 *   enableReranking: true // Optional: enable for better precision
 * });
 *
 * // Use context.synthesizedContext in agent prompt
 * const prompt = `${basePrompt}\n\nContext:\n${context.synthesizedContext}`;
 *
 * // Check if reranking was applied
 * if (context.metadata.rerankingApplied) {
 *   console.log(`Reranking took ${context.metadata.rerankingLatencyMs}ms`);
 * }
 * ```
 */

import type { DecisionMakerTargetType, GeographicScope } from '$lib/core/agents/providers/types';
import type { IntelligenceCategory } from '$lib/server/mongodb/schema';
import type { IntelligenceItemDocument, OrganizationDocument } from '$lib/server/mongodb/schema';
import { OrganizationService, IntelligenceService } from '$lib/server/mongodb/service';
import {
	semanticSearchIntelligence,
	semanticSearchOrganizations,
	type VectorSearchResult
} from '$lib/server/mongodb/vector-search';
import { rerankDocuments } from '$lib/server/embeddings';
import { FEATURES, FeatureStatus } from '$lib/features/config';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for context retrieval
 */
export interface RetrieveContextParams {
	/** User's core message/intent - used for semantic search */
	topic: string;

	/** Type of target being contacted */
	targetType?: DecisionMakerTargetType;

	/** Specific organization name if known */
	targetEntity?: string;

	/** Geographic context for filtering local/state content */
	location?: {
		state?: string;
		city?: string;
		country?: string;
	};

	/** Maximum items per category (default: 5) */
	limit?: number;

	/** Minimum relevance score for intelligence items (default: 0.6) */
	minRelevanceScore?: number;

	/** Use semantic search vs keyword search (default: true) */
	useSemanticSearch?: boolean;

	/** Days to look back for intelligence (default: 30) */
	lookbackDays?: number;

	/**
	 * Enable Voyage AI reranking for improved precision (10-30% improvement).
	 * Default: Uses SEMANTIC_RERANKING feature flag when undefined.
	 * Set explicitly to override the feature flag.
	 */
	enableReranking?: boolean;

	/**
	 * Number of top results to rerank after vector search (default: 10).
	 * Only used when reranking is enabled.
	 */
	rerankTopK?: number;
}

/**
 * Organization context for agents
 */
export interface OrganizationContext {
	/** Organization name */
	name: string;

	/** Type of organization */
	type: DecisionMakerTargetType;

	/** Organization description */
	about?: string;

	/** Industry/sector */
	industry?: string;

	/** Leadership team */
	leadership: Array<{
		name: string;
		title: string;
		email?: string;
	}>;

	/** Recent policy positions */
	policyPositions?: Array<{
		topic: string;
		stance: string;
		summary: string;
	}>;

	/** Contact information */
	contacts?: {
		general?: string;
		press?: string;
		stakeholder?: string;
		phone?: string;
	};
}

/**
 * Intelligence item in agent-friendly format
 */
export interface IntelligenceItem {
	/** Category (news, legislative, corporate, etc.) */
	category: IntelligenceCategory;

	/** Headline/title */
	title: string;

	/** Brief summary/snippet */
	snippet: string;

	/** Source name */
	source: string;

	/** Source URL for reference */
	sourceUrl: string;

	/** Publication date */
	publishedAt: Date;

	/** Relevance score (0-1) */
	relevanceScore: number;

	/** Associated topics */
	topics: string[];

	/** Named entities mentioned */
	entities: string[];

	/** Sentiment if available */
	sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
}

/**
 * Complete context for agent reasoning
 */
export interface AgentContext {
	/** Relevant intelligence items grouped by category */
	intelligence: {
		news: IntelligenceItem[];
		legislative: IntelligenceItem[];
		corporate: IntelligenceItem[];
		regulatory: IntelligenceItem[];
		social: IntelligenceItem[];
	};

	/** Target organization profile if applicable */
	organization?: OrganizationContext;

	/** Synthesized context ready for prompt injection */
	synthesizedContext: string;

	/** Metadata about the retrieval */
	metadata: {
		/** Total items retrieved */
		totalItems: number;
		/** Retrieval method used */
		method: 'semantic' | 'keyword';
		/** Query time in milliseconds */
		latencyMs: number;
		/** Whether organization was found */
		hasOrganization: boolean;
		/** Whether reranking was applied */
		rerankingApplied: boolean;
		/** Reranking latency in milliseconds (if applied) */
		rerankingLatencyMs?: number;
	};
}

/**
 * Search options for intelligence queries
 */
export interface SearchOptions {
	/** Categories to search */
	categories?: IntelligenceCategory[];

	/** Maximum results */
	limit?: number;

	/** Minimum relevance score */
	minScore?: number;

	/** Date range filter */
	dateRange?: {
		start?: Date;
		end?: Date;
	};

	/** Topic filters */
	topics?: string[];
}

// ============================================================================
// Service Implementation
// ============================================================================

export class AgentMemoryService {
	/**
	 * Retrieve relevant context for agent reasoning.
	 *
	 * This is the main entry point for agents to gather contextual information
	 * before processing a user's request.
	 *
	 * @param params - Context retrieval parameters
	 * @returns Complete agent context with intelligence and org data
	 *
	 * @example
	 * ```typescript
	 * const context = await AgentMemoryService.retrieveContext({
	 *   topic: 'renewable energy policy',
	 *   targetType: 'congress',
	 *   location: { state: 'CA' },
	 *   limit: 5
	 * });
	 * ```
	 */
	static async retrieveContext(params: RetrieveContextParams): Promise<AgentContext> {
		const startTime = Date.now();

		const {
			topic,
			targetType,
			targetEntity,
			location,
			limit = 5,
			minRelevanceScore = 0.6,
			useSemanticSearch = true,
			lookbackDays = 30,
			enableReranking,
			rerankTopK = 10
		} = params;

		// Determine if reranking should be used:
		// 1. Explicit param takes precedence
		// 2. Otherwise check feature flag (BETA = enabled if VITE_ENABLE_BETA=true)
		const shouldRerank =
			enableReranking !== undefined
				? enableReranking
				: FEATURES.SEMANTIC_RERANKING === FeatureStatus.ON ||
					(FEATURES.SEMANTIC_RERANKING === FeatureStatus.BETA &&
						(typeof process !== 'undefined' && process.env?.VITE_ENABLE_BETA === 'true'));

		// Determine which categories to search based on target type
		const categories = this.selectCategories(targetType);

		// Build date filter for recency
		const dateFilter = {
			start: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
		};

		// When reranking, fetch more candidates to rerank from
		const searchLimit = shouldRerank ? Math.max(limit * 3, rerankTopK * 2) : limit;

		// Fetch intelligence and organization in parallel
		const [intelligenceResults, organizationResult] = await Promise.all([
			// Get intelligence items
			useSemanticSearch
				? this.semanticSearchIntelligence(topic, {
						categories,
						limit: searchLimit,
						minScore: minRelevanceScore,
						dateRange: dateFilter
					})
				: this.keywordSearchIntelligence(topic, {
						categories,
						limit: searchLimit,
						minScore: minRelevanceScore,
						dateRange: dateFilter
					}),

			// Get organization profile if target entity specified
			targetEntity ? this.getOrganization(targetEntity) : Promise.resolve(null)
		]);

		// Apply reranking if enabled and we have results
		let finalResults = intelligenceResults;
		let rerankingLatencyMs: number | undefined;
		let rerankingApplied = false;

		if (shouldRerank && intelligenceResults.length > 0 && useSemanticSearch) {
			const rerankStart = Date.now();
			try {
				finalResults = await this.rerankIntelligenceResults(
					topic,
					intelligenceResults,
					Math.min(rerankTopK, limit)
				);
				rerankingApplied = true;
				rerankingLatencyMs = Date.now() - rerankStart;

				console.log(
					`[AgentMemory] Reranking complete: ${intelligenceResults.length} candidates -> ${finalResults.length} results in ${rerankingLatencyMs}ms`
				);
			} catch (error) {
				// Reranking failed - fall back to original results
				console.error('[AgentMemory] Reranking failed, using original results:', error);
				finalResults = intelligenceResults.slice(0, limit);
			}
		} else {
			// No reranking - just trim to limit
			finalResults = intelligenceResults.slice(0, limit);
		}

		// Group intelligence by category
		const intelligence = this.groupByCategory(finalResults);

		// Synthesize into prompt-ready context
		const synthesizedContext = this.synthesizeContext({
			intelligence,
			organization: organizationResult,
			topic,
			targetType,
			location
		});

		const latencyMs = Date.now() - startTime;

		return {
			intelligence,
			organization: organizationResult || undefined,
			synthesizedContext,
			metadata: {
				totalItems: finalResults.length,
				method: useSemanticSearch ? 'semantic' : 'keyword',
				latencyMs,
				hasOrganization: !!organizationResult,
				rerankingApplied,
				rerankingLatencyMs
			}
		};
	}

	/**
	 * Quick lookup of a specific organization's cached profile.
	 *
	 * Returns organization context if available in cache, null otherwise.
	 *
	 * @param name - Organization name
	 * @returns Organization context or null
	 *
	 * @example
	 * ```typescript
	 * const org = await AgentMemoryService.getOrganization('ExxonMobil');
	 * if (org) {
	 *   console.log(`CEO: ${org.leadership[0]?.name}`);
	 * }
	 * ```
	 */
	static async getOrganization(name: string): Promise<OrganizationContext | null> {
		try {
			const org = await OrganizationService.findOrganization(name);

			if (!org) {
				return null;
			}

			return this.formatOrganization(org);
		} catch (error) {
			console.error(`[AgentMemory] Error fetching organization "${name}":`, error);
			return null;
		}
	}

	/**
	 * Search intelligence items semantically using vector embeddings.
	 *
	 * Uses MongoDB Atlas Vector Search for semantic similarity matching.
	 * More accurate than keyword search but requires embeddings.
	 *
	 * @param query - Natural language query
	 * @param options - Search options
	 * @returns Matching intelligence items
	 *
	 * @example
	 * ```typescript
	 * const items = await AgentMemoryService.searchIntelligence(
	 *   'climate change legislation',
	 *   { categories: ['legislative', 'news'], limit: 10 }
	 * );
	 * ```
	 */
	static async searchIntelligence(
		query: string,
		options: SearchOptions = {}
	): Promise<IntelligenceItem[]> {
		return this.semanticSearchIntelligence(query, options);
	}

	// ============================================================================
	// Private Helper Methods
	// ============================================================================

	/**
	 * Perform semantic search on intelligence items
	 */
	private static async semanticSearchIntelligence(
		query: string,
		options: SearchOptions = {}
	): Promise<IntelligenceItem[]> {
		const { categories, limit = 10, minScore = 0.6, dateRange, topics } = options;

		try {
			const results = await semanticSearchIntelligence(
				query,
				{
					categories,
					topics,
					publishedAfter: dateRange?.start,
					publishedBefore: dateRange?.end,
					minRelevanceScore: minScore
				},
				{
					limit,
					minScore,
					includeScore: true
				}
			);

			return results.map((result) => this.formatIntelligenceItem(result));
		} catch (error) {
			console.error('[AgentMemory] Semantic search failed, falling back to keyword:', error);
			// Fallback to keyword search
			return this.keywordSearchIntelligence(query, options);
		}
	}

	/**
	 * Fallback keyword search using MongoDB service
	 */
	private static async keywordSearchIntelligence(
		query: string,
		options: SearchOptions = {}
	): Promise<IntelligenceItem[]> {
		const { categories, limit = 10, minScore = 0.5 } = options;

		try {
			const results = await IntelligenceService.getRelevantIntelligence({
				topics: [query],
				categories,
				minRelevanceScore: minScore,
				limit
			});

			return results.map((doc) => this.formatIntelligenceItemFromDoc(doc));
		} catch (error) {
			console.error('[AgentMemory] Keyword search failed:', error);
			return [];
		}
	}

	/**
	 * Rerank intelligence results using Voyage AI reranking model.
	 *
	 * This provides 10-30% precision improvement by using a cross-encoder
	 * to directly score query-document pairs, rather than relying solely
	 * on embedding similarity.
	 *
	 * @param query - The original search query
	 * @param results - Vector search results to rerank
	 * @param topK - Number of top results to return after reranking
	 * @returns Reranked results with updated relevance scores
	 */
	private static async rerankIntelligenceResults(
		query: string,
		results: IntelligenceItem[],
		topK: number
	): Promise<IntelligenceItem[]> {
		if (results.length === 0) {
			return [];
		}

		// Prepare documents for reranking - combine title and snippet for richer context
		const documentsToRerank = results.map(
			(item) => `${item.title}. ${item.snippet}`
		);

		console.log(
			`[AgentMemory] Reranking ${documentsToRerank.length} candidates for query: "${query.slice(0, 50)}..."`
		);

		// Call Voyage AI rerank (using rerank-2.5 for best performance)
		const rerankResults = await rerankDocuments(query, documentsToRerank, {
			model: 'rerank-2.5',
			topK: Math.min(topK, results.length),
			returnDocuments: false // We already have the documents
		});

		// Map reranked results back to IntelligenceItem with updated scores
		return rerankResults.map((rerankResult) => {
			const originalItem = results[rerankResult.index];
			return {
				...originalItem,
				// Update relevance score with the reranking score
				relevanceScore: rerankResult.relevanceScore
			};
		});
	}

	/**
	 * Select appropriate intelligence categories based on target type
	 */
	private static selectCategories(
		targetType?: DecisionMakerTargetType
	): IntelligenceCategory[] {
		if (!targetType) {
			return ['news', 'legislative', 'regulatory', 'corporate', 'social'];
		}

		const categoryMap: Record<DecisionMakerTargetType, IntelligenceCategory[]> = {
			congress: ['legislative', 'news', 'regulatory'],
			state_legislature: ['legislative', 'news', 'regulatory'],
			local_government: ['news', 'regulatory'],
			corporate: ['corporate', 'news', 'social'],
			nonprofit: ['news', 'social'],
			education: ['news', 'regulatory'],
			healthcare: ['news', 'regulatory'],
			labor: ['news', 'social'],
			media: ['news', 'social']
		};

		return categoryMap[targetType] || ['news', 'legislative', 'corporate'];
	}

	/**
	 * Group intelligence items by category
	 */
	private static groupByCategory(items: IntelligenceItem[]): AgentContext['intelligence'] {
		const grouped: AgentContext['intelligence'] = {
			news: [],
			legislative: [],
			corporate: [],
			regulatory: [],
			social: []
		};

		for (const item of items) {
			grouped[item.category].push(item);
		}

		return grouped;
	}

	/**
	 * Format vector search result into IntelligenceItem
	 */
	private static formatIntelligenceItem(
		result: VectorSearchResult<IntelligenceItemDocument>
	): IntelligenceItem {
		const doc = result.document;
		return {
			category: doc.category,
			title: doc.title,
			snippet: doc.snippet,
			source: doc.source,
			sourceUrl: doc.sourceUrl,
			publishedAt: doc.publishedAt,
			relevanceScore: result.score,
			topics: doc.topics,
			entities: doc.entities,
			sentiment: doc.sentiment
		};
	}

	/**
	 * Format intelligence document into IntelligenceItem
	 */
	private static formatIntelligenceItemFromDoc(
		doc: IntelligenceItemDocument
	): IntelligenceItem {
		return {
			category: doc.category,
			title: doc.title,
			snippet: doc.snippet,
			source: doc.source,
			sourceUrl: doc.sourceUrl,
			publishedAt: doc.publishedAt,
			relevanceScore: doc.relevanceScore || 0.5,
			topics: doc.topics,
			entities: doc.entities,
			sentiment: doc.sentiment
		};
	}

	/**
	 * Format organization document into OrganizationContext
	 */
	private static formatOrganization(doc: OrganizationDocument): OrganizationContext {
		return {
			name: doc.name,
			type: 'corporate', // Could be inferred from industry or metadata
			about: doc.about,
			industry: doc.industry,
			leadership: doc.leadership.map((leader) => ({
				name: leader.name,
				title: leader.title,
				email: leader.email
			})),
			policyPositions: doc.policyPositions?.map((pos) => ({
				topic: pos.topic,
				stance: pos.stance,
				summary: pos.summary
			})),
			contacts: doc.contacts
		};
	}

	/**
	 * Synthesize context into prompt-ready string
	 */
	private static synthesizeContext(params: {
		intelligence: AgentContext['intelligence'];
		organization?: OrganizationContext;
		topic: string;
		targetType?: DecisionMakerTargetType;
		location?: { state?: string; city?: string; country?: string };
	}): string {
		const { intelligence, organization, topic, targetType, location } = params;

		const sections: string[] = [];

		// Header
		sections.push(`# Context for: ${topic}`);

		if (targetType) {
			sections.push(`Target Type: ${targetType}`);
		}

		if (location) {
			const locationParts = [location.city, location.state, location.country]
				.filter(Boolean)
				.join(', ');
			if (locationParts) {
				sections.push(`Location: ${locationParts}`);
			}
		}

		sections.push(''); // Empty line

		// Organization context
		if (organization) {
			sections.push('## Target Organization');
			sections.push(`**${organization.name}**`);

			if (organization.about) {
				sections.push(organization.about);
			}

			if (organization.industry) {
				sections.push(`Industry: ${organization.industry}`);
			}

			if (organization.leadership.length > 0) {
				sections.push('\nLeadership:');
				organization.leadership.slice(0, 3).forEach((leader) => {
					sections.push(`- ${leader.name}, ${leader.title}`);
				});
			}

			if (organization.policyPositions && organization.policyPositions.length > 0) {
				sections.push('\nRecent Policy Positions:');
				organization.policyPositions.slice(0, 3).forEach((pos) => {
					sections.push(`- ${pos.topic}: ${pos.stance}`);
				});
			}

			sections.push(''); // Empty line
		}

		// Intelligence sections
		const categoryLabels: Record<IntelligenceCategory, string> = {
			news: 'Recent News',
			legislative: 'Legislative Activity',
			corporate: 'Corporate Developments',
			regulatory: 'Regulatory Updates',
			social: 'Social Media & Public Discourse'
		};

		for (const [category, items] of Object.entries(intelligence)) {
			if (items.length === 0) continue;

			const label = categoryLabels[category as IntelligenceCategory];
			sections.push(`## ${label}`);

			items.forEach((item, idx) => {
				const date = item.publishedAt.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				});

				sections.push(`${idx + 1}. **${item.title}** (${date})`);
				sections.push(`   ${item.snippet}`);
				sections.push(`   Source: ${item.source}`);

				if (item.sentiment) {
					sections.push(`   Sentiment: ${item.sentiment}`);
				}

				sections.push(''); // Empty line between items
			});
		}

		// Footer
		const totalItems = Object.values(intelligence).reduce((sum, items) => sum + items.length, 0);

		if (totalItems === 0) {
			sections.push('*No recent intelligence items found for this topic.*');
		}

		return sections.join('\n');
	}
}
