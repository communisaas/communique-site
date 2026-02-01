/**
 * Document Tool
 *
 * Agent-invocable tool for document analysis with parallel processing support.
 * Integrates with Reducto for parsing and ThoughtEmitter for perceptual engineering.
 *
 * Key features:
 * - Single document analysis via executeDocumentTool()
 * - Parallel multi-document analysis via executeMultipleDocumentTool()
 * - Progress events for UI feedback during long operations (30-60s)
 * - Automatic prioritization by relevance when exceeding limits
 *
 * @module tools/document
 */

import {
	getReductoClient,
	MAX_PARALLEL_DOCUMENTS,
	ANALYSIS_TIMEOUT_MS,
	ESTIMATED_TIME_PER_DOCUMENT_MS
} from '$lib/server/reducto/client';
import type {
	ParsedDocument,
	DocumentType,
	DocumentAnalysisEventCallback,
	ParseMultipleResult
} from '$lib/server/reducto/types';
import type { Citation, ActionHandle } from '$lib/core/thoughts/types';
import type { ThoughtEmitter } from '$lib/core/thoughts/emitter';

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Tool definition for agent function calling
 */
export const documentToolDefinition = {
	name: 'analyze_document',
	description: `Analyze a document (PDF, bill, report, filing) to extract relevant information.
Use this when:
- User provides a document URL to analyze
- A cited source needs deeper analysis
- Legislative text, SEC filings, or official reports need parsing

The tool extracts document structure, key entities (amounts, dates, names), and finds passages relevant to the current query.`,
	parameters: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: 'URL of the document to analyze'
			},
			query: {
				type: 'string',
				description: 'What to look for in the document (used for relevance scoring)'
			},
			documentType: {
				type: 'string',
				enum: ['legislative', 'official', 'media', 'corporate', 'academic'],
				description: 'Type of document (auto-detected if not provided)'
			}
		},
		required: ['url', 'query']
	}
};

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Result from document analysis
 */
export interface DocumentAnalysisResult {
	success: boolean;
	document?: ParsedDocument;
	summary?: string;
	citations?: Citation[];
	error?: string;
}

/**
 * Execute document analysis tool
 *
 * @param url - Document URL to analyze
 * @param query - Query for relevance scoring
 * @param documentType - Optional type hint
 * @param emitter - Optional ThoughtEmitter for streaming updates
 */
