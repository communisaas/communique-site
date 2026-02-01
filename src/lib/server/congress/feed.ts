/**
 * Congress.gov Legislative Feed Ingestion
 *
 * Proactive legislative feed ingestion with:
 * - Scheduled polling for new/updated bills
 * - Voyage AI embeddings (voyage-law-2 for legal text)
 * - MongoDB caching with vector search
 * - Progressive disclosure summaries (L1 one-line impact)
 *
 * Phase 2E Implementation
 *
 * @module congress/feed
 */

import { createHash } from 'crypto';
import type { Collection, ObjectId } from 'mongodb';
import {
	fetchRecentBills,
	fetchBillDetails,
	getBillsUpdatedSince,
	getCurrentCongress,
	getRateLimitStatus,
	type Bill,
	type BillDetails,
	type BillType
} from './client';
import { createEmbedding, createBatchEmbeddings } from '../embeddings';
import { getDatabase } from '../mongodb';
import type { IntelligenceItemDocument } from '../mongodb/schema';
import { COLLECTIONS } from '../mongodb/schema';

// ============================================================================
// Configuration
// ============================================================================

/** Default cache TTL for bills (90 days) */
const BILL_CACHE_TTL_DAYS = 90;

/** Maximum bills to process per ingestion run */
const MAX_BILLS_PER_RUN = 50;

/** Batch size for embedding generation */
const EMBEDDING_BATCH_SIZE = 10;

/** Collection name for legislative bills cache */
export const BILLS_COLLECTION = 'legislative_bills';

// ============================================================================
// Types
// ============================================================================

/**
 * MongoDB document for cached legislative bills
 */
export interface LegislativeBillDocument {
	_id?: ObjectId;
	/** Unique bill identifier (congress-type-number) */
	billId: string;
	/** SHA-256 hash of billId for deduplication */
	billIdHash: string;
	/** Congress number */
	congress: number;
	/** Bill type */
	type: BillType;
	/** Bill number */
	number: string;
	/** Full bill title */
	title: string;
	/** Bill sponsor */
	sponsor: string;
	/** Current status */
	status: string;
	/** Chamber of origin */
	chamber: 'house' | 'senate';
	/** Date introduced */
	introducedDate: Date;
	/** Latest action date */
	latestActionDate?: Date;
	/** Latest action description */
	latestAction?: string;
	/** Policy area/topic */
	policyArea?: string;
	/** Number of cosponsors */
	cosponsorsCount?: number;
	/** Congress.gov URL */
	congressUrl: string;
	/** Full bill summary (if available) */
	summary?: string;
	/** Full text URL */
	fullTextUrl?: string;

	// ============================================================================
	// Progressive Disclosure Summaries
	// ============================================================================

	/** L1: One-line impact summary (generated) */
	l1Summary?: string;
	/** L2: Key provisions summary (generated on demand) */
	l2Summary?: string;
	/** L3: Full analysis reference (document ID) */
	l3DocumentId?: string;

	// ============================================================================
	// Vector Search
	// ============================================================================

	/** Voyage AI embedding (voyage-law-2, 1024 dimensions) */
	embedding?: number[];
	/** Text used for embedding generation */
	embeddingText?: string;

	// ============================================================================
	// Metadata
	// ============================================================================

	/** When first ingested */
	createdAt: Date;
	/** Last update */
	updatedAt: Date;
	/** TTL for cache expiration */
	expiresAt: Date;
	/** Source of data */
	source: 'congress.gov';
	/** Last sync timestamp */
	lastSyncedAt: Date;
	/** Version hash for change detection */
	versionHash: string;
}

/**
 * Ingestion run statistics
 */
export interface IngestionStats {
	/** Number of bills fetched from API */
	fetched: number;
	/** Number of new bills added */
	added: number;
	/** Number of existing bills updated */
	updated: number;
	/** Number of bills unchanged (skipped) */
	skipped: number;
	/** Number of embeddings generated */
	embeddingsGenerated: number;
	/** Number of L1 summaries generated */
	l1SummariesGenerated: number;
	/** Run duration in milliseconds */
	duration: number;
	/** Errors encountered */
	errors: string[];
	/** Rate limit status after run */
	rateLimitStatus: ReturnType<typeof getRateLimitStatus>;
}

