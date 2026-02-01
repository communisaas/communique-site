/**
 * MongoDB Constants
 *
 * Centralized constants for MongoDB configuration.
 * Separated from schema.ts to avoid circular dependencies.
 *
 * @module mongodb/constants
 */

// ============================================================================
// Collection Names - Centralized constants
// ============================================================================

export const COLLECTIONS = {
	ORGANIZATIONS: 'organizations',
	INTELLIGENCE: 'intelligence',
	DECISION_MAKER_CACHE: 'decision_maker_cache',
	PARSED_DOCUMENTS: 'parsed_documents',
	LEGISLATIVE_BILLS: 'legislative_bills',
	CONGRESS_MEMBERS: 'congress_members',
	MEMBER_VOTES: 'member_votes'
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// ============================================================================
// Database Name
// ============================================================================

export const DATABASE_NAME = 'communique';
