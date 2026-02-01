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
	DocumentType,
	DocumentEntity,
	DocumentSection,
	RelevantPassage,
	ExtractSchema,
	ExtractSchemaField,
	ExtractResult,
	ExtractedBill,
	BillExtractOptions,
	BillExtractResult,
	BillSponsor,
	BillFunding,
	BillProvision,
	BillDefinition,
	// Import parallel processing types from types.ts to avoid circular deps
	DocumentAnalysisEventCallback,
	ParseMultipleOptions,
	ParseMultipleResult
} from './types';
import {
	// Import parallel processing constants from types.ts
	MAX_PARALLEL_DOCUMENTS,
	ANALYSIS_TIMEOUT_MS,
	ESTIMATED_TIME_PER_DOCUMENT_MS
} from './types';
import type { ParsedDocumentCacheDocument } from '../mongodb/schema';
import { getParsedDocumentsCollection } from '../mongodb/collections';

// Re-export constants for backward compatibility
export { MAX_PARALLEL_DOCUMENTS, ANALYSIS_TIMEOUT_MS, ESTIMATED_TIME_PER_DOCUMENT_MS };
export { MAX_DOCUMENT_SIZE_BYTES } from './types';

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
	 * Parse multiple documents in parallel with progress events.
	 *
	 * This method implements perceptual engineering for long-running operations:
	 * - Immediate feedback on start (0-1s timing budget)
	 * - Granular progress per document (1-30s timing budget)
	 * - Interim findings to maintain engagement (30s+ timing budget)
	 *
	 * Key features:
	 * - Parallel processing with Promise.allSettled (3 docs in ~35s vs 90s+ sequential)
	 * - Error isolation per document (one failure doesn't affect others)
	 * - Timeout handling to prevent hung operations
	 * - Prioritization by relevance score if more than MAX_PARALLEL_DOCUMENTS
	 *
	 * @param urls - Array of document URLs to parse
	 * @param options - Parsing options with progress callback
	 * @returns Results in order with isolated errors and summary stats
	 *
	 * @example
	 * ```typescript
	 * const result = await client.parseMultiple(
	 *   ['https://sec.gov/filing1.pdf', 'https://congress.gov/bill123'],
	 *   {
	 *     query: 'climate policy funding',
	 *     onProgress: (event) => {
	 *       if (event.type === 'document_progress') {
	 *         console.log(`Document ${event.index + 1}/${event.total}: ${event.stage}`);
	 *       }
	 *     }
	 *   }
	 * );
	 * ```
	 */
	async parseMultiple(urls: string[], options: ParseMultipleOptions = {}): Promise<ParseMultipleResult> {
		const startTime = Date.now();
		const {
			query,
			type,
			extractEntities = true,
			detectCrossRefs = true,
			onProgress,
			relevanceScores,
			timeoutMs = ANALYSIS_TIMEOUT_MS
		} = options;

		// Handle empty input
		if (urls.length === 0) {
			return {
				results: [],
				stats: {
					total: 0,
					successful: 0,
					failed: 0,
					timedOut: 0,
					cached: 0,
					totalTimeMs: 0
				}
			};
		}

		// Prioritize and limit documents if needed
		let prioritizedUrls = [...urls];
		if (urls.length > MAX_PARALLEL_DOCUMENTS && relevanceScores) {
			// Sort by relevance score (descending) and take top N
			prioritizedUrls = [...urls]
				.sort((a, b) => (relevanceScores.get(b) ?? 0) - (relevanceScores.get(a) ?? 0))
				.slice(0, MAX_PARALLEL_DOCUMENTS);

			console.log(`[ReductoClient] Prioritized ${prioritizedUrls.length}/${urls.length} documents by relevance`);
		} else if (urls.length > MAX_PARALLEL_DOCUMENTS) {
			// No relevance scores - just take first N
			prioritizedUrls = urls.slice(0, MAX_PARALLEL_DOCUMENTS);
			console.log(`[ReductoClient] Limited to ${prioritizedUrls.length}/${urls.length} documents (no relevance scores)`);
		}

		const total = prioritizedUrls.length;
		const estimatedTimeMs = total * ESTIMATED_TIME_PER_DOCUMENT_MS;

		// Emit analysis start event (immediate feedback for 0-1s timing budget)
		onProgress?.({
			type: 'analysis_start',
			count: total,
			estimatedTimeMs,
			parallel: true,
			urls: prioritizedUrls
		});

		// Track per-document timing and results
		const documentStartTimes = new Map<number, number>();
		const results: ParseResult[] = new Array(total);
		let successful = 0;
		let failed = 0;
		let timedOut = 0;
		let cached = 0;

		// Create parsing promises with timeout and progress tracking
		const parsePromises = prioritizedUrls.map(async (url, index) => {
			const docStartTime = Date.now();
			documentStartTimes.set(index, docStartTime);

			// Emit queued status
			onProgress?.({
				type: 'document_progress',
				index,
				total,
				url,
				stage: 'queued',
				timeElapsedMs: 0
			});

			try {
				// Emit parsing status
				onProgress?.({
					type: 'document_progress',
					index,
					total,
					url,
					stage: 'parsing',
					timeElapsedMs: Date.now() - docStartTime
				});

				// Race between parse and timeout
				const result = await Promise.race([
					this.parse({
						url,
						type,
						query,
						extractEntities,
						detectCrossRefs
					}),
					new Promise<ParseResult>((_, reject) =>
						setTimeout(
							() => reject(new Error(`Analysis timeout after ${timeoutMs}ms`)),
							timeoutMs
						)
					)
				]);

				const elapsed = Date.now() - docStartTime;

				if (result.success) {
					// Emit interim finding if we have relevant passages
					if (result.document?.queryRelevance?.passages?.[0]) {
						const topPassage = result.document.queryRelevance.passages[0];
						onProgress?.({
							type: 'document_interim',
							documentIndex: index,
							finding: topPassage.text.slice(0, 150) + (topPassage.text.length > 150 ? '...' : ''),
							confidence: topPassage.score
						});
					}

					// Emit complete status
					onProgress?.({
						type: 'document_progress',
						index,
						total,
						url,
						title: result.document?.title,
						stage: 'complete',
						timeElapsedMs: elapsed,
						cached: result.cached
					});

					if (result.cached) cached++;
					successful++;
				} else {
					// Emit error status
					onProgress?.({
						type: 'document_progress',
						index,
						total,
						url,
						stage: 'error',
						timeElapsedMs: elapsed,
						error: result.error
					});
					failed++;
				}

				return { index, result };
			} catch (error) {
				const elapsed = Date.now() - docStartTime;
				const isTimeout = error instanceof Error && error.message.includes('timeout');

				// Emit timeout or error status
				onProgress?.({
					type: 'document_progress',
					index,
					total,
					url,
					stage: isTimeout ? 'timeout' : 'error',
					timeElapsedMs: elapsed,
					error: error instanceof Error ? error.message : 'Unknown error'
				});

				if (isTimeout) {
					timedOut++;
				} else {
					failed++;
				}

				// Return error result (doesn't throw - error isolation)
				const errorResult: ParseResult = {
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
					cached: false
				};

				return { index, result: errorResult };
			}
		});

		// Execute all in parallel with Promise.allSettled for error isolation
		const settledResults = await Promise.allSettled(parsePromises);

		// Process results back into order
		for (const settled of settledResults) {
			if (settled.status === 'fulfilled') {
				results[settled.value.index] = settled.value.result;
			} else {
				// This shouldn't happen since we catch errors above, but handle defensively
				console.error('[ReductoClient] Unexpected rejection in parseMultiple:', settled.reason);
			}
		}

		const totalTimeMs = Date.now() - startTime;

		// Emit analysis complete event
		onProgress?.({
			type: 'analysis_complete',
			total,
			successful,
			failed,
			timedOut,
			totalTimeMs
		});

		console.log(`[ReductoClient] parseMultiple complete:`, {
			total,
			successful,
			failed,
			timedOut,
			cached,
			totalTimeMs
		});

		return {
			results,
			stats: {
				total,
				successful,
				failed,
				timedOut,
				cached,
				totalTimeMs
			}
		};
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
	 *
	 * API Reference: https://docs.reducto.ai/api-reference/parse
	 * Request uses 'input' field (not 'url') per Reducto API contract.
	 */
	private async callReductoAPI(
		url: string,
		options: { type?: DocumentType; extractEntities: boolean; detectCrossRefs: boolean }
	): Promise<ParsedDocument> {
		if (!this.apiKey) {
			throw new Error('Reducto API key not configured');
		}

		// Call Reducto parse endpoint
		// API Contract: POST /parse with { input, retrieval?, settings?, ... }
		const response = await fetch(`${REDUCTO_API_BASE}/parse`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`
			},
			body: JSON.stringify({
				// 'input' is the correct field name per Reducto API (not 'url')
				input: url,
				// Retrieval options control chunking behavior
				retrieval: {
					chunking: {
						// 'variable' combines layout + semantic structure (best for RAG)
						chunk_mode: 'variable',
						chunk_size: 1000,
						chunk_overlap: 100,
						// Keep tables intact for better citation support
						keep_tables_and_figures: true
					}
				},
				// Settings control processing behavior
				settings: {
					// We don't need images for text-focused parsing
					return_images: false
				}
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Reducto API error (${response.status}): ${error}`);
		}

		const result = await response.json();

		// Handle URL result type (large documents exceed ~6MB HTTP limit)
		// Reducto returns a presigned URL instead of inline data
		if (result.result?.type === 'url' && result.result?.url) {
			const urlResponse = await fetch(result.result.url);
			if (!urlResponse.ok) {
				throw new Error(`Failed to fetch large document result: ${urlResponse.status}`);
			}
			const fullResult = await urlResponse.json();
			// Merge the fetched result back into the response structure
			result.result = { type: 'full', ...fullResult };
		}

		// Transform Reducto response to our format
		return this.transformReductoResponse(result, url, options.type);
	}

	/**
	 * Transform Reducto API response to our ParsedDocument format
	 *
	 * Reducto API Response Structure:
	 * {
	 *   job_id: string,
	 *   duration: number,
	 *   usage: { num_pages: number, credits: number },
	 *   result: {
	 *     type: 'full' | 'url',
	 *     chunks: Array<{
	 *       content: string,
	 *       embed: string,
	 *       blocks: Array<{ type, content, bbox, confidence }>
	 *     }>
	 *   }
	 * }
	 */
	private transformReductoResponse(
		result: any,
		sourceUrl: string,
		typeHint?: DocumentType
	): ParsedDocument {
		const docType = typeHint || this.inferDocumentType(sourceUrl, result);

		// Reducto nests chunks under result.result.chunks (not result.chunks)
		const chunks = result.result?.chunks || [];

		// Extract sections from Reducto chunks
		const sections = this.extractSections(chunks);

		// Extract entities from block content
		// Note: Reducto Parse API doesn't return entities directly;
		// for entity extraction, use Reducto Extract API with a schema.
		// Here we extract basic entities from block metadata.
		const entities = this.extractEntitiesFromBlocks(chunks);

		// Extract title from first Title block or use document metadata
		const title = this.extractTitle(chunks) || 'Untitled Document';

		return {
			id: result.job_id || createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16),
			title,
			source: {
				name: this.inferSourceName(sourceUrl),
				url: sourceUrl,
				date: undefined, // Reducto doesn't extract document date in parse
				type: docType
			},
			type: docType,
			sections,
			entities,
			crossRefs: [], // TODO: Extract cross-references from content
			metadata: {
				parsedAt: new Date(),
				sourceUrl,
				pageCount: result.usage?.num_pages || sections.length,
				reductoJobId: result.job_id
			}
		};
	}

	/**
	 * Extract document title from Reducto chunks
	 * Looks for first block with type 'Title'
	 */
	private extractTitle(chunks: any[]): string | null {
		for (const chunk of chunks) {
			for (const block of chunk.blocks || []) {
				if (block.type === 'Title') {
					return block.content;
				}
			}
		}
		return null;
	}

	/**
	 * Extract entities from block content
	 * Note: For full entity extraction, use Reducto Extract API with a schema
	 */
	private extractEntitiesFromBlocks(chunks: any[]): DocumentEntity[] {
		const entities: DocumentEntity[] = [];

		// Reducto Parse doesn't return structured entities
		// This is a placeholder for future Extract API integration
		// or client-side entity extraction

		return entities;
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
	 *
	 * Reducto chunk structure:
	 * {
	 *   content: string,       // Full text content
	 *   embed: string,         // Embedding-optimized content
	 *   blocks: Array<{
	 *     type: 'Header' | 'Title' | 'Section Header' | 'Text' | 'Table' | 'Figure' | etc.,
	 *     content: string,
	 *     bbox: { left, top, width, height, page }
	 *   }>
	 * }
	 */
	private extractSections(chunks: any[]): DocumentSection[] {
		const sections: DocumentSection[] = [];
		let currentSection: DocumentSection | null = null;
		const pageNumbers = new Set<number>();

		for (const chunk of chunks) {
			// Process blocks within each chunk
			const blocks = chunk.blocks || [];

			for (const block of blocks) {
				// Track page numbers from bounding boxes
				if (block.bbox?.page) {
					pageNumbers.add(block.bbox.page);
				}

				// Block types: Header, Footer, Title, Section Header, Page Number,
				// List Item, Figure, Table, Key Value, Text, Comment, Signature
				const isHeading =
					block.type === 'Title' ||
					block.type === 'Section Header' ||
					block.type === 'Header';

				if (isHeading) {
					// New section - save page numbers from previous section
					if (currentSection && pageNumbers.size > 0) {
						currentSection.pageNumbers = Array.from(pageNumbers).sort((a, b) => a - b);
						pageNumbers.clear();
					}

					const section: DocumentSection = {
						id: `section-${sections.length + 1}`,
						title: block.content || 'Untitled Section',
						// Infer level from block type
						level: block.type === 'Title' ? 0 : block.type === 'Section Header' ? 1 : 2,
						content: '',
						pageNumbers: block.bbox?.page ? [block.bbox.page] : undefined
					};
					sections.push(section);
					currentSection = section;
				} else if (block.type !== 'Footer' && block.type !== 'Page Number') {
					// Add content to current section (skip footers and page numbers)
					if (currentSection) {
						currentSection.content +=
							(currentSection.content ? '\n\n' : '') + (block.content || '');
					} else {
						// No section yet, create implicit first section
						const section: DocumentSection = {
							id: 'section-1',
							title: 'Document Content',
							level: 0,
							content: block.content || '',
							pageNumbers: block.bbox?.page ? [block.bbox.page] : undefined
						};
						sections.push(section);
						currentSection = section;
					}
				}
			}

			// If chunk has content but no blocks, use chunk.content directly
			if (blocks.length === 0 && chunk.content) {
				if (currentSection) {
					currentSection.content +=
						(currentSection.content ? '\n\n' : '') + chunk.content;
				} else {
					const section: DocumentSection = {
						id: 'section-1',
						title: 'Document Content',
						level: 0,
						content: chunk.content
					};
					sections.push(section);
					currentSection = section;
				}
			}
		}

		// Update final section with remaining page numbers
		if (currentSection && pageNumbers.size > 0) {
			currentSection.pageNumbers = Array.from(pageNumbers).sort((a, b) => a - b);
		}

		return sections;
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

	// ============================================================================
	// Extract API Methods (Structured Extraction)
	// ============================================================================

	/**
	 * Extract structured data from a document using Reducto Extract API
	 *
	 * The Extract API allows schema-driven extraction of specific fields
	 * from documents, returning structured JSON data.
	 *
	 * @param url - Document URL to extract from
	 * @param schema - Extraction schema defining fields to extract
	 * @returns Extracted data with confidence scores
	 *
	 * @example
	 * const result = await client.extract('https://congress.gov/bill.pdf', {
	 *   fields: [
	 *     { name: 'title', description: 'Bill title', type: 'string', required: true },
	 *     { name: 'sponsor', description: 'Primary sponsor name', type: 'string' }
	 *   ]
	 * });
	 */
	async extract(url: string, schema: ExtractSchema): Promise<ExtractResult> {
		if (!this.apiKey) {
			return { success: false, error: 'Reducto API key not configured' };
		}

		try {
			const response = await fetch(`${REDUCTO_API_BASE}/extract`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`
				},
				body: JSON.stringify({
					input: url,
					schema: this.convertSchemaToReductoFormat(schema),
					settings: {
						return_images: false
					}
				})
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Reducto Extract API error (${response.status}): ${error}`);
			}

			const result = await response.json();

			// Handle URL result type for large responses
			let extractedData = result.result;
			if (result.result?.type === 'url' && result.result?.url) {
				const urlResponse = await fetch(result.result.url);
				if (!urlResponse.ok) {
					throw new Error(`Failed to fetch large extraction result: ${urlResponse.status}`);
				}
				extractedData = await urlResponse.json();
			}

			return {
				success: true,
				data: extractedData?.data || extractedData,
				confidence: extractedData?.confidence,
				citations: extractedData?.citations
			};
		} catch (error) {
			console.error('[ReductoClient] Extract failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Extract structured data from a legislative bill
	 *
	 * Uses a comprehensive schema optimized for congressional bills,
	 * extracting sponsors, funding, provisions, definitions, etc.
	 *
	 * @param options - Bill extraction options
	 * @returns Structured bill data
	 *
	 * @example
	 * const result = await client.extractBill({
	 *   url: 'https://www.congress.gov/118/bills/hr1/BILLS-118hr1ih.pdf',
	 *   congress: 118,
	 *   billType: 'hr'
	 * });
	 */
	async extractBill(options: BillExtractOptions): Promise<BillExtractResult> {
		const { url, billType, congress, includeDefinitions = true, maxProvisions = 10 } = options;

		if (!this.apiKey) {
			return { success: false, error: 'Reducto API key not configured', cached: false };
		}

		// Check cache first
		const cacheKey = `bill-extract:${url}`;
		const cachedHash = createHash('sha256').update(cacheKey).digest('hex');
		const cached = await this.getFromCache(cacheKey);

		if (cached?.document?.metadata?.extractedBill) {
			console.log('[ReductoClient] Bill extraction cache hit:', url);
			return {
				success: true,
				bill: cached.document.metadata.extractedBill as ExtractedBill,
				cached: true
			};
		}

		console.log('[ReductoClient] Extracting bill:', url);

		try {
			const result = await this.extract(url, this.buildBillExtractionSchema(includeDefinitions));

			if (!result.success || !result.data) {
				return { success: false, error: result.error, cached: false };
			}

			// Transform raw extraction to structured bill
			const bill = this.transformExtractedBill(result.data, url, congress, billType);

			// Add confidence from extraction
			if (result.confidence) {
				const confidenceValues = Object.values(result.confidence);
				bill.extractionMetadata.confidence =
					confidenceValues.reduce((sum, v) => sum + (v as number), 0) / confidenceValues.length;
			}

			return { success: true, bill, cached: false };
		} catch (error) {
			console.error('[ReductoClient] Bill extraction failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				cached: false
			};
		}
	}

	/**
	 * Build the comprehensive bill extraction schema
	 */
	private buildBillExtractionSchema(includeDefinitions: boolean): ExtractSchema {
		const fields: ExtractSchemaField[] = [
			{
				name: 'billNumber',
				description: 'Bill number including prefix (e.g., "H.R. 1234", "S. 5678")',
				type: 'string',
				required: true
			},
			{
				name: 'title',
				description: 'Official long title of the bill',
				type: 'string',
				required: true
			},
			{
				name: 'shortTitle',
				description: 'Short title or popular name if different from official title',
				type: 'string'
			},
			{
				name: 'congress',
				description: 'Congress number (e.g., 118 for 118th Congress)',
				type: 'number'
			},
			{
				name: 'chamber',
				description: 'Chamber of origin: "house" or "senate"',
				type: 'string'
			},
			{
				name: 'introducedDate',
				description: 'Date the bill was introduced (format: YYYY-MM-DD)',
				type: 'date'
			},
			{
				name: 'sponsor',
				description: 'Primary sponsor of the bill',
				type: 'object',
				properties: [
					{ name: 'name', description: 'Full name of sponsor', type: 'string' },
					{ name: 'party', description: 'Party affiliation (D, R, or I)', type: 'string' },
					{ name: 'state', description: 'State (2-letter code)', type: 'string' },
					{ name: 'district', description: 'District number for House members', type: 'number' }
				]
			},
			{
				name: 'cosponsors',
				description: 'List of cosponsors',
				type: 'array',
				items: {
					name: 'cosponsor',
					description: 'A cosponsor',
					type: 'object',
					properties: [
						{ name: 'name', description: 'Full name', type: 'string' },
						{ name: 'party', description: 'Party (D, R, I)', type: 'string' },
						{ name: 'state', description: 'State', type: 'string' }
					]
				}
			},
			{
				name: 'policyArea',
				description: 'Primary policy area (e.g., "Health", "Defense", "Education")',
				type: 'string'
			},
			{
				name: 'subjects',
				description: 'Subject keywords/topics',
				type: 'array',
				items: { name: 'subject', description: 'A subject keyword', type: 'string' }
			},
			{
				name: 'purpose',
				description: 'Brief purpose statement from the bill',
				type: 'string'
			},
			{
				name: 'provisions',
				description: 'Key provisions or sections of the bill',
				type: 'array',
				items: {
					name: 'provision',
					description: 'A key provision',
					type: 'object',
					properties: [
						{ name: 'section', description: 'Section number', type: 'string' },
						{ name: 'title', description: 'Section title', type: 'string' },
						{ name: 'summary', description: 'Brief summary of what this section does', type: 'string' },
						{ name: 'effectiveDate', description: 'When this provision takes effect', type: 'string' }
					]
				}
			},
			{
				name: 'funding',
				description: 'Funding allocations and appropriations',
				type: 'array',
				items: {
					name: 'allocation',
					description: 'A funding allocation',
					type: 'object',
					properties: [
						{ name: 'program', description: 'Program or purpose', type: 'string' },
						{ name: 'amount', description: 'Dollar amount', type: 'number' },
						{ name: 'fiscalYear', description: 'Fiscal year', type: 'number' },
						{ name: 'duration', description: 'Duration (e.g., "5 years")', type: 'string' }
					]
				}
			},
			{
				name: 'effectiveDates',
				description: 'Effective dates for the bill or its provisions',
				type: 'array',
				items: { name: 'date', description: 'An effective date', type: 'string' }
			},
			{
				name: 'sunsetDate',
				description: 'Sunset or expiration date if applicable',
				type: 'string'
			},
			{
				name: 'amendsLaws',
				description: 'Existing laws this bill amends (e.g., "42 U.S.C. 1234")',
				type: 'array',
				items: { name: 'law', description: 'A law being amended', type: 'string' }
			}
		];

		if (includeDefinitions) {
			fields.push({
				name: 'definitions',
				description: 'Key terms defined in the bill',
				type: 'array',
				items: {
					name: 'definition',
					description: 'A defined term',
					type: 'object',
					properties: [
						{ name: 'term', description: 'The term being defined', type: 'string' },
						{ name: 'definition', description: 'The definition', type: 'string' },
						{ name: 'section', description: 'Section where defined', type: 'string' }
					]
				}
			});
		}

		return {
			fields,
			context: 'This is a U.S. Congressional bill. Extract structured information about the legislation including sponsors, funding amounts, key provisions, and effective dates.'
		};
	}

	/**
	 * Convert our schema format to Reducto's expected format
	 */
	private convertSchemaToReductoFormat(schema: ExtractSchema): Record<string, unknown> {
		// Reducto expects a JSON Schema-like format
		const properties: Record<string, unknown> = {};
		const required: string[] = [];

		for (const field of schema.fields) {
			properties[field.name] = this.convertFieldToJsonSchema(field);
			if (field.required) {
				required.push(field.name);
			}
		}

		return {
			type: 'object',
			properties,
			required: required.length > 0 ? required : undefined,
			description: schema.context
		};
	}

	/**
	 * Convert a field to JSON Schema format
	 */
	private convertFieldToJsonSchema(field: ExtractSchemaField): Record<string, unknown> {
		const result: Record<string, unknown> = {
			description: field.description
		};

		switch (field.type) {
			case 'string':
				result.type = 'string';
				break;
			case 'number':
				result.type = 'number';
				break;
			case 'boolean':
				result.type = 'boolean';
				break;
			case 'date':
				result.type = 'string';
				result.format = 'date';
				break;
			case 'array':
				result.type = 'array';
				if (field.items) {
					result.items = this.convertFieldToJsonSchema(field.items);
				}
				break;
			case 'object':
				result.type = 'object';
				if (field.properties) {
					const props: Record<string, unknown> = {};
					for (const prop of field.properties) {
						props[prop.name] = this.convertFieldToJsonSchema(prop);
					}
					result.properties = props;
				}
				break;
		}

		return result;
	}

	/**
	 * Transform raw extraction data to structured ExtractedBill
	 */
	private transformExtractedBill(
		data: Record<string, unknown>,
		sourceUrl: string,
		congress?: number,
		billType?: string
	): ExtractedBill {
		// Extract sponsor
		const rawSponsor = data.sponsor as Record<string, unknown> | undefined;
		const sponsor: BillSponsor | undefined = rawSponsor ? {
			name: String(rawSponsor.name || ''),
			party: String(rawSponsor.party || 'I'),
			state: String(rawSponsor.state || ''),
			district: rawSponsor.district as number | undefined,
			role: 'sponsor'
		} : undefined;

		// Extract cosponsors
		const rawCosponsors = data.cosponsors as Array<Record<string, unknown>> || [];
		const cosponsors: BillSponsor[] = rawCosponsors.map(c => ({
			name: String(c.name || ''),
			party: String(c.party || 'I'),
			state: String(c.state || ''),
			district: c.district as number | undefined,
			role: 'cosponsor'
		}));

		// Extract provisions
		const rawProvisions = data.provisions as Array<Record<string, unknown>> || [];
		const provisions: BillProvision[] = rawProvisions.map(p => ({
			section: String(p.section || ''),
			title: String(p.title || ''),
			summary: String(p.summary || ''),
			effectiveDate: p.effectiveDate as string | undefined,
			impactedEntities: p.impactedEntities as string[] | undefined
		}));

		// Extract funding
		const rawFunding = data.funding as Array<Record<string, unknown>> || [];
		const funding: BillFunding[] = rawFunding.map(f => ({
			program: String(f.program || ''),
			amount: Number(f.amount) || 0,
			fiscalYear: f.fiscalYear as number | undefined,
			duration: f.duration as string | undefined,
			purpose: f.purpose as string | undefined
		}));

		// Extract definitions
		const rawDefinitions = data.definitions as Array<Record<string, unknown>> || [];
		const definitions: BillDefinition[] = rawDefinitions.map(d => ({
			term: String(d.term || ''),
			definition: String(d.definition || ''),
			section: d.section as string | undefined
		}));

		// Determine chamber from bill number or type
		const billNumber = String(data.billNumber || '');
		let chamber: 'house' | 'senate' = 'house';
		if (billType?.startsWith('s') || billNumber.toLowerCase().startsWith('s.') || billNumber.toLowerCase().startsWith('s ')) {
			chamber = 'senate';
		}

		return {
			billNumber,
			title: String(data.title || 'Untitled Bill'),
			shortTitle: data.shortTitle as string | undefined,
			congress: (data.congress as number) || congress || 118,
			chamber,
			introducedDate: data.introducedDate as string | undefined,
			sponsor,
			cosponsors,
			cosponsorsCount: cosponsors.length,
			policyArea: data.policyArea as string | undefined,
			subjects: (data.subjects as string[]) || [],
			purpose: data.purpose as string | undefined,
			provisions,
			funding,
			definitions,
			effectiveDates: (data.effectiveDates as string[]) || [],
			sunsetDate: data.sunsetDate as string | undefined,
			amendsLaws: (data.amendsLaws as string[]) || [],
			extractionMetadata: {
				extractedAt: new Date(),
				confidence: 0.8 // Default, updated with actual confidence
			}
		};
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
