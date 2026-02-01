/**
 * Reducto Document Intelligence
 *
 * API wrapper and types for document parsing with Reducto.
 * Enables L3 depth layer with structure extraction and entity recognition.
 *
 * Parallel Processing:
 * - parseMultiple() for batch document analysis
 * - Progress events for perceptual engineering
 * - Automatic prioritization and timeout handling
 *
 * @module reducto
 */

// Client
export {
	ReductoClient,
	getReductoClient,
	resetReductoClient,
	// Parallel processing constants
	MAX_PARALLEL_DOCUMENTS,
	MAX_DOCUMENT_SIZE_BYTES,
	ANALYSIS_TIMEOUT_MS,
	ESTIMATED_TIME_PER_DOCUMENT_MS
} from './client';

// Types
export type {
	DocumentType,
	DocumentSource,
	DocumentSection,
	DocumentEntity,
	RelevantPassage,
	DocumentCrossRef,
	ParsedDocument,
	ParseOptions,
	ParseResult,
	// Parallel processing types
	DocumentAnalysisProgress,
	AnalysisStartEvent,
	DocumentProgressEvent,
	DocumentInterimEvent,
	AnalysisCompleteEvent,
	DocumentAnalysisEvent,
	DocumentAnalysisEventCallback,
	ParseMultipleOptions,
	ParseMultipleResult
} from './types';

// MongoDB cache type is in mongodb/schema
export type { ParsedDocumentCacheDocument } from '$lib/server/mongodb/schema';
