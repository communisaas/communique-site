/**
 * MongoDB Schema Definitions for Communique
 *
 * This module defines TypeScript interfaces for all MongoDB collections used in the platform:
 * - Organization profiles (cached from Firecrawl)
 * - Intelligence items (news, legislative activity, etc.)
 * - Decision maker caches (for lookup optimization)
 */

import type { ObjectId } from 'mongodb';

// ============================================================================
// Organization Collection - Cached profiles from Firecrawl
// ============================================================================

export interface LeaderDocument {
	name: string;
	title: string;
	email?: string;
	linkedin?: string;
	isVerified: boolean;
	sourceUrl?: string;
}

export interface PolicyPositionDocument {
	topic: string;
	stance: string;
	summary: string;
	sourceUrl?: string;
	lastUpdated: Date;
}

export interface OrganizationContactsDocument {
	general?: string;
	press?: string;
	stakeholder?: string;
	phone?: string;
}

export interface OrganizationDocument {
	_id: ObjectId;
	name: string;
	normalizedName: string; // Lowercase, stripped for matching
	website: string;
	about?: string;
	industry?: string;
	headquarters?: {
		city?: string;
		state?: string;
		country?: string;
	};
	leadership: LeaderDocument[];
	policyPositions: PolicyPositionDocument[];
	contacts: OrganizationContactsDocument;

	// Vector search capability
	embedding?: number[]; // Voyage AI embedding for semantic search

	// Metadata
	source: 'firecrawl' | 'manual' | 'import';
	createdAt: Date;
	updatedAt: Date;
	expiresAt?: Date; // TTL for cache expiration
}

// ============================================================================
// Intelligence Collection - News, legislative activity, and other intelligence
// ============================================================================

export type IntelligenceCategory =
	| 'news'
	| 'legislative'
	| 'regulatory'
	| 'corporate'
	| 'social';

export type GeographicScope =
	| 'local'
	| 'state'
	| 'national'
	| 'international';

export type Sentiment =
	| 'positive'
	| 'negative'
	| 'neutral'
	| 'mixed';

export interface IntelligenceItemDocument {
	_id: ObjectId;
	category: IntelligenceCategory;

	// Core content
	title: string;
	source: string;
	sourceUrl: string;
	publishedAt: Date;
	snippet: string;

	// Categorization
	topics: string[]; // e.g., ["healthcare", "education"]
	entities: string[]; // Named entities extracted from content

	// Vector search
	embedding?: number[]; // Voyage AI embedding

	// Analysis metadata
	relevanceScore?: number; // 0-1 score for importance
	sentiment?: Sentiment;
	geographicScope?: GeographicScope;

	// Lifecycle
	createdAt: Date;
	expiresAt?: Date; // TTL for automatic cleanup
}

// ============================================================================
// Decision Maker Cache - Optimized lookups
// ============================================================================

export interface DecisionMakerDocument {
	name: string;
	title: string;
	organization: string;
	email?: string;
	phone?: string;
	address?: {
		street?: string;
		city?: string;
		state?: string;
		zip?: string;
	};
	socialMedia?: {
		twitter?: string;
		linkedin?: string;
		facebook?: string;
	};
	metadata?: Record<string, unknown>;
}

export type TargetType =
	| 'legislative'
	| 'executive'
	| 'corporate'
	| 'nonprofit'
	| 'academic';

export interface DecisionMakerCacheDocument {
	_id: ObjectId;
	queryHash: string; // Hash of query parameters for deduplication

	// Query parameters
	targetType: TargetType;
	targetEntity: string; // e.g., "US Congress", "California State Senate"
	topics?: string[];
	geographicScope?: string;

	// Cached results
	decisionMakers: DecisionMakerDocument[];

	// Cache metadata
	provider: string; // Which service provided the data
	createdAt: Date;
	expiresAt?: Date; // TTL for cache expiration
	hitCount: number; // Number of times this cache entry was used
	lastHitAt?: Date; // Last time this cache was accessed
}

// ============================================================================
// Collection Names - Centralized constants
// ============================================================================

export const COLLECTIONS = {
	ORGANIZATIONS: 'organizations',
	INTELLIGENCE: 'intelligence',
	DECISION_MAKER_CACHE: 'decision_maker_cache'
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// ============================================================================
// Database Name
// ============================================================================

export const DATABASE_NAME = 'communique';