export async function executeDocumentTool(
	url: string,
	query: string,
	documentType?: DocumentType,
	emitter?: ThoughtEmitter
): Promise<DocumentAnalysisResult> {
	const client = getReductoClient();

	// Emit action start if emitter provided
	let actionHandle: ActionHandle | undefined;
	if (emitter) {
		actionHandle = emitter.startAction?.('analyze', `Analyzing document: ${url}`);
	}

	try {
		// Parse and analyze document
		const result = await client.parse({
			url,
			type: documentType,
			query,
			extractEntities: true,
			detectCrossRefs: true
		});

		if (!result.success || !result.document) {
			actionHandle?.error?.(result.error || 'Parse failed');
			return {
				success: false,
				error: result.error || 'Failed to parse document'
			};
		}

		const doc = result.document;

		// Build citations from relevant passages
		const citations = buildCitationsFromDocument(doc, query);

		// Generate summary
		const summary = generateDocumentSummary(doc);

		// Complete action
		actionHandle?.complete?.(
			`Analyzed ${doc.title}: ${doc.sections.length} sections, ${doc.entities.length} entities`
		);

		return {
			success: true,
			document: doc,
			summary,
			citations
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		actionHandle?.error?.(errorMessage);
		return {
			success: false,
			error: errorMessage
		};
	}
}

// ============================================================================
// Multi-Document Analysis (Parallel Processing)
// ============================================================================

/**
 * Options for parallel document analysis
 */
export interface MultiDocumentAnalysisOptions {
	/** Query for relevance scoring across all documents */
	query: string;
	/** Document type hint (auto-detected if not provided) */
	documentType?: DocumentType;
	/** Optional ThoughtEmitter for streaming updates */
	emitter?: ThoughtEmitter;
	/** Relevance scores for prioritization (optional, keyed by URL) */
	relevanceScores?: Map<string, number>;
	/** Custom timeout per document (defaults to 60s) */
	timeoutMs?: number;
}

/**
 * Result from multi-document analysis
 */
export interface MultiDocumentAnalysisResult {
	/** Whether the overall operation succeeded (at least one document parsed) */
	success: boolean;
	/** Successfully parsed documents */
	documents: ParsedDocument[];
	/** Summary text across all documents */
	summary?: string;
	/** Aggregated citations from all documents */
	citations?: Citation[];
	/** Documents that failed to parse */
	errors: Array<{ url: string; error: string }>;
	/** Statistics about the operation */
	stats: {
		total: number;
		successful: number;
		failed: number;
		timedOut: number;
		cached: number;
		totalTimeMs: number;
	};
}

/**
 * Execute document analysis on multiple documents in parallel.
 *
 * This is the preferred method when the agent needs to analyze multiple
 * documents (e.g., multiple SEC filings, bills, reports). It provides:
 *
 * - Parallel processing (3 docs in ~35s vs 90s+ sequential)
 * - Error isolation (one failure doesn't affect others)
 * - Timeout handling (60s max per document)
 * - Prioritization by relevance when exceeding limits
 * - Progress events for UI feedback
 *
 * @param urls - Array of document URLs to analyze
 * @param options - Analysis options with query and emitter
 * @returns Results with documents, errors, and stats
 *
 * @example
 * ```typescript
 * const result = await executeMultipleDocumentTool(
 *   [
 *     'https://sec.gov/filing1.pdf',
 *     'https://sec.gov/filing2.pdf',
 *     'https://congress.gov/bill123'
 *   ],
 *   {
 *     query: 'executive compensation disclosure',
 *     emitter,
 *     relevanceScores: new Map([
 *       ['https://sec.gov/filing1.pdf', 0.9],
 *       ['https://sec.gov/filing2.pdf', 0.7],
 *       ['https://congress.gov/bill123', 0.5]
 *     ])
 *   }
 * );
 *
 * console.log(`Analyzed ${result.stats.successful}/${result.stats.total} documents`);
 * ```
 */
export async function executeMultipleDocumentTool(
	urls: string[],
	options: MultiDocumentAnalysisOptions
): Promise<MultiDocumentAnalysisResult> {
	const {
		query,
		documentType,
		emitter,
		relevanceScores,
		timeoutMs = ANALYSIS_TIMEOUT_MS
	} = options;

	const client = getReductoClient();

	// Create progress callback that bridges to emitter
	const onProgress: DocumentAnalysisEventCallback | undefined = emitter
		? (event) => emitter.handleDocumentAnalysisEvent(event)
		: undefined;

	// Execute parallel parsing
	const parseResult = await client.parseMultiple(urls, {
		query,
		type: documentType,
		extractEntities: true,
		detectCrossRefs: true,
		onProgress,
		relevanceScores,
		timeoutMs
	});

	// Process results
	const documents: ParsedDocument[] = [];
	const errors: Array<{ url: string; error: string }> = [];
	const allCitations: Citation[] = [];

	parseResult.results.forEach((result, index) => {
		const url = urls[index];
		if (result.success && result.document) {
			documents.push(result.document);

			// Build citations for this document
			const docCitations = buildCitationsFromDocument(result.document, query);
			allCitations.push(...docCitations);
		} else {
			errors.push({
				url,
				error: result.error || 'Unknown error'
			});
		}
	});

	// Generate combined summary
	let summary: string | undefined;
	if (documents.length > 0) {
		const summaryParts = documents.map((doc) => generateDocumentSummary(doc));
		summary = `## Document Analysis Results\n\n${summaryParts.join('\n\n---\n\n')}`;
	}

	return {
		success: documents.length > 0,
		documents,
		summary,
		citations: allCitations.length > 0 ? allCitations : undefined,
		errors,
		stats: parseResult.stats
	};
}

/**
 * Re-export constants for external use
 */
export {
	MAX_PARALLEL_DOCUMENTS,
	ANALYSIS_TIMEOUT_MS,
	ESTIMATED_TIME_PER_DOCUMENT_MS
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build L1 citations from parsed document
 */
function buildCitationsFromDocument(doc: ParsedDocument, query: string): Citation[] {
	const citations: Citation[] = [];

	// Citation from relevant passages
	if (doc.queryRelevance?.passages) {
		for (const passage of doc.queryRelevance.passages.slice(0, 3)) {
			citations.push({
				id: `doc-${doc.id}-${passage.sectionId}`,
				label: `${doc.title} - ${getSectionTitle(doc, passage.sectionId)}`,
				url: doc.source.url,
				excerpt: passage.text.slice(0, 200) + (passage.text.length > 200 ? '...' : ''),
				sourceType: 'document',
				documentId: doc.id
			});
		}
	}

	// If no relevant passages, cite the document itself
	if (citations.length === 0) {
		citations.push({
			id: `doc-${doc.id}`,
			label: doc.title,
			url: doc.source.url,
			excerpt: doc.sections[0]?.content.slice(0, 200) || 'Document analyzed',
			sourceType: 'document',
			documentId: doc.id
		});
	}

	return citations;
}

/**
 * Get section title by ID
 */
function getSectionTitle(doc: ParsedDocument, sectionId: string): string {
	const section = doc.sections.find((s) => s.id === sectionId);
	return section?.title || 'Section';
}

/**
 * Generate a brief summary of the document
 */
function generateDocumentSummary(doc: ParsedDocument): string {
	const parts: string[] = [];

	// Basic info
	parts.push(`**${doc.title}**`);
	parts.push(`Source: ${doc.source.name}`);

	if (doc.source.date) {
		parts.push(`Date: ${doc.source.date}`);
	}

	// Structure overview
	parts.push(`\nStructure: ${doc.sections.length} sections, ${doc.metadata.pageCount} pages`);

	// Key entities summary
	if (doc.entities.length > 0) {
		const entityTypes = new Map<string, number>();
		for (const entity of doc.entities) {
			entityTypes.set(entity.type, (entityTypes.get(entity.type) || 0) + 1);
		}

		const entitySummary = Array.from(entityTypes.entries())
			.map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
			.join(', ');

		parts.push(`Key entities: ${entitySummary}`);
	}

	// Relevance summary
	if (doc.queryRelevance) {
		parts.push(`\nRelevance: ${doc.queryRelevance.summary}`);

		if (doc.queryRelevance.passages.length > 0) {
			parts.push('\nTop findings:');
			for (const passage of doc.queryRelevance.passages.slice(0, 2)) {
				parts.push(`- "${passage.text.slice(0, 100)}..."`);
			}
		}
	}

	return parts.join('\n');
}

// ============================================================================
// Document Type Helpers (re-exported from document-helpers.ts for backward compatibility)
// ============================================================================

export { getDocumentTypeIcon, getDocumentTypeColor } from './document-helpers';
