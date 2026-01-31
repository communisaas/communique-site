/**
 * MongoDB Collection Accessors
 *
 * Provides type-safe access to MongoDB collections.
 * Each function returns a properly typed Collection instance.
 */

import type { Collection } from 'mongodb';
import { getDatabase } from '../mongodb';
import {
	COLLECTIONS,
	type OrganizationDocument,
	type IntelligenceItemDocument,
	type DecisionMakerCacheDocument
} from './schema';

/**
 * Get the Organizations collection
 * Stores cached organization profiles from Firecrawl
 *
 * @returns Promise<Collection<OrganizationDocument>>
 *
 * @example
 * const orgs = await getOrganizationsCollection();
 * const result = await orgs.findOne({ normalizedName: 'acme corp' });
 */
export async function getOrganizationsCollection(): Promise<
	Collection<OrganizationDocument>
> {
	const db = await getDatabase();
	return db.collection<OrganizationDocument>(COLLECTIONS.ORGANIZATIONS);
}

/**
 * Get the Intelligence collection
 * Stores news, legislative activity, and other intelligence items
 *
 * @returns Promise<Collection<IntelligenceItemDocument>>
 *
 * @example
 * const intel = await getIntelligenceCollection();
 * const items = await intel.find({ category: 'legislative' }).limit(10).toArray();
 */
export async function getIntelligenceCollection(): Promise<
	Collection<IntelligenceItemDocument>
> {
	const db = await getDatabase();
	return db.collection<IntelligenceItemDocument>(COLLECTIONS.INTELLIGENCE);
}

/**
 * Get the Decision Maker Cache collection
 * Stores cached decision maker lookups for performance optimization
 *
 * @returns Promise<Collection<DecisionMakerCacheDocument>>
 *
 * @example
 * const cache = await getDecisionMakerCacheCollection();
 * const cached = await cache.findOne({ queryHash: '...' });
 */
export async function getDecisionMakerCacheCollection(): Promise<
	Collection<DecisionMakerCacheDocument>
> {
	const db = await getDatabase();
	return db.collection<DecisionMakerCacheDocument>(
		COLLECTIONS.DECISION_MAKER_CACHE
	);
}

/**
 * Collection accessor map for dynamic access
 * Useful when you need to access collections by name
 */
export const collectionAccessors = {
	[COLLECTIONS.ORGANIZATIONS]: getOrganizationsCollection,
	[COLLECTIONS.INTELLIGENCE]: getIntelligenceCollection,
	[COLLECTIONS.DECISION_MAKER_CACHE]: getDecisionMakerCacheCollection
} as const;
