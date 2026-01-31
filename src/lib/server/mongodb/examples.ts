/**
 * MongoDB Usage Examples
 *
 * This file contains practical examples of how to use the MongoDB integration layer.
 * These examples can be used as reference when implementing features.
 */

import {
	findOrganizationByName,
	upsertOrganization,
	queryIntelligence,
	insertIntelligenceItem,
	findCachedDecisionMakers,
	cacheDecisionMakers
} from './queries';
import { generateQueryHash, createTTL, normalizeName } from './utils';
import type {
	OrganizationDocument,
	IntelligenceItemDocument,
	DecisionMakerDocument
} from './schema';

// ============================================================================
// Example 1: Caching Organization Profiles from Firecrawl
// ============================================================================

async function exampleCacheOrganization() {
	// Suppose we've scraped an org profile from Firecrawl
	const scrapedData = {
		name: 'ACME Corporation',
		website: 'https://acme.com',
		about: 'Leading provider of innovative solutions',
		industry: 'Technology',
		headquarters: {
			city: 'San Francisco',
			state: 'CA',
			country: 'USA'
		},
		leadership: [
			{
				name: 'Jane Doe',
				title: 'CEO',
				email: 'jane@acme.com',
				linkedin: 'https://linkedin.com/in/janedoe',
				isVerified: true,
				sourceUrl: 'https://acme.com/about/team'
			}
		],
		policyPositions: [
			{
				topic: 'AI Regulation',
				stance: 'Support',
				summary: 'Advocates for responsible AI development',
				sourceUrl: 'https://acme.com/policy',
				lastUpdated: new Date()
			}
		],
		contacts: {
			general: 'info@acme.com',
			press: 'press@acme.com',
			phone: '+1-555-0100'
		}
	};

	// Upsert the organization (creates or updates)
	const orgId = await upsertOrganization({
		name: scrapedData.name,
		normalizedName: normalizeName(scrapedData.name),
		website: scrapedData.website,
		about: scrapedData.about,
		industry: scrapedData.industry,
		headquarters: scrapedData.headquarters,
		leadership: scrapedData.leadership,
		policyPositions: scrapedData.policyPositions,
		contacts: scrapedData.contacts,
		source: 'firecrawl',
		createdAt: new Date(),
		updatedAt: new Date(),
		expiresAt: createTTL(30) // Cache for 30 days
	});

	console.log('Organization cached:', orgId);

	// Later, retrieve it
	const org = await findOrganizationByName('ACME Corporation');
	console.log('Found org:', org?.name);
}

// ============================================================================
// Example 2: Storing Intelligence Items (News)
// ============================================================================

async function exampleStoreNewsArticle() {
	// Suppose we've fetched a news article from an API
	const newsItem: Omit<IntelligenceItemDocument, '_id' | 'createdAt'> = {
		category: 'news',
		title: 'New Healthcare Bill Introduced in Senate',
		source: 'Political News Daily',
		sourceUrl: 'https://news.example.com/article/123',
		publishedAt: new Date('2026-01-30'),
		snippet:
			'Senator Smith introduced a comprehensive healthcare reform bill...',
		topics: ['healthcare', 'legislation', 'insurance'],
		entities: ['Senator Smith', 'Senate Health Committee', 'ACME Insurance'],
		relevanceScore: 0.85,
		sentiment: 'neutral',
		geographicScope: 'national',
		expiresAt: createTTL(90) // Keep for 90 days
	};

	const itemId = await insertIntelligenceItem(newsItem);
	console.log('Intelligence item stored:', itemId);

	// Later, query relevant intelligence
	const healthcareIntel = await queryIntelligence({
		topics: ['healthcare'],
		category: 'news',
		minRelevanceScore: 0.7,
		limit: 10
	});

	console.log(`Found ${healthcareIntel.length} relevant articles`);
}

// ============================================================================
// Example 3: Caching Decision Maker Lookups
// ============================================================================

