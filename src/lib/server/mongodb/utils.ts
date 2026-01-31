/**
 * MongoDB Utility Functions
 *
 * Common operations and helpers for working with MongoDB collections.
 */

import { ObjectId } from 'mongodb';
import { createHash } from 'crypto';

/**
 * Generate a query hash for caching
 * Creates a deterministic hash from query parameters
 *
 * @param params - Object containing query parameters
 * @returns 32-character hex hash
 *
 * @example
 * const hash = generateQueryHash({
 *   targetType: 'legislative',
 *   targetEntity: 'US Senate',
 *   topics: ['healthcare']
 * });
 */
export function generateQueryHash(params: Record<string, unknown>): string {
	// Sort keys for deterministic hashing
	const sortedKeys = Object.keys(params).sort();
	const normalized: Record<string, unknown> = {};

	for (const key of sortedKeys) {
		const value = params[key];
		// Normalize arrays by sorting
		normalized[key] = Array.isArray(value) ? [...value].sort() : value;
	}

	const stringified = JSON.stringify(normalized);
	return createHash('sha256').update(stringified).digest('hex');
}

/**
 * Normalize a name for consistent matching
 * Converts to lowercase and normalizes whitespace
 *
 * @param name - Name to normalize
 * @returns Normalized name
 *
 * @example
 * normalizeName('  ACME  Corp. ') // => 'acme corp.'
 */
export function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ');
}

/**
 * Create a TTL expiration date
 *
 * @param days - Number of days until expiration
 * @returns Date object set to expire after specified days
 *
 * @example
 * const expiresAt = createTTL(30); // Expires in 30 days
 */
export function createTTL(days: number): Date {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date;
}

/**
 * Check if a document is expired
 *
 * @param expiresAt - Optional expiration date
 * @returns true if document is expired
 */
export function isExpired(expiresAt?: Date): boolean {
	if (!expiresAt) return false;
	return new Date() > expiresAt;
}

/**
 * Convert string ID to ObjectId
 * Safely handles invalid IDs
 *
 * @param id - String representation of ObjectId
 * @returns ObjectId or null if invalid
 */
export function toObjectId(id: string): ObjectId | null {
	try {
		return new ObjectId(id);
	} catch {
		return null;
	}
}

/**
 * Validate ObjectId string
 *
 * @param id - String to validate
 * @returns true if valid ObjectId string
 */
export function isValidObjectId(id: string): boolean {
	return ObjectId.isValid(id);
}

/**
 * Extract domain from URL
 *
 * @param url - URL to extract domain from
 * @returns Domain or null if invalid
 *
 * @example
 * extractDomain('https://www.example.com/path') // => 'example.com'
 */
export function extractDomain(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, '');
	} catch {
		return null;
	}
}

/**
 * Create a projection object for common fields
 *
 * @param includeEmbedding - Whether to include embedding field
 * @returns Projection object
 */
export function createBasicProjection(includeEmbedding = false) {
	const projection: Record<string, number> = {
		_id: 1,
		createdAt: 1,
		updatedAt: 1
	};

	if (!includeEmbedding) {
		projection.embedding = 0;
	}

	return projection;
}

/**
 * Build a text search query
 *
 * @param searchText - Text to search for
 * @returns MongoDB text search query
 *
 * @example
 * const query = buildTextSearchQuery('healthcare policy');
 * const results = await collection.find(query).toArray();
 */
export function buildTextSearchQuery(searchText: string) {
	return { $text: { $search: searchText } };
}

/**
 * Build a date range query
 *
 * @param field - Field name to query
 * @param start - Start date (optional)
 * @param end - End date (optional)
 * @returns MongoDB date range query
 */
export function buildDateRangeQuery(
	field: string,
	start?: Date,
	end?: Date
): Record<string, unknown> {
	const query: Record<string, unknown> = {};

	if (start || end) {
		const range: Record<string, Date> = {};
		if (start) range.$gte = start;
		if (end) range.$lte = end;
		query[field] = range;
	}

	return query;
}

/**
 * Increment cache hit count
 * Returns update operation for bulkWrite
 *
 * @param _id - Document ID
 * @returns Update operation
 */
export function incrementHitCount(_id: ObjectId) {
	return {
		updateOne: {
			filter: { _id },
			update: {
				$inc: { hitCount: 1 },
				$set: { lastHitAt: new Date() }
			}
		}
	};
}

/**
 * Build a topic filter query
 *
 * @param topics - Array of topics to match
 * @param matchAll - If true, document must have all topics (default: false)
 * @returns MongoDB query
 *
 * @example
 * // Match any of the topics
 * buildTopicQuery(['healthcare', 'education'])
 *
 * // Match all topics
 * buildTopicQuery(['healthcare', 'education'], true)
 */
export function buildTopicQuery(
	topics: string[],
	matchAll = false
): Record<string, unknown> {
	if (topics.length === 0) return {};

	return {
		topics: matchAll ? { $all: topics } : { $in: topics }
	};
}

/**
 * Sanitize user input for MongoDB query
 * Prevents NoSQL injection by removing $ and . from keys
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeQuery<T extends Record<string, unknown>>(obj: T): T {
	const sanitized = {} as T;

	for (const [key, value] of Object.entries(obj)) {
		// Skip keys with $ or .
		if (key.includes('$') || key.includes('.')) {
			continue;
		}

		// Recursively sanitize nested objects
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			sanitized[key as keyof T] = sanitizeQuery(
				value as Record<string, unknown>
			) as T[keyof T];
		} else {
			sanitized[key as keyof T] = value as T[keyof T];
		}
	}

	return sanitized;
}

/**
 * Calculate cosine similarity between two vectors
 * Used for vector search result validation
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity (-1 to 1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error('Vectors must have same length');
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Create a MongoDB aggregation pipeline for pagination
 *
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of documents per page
 * @returns Array of aggregation stages
 */
export function createPaginationPipeline(page = 1, pageSize = 20) {
	const skip = (page - 1) * pageSize;

	return [
		{ $skip: skip },
		{ $limit: pageSize },
		{
			$facet: {
				documents: [{ $skip: 0 }],
				totalCount: [{ $count: 'count' }]
			}
		}
	];
}

/**
 * Parse MongoDB error for user-friendly message
 *
 * @param error - MongoDB error
 * @returns User-friendly error message
 */
export function parseMongoError(error: unknown): string {
	if (error && typeof error === 'object' && 'code' in error) {
		const mongoError = error as { code: number; message: string };

		switch (mongoError.code) {
			case 11000:
				return 'A document with this information already exists';
			case 121:
				return 'Document validation failed';
			default:
				return mongoError.message || 'Database operation failed';
		}
	}

	return 'An unknown database error occurred';
}
