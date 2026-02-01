/**
 * Template Semantic Search API
 *
 * Uses MongoDB vector search for natural language template discovery.
 * Enables "find templates about climate" → returns semantically similar results.
 *
 * Hackathon Demo Value:
 * - MongoDB Atlas vector search in action
 * - Natural language → relevant templates
 * - Sub-100ms response times with proper indexing
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDatabase } from '$lib/server/mongodb';

// Gemini embeddings for query encoding
async function generateQueryEmbedding(query: string): Promise<number[] | null> {
	try {
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			console.warn('[Template Search] No GEMINI_API_KEY, falling back to text search');
			return null;
		}

		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'models/text-embedding-004',
					content: { parts: [{ text: query }] },
					taskType: 'RETRIEVAL_QUERY'
				})
			}
		);

		if (!response.ok) {
			console.error('[Template Search] Embedding API error:', await response.text());
			return null;
		}

		const data = await response.json();
		return data.embedding?.values || null;
	} catch (error) {
		console.error('[Template Search] Embedding generation failed:', error);
		return null;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { query, limit = 20 } = await request.json();

		if (!query || typeof query !== 'string') {
			return json({ error: 'Query is required' }, { status: 400 });
		}

		// Get database (will wait for connection if still warming up)
		let db;
		try {
			db = await getDatabase();
		} catch (dbError) {
			console.warn('[Template Search] MongoDB connection failed:', dbError);
			return json({ results: [], source: 'unavailable' });
		}
		const collection = db.collection('template_search_cache');

		// Try to generate embedding for semantic search
		const embedding = await generateQueryEmbedding(query);

		let results: unknown[];
		let searchType: string;

		if (embedding && embedding.length > 0) {
			// Vector search with MongoDB Atlas
			// Note: Requires vector search index named 'template_vector_index' on the collection
			try {
				results = await collection
					.aggregate([
						{
							$vectorSearch: {
								index: 'template_vector_index',
								path: 'embedding',
								queryVector: embedding,
								numCandidates: limit * 10,
								limit: limit
							}
						},
						{
							$project: {
								_id: 0,
								id: '$template_id',
								title: 1,
								description: 1,
								category: 1,
								topics: 1,
								score: { $meta: 'vectorSearchScore' }
							}
						}
					])
					.toArray();
				searchType = 'vector';
			} catch (vectorError) {
				// Vector index might not exist, fall back to text search
				console.warn('[Template Search] Vector search failed, using text search:', vectorError);
				results = await textSearch(collection, query, limit);
				searchType = 'text-fallback';
			}
		} else {
			// Text search fallback
			results = await textSearch(collection, query, limit);
			searchType = 'text';
		}

		return json({
			results,
			query,
			count: results.length,
			searchType
		});
	} catch (error) {
		console.error('[Template Search] Error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
};

async function textSearch(collection: unknown, query: string, limit: number): Promise<unknown[]> {
	// Simple regex-based search as fallback
	const searchRegex = new RegExp(query.split(/\s+/).join('|'), 'i');

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (collection as any)
		.find({
			$or: [
				{ title: searchRegex },
				{ description: searchRegex },
				{ category: searchRegex },
				{ topics: searchRegex }
			]
		})
		.limit(limit)
		.project({
			_id: 0,
			id: '$template_id',
			title: 1,
			description: 1,
			category: 1,
			topics: 1
		})
		.toArray();
}

// GET endpoint for simple text search (no embedding needed)
export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const limit = parseInt(url.searchParams.get('limit') || '20');

	if (!query) {
		return json({ results: [], count: 0 });
	}

	// For GET, just do simple text matching without embeddings
	// This is faster for autocomplete-style search
	let db;
	try {
		db = await getDatabase();
	} catch (dbError) {
		console.warn('[Template Search] MongoDB connection failed:', dbError);
		return json({ results: [], source: 'unavailable' });
	}

	try {
		const collection = db.collection('template_search_cache');
		const results = await textSearch(collection, query, limit);

		return json({
			results,
			query,
			count: results.length,
			searchType: 'text'
		});
	} catch (error) {
		console.error('[Template Search] GET error:', error);
		return json({ results: [], error: 'Search failed' });
	}
};