async function exampleCacheDecisionMakers() {
	// User wants to contact decision makers about healthcare
	const lookupParams = {
		targetType: 'legislative' as const,
		targetEntity: 'US Senate',
		topics: ['healthcare', 'insurance']
	};

	// Generate hash for cache lookup
	const queryHash = generateQueryHash(lookupParams);

	// Check cache first
	let cached = await findCachedDecisionMakers(queryHash);

	if (cached) {
		console.log(`Cache hit! Found ${cached.decisionMakers.length} decision makers`);
		return cached.decisionMakers;
	}

	// Cache miss - fetch from external API (Firecrawl, etc.)
	const decisionMakers: DecisionMakerDocument[] = [
		{
			name: 'Senator Jane Smith',
			title: 'Senator',
			organization: 'US Senate',
			email: 'jane.smith@senate.gov',
			address: {
				street: '123 Senate Office Building',
				city: 'Washington',
				state: 'DC',
				zip: '20510'
			},
			socialMedia: {
				twitter: '@senatorsmith'
			}
		}
		// ... more decision makers
	];

	// Cache the results
	await cacheDecisionMakers({
		queryHash,
		...lookupParams,
		decisionMakers,
		provider: 'firecrawl',
		expiresAt: createTTL(7) // Cache for 7 days
	});

	console.log('Decision makers cached');
	return decisionMakers;
}

// ============================================================================
// Example 4: Full Workflow - User Creates Message
// ============================================================================

async function exampleFullWorkflow() {
	// 1. User enters organization name
	const userInput = 'acme corporation';

	// 2. Check if we have cached org profile
	let org = await findOrganizationByName(userInput);

	if (!org) {
		console.log('Org not in cache, fetching from Firecrawl...');
		// Fetch from Firecrawl and cache (Example 1)
		// org = await fetchAndCacheOrganization(userInput);
	}

	// 3. Get relevant intelligence about the organization
	const intelligence = await queryIntelligence({
		topics: org?.policyPositions.map((p) => p.topic) || [],
		limit: 5
	});

	console.log(`Found ${intelligence.length} relevant intelligence items`);

	// 4. Get decision makers
	const lookupParams = {
		targetType: 'corporate' as const,
		targetEntity: org?.name || '',
		topics: ['policy', 'advocacy']
	};

	const queryHash = generateQueryHash(lookupParams);
	let decisionMakers = await findCachedDecisionMakers(queryHash);

	if (!decisionMakers) {
		console.log('Decision makers not cached, fetching...');
		// Fetch and cache (Example 3)
	}

	// 5. User can now compose informed message with:
	// - Organization profile (org)
	// - Relevant news/intelligence (intelligence)
	// - Verified decision makers (decisionMakers)

	return {
		organization: org,
		intelligence,
		decisionMakers
	};
}

// ============================================================================
// Example 5: Semantic Search with Vector Embeddings (Future)
// ============================================================================

async function exampleVectorSearch() {
	// This example shows how vector search will work once embeddings are added

	// User's query
	const userQuery = 'renewable energy policy initiatives';

	// Generate embedding for query (using Voyage AI)
	// const queryEmbedding = await generateEmbedding(userQuery);

	// Perform vector search using MongoDB Atlas Vector Search
	/*
	const db = await getDatabase();
	const results = await db.collection('intelligence').aggregate([
		{
			$vectorSearch: {
				index: 'vector_search_intelligence',
				path: 'embedding',
				queryVector: queryEmbedding,
				numCandidates: 100,
				limit: 10
			}
		},
		{
			$project: {
				title: 1,
				snippet: 1,
				publishedAt: 1,
				score: { $meta: 'vectorSearchScore' }
			}
		}
	]).toArray();
	*/

	console.log('Vector search will return semantically similar items');
}

// ============================================================================
// Export examples for reference
// ============================================================================

export const examples = {
	exampleCacheOrganization,
	exampleStoreNewsArticle,
	exampleCacheDecisionMakers,
	exampleFullWorkflow,
	exampleVectorSearch
};

// Note: These are examples only - not meant to be run directly
// Use them as reference when implementing features
