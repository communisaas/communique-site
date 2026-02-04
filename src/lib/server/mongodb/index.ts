/**
 * MongoDB Integration Layer - Main Export
 *
 * This module provides a clean API for working with MongoDB in Communique.
 */

// Client and database access
export {
	getMongoClient,
	getDatabase,
	closeMongoClient,
	testMongoConnection
} from '../mongodb';

// Collection accessors
export {
	getIntelligenceCollection,
	getParsedDocumentsCollection,
	collectionAccessors
} from './collections';

// Schema types
export type {
	IntelligenceItemDocument,
	IntelligenceCategory,
	GeographicScope,
	Sentiment,
	CollectionName,
	ParsedDocumentCacheDocument
} from './schema';

export { COLLECTIONS, DATABASE_NAME } from './schema';

// Index management
export {
	ensureAllIndexes,
	dropAllIndexes,
	listCollectionIndexes
} from './indexes';

// Query builders
export {
	queryIntelligence,
	findIntelligenceByTopics,
	findRecentIntelligence,
	insertIntelligenceItem,
	bulkInsertIntelligence
} from './queries';

export type { IntelligenceQueryOptions } from './queries';

// Utility functions
export {
	generateQueryHash,
	normalizeName,
	createTTL,
	isExpired,
	toObjectId,
	isValidObjectId,
	extractDomain,
	createBasicProjection,
	buildTextSearchQuery,
	buildDateRangeQuery,
	incrementHitCount,
	buildTopicQuery,
	sanitizeQuery,
	cosineSimilarity,
	createPaginationPipeline,
	parseMongoError
} from './utils';

// Service layer (recommended for application code)
export {
	MongoDBService,
	IntelligenceService
} from './service';

// Re-export default service as primary interface
export { default } from './service';
