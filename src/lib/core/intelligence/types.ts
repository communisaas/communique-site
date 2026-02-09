/**
 * Intelligence Orchestration Type Definitions
 *
 * Type-safe interfaces for the intelligence gathering system that surfaces
 * contextual information during template creation.
 */

import type { DecisionMakerTargetType, GeographicScope } from '../agents/providers/types';
import type { IntelligenceCategory } from '$lib/server/intelligence/types';

// Re-export for convenience
export type { IntelligenceCategory, GeographicScope };

// ============================================================================
// Query Context
// ============================================================================

/**
 * Context for intelligence queries
 * Describes what information to gather and from what scope
 */
export interface IntelligenceQuery {
	/** Topics to research */
	topics: string[];

	/** Type of target being contacted */
	targetType?: DecisionMakerTargetType;

	/** Specific organization or entity */
	targetEntity?: string;

	/** Geographic scope for local/state issues */
	location?: GeographicScope;

	/** Organization ID for tracking */
	organizationId?: string;

	/** Time window for intelligence freshness */
	timeframe?: 'day' | 'week' | 'month';
}

// ============================================================================
// Intelligence Items
// ============================================================================

/**
 * Single intelligence item (news article, bill, announcement)
 */
export interface IntelligenceItem {
	/** Unique identifier (hash of source URL + category) */
	id: string;

	/** Category of intelligence */
	category: IntelligenceCategory;

	/** Article/bill/document title */
	title: string;

	/** Brief description or excerpt */
	summary: string;

	/** Source URL for full content */
	sourceUrl: string;

	/** Publication or source name */
	sourceName: string;

	/** Publication/announcement date */
	publishedAt: Date;

	/** Relevance score (0-1) based on topic match */
	relevanceScore: number;

	/** Associated topics */
	topics: string[];

	/** Named entities mentioned (people, orgs, places) */
	entities: Array<{
		name: string;
		type: 'person' | 'organization' | 'location' | 'legislation' | 'other';
	}>;

	/** Optional sentiment analysis */
	sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';

	/** Whether this item can be cited in a message */
	isActionable?: boolean;

	/** Provider-specific metadata */
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Intelligence provider interface
 * Implementations gather intelligence from different sources
 */
export interface IntelligenceProvider {
	/** Provider identifier */
	readonly name: string;

	/** Categories this provider can supply */
	readonly categories: readonly IntelligenceCategory[];

	/**
	 * Fetch intelligence items for the given query
	 * Uses AsyncGenerator for true streaming as results arrive
	 *
	 * @yields IntelligenceItem - Individual items as they're discovered
	 * @throws Error - If provider fails critically
	 */
	fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem>;
}

// ============================================================================
// Stream Events
// ============================================================================

/**
 * Events emitted during intelligence gathering
 * For progress tracking and UI updates
 */
export type IntelligenceStreamEvent =
	| IntelligenceItemEvent
	| IntelligenceProgressEvent
	| IntelligenceCompleteEvent
	| IntelligenceErrorEvent;

export interface IntelligenceItemEvent {
	type: 'item';
	category: IntelligenceCategory;
	item: IntelligenceItem;
}

export interface IntelligenceProgressEvent {
	type: 'progress';
	category: IntelligenceCategory;
	message: string;
	/** Number of items found so far */
	itemCount: number;
}

export interface IntelligenceCompleteEvent {
	type: 'complete';
	category: IntelligenceCategory;
	/** Total items yielded */
	totalItems: number;
	/** Time taken in milliseconds */
	durationMs: number;
}

export interface IntelligenceErrorEvent {
	type: 'error';
	category: IntelligenceCategory;
	error: string;
	/** Whether this is a recoverable error */
	recoverable: boolean;
}

// ============================================================================
// Orchestration Options
// ============================================================================

/**
 * Options for intelligence orchestration
 */
export interface OrchestrationOptions {
	/** Maximum items per provider (default: 10) */
	maxItemsPerProvider?: number;

	/** Minimum relevance score to include (0-1, default: 0.5) */
	minRelevanceScore?: number;

	/** Whether to check cache before fetching (default: true) */
	useCache?: boolean;

	/** Maximum age of cached items in hours (default: 24) */
	maxCacheAgeHours?: number;

	/** Categories to fetch (default: all relevant to query) */
	categories?: IntelligenceCategory[];

	/** Timeout per provider in milliseconds (default: 30000) */
	providerTimeoutMs?: number;
}

// ============================================================================
// Deduplication
// ============================================================================

/**
 * Deduplication strategy for merging results from multiple providers
 */
export type DeduplicationStrategy = 'url' | 'content-hash' | 'title-similarity';

/**
 * Item with deduplication metadata
 */
export interface DedupedItem extends IntelligenceItem {
	/** Sources that contributed this item (if merged) */
	sources?: string[];
	/** Original relevance scores from each provider */
	relevanceScores?: Record<string, number>;
}
