/**
 * Fire Enrich API - Contact Enrichment
 *
 * Augments contact data from email addresses or LinkedIn URLs.
 * Used to fill in missing contact details for decision-makers.
 *
 * Features:
 * - Email-to-company domain extraction
 * - LinkedIn profile scraping
 * - Company website intelligence gathering
 * - MongoDB caching with 7-day TTL (data may change)
 * - LLM-powered data synthesis using Gemini
 */

import { createHash } from 'crypto';
import { getDatabase } from '../mongodb';
import { createTTL } from '../mongodb/utils';
import { generate, GEMINI_CONFIG } from '$lib/core/agents/gemini-client';
import type { Collection, ObjectId } from 'mongodb';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the Enrich API request
 */
export interface EnrichOptions {
	/** Email address to enrich from */
	email?: string;
	/** LinkedIn profile URL to enrich from */
	linkedinUrl?: string;
	/** Whether to include company information (default: true) */
	includeCompany?: boolean;
}

/**
 * Person information from enrichment
 */
export interface EnrichedPerson {
	/** Full name */
	name: string;
	/** Job title */
	title?: string;
	/** Company name */
	company?: string;
	/** Location (city, state/country) */
	location?: string;
	/** Professional bio or summary */
	bio?: string;
}

/**
 * Contact information from enrichment
 */
export interface EnrichedContact {
	/** Email address */
	email?: string;
	/** Phone number */
	phone?: string;
	/** LinkedIn profile URL */
	linkedin?: string;
	/** Twitter/X handle */
	twitter?: string;
}

/**
 * Company information from enrichment
 */
export interface EnrichedCompany {
	/** Company name */
	name: string;
	/** Primary domain */
	domain: string;
	/** Industry/sector */
	industry?: string;
	/** Company size (employees) */
	size?: string;
	/** Description */
	description?: string;
	/** Headquarters location */
	headquarters?: string;
	/** Year founded */
	yearFounded?: number;
}

/**
 * Result from the Enrich API
 */
export interface EnrichResult {
	/** Whether the enrichment was successful */
	success: boolean;
	/** Enriched person information */
	person: EnrichedPerson;
	/** Contact information */
	contact: EnrichedContact;
	/** Company information (if includeCompany was true) */
	company?: EnrichedCompany;
	/** Whether result came from cache */
	cached: boolean;
	/** Data sources used */
	sources?: string[];
	/** Error message if enrichment failed */
	error?: string;
}

/**
 * MongoDB document for cached enrichment results
 */
interface EnrichmentCacheDocument {
	_id?: ObjectId;
	/** SHA-256 hash of the lookup key (email or LinkedIn URL) */
	lookupHash: string;
	/** Original lookup value */
	lookupValue: string;
	/** Type of lookup (email or linkedin) */
	lookupType: 'email' | 'linkedin';
	/** Enriched person data */
	person: EnrichedPerson;
	/** Contact data */
	contact: EnrichedContact;
	/** Company data (if available) */
	company?: EnrichedCompany;
	/** Data sources used for enrichment */
	sources: string[];
	/** Cache metadata */
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date;
	/** Access statistics */
	hitCount: number;
	lastAccessedAt?: Date;
}

/**
 * Internal structure for scraped company data
 */
interface ScrapedCompanyData {
	name?: string;
	domain?: string;
	description?: string;
	industry?: string;
	size?: string;
	headquarters?: string;
	yearFounded?: number;
	leadershipPages?: string[];
}

/**
 * Internal structure for scraped person data
 */
