/**
 * Reducto Document Intelligence Types
 *
 * Type definitions for parsed documents with structure extraction.
 * Enables L3 depth layer with section navigation, entities, and query relevance.
 *
 * @module reducto/types
 */

// ============================================================================
// Document Types
// ============================================================================

/**
 * Document type for visual encoding (peripheral color recognition)
 *
 * Maps to CSS custom properties:
 * - legislative: --doc-legislative (amber)
 * - official: --doc-official (slate)
 * - media: --doc-media (blue)
 * - corporate: --doc-corporate (emerald)
 * - academic: --doc-academic (purple)
 */
export type DocumentType = 'legislative' | 'official' | 'media' | 'corporate' | 'academic';

/**
 * Document source metadata
 */
export interface DocumentSource {
	/** Source name (e.g., "Congress.gov", "SEC EDGAR") */
	name: string;

	/** Source URL */
	url: string;

	/** Publication/filing date */
	date?: string;

	/** Source type for visual encoding */
	type: DocumentType;
}

// ============================================================================
// Parsed Document Structure
// ============================================================================

/**
 * A section within a parsed document
 * Enables hierarchical navigation in L3 view
 */
export interface DocumentSection {
	/** Section identifier (e.g., "§102", "Section 3.1") */
	id: string;

	/** Section title/heading */
	title: string;

	/** Nesting level (0 = top-level) */
	level: number;

	/** Section content (text) */
	content: string;

	/** Child sections */
	children?: DocumentSection[];

	/** Page number(s) in original document */
	pageNumbers?: number[];
}

/**
 * Entity extracted from document
 * Key items for quick scanning (amounts, dates, names)
 */
export interface DocumentEntity {
	/** Entity type */
	type: 'amount' | 'date' | 'person' | 'organization' | 'location' | 'reference';

	/** Entity value as extracted */
	value: string;

	/** Normalized value (e.g., parsed date, numeric amount) */
	normalized?: string | number | Date;

	/** Context around the entity */
	context: string;

	/** Section where entity appears */
	sectionId?: string;
}

/**
 * A passage particularly relevant to the user's query
 */
export interface RelevantPassage {
	/** Passage text */
	text: string;

	/** Section containing this passage */
	sectionId: string;

	/** Relevance score (0-1) */
	score: number;

	/** Why this passage is relevant */
	reason: string;
}

/**
 * Cross-reference to another document
 */
export interface DocumentCrossRef {
	/** Reference text as it appears */
	text: string;

	/** Target document ID (if we have it parsed) */
	targetDocId?: string;

	/** External URL (if resolvable) */
	url?: string;

	/** Type of reference */
	type: 'citation' | 'amendment' | 'supersedes' | 'related';
}

/**
 * Fully parsed document with Reducto intelligence
 *
 * This is what we cache in MongoDB and display in L3 view.
 */
export interface ParsedDocument {
	/** Unique document ID (MongoDB _id when cached) */
	id: string;

	/** Document title */
	title: string;

	/** Source information */
	source: DocumentSource;

	/** Document type for visual encoding */
	type: DocumentType;

	/** Hierarchical section structure */
	sections: DocumentSection[];

	/** Extracted entities */
	entities: DocumentEntity[];

	/** Cross-references to other documents */
	crossRefs: DocumentCrossRef[];

	/** Query relevance (computed when retrieved for specific query) */
	queryRelevance?: {
		/** Overall relevance score (0-1) */
		score: number;

		/** Sections most relevant to query */
		relevantSections: string[];

		/** Key passages matching query */
		passages: RelevantPassage[];

		/** Summary of why document is relevant */
		summary: string;
	};

	/** Parsing metadata */
	metadata: {
		/** When document was parsed */
		parsedAt: Date;

		/** Original document URL */
		sourceUrl: string;

		/** Total page count */
		pageCount: number;

		/** Reducto job ID for reference */
		reductoJobId?: string;
	};
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Options for parsing a document
 */
export interface ParseOptions {
	/** URL of document to parse */
	url: string;

	/** Document type hint (auto-detected if not provided) */
	type?: DocumentType;

	/** Query for relevance scoring */
	query?: string;

	/** Whether to extract entities */
	extractEntities?: boolean;

	/** Whether to detect cross-references */
	detectCrossRefs?: boolean;
}

/**
 * Options for analyzing a document
 */
export interface AnalyzeOptions {
	/** Document ID (must be already parsed) */
	documentId: string;

	/** Query to analyze against */
	query: string;

