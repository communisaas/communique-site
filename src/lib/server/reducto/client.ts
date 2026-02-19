/**
 * Reducto Client
 *
 * API wrapper for Reducto document parsing with Postgres JSONB caching.
 * Enables L3 depth layer with on-demand document analysis.
 *
 * @module reducto/client
 */

import { createHash } from 'crypto';
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
import { db } from '$lib/core/db';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Typed helpers for Prisma JSON ↔ ParsedDocument conversion
// ============================================================================

/** Extract ParsedDocument from Prisma JSON column value.
 *  Prisma types JSON columns as JsonValue — this provides type-safe extraction. */
function toParsedDocument(json: unknown): ParsedDocument {
	return json as ParsedDocument;
}

/** Convert ParsedDocument to Prisma-compatible JSON input. */
function toJsonValue(doc: ParsedDocument): Prisma.InputJsonValue {
	return doc as unknown as Prisma.InputJsonValue;
}

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

	constructor(apiKey?: string) {
		this.apiKey = apiKey || process.env.REDUCTO_API_KEY || '';

		if (!this.apiKey) {
			console.warn('[ReductoClient] No API key provided - document parsing will be unavailable');
		}
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
			const doc = toParsedDocument(cached.document);
			if (query && doc) {
				doc.queryRelevance = await this.computeRelevance(doc, query);
			}
			return { success: true, document: doc, cached: true };
		}

		// Parse with Reducto
		try {
			const parsed = await this.callReductoAPI(url, {
				type,
				extractEntities,
				detectCrossRefs
			});

			if (parsed) {
				await this.saveToCache(url, parsed);
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
			const cached = await db.parsedDocumentCache.findFirst({
				where: {
					document: { path: ['id'], equals: documentId }
				}
			});
			return cached ? toParsedDocument(cached.document) : null;
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
			const cached = await db.parsedDocumentCache.findUnique({
				where: {
					source_url_hash: urlHash,
					expires_at: { gt: new Date() }
				}
			});
			return cached ? toParsedDocument(cached.document) : null;
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
			const cached = await db.parsedDocumentCache.findMany({
				where: {
					document_type: documentType,
					expires_at: { gt: new Date() }
				},
				orderBy: { created_at: 'desc' },
				take: limit
			});

			return cached.map((doc) => toParsedDocument(doc.document));
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
			const now = new Date();
			const [total, byType, oldest, newest] = await Promise.all([
				db.parsedDocumentCache.count({ where: { expires_at: { gt: now } } }),
				db.parsedDocumentCache.groupBy({
					by: ['document_type'],
					where: { expires_at: { gt: now } },
					_count: true
				}),
				db.parsedDocumentCache.findFirst({ orderBy: { created_at: 'asc' }, select: { created_at: true } }),
				db.parsedDocumentCache.findFirst({ orderBy: { created_at: 'desc' }, select: { created_at: true } })
			]);

			const typeCount: Record<DocumentType, number> = {
				legislative: 0,
				official: 0,
				media: 0,
				corporate: 0,
				academic: 0
			};

			for (const item of byType) {
				if (item.document_type in typeCount) {
					typeCount[item.document_type as DocumentType] = item._count;
				}
			}

			return {
				totalDocuments: total,
				byType: typeCount,
				oldestDocument: oldest?.created_at,
				newestDocument: newest?.created_at
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

	private async callReductoAPI(
		url: string,
		options: { type?: DocumentType; extractEntities: boolean; detectCrossRefs: boolean }
	): Promise<ParsedDocument> {
		if (!this.apiKey) {
			throw new Error('Reducto API key not configured');
		}

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
					extract_images: false,
					chunking_strategy: 'semantic'
				}
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Reducto API error (${response.status}): ${error}`);
		}

		const result = await response.json();
		return this.transformReductoResponse(result, url, options.type);
	}

	private transformReductoResponse(
		result: any,
		sourceUrl: string,
		typeHint?: DocumentType
	): ParsedDocument {
		const docType = typeHint || this.inferDocumentType(sourceUrl, result);
		const sections = this.extractSections(result.chunks || result.elements || []);
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
			crossRefs: [],
			metadata: {
				parsedAt: new Date(),
				sourceUrl,
				pageCount: result.metadata?.page_count || sections.length,
				reductoJobId: result.job_id
			}
		};
	}

	private inferDocumentType(url: string, _result: any): DocumentType {
		const urlLower = url.toLowerCase();
		if (urlLower.includes('congress.gov') || urlLower.includes('govinfo.gov')) return 'legislative';
		if (urlLower.includes('sec.gov') || urlLower.includes('edgar')) return 'corporate';
		if (urlLower.includes('.gov')) return 'official';
		if (urlLower.includes('arxiv') || urlLower.includes('.edu')) return 'academic';
		return 'media';
	}

	private inferSourceName(url: string): string {
		try {
			const hostname = new URL(url).hostname;
			return hostname.replace(/^www\./, '').replace(/\.(com|org|gov|edu|io)$/, '');
		} catch {
			return 'Unknown Source';
		}
	}

	private extractSections(chunks: any[]): DocumentSection[] {
		const sections: DocumentSection[] = [];
		let currentSection: DocumentSection | null = null;

		for (const chunk of chunks) {
			if (chunk.type === 'heading' || chunk.type === 'title') {
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
				currentSection.content += (currentSection.content ? '\n\n' : '') + (chunk.text || chunk.content);
			} else {
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

	private extractEntities(rawEntities: any[]): DocumentEntity[] {
		return rawEntities.map((entity) => ({
			type: this.mapEntityType(entity.type),
			value: entity.value || entity.text,
			normalized: entity.normalized,
			context: entity.context || '',
			sectionId: entity.section_id
		}));
	}

	private mapEntityType(
		reductoType: string
	): 'amount' | 'date' | 'person' | 'organization' | 'location' | 'reference' {
		const mapping: Record<string, DocumentEntity['type']> = {
			money: 'amount', currency: 'amount', number: 'amount',
			date: 'date', time: 'date',
			person: 'person', name: 'person',
			organization: 'organization', company: 'organization',
			location: 'location', place: 'location',
			citation: 'reference', reference: 'reference'
		};
		return mapping[reductoType?.toLowerCase()] || 'reference';
	}

	private async computeRelevance(
		doc: ParsedDocument,
		query: string,
		maxPassages = 5
	): Promise<ParsedDocument['queryRelevance']> {
		const queryTerms = query.toLowerCase().split(/\s+/);
		const passages: RelevantPassage[] = [];

		for (const section of doc.sections) {
			const contentLower = section.content.toLowerCase();
			const titleLower = section.title.toLowerCase();

			let matches = 0;
			for (const term of queryTerms) {
				if (contentLower.includes(term) || titleLower.includes(term)) matches++;
			}

			if (matches > 0) {
				const score = matches / queryTerms.length;
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

		passages.sort((a, b) => b.score - a.score);
		const topPassages = passages.slice(0, maxPassages);

		const overallScore =
			topPassages.length > 0
				? topPassages.reduce((sum, p) => sum + p.score, 0) / topPassages.length
				: 0;

		return {
			score: overallScore,
			relevantSections: topPassages.map((p) => p.sectionId),
			passages: topPassages,
			summary:
				topPassages.length > 0
					? `Found ${topPassages.length} relevant passages across ${new Set(topPassages.map((p) => p.sectionId)).size} sections`
					: 'No relevant content found'
		};
	}

	private async getFromCache(url: string): Promise<{ document: unknown } | null> {
		const urlHash = createHash('sha256').update(url).digest('hex');

		try {
			const cached = await db.parsedDocumentCache.findUnique({
				where: { source_url_hash: urlHash }
			});

			if (cached && cached.expires_at > new Date()) {
				// Increment hit count
				await db.parsedDocumentCache.update({
					where: { id: cached.id },
					data: {
						hit_count: { increment: 1 },
						last_accessed_at: new Date()
					}
				});
				return { document: cached.document };
			}

			return null;
		} catch (error) {
			console.error('[ReductoClient] Cache read failed:', error);
			return null;
		}
	}

	private async saveToCache(url: string, document: ParsedDocument): Promise<void> {
		const urlHash = createHash('sha256').update(url).digest('hex');
		const now = new Date();
		const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

		try {
			await db.parsedDocumentCache.upsert({
				where: { source_url_hash: urlHash },
				create: {
					source_url: url,
					source_url_hash: urlHash,
					document_type: document.type,
					document: toJsonValue(document),
					expires_at: expiresAt,
					hit_count: 0
				},
				update: {
					document_type: document.type,
					document: toJsonValue(document),
					expires_at: expiresAt
				}
			});
		} catch (error) {
			console.error('[ReductoClient] Cache write failed:', error);
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: ReductoClient | null = null;

export function getReductoClient(): ReductoClient {
	if (!clientInstance) {
		clientInstance = new ReductoClient();
	}
	return clientInstance;
}

export function resetReductoClient(): void {
	clientInstance = null;
}