interface ScrapedPersonData {
	name?: string;
	title?: string;
	company?: string;
	location?: string;
	bio?: string;
	linkedinUrl?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';
const COLLECTION_NAME = 'enrichment_cache';
const DEFAULT_CACHE_DAYS = 7; // 7-day TTL - contact data may change

/**
 * Common email providers to filter out for company domain extraction
 */
const COMMON_EMAIL_PROVIDERS = new Set([
	'gmail.com',
	'yahoo.com',
	'hotmail.com',
	'outlook.com',
	'aol.com',
	'icloud.com',
	'mail.com',
	'protonmail.com',
	'zoho.com',
	'yandex.com',
	'gmx.com',
	'live.com',
	'msn.com',
	'me.com',
	'mac.com'
]);

// ============================================================================
// Collection Accessor
// ============================================================================

/**
 * Get the Enrichment Cache collection
 */
async function getEnrichmentCacheCollection(): Promise<Collection<EnrichmentCacheDocument>> {
	const db = await getDatabase();
	return db.collection<EnrichmentCacheDocument>(COLLECTION_NAME);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string | null {
	const parts = email.split('@');
	if (parts.length !== 2) return null;

	const domain = parts[1].toLowerCase();

	// Filter out common email providers
	if (COMMON_EMAIL_PROVIDERS.has(domain)) {
		return null;
	}

	return domain;
}

/**
 * Extract LinkedIn username from URL
 */
function extractLinkedInUsername(url: string): string | null {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.includes('linkedin.com')) return null;

		// Handle /in/username format
		const match = parsed.pathname.match(/\/in\/([^/]+)/);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

/**
 * Generate cache key hash from lookup value
 */
function generateLookupHash(value: string): string {
	const normalized = value.toLowerCase().trim();
	return createHash('sha256').update(normalized).digest('hex');
}

// ============================================================================
// Caching
// ============================================================================

/**
 * Get cached enrichment result if available
 */
async function getCachedResult(lookupValue: string): Promise<EnrichmentCacheDocument | null> {
	try {
		const collection = await getEnrichmentCacheCollection();
		const lookupHash = generateLookupHash(lookupValue);

		const cached = await collection.findOneAndUpdate(
			{ lookupHash },
			{
				$inc: { hitCount: 1 },
				$set: { lastAccessedAt: new Date() }
			},
			{ returnDocument: 'after' }
		);

		return cached;
	} catch (error) {
		console.error('[firecrawl-enrich] Cache lookup error:', error);
		return null;
	}
}

/**
 * Cache enrichment result to MongoDB
 */
async function cacheResult(
	lookupValue: string,
	lookupType: 'email' | 'linkedin',
	person: EnrichedPerson,
	contact: EnrichedContact,
	company: EnrichedCompany | undefined,
	sources: string[]
): Promise<void> {
	try {
		const collection = await getEnrichmentCacheCollection();
		const lookupHash = generateLookupHash(lookupValue);
		const now = new Date();

		await collection.updateOne(
			{ lookupHash },
			{
				$set: {
					lookupValue,
					lookupType,
					person,
					contact,
					company,
					sources,
					updatedAt: now,
					expiresAt: createTTL(DEFAULT_CACHE_DAYS)
				},
				$setOnInsert: {
					lookupHash,
					createdAt: now,
					hitCount: 0
				}
			},
			{ upsert: true }
		);

		console.log('[firecrawl-enrich] Cached enrichment result:', {
			lookupType,
			person: person.name,
			company: company?.name
		});
	} catch (error) {
		console.error('[firecrawl-enrich] Cache write error:', error);
		// Don't throw - caching failure shouldn't break the flow
	}
}

// ============================================================================
// Firecrawl API Calls
// ============================================================================

/**
 * Scrape a URL using Firecrawl
 */
async function scrapeUrl(url: string): Promise<{ content: string; title?: string } | null> {
	const apiKey = process.env.FIRECRAWL_API_KEY;

	if (!apiKey) {
		console.error('[firecrawl-enrich] Firecrawl API key not configured');
		return null;
	}

	try {
		const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				url,
				formats: ['markdown'],
				onlyMainContent: true
			})
		});

		if (response.status === 429) {
			console.warn('[firecrawl-enrich] Rate limited by Firecrawl');
			return null;
		}

		if (!response.ok) {
			console.error('[firecrawl-enrich] Scrape failed:', response.status);
			return null;
		}

		const data = await response.json();

		if (!data.success || !data.data) {
			return null;
		}

		return {
			content: data.data.markdown || '',
			title: data.data.metadata?.title
		};
	} catch (error) {
		console.error('[firecrawl-enrich] Scrape error:', error);
		return null;
	}
}

/**
 * Search for information using Firecrawl search API
 */
