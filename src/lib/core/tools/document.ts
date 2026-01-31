/**
 * Document Tool
 *
 * Agent-invocable tool for document analysis.
 * Integrates with Reducto for parsing and ThoughtEmitter for citations.
 *
 * @module tools/document
 */

import { getReductoClient } from '$lib/server/reducto/client';
import type { ParsedDocument, DocumentType } from '$lib/server/reducto/types';
import type { Citation, ThoughtEmitter } from '$lib/core/thoughts/types';

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
	let actionHandle: any;
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
// Document Type Helpers
// ============================================================================

/**
 * Get icon for document type (for L1 citations)
 */
export function getDocumentTypeIcon(type: DocumentType): string {
	const icons: Record<DocumentType, string> = {
		legislative: '📜',
		official: '📋',
		media: '📰',
		corporate: '📊',
		academic: '📚'
	};
	return icons[type] || '📄';
}

/**
 * Get color token for document type (for peripheral encoding)
 */
export function getDocumentTypeColor(type: DocumentType): string {
	const colors: Record<DocumentType, string> = {
		legislative: 'var(--doc-legislative, oklch(0.75 0.15 85))', // amber
		official: 'var(--doc-official, oklch(0.55 0.03 260))', // slate
		media: 'var(--doc-media, oklch(0.6 0.15 250))', // blue
		corporate: 'var(--doc-corporate, oklch(0.6 0.15 160))', // emerald
		academic: 'var(--doc-academic, oklch(0.6 0.15 300))' // purple
	};
	return colors[type] || 'var(--color-text-secondary)';
}
