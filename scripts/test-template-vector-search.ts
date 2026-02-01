/**
 * Test Template Vector Search in MongoDB
 */

import { MongoClient } from 'mongodb';

async function generateEmbedding(text: string): Promise<number[]> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) throw new Error('GEMINI_API_KEY required');

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'models/text-embedding-004',
				content: { parts: [{ text }] },
				taskType: 'RETRIEVAL_QUERY'
			})
		}
	);

	const data = await response.json();
	return data.embedding?.values;
}

async function main() {
	const mongoUri = process.env.MONGODB_URI;
	if (!mongoUri) throw new Error('MONGODB_URI required');

	const client = new MongoClient(mongoUri);
	await client.connect();
	const db = client.db('communique');
	const collection = db.collection('template_search_cache');

	// Test query
	const query = 'healthcare costs are too high';
	console.log('🔍 Query:', query);

	const embedding = await generateEmbedding(query);
	console.log('📊 Embedding generated:', embedding.length, 'dimensions\n');

	// Vector search
	const results = await collection
		.aggregate([
			{
				$vectorSearch: {
					index: 'template_vector_index',
					path: 'embedding',
					queryVector: embedding,
					numCandidates: 50,
					limit: 5
				}
			},
			{
				$project: {
					title: 1,
					category: 1,
					score: { $meta: 'vectorSearchScore' }
				}
			}
		])
		.toArray();

	console.log('✅ Vector Search Results:');
	results.forEach((r, i) => {
		console.log(`  ${i + 1}. ${r.title} (score: ${r.score.toFixed(4)})`);
	});

	await client.close();
}

main().catch(console.error);
