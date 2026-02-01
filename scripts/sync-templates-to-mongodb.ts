/**
 * Sync Templates to MongoDB for Vector Search
 *
 * Reads templates from PostgreSQL and syncs them to MongoDB
 * with embeddings for vector search functionality.
 *
 * Usage:
 *   npx tsx scripts/sync-templates-to-mongodb.ts
 *
 * For production:
 *   DATABASE_URL="..." MONGODB_URI="..." npx tsx scripts/sync-templates-to-mongodb.ts
 */

import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const prisma = new PrismaClient();

// Gemini embedding generation
async function generateEmbedding(text: string): Promise<number[] | null> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.warn('[Sync] No GEMINI_API_KEY, skipping embedding generation');
		return null;
	}

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'models/text-embedding-004',
					content: { parts: [{ text }] },
					taskType: 'RETRIEVAL_DOCUMENT'
				})
			}
		);

		if (!response.ok) {
			console.error('[Sync] Embedding API error:', await response.text());
			return null;
		}

		const data = await response.json();
		return data.embedding?.values || null;
	} catch (error) {
		console.error('[Sync] Embedding generation failed:', error);
		return null;
	}
}

async function main() {
	console.log('🔄 Syncing Templates to MongoDB for Vector Search\n');

	// Connect to MongoDB
	const mongoUri = process.env.MONGODB_URI;
	if (!mongoUri) {
		console.error('❌ MONGODB_URI environment variable is required');
		process.exit(1);
	}

	const mongoClient = new MongoClient(mongoUri);
	await mongoClient.connect();
	console.log('✅ Connected to MongoDB');

	const db = mongoClient.db();
	const collection = db.collection('template_search_cache');

	// Clear existing data
	const deleteResult = await collection.deleteMany({});
	console.log(`🧹 Cleared ${deleteResult.deletedCount} existing documents`);

	// Fetch templates from PostgreSQL
	const templates = await prisma.template.findMany({
		where: { is_public: true },
		select: {
			id: true,
			slug: true,
			title: true,
			description: true,
			category: true,
			message_body: true,
			topics: true,
			topic_embedding: true,
			location_embedding: true
		}
	});

	console.log(`📋 Found ${templates.length} templates in PostgreSQL\n`);

	let synced = 0;
	let embeddingsGenerated = 0;

	for (const template of templates) {
		// Create searchable text combining all relevant fields
		const searchText = [
			template.title,
			template.description,
			template.category,
			template.message_body,
			...(template.topics || [])
		].filter(Boolean).join(' ');

		// Use existing embedding from PostgreSQL or generate new one
		let embedding: number[] | null = null;

		// PostgreSQL stores embeddings as Prisma Decimal array, need to convert
		if (template.topic_embedding && Array.isArray(template.topic_embedding)) {
			embedding = template.topic_embedding.map((v: unknown) =>
				typeof v === 'number' ? v : parseFloat(String(v))
			);
		}

		// Generate embedding if not available
		if (!embedding || embedding.length === 0) {
			console.log(`  ⚡ Generating embedding for "${template.title.substring(0, 40)}..."`);
			embedding = await generateEmbedding(searchText);
			embeddingsGenerated++;

			// Rate limit to avoid API throttling
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		// Insert into MongoDB
		await collection.insertOne({
			template_id: template.id,
			slug: template.slug,
			title: template.title,
			description: template.description,
			category: template.category,
			topics: template.topics || [],
			embedding: embedding,
			synced_at: new Date()
		});

		synced++;
		console.log(`  ✓ Synced: "${template.title.substring(0, 50)}${template.title.length > 50 ? '...' : ''}"`);
	}

	// Create indexes
	console.log('\n📇 Creating indexes...');

	// Text index for fallback search
	try {
		await collection.createIndex(
			{ title: 'text', description: 'text', category: 'text' },
			{ name: 'text_search_index' }
		);
		console.log('  ✓ Created text search index');
	} catch (e) {
		console.log('  ⚠ Text index may already exist');
	}

	// Note about vector index
	console.log('\n⚠️  IMPORTANT: Vector Search Index Required');
	console.log('   You must create the vector index in MongoDB Atlas UI:');
	console.log('   1. Go to Atlas > Database > Browse Collections');
	console.log('   2. Select template_search_cache collection');
	console.log('   3. Go to "Search Indexes" tab');
	console.log('   4. Create index with this JSON definition:');
	console.log(`
{
  "type": "vectorSearch",
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}
`);
	console.log('   5. Name the index: template_vector_index');

	// Summary
	console.log('\n📊 Sync Summary');
	console.log('═══════════════════════════════════════');
	console.log(`Templates synced:      ${synced}`);
	console.log(`Embeddings generated:  ${embeddingsGenerated}`);
	console.log(`Collection:            template_search_cache`);
	console.log('');

	await mongoClient.close();
	await prisma.$disconnect();

	console.log('✅ Sync complete!');
}

main().catch(console.error);