/**
 * Options for feed ingestion
 */
export interface IngestionOptions {
	/** Congress number (defaults to current) */
	congress?: number;
	/** Chamber filter */
	chamber?: 'house' | 'senate';
	/** Bill type filter */
	type?: BillType;
	/** Maximum bills to process */
	limit?: number;
	/** Only fetch bills updated since this date */
	since?: Date;
	/** Generate embeddings for bills */
	generateEmbeddings?: boolean;
	/** Generate L1 summaries for bills */
	generateL1Summaries?: boolean;
	/** Force update even if unchanged */
	forceUpdate?: boolean;
}

// ============================================================================
// MongoDB Collection Access
// ============================================================================

let billsCollection: Collection<LegislativeBillDocument> | null = null;

/**
 * Get the legislative bills collection
 */
export async function getBillsCollection(): Promise<Collection<LegislativeBillDocument>> {
	if (billsCollection) return billsCollection;

	const db = await getDatabase();
	billsCollection = db.collection<LegislativeBillDocument>(BILLS_COLLECTION);

	// Ensure indexes exist
	await ensureIndexes(billsCollection);

	return billsCollection;
}

/**
 * Ensure required indexes exist on the bills collection
 */
async function ensureIndexes(collection: Collection<LegislativeBillDocument>): Promise<void> {
	try {
		// Unique index on billIdHash
		await collection.createIndex({ billIdHash: 1 }, { unique: true });

		// TTL index for automatic cleanup
		await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

		// Search indexes
		await collection.createIndex({ congress: 1, type: 1, chamber: 1 });
		await collection.createIndex({ policyArea: 1 });
		await collection.createIndex({ introducedDate: -1 });
		await collection.createIndex({ updatedAt: -1 });

		// Text index for search
		await collection.createIndex(
			{ title: 'text', summary: 'text', l1Summary: 'text' },
			{ name: 'bills_text_search' }
		);

		console.log('[Congress Feed] Indexes ensured on bills collection');
	} catch (error) {
		// Index creation errors are usually fine (already exists)
		console.log('[Congress Feed] Index creation note:', error);
	}
}

// ============================================================================
// L1 Summary Generation
// ============================================================================

/**
 * Generate a one-line impact summary (L1) for a bill
 *
 * This creates a concise, citizen-focused summary that answers:
 * "What does this bill mean for me?"
 *
 * @param bill - Bill information
 * @returns One-line impact summary
 */
export function generateL1Summary(bill: Bill | BillDetails): string {
	// Extract key information
	const { title, policyArea, status, chamber, sponsor } = bill;

	// Detect bill category for impact framing
	const category = detectBillCategory(title, policyArea);

	// Generate impact-focused summary
	const impactPhrase = getImpactPhrase(category, title);
	const statusPhrase = getStatusPhrase(status, chamber);

	// Build L1 summary (max ~150 chars for readability)
	const summary = `${impactPhrase} ${statusPhrase}`;

	// Truncate if needed while preserving meaning
	if (summary.length > 200) {
		return summary.substring(0, 197) + '...';
	}

	return summary;
}

/**
 * Detect the category of a bill based on title and policy area
 */
function detectBillCategory(
	title: string,
	policyArea?: string
): 'healthcare' | 'tax' | 'environment' | 'education' | 'defense' | 'immigration' | 'general' {
	const combined = `${title} ${policyArea || ''}`.toLowerCase();

	if (
		combined.includes('health') ||
		combined.includes('medicare') ||
		combined.includes('medicaid') ||
		combined.includes('medical')
	) {
		return 'healthcare';
	}
	if (combined.includes('tax') || combined.includes('irs') || combined.includes('revenue')) {
		return 'tax';
	}
	if (
		combined.includes('environment') ||
		combined.includes('climate') ||
		combined.includes('energy') ||
		combined.includes('epa')
	) {
		return 'environment';
	}
	if (
		combined.includes('education') ||
		combined.includes('school') ||
		combined.includes('student')
	) {
		return 'education';
	}
	if (combined.includes('defense') || combined.includes('military') || combined.includes('armed')) {
		return 'defense';
	}
	if (
		combined.includes('immigration') ||
		combined.includes('border') ||
		combined.includes('visa')
	) {
		return 'immigration';
	}

	return 'general';
}

