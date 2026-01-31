/**
 * Reducto Client
 *
 * API wrapper for Reducto document parsing with MongoDB caching.
 * Enables L3 depth layer with on-demand document analysis.
 *
 * @module reducto/client
 */

import { createHash } from 'crypto';
import type { Collection } from 'mongodb';
import type {
	ParsedDocument,
	ParseOptions,
	ParseResult,
	AnalyzeOptions,
	AnalysisResult,
	DocumentType,
	DocumentEntity,
	DocumentSection,
	RelevantPassage
} from './types';
import type { ParsedDocumentCacheDocument } from '../mongodb/schema';
import { getParsedDocumentsCollection } from '../mongodb/collections';

// ============================================================================
// Configuration
// ============================================================================

const REDUCTO_API_BASE = 'https://api.reducto.ai/v1';
const CACHE_TTL_DAYS = 30;

// ============================================================================
// Client Class
// ============================================================================

export class ReductoClient {
	private apiKey: string;
	private collection: Collection<ParsedDocumentCacheDocument> | null = null;
	private collectionPromise: Promise<Collection<ParsedDocumentCacheDocument>> | null = null;

	constructor(apiKey?: string) {
		this.apiKey = apiKey || process.env.REDUCTO_API_KEY || '';

		if (!this.apiKey) {
			console.warn('[ReductoClient] No API key provided - document parsing will be unavailable');
		}
	}

	/**
	 * Get the MongoDB collection for caching (lazy initialization)
	 */
	private async getCollection(): Promise<Collection<ParsedDocumentCacheDocument>> {
		if (this.collection) return this.collection;

		if (!this.collectionPromise) {
			this.collectionPromise = getParsedDocumentsCollection();
		}

		this.collection = await this.collectionPromise;
		return this.collection;
	}

	/**
	 * Parse a document from URL
	 *
	 * Checks cache first, then calls Reducto API if needed.
	 */
	async parse(options: ParseOptions): Promise<ParseResult> {
		const { url, type, query, extractEntities = true, detectCrossRefs = true } = options;

		// Check cache first
		const cached = await this.getFromCache(url);
		if (cached) {
			// If query provided, compute relevance on cached doc
			if (query && cached.document) {
				const relevance = await this.computeRelevance(cached.document, query);
				cached.document.queryRelevance = relevance;
			}
			return { success: true, document: cached.document, cached: true };
		}

		// Parse with Reducto
		try {
			const parsed = await this.callReductoAPI(url, {
				type,
				extractEntities,
				detectCrossRefs
			});

			// Cache the result
			if (parsed) {
				await this.saveToCache(url, parsed);

				// Compute relevance if query provided
				if (query) {
					parsed.queryRelevance = await this.computeRelevance(parsed, query);
				}
			}

			return { success: true, document: parsed, cached: false };
		} catch (error) {
			console.error('[ReductoClient] Parse failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				cached: false
			};
		}
	}