async function searchWeb(query: string, limit = 5): Promise<Array<{ url: string; content: string }>> {
	const apiKey = process.env.FIRECRAWL_API_KEY;

	if (!apiKey) {
		console.error('[firecrawl-enrich] Firecrawl API key not configured');
		return [];
	}

	try {
		const response = await fetch(`${FIRECRAWL_BASE_URL}/search`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				query,
				limit,
				scrapeOptions: {
					formats: ['markdown'],
					onlyMainContent: true
				}
			})
		});

		if (response.status === 429) {
			console.warn('[firecrawl-enrich] Rate limited by Firecrawl');
			return [];
		}

		if (!response.ok) {
			console.error('[firecrawl-enrich] Search failed:', response.status);
			return [];
		}

		const data = await response.json();

		if (!data.success || !data.data) {
			return [];
		}

		return data.data.map((item: { url: string; markdown?: string }) => ({
			url: item.url,
			content: item.markdown || ''
		}));
	} catch (error) {
		console.error('[firecrawl-enrich] Search error:', error);
		return [];
	}
}

// ============================================================================
// Data Gathering
// ============================================================================

/**
 * Gather company data from domain
 */
async function gatherCompanyData(domain: string): Promise<ScrapedCompanyData> {
	const companyData: ScrapedCompanyData = {
		domain
	};

	// Try to scrape the company homepage
	const homepageUrl = `https://${domain}`;
	const homepage = await scrapeUrl(homepageUrl);

	if (homepage) {
		companyData.name = homepage.title?.split('|')[0]?.trim() || homepage.title?.split('-')[0]?.trim();
	}

	// Try about page
	const aboutUrls = [`https://${domain}/about`, `https://${domain}/about-us`, `https://${domain}/company`];

	for (const aboutUrl of aboutUrls) {
		const aboutPage = await scrapeUrl(aboutUrl);
		if (aboutPage?.content) {
			// We'll use LLM to extract structured data later
			companyData.description = aboutPage.content.substring(0, 5000);
			break;
		}
	}

	// Search for additional company info
	const searchResults = await searchWeb(`"${domain}" company information`, 3);
	if (searchResults.length > 0) {
		// Append search results for LLM processing
		if (!companyData.description) {
			companyData.description = searchResults
				.map((r) => r.content)
				.join('\n\n')
				.substring(0, 5000);
		}
	}

	return companyData;
}

/**
 * Gather person data from LinkedIn URL
 */
async function gatherLinkedInData(linkedinUrl: string): Promise<ScrapedPersonData> {
	const personData: ScrapedPersonData = {
		linkedinUrl
	};

	// Note: LinkedIn blocks most scraping, so we use search instead
	const username = extractLinkedInUsername(linkedinUrl);
	if (!username) {
		return personData;
	}

	// Search for public information about this person
	const searchResults = await searchWeb(`"${username}" linkedin site:linkedin.com`, 3);

	if (searchResults.length > 0) {
		// Collect content for LLM processing
		personData.bio = searchResults
			.map((r) => r.content)
			.join('\n\n')
			.substring(0, 5000);
	}

	// Also search for the person's name + company for broader context
	const contextResults = await searchWeb(`"${username}" professional profile`, 2);
	if (contextResults.length > 0) {
		personData.bio = (personData.bio || '') + '\n\n' + contextResults.map((r) => r.content).join('\n\n');
		personData.bio = personData.bio.substring(0, 8000);
	}

	return personData;
}

/**
 * Gather person data from email (search-based)
 */
async function gatherPersonDataFromEmail(email: string): Promise<ScrapedPersonData> {
	const personData: ScrapedPersonData = {};

	// Search for the email to find public profiles
	const searchResults = await searchWeb(`"${email}" professional profile OR linkedin`, 5);

	if (searchResults.length > 0) {
		personData.bio = searchResults
			.map((r) => r.content)
			.join('\n\n')
			.substring(0, 8000);

		// Check if any results are LinkedIn
		const linkedinResult = searchResults.find((r) => r.url.includes('linkedin.com'));
		if (linkedinResult) {
			personData.linkedinUrl = linkedinResult.url;
		}
	}

	return personData;
}

// ============================================================================
// LLM Synthesis
// ============================================================================