/**
 * Get an impact phrase based on bill category
 */
function getImpactPhrase(
	category: ReturnType<typeof detectBillCategory>,
	title: string
): string {
	// Simplify title for summary
	const simplifiedTitle = simplifyTitle(title);

	switch (category) {
		case 'healthcare':
			return `Healthcare: ${simplifiedTitle} could affect your medical coverage or costs.`;
		case 'tax':
			return `Taxes: ${simplifiedTitle} may impact your tax obligations or refunds.`;
		case 'environment':
			return `Environment: ${simplifiedTitle} addresses climate or energy policy.`;
		case 'education':
			return `Education: ${simplifiedTitle} could affect schools or student programs.`;
		case 'defense':
			return `Defense: ${simplifiedTitle} relates to military or national security.`;
		case 'immigration':
			return `Immigration: ${simplifiedTitle} may change immigration policies.`;
		default:
			return `${simplifiedTitle}`;
	}
}

/**
 * Simplify a bill title for summary use
 */
function simplifyTitle(title: string): string {
	// Remove common prefixes
	let simplified = title
		.replace(/^(A bill |To |An act )/i, '')
		.replace(/\.$/, '')
		.trim();

	// Capitalize first letter
	simplified = simplified.charAt(0).toUpperCase() + simplified.slice(1);

	// Truncate if too long
	if (simplified.length > 80) {
		const cutoff = simplified.lastIndexOf(' ', 77);
		simplified = simplified.substring(0, cutoff > 0 ? cutoff : 77) + '...';
	}

	return simplified;
}

/**
 * Get a status phrase for the bill
 */
