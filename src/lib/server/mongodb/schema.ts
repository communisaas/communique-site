/**
 * MongoDB Schema Definitions for Communique
 *
 * This module defines TypeScript interfaces for all MongoDB collections used in the platform:
 * - Intelligence items (news, legislative activity, etc.)
 * - Parsed document caches (Reducto results)
 */

import type { ObjectId } from 'mongodb';

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
// Parsed Documents Cache - Reducto results
// ============================================================================

import type {
	ParsedDocument,
	DocumentType
} from '../reducto/types';

/**
 * MongoDB schema for cached parsed documents from Reducto
 * TTL: 30 days (documents don't change once published)
 *
 * Indexes:
 * - TTL on expiresAt (automatic cleanup)
 * - Unique on sourceUrlHash (deduplication)
 * - On documentType (filtering by type)
 */
export interface ParsedDocumentCacheDocument {
	_id: ObjectId;

	/** Original document URL */
	sourceUrl: string;

	/** SHA-256 hash of sourceUrl for deduplication */
	sourceUrlHash: string;

	/** Document type for filtering */
	documentType: DocumentType;

	/** The full parsed document */
	document: ParsedDocument;

	/** Cache metadata */
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date; // TTL index

	/** Access statistics */
	hitCount: number;
	lastAccessedAt?: Date;
}

// ============================================================================
// Collection Names - Centralized constants
// ============================================================================

export const COLLECTIONS = {
	INTELLIGENCE: 'intelligence',
	PARSED_DOCUMENTS: 'parsed_documents'
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// ============================================================================
// Database Name
// ============================================================================

export const DATABASE_NAME = 'communique';