/**
 * Synthesize enriched data using Gemini
 */
async function synthesizeEnrichmentData(
	lookupValue: string,
	lookupType: 'email' | 'linkedin',
	personData: ScrapedPersonData,
	companyData: ScrapedCompanyData | null,
	includeCompany: boolean
): Promise<{
	person: EnrichedPerson;
	contact: EnrichedContact;
	company?: EnrichedCompany;
}> {
	const systemPrompt = `You are a data extraction assistant. Extract structured contact information from the provided web content.

IMPORTANT RULES:
1. Only extract information that is clearly stated - do not infer or guess
2. If information is not available, omit the field entirely (use null)
3. For names, use proper capitalization
4. For locations, use "City, State" or "City, Country" format
5. For company size, use ranges like "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
6. Return ONLY valid JSON - no explanations

OUTPUT FORMAT (JSON):
{
  "person": {
    "name": "Full Name",
    "title": "Job Title or null",
    "company": "Company Name or null",
    "location": "City, State/Country or null",
    "bio": "Brief professional summary or null"
  },
  "contact": {
    "email": "email@example.com or null",
    "phone": "phone number or null",
    "linkedin": "LinkedIn URL or null",
    "twitter": "Twitter handle or null"
  },
  "company": {
    "name": "Company Name",
    "domain": "company.com",
    "industry": "Industry or null",
    "size": "Employee range or null",
    "description": "Brief description or null",
    "headquarters": "City, State/Country or null",
    "yearFounded": 2000
  }
}

If includeCompany is false, omit the company field entirely.`;

	const userPrompt = `Extract contact information for the following lookup:

Lookup Type: ${lookupType}
Lookup Value: ${lookupValue}
Include Company: ${includeCompany}

PERSON DATA:
${JSON.stringify(personData, null, 2)}

${companyData ? `COMPANY DATA:\n${JSON.stringify(companyData, null, 2)}` : ''}

Extract and return the structured data as JSON.`;

	try {
		const response = await generate(userPrompt, {
			systemInstruction: systemPrompt,
			temperature: 0.1,
			responseSchema: {
				type: 'object',
				properties: {
					person: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							title: { type: 'string' },
							company: { type: 'string' },
							location: { type: 'string' },
							bio: { type: 'string' }
						},
						required: ['name']
					},
					contact: {
						type: 'object',
						properties: {
							email: { type: 'string' },
							phone: { type: 'string' },
							linkedin: { type: 'string' },
							twitter: { type: 'string' }
						}
					},
					company: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							domain: { type: 'string' },
							industry: { type: 'string' },
							size: { type: 'string' },
							description: { type: 'string' },
							headquarters: { type: 'string' },
							yearFounded: { type: 'integer' }
						}
					}
				},
				required: ['person', 'contact']
			}
		});

		const text = response.text;
		if (!text) {
			throw new Error('Empty response from Gemini');
		}

		const result = JSON.parse(text) as {
			person: EnrichedPerson;
			contact: EnrichedContact;
			company?: EnrichedCompany;
		};

		// Set known values that might not be in the scraped data
		if (lookupType === 'email' && !result.contact.email) {
			result.contact.email = lookupValue;
		}
		if (lookupType === 'linkedin' && !result.contact.linkedin) {
			result.contact.linkedin = lookupValue;
		}
		if (companyData?.domain && result.company) {
			result.company.domain = companyData.domain;
		}

		return result;
	} catch (error) {
		console.error('[firecrawl-enrich] LLM synthesis error:', error);

		// Return minimal data on error
		return {
			person: {
				name: 'Unknown',
				company: companyData?.name
			},
			contact: {
				email: lookupType === 'email' ? lookupValue : undefined,
				linkedin: lookupType === 'linkedin' ? lookupValue : undefined
			},
			company: includeCompany && companyData
				? {
						name: companyData.name || 'Unknown',
						domain: companyData.domain || ''
					}
				: undefined
		};
	}
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Enrich contact information from email or LinkedIn URL
 *
 * This function:
 * 1. Checks cache for existing enrichment
 * 2. Gathers data from web sources using Firecrawl
 * 3. Synthesizes structured data using Gemini LLM
 * 4. Caches the result for future lookups
 *
 * @param options - Enrichment options (email or linkedinUrl required)
 * @returns EnrichResult with person, contact, and company data
 *
 * @example
 * ```typescript
 * // Enrich from email
 * const result = await enrichContact({
 *   email: 'john.smith@company.com',
 *   includeCompany: true
 * });
 *
 * console.log(result.person.name);
 * console.log(result.company?.industry);
 *
 * // Enrich from LinkedIn
 * const result = await enrichContact({
 *   linkedinUrl: 'https://www.linkedin.com/in/johnsmith'
 * });
 * ```
 */
