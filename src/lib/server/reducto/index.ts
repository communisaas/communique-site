/**
 * Reducto Document Intelligence
 *
 * API wrapper and types for document parsing with Reducto.
 * Enables L3 depth layer with structure extraction and entity recognition.
 *
 * @module reducto
 */

// Client
export { ReductoClient, getReductoClient, initReductoClient } from './client';

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
	AnalysisResult,
	ParsedDocumentDocument
} from './types';