	/** Maximum relevant passages to return */
	maxPassages?: number;
}

/**
 * Parse result from Reducto API
 */
export interface ParseResult {
	/** Whether parsing succeeded */
	success: boolean;

	/** Parsed document (if successful) */
	document?: ParsedDocument;

	/** Error message (if failed) */
	error?: string;

	/** Whether result was from cache */
	cached: boolean;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
	/** Whether analysis succeeded */
	success: boolean;

	/** Query relevance data */
	relevance?: ParsedDocument['queryRelevance'];

	/** Error message (if failed) */
	error?: string;
}

// ============================================================================
// MongoDB Cache Types
// ============================================================================

// Note: The MongoDB cache schema is now defined in:
// src/lib/server/mongodb/schema.ts as ParsedDocumentCacheDocument
//
// This provides:
// - Proper ObjectId typing
// - TTL index on expiresAt (30 days)
// - Unique index on sourceUrlHash for deduplication
// - Index on documentType for filtering
// - Hit count tracking for cache statistics

// ============================================================================
// Reducto Extract API Types (Structured Extraction)
// ============================================================================

/**
 * Schema field for Extract API
 * Defines what to extract from the document
 */
export interface ExtractSchemaField {
	/** Field name (becomes key in extracted data) */
	name: string;
	/** Description for the AI to understand what to extract */
	description: string;
	/** Data type */
	type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
	/** Whether this field is required */
	required?: boolean;
	/** For array/object types, nested schema */
	items?: ExtractSchemaField;
	properties?: ExtractSchemaField[];
}

/**
 * Schema for Extract API request
 */
export interface ExtractSchema {
	/** Schema fields to extract */
	fields: ExtractSchemaField[];
	/** Optional context to guide extraction */
	context?: string;
}

/**
 * Result from Extract API
 */
export interface ExtractResult {
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
	/** Confidence scores per field (0-1) */
	confidence?: Record<string, number>;
	/** Source citations for extracted data */
	citations?: Record<string, string>;
}

// ============================================================================
// Legislative Bill Extraction Types
// ============================================================================

/**
 * Sponsor/cosponsor information
 */
export interface BillSponsor {
	name: string;
	party: 'D' | 'R' | 'I' | string;
	state: string;
	district?: number;
	role: 'sponsor' | 'cosponsor';
}

/**
 * Funding allocation in a bill
 */
export interface BillFunding {
	program: string;
	amount: number;
	fiscalYear?: number;
	duration?: string;
	purpose?: string;
}

/**
 * Key provision in a bill
 */
export interface BillProvision {
	section: string;
	title: string;
	summary: string;
	effectiveDate?: string;
	impactedEntities?: string[];
}

/**
 * Definition from a bill
 */
export interface BillDefinition {
	term: string;
	definition: string;
	section?: string;
}

/**
 * Structured extraction of a legislative bill
 */
export interface ExtractedBill {
	/** Bill identifier (e.g., "H.R. 1234") */
	billNumber: string;
	/** Official title */
	title: string;
	/** Short title (if different) */
	shortTitle?: string;
	/** Congress number */
	congress: number;
	/** Chamber of origin */
	chamber: 'house' | 'senate';
	/** Date introduced */
	introducedDate?: string;
	/** Primary sponsor */
	sponsor?: BillSponsor;
	/** Cosponsors */
	cosponsors: BillSponsor[];
	/** Total cosponsors count */
	cosponsorsCount: number;
	/** Policy area */
	policyArea?: string;
	/** Subject keywords */
	subjects: string[];
	/** Purpose statement */
	purpose?: string;
	/** Key provisions */
	provisions: BillProvision[];
	/** Funding allocations */
	funding: BillFunding[];
	/** Definitions */
	definitions: BillDefinition[];
	/** Effective date(s) */
	effectiveDates?: string[];
	/** Sunset/expiration date */
	sunsetDate?: string;
	/** Amendments to existing law */
	amendsLaws?: string[];
	/** Extraction metadata */
	extractionMetadata: {
		extractedAt: Date;
		confidence: number;
		reductoJobId?: string;
	};
}

/**
 * Options for bill extraction
 */
export interface BillExtractOptions {
	/** URL of the bill document */
	url: string;
	/** Bill type hint */
	billType?: 'hr' | 's' | 'hjres' | 'sjres';
	/** Congress number (for validation) */
	congress?: number;
	/** Include definitions section */
	includeDefinitions?: boolean;
	/** Maximum provisions to extract */
	maxProvisions?: number;
}

/**
 * Result from bill extraction
 */
export interface BillExtractResult {
	success: boolean;
	bill?: ExtractedBill;
	error?: string;
	cached: boolean;
}

// ============================================================================
// Parallel Processing Configuration
// ============================================================================

/** Maximum documents to process in parallel (API rate limits) */
export const MAX_PARALLEL_DOCUMENTS = 3;

/** Maximum document size in bytes (10 MB) */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Analysis timeout per document in milliseconds (60 seconds) */
export const ANALYSIS_TIMEOUT_MS = 60_000;

/** Estimated time per document for progress calculations (30 seconds) */
export const ESTIMATED_TIME_PER_DOCUMENT_MS = 30_000;

// ============================================================================
// Parallel Processing Types
// ============================================================================

/**
 * Progress callback for document analysis lifecycle events.
 * Enables perceptual engineering for long-running operations.
 */
export interface DocumentAnalysisProgress {
	/** Event type for UI state management */
	type: 'analysis_start' | 'document_progress' | 'document_interim' | 'analysis_complete';
}

/**
 * Emitted when document analysis begins.
 * Timing budget: 0-1s user expects immediate feedback.
 */
export interface AnalysisStartEvent extends DocumentAnalysisProgress {
	type: 'analysis_start';
	/** Number of documents being analyzed */
	count: number;
	/** Estimated total time in milliseconds */
	estimatedTimeMs: number;
	/** Whether documents are being processed in parallel */
	parallel: boolean;
	/** Document URLs being analyzed */
	urls: string[];
}

/**
 * Emitted as each document progresses through stages.
 * Timing budget: 1-30s user expects granular progress.
 */
export interface DocumentProgressEvent extends DocumentAnalysisProgress {
	type: 'document_progress';
	/** Index of this document (0-based) */
	index: number;
	/** Total documents being analyzed */
	total: number;
	/** Document URL */
	url: string;
	/** Document title (if known) */
	title?: string;
	/** Current stage of analysis */
	stage: 'queued' | 'parsing' | 'extracting' | 'complete' | 'error' | 'timeout';
	/** Time elapsed for this document in milliseconds */
	timeElapsedMs: number;
	/** Error message if stage is 'error' or 'timeout' */
	error?: string;
	/** Whether result was from cache */
	cached?: boolean;
}

/**
 * Emitted when interim findings are discovered.
 * Prevents user from thinking the system is stuck.
 */
export interface DocumentInterimEvent extends DocumentAnalysisProgress {
	type: 'document_interim';
	/** Index of the document */
	documentIndex: number;
	/** Description of the finding */
	finding: string;
	/** Confidence in this finding (0-1) */
	confidence: number;
}

/**
 * Emitted when all document analysis completes.
 */
export interface AnalysisCompleteEvent extends DocumentAnalysisProgress {
	type: 'analysis_complete';
	/** Total documents processed */
	total: number;
	/** Successfully parsed documents */
	successful: number;
	/** Failed documents */
	failed: number;
	/** Timed out documents */
	timedOut: number;
	/** Total time elapsed in milliseconds */
	totalTimeMs: number;
}

/**
 * Union type for all document analysis events
 */
export type DocumentAnalysisEvent =
	| AnalysisStartEvent
	| DocumentProgressEvent
	| DocumentInterimEvent
	| AnalysisCompleteEvent;

/**
 * Callback for receiving document analysis events
 */
export type DocumentAnalysisEventCallback = (event: DocumentAnalysisEvent) => void;

/**
 * Options for parallel document parsing
 */
export interface ParseMultipleOptions {
	/** Query for relevance scoring across all documents */
	query?: string;
	/** Document type hint (auto-detected if not provided) */
	type?: DocumentType;
	/** Whether to extract entities */
	extractEntities?: boolean;
	/** Whether to detect cross-references */
	detectCrossRefs?: boolean;
	/** Callback for progress events (enables perceptual engineering) */
	onProgress?: DocumentAnalysisEventCallback;
	/** Relevance scores for prioritization (optional, keyed by URL) */
	relevanceScores?: Map<string, number>;
	/** Custom timeout per document (defaults to ANALYSIS_TIMEOUT_MS) */
	timeoutMs?: number;
}

/**
 * Result from parallel document parsing
 */
export interface ParseMultipleResult {
	/** Results in the same order as input URLs */
	results: ParseResult[];
	/** Summary statistics */
	stats: {
		total: number;
		successful: number;
		failed: number;
		timedOut: number;
		cached: number;
		totalTimeMs: number;
	};
}