	/**
	 * Analyze a cached document against a query
	 */
	async analyze(options: AnalyzeOptions): Promise<AnalysisResult> {
		const { documentId, query, maxPassages = 5 } = options;

		// Get document from cache
		const doc = await this.getById(documentId);
		if (!doc) {
			return { success: false, error: 'Document not found in cache' };
		}

		try {
			const relevance = await this.computeRelevance(doc, query, maxPassages);
			return { success: true, relevance };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Analysis failed'
			};
		}
	}

	/**
	 * Get a parsed document by ID
	 */
	async getById(documentId: string): Promise<ParsedDocument | null> {
		try {
			const collection = await this.getCollection();
			const cached = await collection.findOne({ 'document.id': documentId });
			return cached?.document || null;
		} catch (error) {
			console.error('[ReductoClient] getById failed:', error);
			return null;
		}
	}

	/**
	 * Get a parsed document by source URL
	 */
	async getByUrl(url: string): Promise<ParsedDocument | null> {
		const urlHash = createHash('sha256').update(url).digest('hex');

		try {
			const collection = await this.getCollection();
			const cached = await collection.findOne({
				sourceUrlHash: urlHash,
				expiresAt: { $gt: new Date() }
			});
			return cached?.document || null;
		} catch (error) {
			console.error('[ReductoClient] getByUrl failed:', error);
			return null;
		}
	}

	/**
	 * Get documents by type
	 */
	async getByType(documentType: DocumentType, limit = 10): Promise<ParsedDocument[]> {
		try {
			const collection = await this.getCollection();
			const cached = await collection
				.find({
					documentType,
					expiresAt: { $gt: new Date() }
				})
				.sort({ createdAt: -1 })
				.limit(limit)
				.toArray();

			return cached.map((doc) => doc.document);
		} catch (error) {
			console.error('[ReductoClient] getByType failed:', error);
			return [];
		}
	}

	/**
	 * Get cache statistics
	 */
	async getCacheStats(): Promise<{
		totalDocuments: number;
		byType: Record<DocumentType, number>;
		oldestDocument?: Date;
		newestDocument?: Date;
	}> {
		try {
			const collection = await this.getCollection();

			const [total, byType, oldest, newest] = await Promise.all([
				collection.countDocuments({ expiresAt: { $gt: new Date() } }),
				collection
					.aggregate<{ _id: DocumentType; count: number }>([
						{ $match: { expiresAt: { $gt: new Date() } } },
						{ $group: { _id: '$documentType', count: { $sum: 1 } } }
					])
					.toArray(),
				collection.findOne({}, { sort: { createdAt: 1 }, projection: { createdAt: 1 } }),
				collection.findOne({}, { sort: { createdAt: -1 }, projection: { createdAt: 1 } })
			]);

			const typeCount: Record<DocumentType, number> = {
				legislative: 0,
				official: 0,
				media: 0,
				corporate: 0,
				academic: 0
			};

			for (const item of byType) {
				if (item._id) {
					typeCount[item._id] = item.count;
				}
			}

			return {
				totalDocuments: total,
				byType: typeCount,
				oldestDocument: oldest?.createdAt,
				newestDocument: newest?.createdAt
			};
		} catch (error) {
			console.error('[ReductoClient] getCacheStats failed:', error);
			return {
				totalDocuments: 0,
				byType: { legislative: 0, official: 0, media: 0, corporate: 0, academic: 0 }
			};
		}
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	/**
	 * Call Reducto API to parse document
	 */
	private async callReductoAPI(
		url: string,
		options: { type?: DocumentType; extractEntities: boolean; detectCrossRefs: boolean }
	): Promise<ParsedDocument> {
		if (!this.apiKey) {
			throw new Error('Reducto API key not configured');
		}

		// Call Reducto parse endpoint
		const response = await fetch(`${REDUCTO_API_BASE}/parse`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`
			},
			body: JSON.stringify({
				url,
				options: {
					extract_tables: true,
					extract_images: false, // Text-focused for now
					chunking_strategy: 'semantic'
				}
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Reducto API error (${response.status}): ${error}`);
		}

		const result = await response.json();

		// Transform Reducto response to our format
		return this.transformReductoResponse(result, url, options.type);
	}

	/**
	 * Transform Reducto API response to our ParsedDocument format
	 */
	private transformReductoResponse(
		result: any,
		sourceUrl: string,
		typeHint?: DocumentType
	): ParsedDocument {
		const docType = typeHint || this.inferDocumentType(sourceUrl, result);

		// Extract sections from Reducto chunks
		const sections = this.extractSections(result.chunks || result.elements || []);

		// Extract entities from Reducto
		const entities = this.extractEntities(result.entities || []);

		return {
			id: result.job_id || createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16),
			title: result.title || result.metadata?.title || 'Untitled Document',
			source: {
				name: this.inferSourceName(sourceUrl),
				url: sourceUrl,
				date: result.metadata?.date,
				type: docType
			},
			type: docType,
			sections,
			entities,
			crossRefs: [], // TODO: Extract cross-references
			metadata: {
				parsedAt: new Date(),
				sourceUrl,
				pageCount: result.metadata?.page_count || sections.length,
				reductoJobId: result.job_id
			}
		};
	}

	/**
	 * Infer document type from URL and content
	 */
	private inferDocumentType(url: string, result: any): DocumentType {
		const urlLower = url.toLowerCase();

		if (urlLower.includes('congress.gov') || urlLower.includes('govinfo.gov')) {
			return 'legislative';
		}
		if (urlLower.includes('sec.gov') || urlLower.includes('edgar')) {
			return 'corporate';
		}
		if (urlLower.includes('.gov')) {
			return 'official';
		}
		if (urlLower.includes('arxiv') || urlLower.includes('.edu')) {
			return 'academic';
		}

		return 'media'; // Default
	}

	/**
	 * Infer source name from URL
	 */
	private inferSourceName(url: string): string {
		try {
			const hostname = new URL(url).hostname;
			// Remove www. and common TLDs for cleaner display
			return hostname.replace(/^www\./, '').replace(/\.(com|org|gov|edu|io)$/, '');
		} catch {
			return 'Unknown Source';
		}
	}

	/**
	 * Extract hierarchical sections from Reducto chunks
	 */
	private extractSections(chunks: any[]): DocumentSection[] {
		const sections: DocumentSection[] = [];
		let currentSection: DocumentSection | null = null;

		for (const chunk of chunks) {
			// Reducto chunks have type (heading, paragraph, list, table)
			if (chunk.type === 'heading' || chunk.type === 'title') {
				// New section
				const section: DocumentSection = {
					id: `section-${sections.length + 1}`,
					title: chunk.text || chunk.content,
					level: chunk.level || 0,
					content: '',
					pageNumbers: chunk.page ? [chunk.page] : undefined
				};
				sections.push(section);
				currentSection = section;
			} else if (currentSection) {
				// Add to current section
				currentSection.content += (currentSection.content ? '\n\n' : '') + (chunk.text || chunk.content);
			} else {
				// No section yet, create implicit first section
				const section: DocumentSection = {
					id: 'section-1',
					title: 'Introduction',
					level: 0,
					content: chunk.text || chunk.content
				};
				sections.push(section);
				currentSection = section;
			}
		}

		return sections;
	}

	/**
	 * Extract entities from Reducto response
	 */
	private extractEntities(rawEntities: any[]): DocumentEntity[] {
		return rawEntities.map((entity, index) => ({
			type: this.mapEntityType(entity.type),
			value: entity.value || entity.text,
			normalized: entity.normalized,
			context: entity.context || '',
			sectionId: entity.section_id
		}));
	}

	/**
	 * Map Reducto entity types to our types
	 */
	private mapEntityType(
		reductoType: string
	): 'amount' | 'date' | 'person' | 'organization' | 'location' | 'reference' {
		const mapping: Record<string, DocumentEntity['type']> = {
			money: 'amount',
			currency: 'amount',
			number: 'amount',
			date: 'date',
			time: 'date',
			person: 'person',
			name: 'person',
			organization: 'organization',
			company: 'organization',
			location: 'location',
			place: 'location',
			citation: 'reference',
			reference: 'reference'
		};
		return mapping[reductoType?.toLowerCase()] || 'reference';
	}

	/**
	 * Compute query relevance for a document
	 */
	private async computeRelevance(
		doc: ParsedDocument,
		query: string,
		maxPassages = 5
	): Promise<ParsedDocument['queryRelevance']> {
		// Simple keyword-based relevance for now
		// TODO: Use Voyage AI for semantic similarity
		const queryTerms = query.toLowerCase().split(/\s+/);
		const passages: RelevantPassage[] = [];

		for (const section of doc.sections) {
			const contentLower = section.content.toLowerCase();
			const titleLower = section.title.toLowerCase();

			// Count matching terms
			let matches = 0;
			for (const term of queryTerms) {
				if (contentLower.includes(term) || titleLower.includes(term)) {
					matches++;
				}
			}

			if (matches > 0) {
				const score = matches / queryTerms.length;

				// Extract most relevant sentence
				const sentences = section.content.split(/[.!?]+/);
				let bestSentence = sentences[0];
				let bestScore = 0;

				for (const sentence of sentences) {
					const sentenceLower = sentence.toLowerCase();
					let sentenceMatches = 0;
					for (const term of queryTerms) {
						if (sentenceLower.includes(term)) sentenceMatches++;
					}
					if (sentenceMatches > bestScore) {
						bestScore = sentenceMatches;
						bestSentence = sentence.trim();
					}
				}

				passages.push({
					text: bestSentence,
					sectionId: section.id,
					score,
					reason: `Contains ${matches} of ${queryTerms.length} query terms`
				});
			}
		}

		// Sort by score and limit
		passages.sort((a: RelevantPassage, b: RelevantPassage) => b.score - a.score);
		const topPassages = passages.slice(0, maxPassages);

		// Compute overall score
		const overallScore =
			topPassages.length > 0
				? topPassages.reduce((sum: number, p: RelevantPassage) => sum + p.score, 0) / topPassages.length
				: 0;

		return {
			score: overallScore,
			relevantSections: topPassages.map((p: RelevantPassage) => p.sectionId),
			passages: topPassages,
			summary:
				topPassages.length > 0
					? `Found ${topPassages.length} relevant passages across ${new Set(topPassages.map((p: RelevantPassage) => p.sectionId)).size} sections`
					: 'No relevant content found'
		};
	}

	/**
	 * Get document from MongoDB cache
	 */
	private async getFromCache(url: string): Promise<ParsedDocumentCacheDocument | null> {
		const urlHash = createHash('sha256').update(url).digest('hex');

		try {
			const collection = await this.getCollection();
			const cached = await collection.findOne({
				sourceUrlHash: urlHash,
				expiresAt: { $gt: new Date() }
			});

			if (cached) {
				// Update hit count and last accessed time
				await collection.updateOne(
					{ _id: cached._id },
					{
						$inc: { hitCount: 1 },
						$set: { lastAccessedAt: new Date() }
					}
				);
			}

			return cached;
		} catch (error) {
			console.error('[ReductoClient] Cache read failed:', error);
			return null;
		}
	}

	/**
	 * Save parsed document to MongoDB cache
	 */
	private async saveToCache(url: string, document: ParsedDocument): Promise<void> {
		const urlHash = createHash('sha256').update(url).digest('hex');
		const now = new Date();
		const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

		try {
			const collection = await this.getCollection();
			await collection.updateOne(
				{ sourceUrlHash: urlHash },
				{
					$set: {
						sourceUrl: url,
						sourceUrlHash: urlHash,
						documentType: document.type,
						document,
						updatedAt: now,
						expiresAt
					},
					$setOnInsert: {
						createdAt: now,
						hitCount: 0
					}
				},
				{ upsert: true }
			);
		} catch (error) {
			console.error('[ReductoClient] Cache write failed:', error);
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: ReductoClient | null = null;

/**
 * Get the Reducto client singleton
 *
 * The client automatically connects to MongoDB for caching.
 * No initialization required - just call this function.
 *
 * @example
 * const client = getReductoClient();
 * const result = await client.parse({ url: 'https://example.com/doc.pdf' });
 */
export function getReductoClient(): ReductoClient {
	if (!clientInstance) {
		clientInstance = new ReductoClient();
	}
	return clientInstance;
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetReductoClient(): void {
	clientInstance = null;
}