function getStatusPhrase(status: string, chamber: 'house' | 'senate'): string {
	const statusLower = status.toLowerCase();
	const chamberName = chamber === 'house' ? 'House' : 'Senate';

	if (statusLower.includes('became law') || statusLower.includes('signed by president')) {
		return 'Now law.';
	}
	if (statusLower.includes('passed') && statusLower.includes('senate')) {
		return 'Passed Senate.';
	}
	if (statusLower.includes('passed') && statusLower.includes('house')) {
		return 'Passed House.';
	}
	if (statusLower.includes('committee')) {
		return `In ${chamberName} committee.`;
	}
	if (statusLower.includes('introduced')) {
		return `Introduced in ${chamberName}.`;
	}

	return `Status: ${status.substring(0, 50)}${status.length > 50 ? '...' : ''}`;
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding text for a bill
 * Combines relevant fields for optimal semantic search
 */
function generateEmbeddingText(bill: Bill | LegislativeBillDocument): string {
	const parts = [
		bill.title,
		bill.policyArea ? `Policy Area: ${bill.policyArea}` : '',
		bill.status ? `Status: ${bill.status}` : '',
		'summary' in bill && bill.summary ? bill.summary : '',
		'l1Summary' in bill && bill.l1Summary ? bill.l1Summary : ''
	].filter(Boolean);

	return parts.join('\n\n');
}

/**
 * Generate embeddings for a batch of bills
 */
async function generateBillEmbeddings(
	bills: LegislativeBillDocument[]
): Promise<Map<string, number[]>> {
	const embeddingMap = new Map<string, number[]>();

	// Filter bills that need embeddings
	const billsNeedingEmbeddings = bills.filter((b) => !b.embedding);

	if (billsNeedingEmbeddings.length === 0) {
		return embeddingMap;
	}

	console.log(`[Congress Feed] Generating embeddings for ${billsNeedingEmbeddings.length} bills`);

	// Generate embedding texts
	const texts = billsNeedingEmbeddings.map(generateEmbeddingText);

	try {
		// Use voyage-law-2 for legislative content (6-10% better accuracy)
		const embeddings = await createBatchEmbeddings(texts, {
			contentType: 'legislative',
			batchSize: EMBEDDING_BATCH_SIZE,
			showProgress: true
		});

		// Map embeddings back to bill IDs
		for (let i = 0; i < billsNeedingEmbeddings.length; i++) {
			embeddingMap.set(billsNeedingEmbeddings[i].billId, embeddings[i]);
		}

		console.log(`[Congress Feed] Generated ${embeddings.length} embeddings`);
	} catch (error) {
		console.error('[Congress Feed] Embedding generation failed:', error);
	}

	return embeddingMap;
}

// ============================================================================
// Feed Ingestion
// ============================================================================

/**
 * Calculate a version hash for change detection
 */
function calculateVersionHash(bill: Bill): string {
	const hashInput = [bill.title, bill.status, bill.latestAction, bill.cosponsorsCount].join('|');

	return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

/**
 * Transform a Bill to a LegislativeBillDocument
 */
function billToDocument(bill: Bill, existingDoc?: LegislativeBillDocument): LegislativeBillDocument {
	const now = new Date();
	const billId = `${bill.congress}-${bill.type}-${bill.number.replace(/\D/g, '')}`;
	const billIdHash = createHash('sha256').update(billId).digest('hex');

	return {
		_id: existingDoc?._id,
		billId,
		billIdHash,
		congress: bill.congress,
		type: bill.type,
		number: bill.number,
		title: bill.title,
		sponsor: bill.sponsor,
		status: bill.status,
		chamber: bill.chamber,
		introducedDate: bill.introducedDate,
		latestActionDate: bill.latestActionDate,
		latestAction: bill.latestAction,
		policyArea: bill.policyArea,
		cosponsorsCount: bill.cosponsorsCount,
		congressUrl: bill.congressUrl,
		summary: bill.summary,
		fullTextUrl: bill.fullTextUrl,

		// Preserve existing summaries or generate new
		l1Summary: existingDoc?.l1Summary || generateL1Summary(bill),
		l2Summary: existingDoc?.l2Summary,
		l3DocumentId: existingDoc?.l3DocumentId,

		// Preserve existing embedding if bill unchanged
		embedding: existingDoc?.embedding,
		embeddingText: existingDoc?.embeddingText,

		createdAt: existingDoc?.createdAt || now,
		updatedAt: now,
		expiresAt: new Date(now.getTime() + BILL_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
		source: 'congress.gov',
		lastSyncedAt: now,
		versionHash: calculateVersionHash(bill)
	};
}

/**
 * Run legislative feed ingestion
 *
 * Fetches recent bills from Congress.gov, stores them in MongoDB,
 * generates embeddings, and creates L1 summaries.
 *
 * @param options - Ingestion options
 * @returns Statistics about the ingestion run
 *
 * @example
 * // Ingest recent bills with full processing
 * const stats = await ingestLegislativeFeed({
 *   generateEmbeddings: true,
 *   generateL1Summaries: true
 * });
 *
 * // Incremental update since last run
 * const stats = await ingestLegislativeFeed({
 *   since: lastRunDate,
 *   generateEmbeddings: true
 * });
 */
export async function ingestLegislativeFeed(options: IngestionOptions = {}): Promise<IngestionStats> {
	const startTime = Date.now();
	const stats: IngestionStats = {
		fetched: 0,
		added: 0,
		updated: 0,
		skipped: 0,
		embeddingsGenerated: 0,
		l1SummariesGenerated: 0,
		duration: 0,
		errors: [],
		rateLimitStatus: getRateLimitStatus()
	};

	const {
		congress = getCurrentCongress(),
		chamber,
		type,
		limit = MAX_BILLS_PER_RUN,
		since,
		generateEmbeddings = true,
		generateL1Summaries = true,
		forceUpdate = false
	} = options;

	try {
		console.log(`[Congress Feed] Starting ingestion for Congress ${congress}`);

		// Fetch bills from API
		const bills = since
			? await getBillsUpdatedSince(since, { congress, chamber, type, limit })
			: await fetchRecentBills({ congress, chamber, type, limit });

		stats.fetched = bills.length;
		console.log(`[Congress Feed] Fetched ${bills.length} bills from Congress.gov`);

		if (bills.length === 0) {
			stats.duration = Date.now() - startTime;
			return stats;
		}

		// Get MongoDB collection
		const collection = await getBillsCollection();

		// Process bills
		const documentsToInsert: LegislativeBillDocument[] = [];
		const documentsToUpdate: LegislativeBillDocument[] = [];

		for (const bill of bills) {
			const billId = `${bill.congress}-${bill.type}-${bill.number.replace(/\D/g, '')}`;
			const billIdHash = createHash('sha256').update(billId).digest('hex');

			// Check for existing document
			const existingDoc = await collection.findOne({ billIdHash });
			const versionHash = calculateVersionHash(bill);

			if (existingDoc) {
				// Check if bill has changed
				if (!forceUpdate && existingDoc.versionHash === versionHash) {
					stats.skipped++;
					continue;
				}

				// Bill changed, prepare update
				const doc = billToDocument(bill, existingDoc);

				// Generate L1 summary if needed
				if (generateL1Summaries && !doc.l1Summary) {
					doc.l1Summary = generateL1Summary(bill);
					stats.l1SummariesGenerated++;
				}

				documentsToUpdate.push(doc);
				stats.updated++;
			} else {
				// New bill
				const doc = billToDocument(bill);

				// Generate L1 summary
				if (generateL1Summaries) {
					doc.l1Summary = generateL1Summary(bill);
					stats.l1SummariesGenerated++;
				}

				documentsToInsert.push(doc);
				stats.added++;
			}
		}

		// Generate embeddings for new/updated bills
		if (generateEmbeddings) {
			const allDocs = [...documentsToInsert, ...documentsToUpdate];
			const embeddingMap = await generateBillEmbeddings(allDocs);

			// Apply embeddings to documents
			for (const doc of allDocs) {
				const embedding = embeddingMap.get(doc.billId);
				if (embedding) {
					doc.embedding = embedding;
					doc.embeddingText = generateEmbeddingText(doc);
					stats.embeddingsGenerated++;
				}
			}
		}

		// Bulk insert new bills
		if (documentsToInsert.length > 0) {
			await collection.insertMany(documentsToInsert);
			console.log(`[Congress Feed] Inserted ${documentsToInsert.length} new bills`);
		}

		// Bulk update existing bills
		for (const doc of documentsToUpdate) {
			await collection.updateOne(
				{ billIdHash: doc.billIdHash },
				{
					$set: {
						title: doc.title,
						sponsor: doc.sponsor,
						status: doc.status,
						latestActionDate: doc.latestActionDate,
						latestAction: doc.latestAction,
						policyArea: doc.policyArea,
						cosponsorsCount: doc.cosponsorsCount,
						summary: doc.summary,
						l1Summary: doc.l1Summary,
						embedding: doc.embedding,
						embeddingText: doc.embeddingText,
						updatedAt: doc.updatedAt,
						expiresAt: doc.expiresAt,
						lastSyncedAt: doc.lastSyncedAt,
						versionHash: doc.versionHash
					}
				}
			);
		}

		if (documentsToUpdate.length > 0) {
			console.log(`[Congress Feed] Updated ${documentsToUpdate.length} existing bills`);
		}

		// Also store as intelligence items for unified search
		await storeAsIntelligenceItems(documentsToInsert);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		stats.errors.push(errorMessage);
		console.error('[Congress Feed] Ingestion error:', error);
	}

	stats.duration = Date.now() - startTime;
	stats.rateLimitStatus = getRateLimitStatus();

	console.log(`[Congress Feed] Ingestion complete:`, {
		fetched: stats.fetched,
		added: stats.added,
		updated: stats.updated,
		skipped: stats.skipped,
		embeddingsGenerated: stats.embeddingsGenerated,
		duration: `${stats.duration}ms`
	});

	return stats;
}

/**
 * Store bills as intelligence items for unified search
 */
async function storeAsIntelligenceItems(bills: LegislativeBillDocument[]): Promise<void> {
	if (bills.length === 0) return;

	try {
		const db = await getDatabase();
		const collection = db.collection<IntelligenceItemDocument>(COLLECTIONS.INTELLIGENCE);

		const items: Omit<IntelligenceItemDocument, '_id'>[] = bills.map((bill) => ({
			category: 'legislative' as const,
			title: bill.title,
			source: 'Congress.gov',
			sourceUrl: bill.congressUrl,
			publishedAt: bill.introducedDate,
			snippet: bill.l1Summary || bill.title,
			topics: bill.policyArea ? [bill.policyArea] : [],
			entities: [bill.sponsor],
			embedding: bill.embedding,
			relevanceScore: 0.8, // Legislative content is high relevance
			geographicScope: 'national' as const,
			createdAt: new Date(),
			expiresAt: bill.expiresAt
		}));

		await collection.insertMany(items as IntelligenceItemDocument[]);
		console.log(`[Congress Feed] Stored ${items.length} bills as intelligence items`);
	} catch (error) {
		console.error('[Congress Feed] Failed to store intelligence items:', error);
	}
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get a bill by its ID
 */
export async function getBillById(billId: string): Promise<LegislativeBillDocument | null> {
	const collection = await getBillsCollection();
	const billIdHash = createHash('sha256').update(billId).digest('hex');

	return collection.findOne({ billIdHash });
}

/**
 * Search bills by text query
 */
export async function searchBills(
	query: string,
	options: {
		congress?: number;
		chamber?: 'house' | 'senate';
		policyArea?: string;
		limit?: number;
	} = {}
): Promise<LegislativeBillDocument[]> {
	const { congress, chamber, policyArea, limit = 20 } = options;

	const collection = await getBillsCollection();

	const filter: Record<string, unknown> = {
		$text: { $search: query }
	};

	if (congress) filter.congress = congress;
	if (chamber) filter.chamber = chamber;
	if (policyArea) filter.policyArea = policyArea;

	return collection
		.find(filter)
		.sort({ score: { $meta: 'textScore' } })
		.limit(limit)
		.toArray();
}

/**
 * Get recent bills by policy area
 */
export async function getBillsByPolicyArea(
	policyArea: string,
	limit = 10
): Promise<LegislativeBillDocument[]> {
	const collection = await getBillsCollection();

	return collection
		.find({ policyArea: { $regex: policyArea, $options: 'i' } })
		.sort({ introducedDate: -1 })
		.limit(limit)
		.toArray();
}

/**
 * Get feed statistics
 */
export async function getFeedStats(): Promise<{
	totalBills: number;
	byCongresss: { congress: number; count: number }[];
	byPolicyArea: { policyArea: string; count: number }[];
	lastIngestion?: Date;
	oldestBill?: Date;
	newestBill?: Date;
}> {
	const collection = await getBillsCollection();

	const [total, byCongress, byPolicyArea, oldest, newest, lastSync] = await Promise.all([
		collection.countDocuments(),
		collection
			.aggregate<{ _id: number; count: number }>([
				{ $group: { _id: '$congress', count: { $sum: 1 } } },
				{ $sort: { _id: -1 } }
			])
			.toArray(),
		collection
			.aggregate<{ _id: string; count: number }>([
				{ $match: { policyArea: { $exists: true, $ne: null } } },
				{ $group: { _id: '$policyArea', count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: 20 }
			])
			.toArray(),
		collection.findOne({}, { sort: { introducedDate: 1 }, projection: { introducedDate: 1 } }),
		collection.findOne({}, { sort: { introducedDate: -1 }, projection: { introducedDate: 1 } }),
		collection.findOne({}, { sort: { lastSyncedAt: -1 }, projection: { lastSyncedAt: 1 } })
	]);

	return {
		totalBills: total,
		byCongresss: byCongress.map((c) => ({ congress: c._id, count: c.count })),
		byPolicyArea: byPolicyArea.map((p) => ({ policyArea: p._id, count: p.count })),
		lastIngestion: lastSync?.lastSyncedAt,
		oldestBill: oldest?.introducedDate,
		newestBill: newest?.introducedDate
	};
}
