/**
 * Reducto Document Intelligence
 *
 * API wrapper and types for document parsing with Reducto.
 * Enables L3 depth layer with structure extraction and entity recognition.
 *
 * @module reducto
 */

// Client
export { ReductoClient, getReductoClient, resetReductoClient } from './client';

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
	AnalyzeOptions,
	AnalysisResult
} from './types';

// MongoDB cache type is in mongodb/schema
export type { ParsedDocumentCacheDocument } from '$lib/server/mongodb/schema';
