/**
 * Intelligence Types (replaces mongodb/schema.ts types)
 */

export type IntelligenceCategory = 'news' | 'legislative' | 'regulatory' | 'corporate' | 'social';
export type GeographicScope = 'local' | 'state' | 'national' | 'international';
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

export interface IntelligenceItem {
	id: string;
	category: IntelligenceCategory;
	title: string;
	source: string;
	source_url: string;
	published_at: Date;
	snippet: string;
	topics: string[];
	entities: string[];
	embedding?: number[];
	relevance_score: number | null;
	sentiment: string | null;
	geographic_scope: string | null;
	created_at: Date;
	expires_at: Date | null;
}

export interface VectorSearchResult<T> {
	document: T;
	score: number;
}

export interface IntelligenceQueryOptions {
	category?: IntelligenceCategory;
	topics?: string[];
	geographicScope?: GeographicScope;
	startDate?: Date;
	endDate?: Date;
	minRelevanceScore?: number;
	limit?: number;
	skip?: number;
}

export interface IntelligenceVectorFilters {
	categories?: IntelligenceCategory[];
	topics?: string[];
	publishedAfter?: Date;
	publishedBefore?: Date;
	minRelevanceScore?: number;
}

export interface VectorSearchOptions {
	limit?: number;
	minScore?: number;
	numCandidates?: number;
	includeScore?: boolean;
	contentType?: string;
}