export async function enrichContact(options: EnrichOptions): Promise<EnrichResult> {
	const { email, linkedinUrl, includeCompany = true } = options;

	// Validate input
	if (!email && !linkedinUrl) {
		return {
			success: false,
			person: { name: 'Unknown' },
			contact: {},
			cached: false,
			error: 'Either email or linkedinUrl is required'
		};
	}

	// Determine lookup value and type
	const lookupValue = email || linkedinUrl!;
	const lookupType: 'email' | 'linkedin' = email ? 'email' : 'linkedin';

	console.log('[firecrawl-enrich] enrichContact called:', {
		lookupType,
		lookupValue: lookupValue.substring(0, 30) + '...',
		includeCompany
	});

	// Check cache first
	const cached = await getCachedResult(lookupValue);
	if (cached) {
		console.log('[firecrawl-enrich] Cache hit:', {
			person: cached.person.name,
			company: cached.company?.name,
			ageHours: Math.round((Date.now() - cached.createdAt.getTime()) / (1000 * 60 * 60))
		});

		return {
			success: true,
			person: cached.person,
			contact: cached.contact,
			company: includeCompany ? cached.company : undefined,
			cached: true,
			sources: cached.sources
		};
	}

	// Gather data based on lookup type
	const sources: string[] = [];
	let personData: ScrapedPersonData;
	let companyData: ScrapedCompanyData | null = null;

	if (lookupType === 'email') {
		// Extract domain and gather company data
		const domain = extractDomainFromEmail(email!);

		if (domain && includeCompany) {
			console.log('[firecrawl-enrich] Gathering company data for domain:', domain);
			companyData = await gatherCompanyData(domain);
			sources.push(`https://${domain}`);
		}

		// Search for person data using email
		console.log('[firecrawl-enrich] Gathering person data from email');
		personData = await gatherPersonDataFromEmail(email!);
	} else {
		// Gather LinkedIn data
		console.log('[firecrawl-enrich] Gathering LinkedIn data');
		personData = await gatherLinkedInData(linkedinUrl!);
		sources.push(linkedinUrl!);

		// If we found company info in LinkedIn, try to gather more company data
		if (includeCompany && personData.company) {
			const companySearchResults = await searchWeb(`"${personData.company}" company information`, 2);
			if (companySearchResults.length > 0) {
				companyData = {
					name: personData.company,
					description: companySearchResults.map((r) => r.content).join('\n\n')
				};
			}
		}
	}

	// Check if we have any data to process
	if (!personData.bio && !companyData?.description) {
		console.warn('[firecrawl-enrich] No data found for lookup:', lookupValue);
		return {
			success: false,
			person: { name: 'Unknown' },
			contact: {
				email: lookupType === 'email' ? lookupValue : undefined,
				linkedin: lookupType === 'linkedin' ? lookupValue : undefined
			},
			cached: false,
			error: 'Could not find sufficient data for enrichment'
		};
	}

	// Synthesize data using LLM
	console.log('[firecrawl-enrich] Synthesizing enrichment data');
	const synthesized = await synthesizeEnrichmentData(
		lookupValue,
		lookupType,
		personData,
		companyData,
		includeCompany
	);

	// Cache the result
	await cacheResult(
		lookupValue,
		lookupType,
		synthesized.person,
		synthesized.contact,
		synthesized.company,
		sources
	);

	console.log('[firecrawl-enrich] Enrichment complete:', {
		person: synthesized.person.name,
		company: synthesized.company?.name,
		sourceCount: sources.length
	});

	return {
		success: true,
		person: synthesized.person,
		contact: synthesized.contact,
		company: synthesized.company,
		cached: false,
		sources
	};
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Check if enrichment result exists in cache
 *
 * @param lookupValue - Email or LinkedIn URL to check
 * @returns true if cached result exists and is not expired
 */
export async function hasEnrichmentCache(lookupValue: string): Promise<boolean> {
	try {
		const collection = await getEnrichmentCacheCollection();
		const lookupHash = generateLookupHash(lookupValue);
		const count = await collection.countDocuments({ lookupHash });
		return count > 0;
	} catch (error) {
		console.error('[firecrawl-enrich] Cache check error:', error);
		return false;
	}
}

/**
 * Invalidate cached enrichment result
 *
 * @param lookupValue - Email or LinkedIn URL to invalidate
 * @returns true if cache was invalidated
 */
export async function invalidateEnrichmentCache(lookupValue: string): Promise<boolean> {
	try {
		const collection = await getEnrichmentCacheCollection();
		const lookupHash = generateLookupHash(lookupValue);
		const result = await collection.deleteOne({ lookupHash });
		return result.deletedCount > 0;
	} catch (error) {
		console.error('[firecrawl-enrich] Cache invalidation error:', error);
		return false;
	}
}

/**
 * Get cache statistics for enrichment results
 */
export async function getEnrichmentCacheStats(): Promise<{
	totalEntries: number;
	emailLookups: number;
	linkedinLookups: number;
	avgHitCount: number;
	oldestEntry?: Date;
	newestEntry?: Date;
}> {
	try {
		const collection = await getEnrichmentCacheCollection();

		const [stats] = await collection
			.aggregate([
				{
					$facet: {
						totals: [
							{
								$group: {
									_id: null,
									totalEntries: { $sum: 1 },
									avgHitCount: { $avg: '$hitCount' },
									oldestEntry: { $min: '$createdAt' },
									newestEntry: { $max: '$createdAt' }
								}
							}
						],
						byType: [
							{
								$group: {
									_id: '$lookupType',
									count: { $sum: 1 }
								}
							}
						]
					}
				}
			])
			.toArray();

		const totals = stats?.totals?.[0] || {};
		const byType = stats?.byType || [];

		const emailCount = byType.find((t: { _id: string; count: number }) => t._id === 'email')?.count || 0;
		const linkedinCount = byType.find((t: { _id: string; count: number }) => t._id === 'linkedin')?.count || 0;

		return {
			totalEntries: totals.totalEntries || 0,
			emailLookups: emailCount,
			linkedinLookups: linkedinCount,
			avgHitCount: Math.round((totals.avgHitCount || 0) * 10) / 10,
			oldestEntry: totals.oldestEntry,
			newestEntry: totals.newestEntry
		};
	} catch (error) {
		console.error('[firecrawl-enrich] Cache stats error:', error);
		return {
			totalEntries: 0,
			emailLookups: 0,
			linkedinLookups: 0,
			avgHitCount: 0
		};
	}
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Ensure indexes exist for the enrichment cache collection
 * Should be called on server startup
 */
export async function ensureEnrichmentCacheIndexes(): Promise<void> {
	try {
		const collection = await getEnrichmentCacheCollection();

		console.log('[firecrawl-enrich] Creating enrichment cache indexes...');

		// TTL index for automatic cleanup
		await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expiresAt' });

		// Unique index on lookup hash for deduplication
		await collection.createIndex({ lookupHash: 1 }, { unique: true, name: 'unique_lookupHash' });

		// Index on lookup type for analytics
		await collection.createIndex({ lookupType: 1 }, { name: 'idx_lookupType' });

		// Index on hit count for cache statistics
		await collection.createIndex(
			{ hitCount: -1, lastAccessedAt: -1 },
			{ name: 'idx_hitCount_lastAccessed' }
		);

		// Index on company name for company-based queries
		await collection.createIndex({ 'company.name': 1 }, { sparse: true, name: 'idx_companyName' });

		console.log('[firecrawl-enrich] Enrichment cache indexes created');
	} catch (error) {
		console.error('[firecrawl-enrich] Index creation error:', error);
	}
}
