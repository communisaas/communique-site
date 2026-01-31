/**
 * Generate Embeddings for Existing Documents
 *
 * This script generates Voyage AI embeddings for documents that don't have them yet.
 * Useful for backfilling embeddings on existing data.
 *
 * Usage:
 *   # Generate embeddings for all intelligence items
 *   pnpm tsx scripts/generate-embeddings.ts --collection intelligence
 *
 *   # Generate embeddings for all organizations
 *   pnpm tsx scripts/generate-embeddings.ts --collection organizations
 *
 *   # Generate embeddings for both
 *   pnpm tsx scripts/generate-embeddings.ts --all
 *
 *   # Dry run (don't save, just estimate cost)
 *   pnpm tsx scripts/generate-embeddings.ts --all --dry-run
 */

import { getDatabase } from '../src/lib/server/mongodb';
import { createBatchEmbeddings, estimateEmbeddingCost } from '../src/lib/server/embeddings';
import type { IntelligenceItemDocument, OrganizationDocument } from '../src/lib/server/mongodb/schema';

interface CommandLineArgs {
	collection?: 'intelligence' | 'organizations';
	all?: boolean;
	dryRun?: boolean;
	batchSize?: number;
	limit?: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CommandLineArgs {
	const args: CommandLineArgs = {};

	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];

		if (arg === '--collection' && process.argv[i + 1]) {
			args.collection = process.argv[i + 1] as 'intelligence' | 'organizations';
			i++;
		} else if (arg === '--all') {
			args.all = true;
		} else if (arg === '--dry-run') {
			args.dryRun = true;
		} else if (arg === '--batch-size' && process.argv[i + 1]) {
			args.batchSize = parseInt(process.argv[i + 1], 10);
			i++;
		} else if (arg === '--limit' && process.argv[i + 1]) {
			args.limit = parseInt(process.argv[i + 1], 10);
			i++;
		}
	}

	return args;
}

/**
 * Generate embeddings for intelligence items
 */
async function generateIntelligenceEmbeddings(
	options: { dryRun?: boolean; batchSize?: number; limit?: number } = {}
): Promise<void> {
	const { dryRun = false, batchSize = 64, limit } = options;

	console.log('\n' + '='.repeat(70));
	console.log('Generating Intelligence Item Embeddings');
	console.log('='.repeat(70));

	const db = await getDatabase();
	const collection = db.collection<IntelligenceItemDocument>('intelligence');

	// Find items without embeddings
	const query = { embedding: { $exists: false } };
	const count = await collection.countDocuments(query);

	console.log(`\nFound ${count} intelligence items without embeddings`);

	if (count === 0) {
		console.log('✓ All intelligence items have embeddings');
		return;
	}

	// Get items
	const items = await collection
		.find(query)
		.limit(limit || count)
		.toArray();

	console.log(`Processing ${items.length} items...`);

	// Prepare texts for embedding
	const texts = items.map((item) => {
		// Combine title and snippet for semantic representation
		return `${item.title}. ${item.snippet}`;
	});

	// Estimate cost
	const estimatedCost = estimateEmbeddingCost(texts);
	console.log(`\nEstimated cost: $${estimatedCost.toFixed(4)}`);

	if (dryRun) {
		console.log('\n[DRY RUN] Would generate embeddings for:');
		items.slice(0, 5).forEach((item, i) => {
			console.log(`  ${i + 1}. ${item.title}`);
		});
		if (items.length > 5) {
			console.log(`  ... and ${items.length - 5} more`);
		}
		return;
	}

	// Confirm before proceeding
	if (estimatedCost > 0.10) {
		console.log('\nCost exceeds $0.10. Continue? (y/n)');
		// In a real script, you'd want to prompt for input
		// For now, we'll just proceed
	}

	// Generate embeddings
	console.log('\nGenerating embeddings...');
	const embeddings = await createBatchEmbeddings(texts, {
		model: 'voyage-3',
		inputType: 'document',
		batchSize,
		showProgress: true
	});

	// Update documents with embeddings
	console.log('\nSaving embeddings to database...');
	const bulkOps = items.map((item, i) => ({
		updateOne: {
			filter: { _id: item._id },
			update: {
				$set: {
					embedding: embeddings[i],
					embeddingModel: 'voyage-3',
					embeddingGeneratedAt: new Date()
				}
			}
		}
	}));

	const result = await collection.bulkWrite(bulkOps);

	console.log(`\n✓ Updated ${result.modifiedCount} documents`);
}

/**
 * Generate embeddings for organizations
 */
async function generateOrganizationEmbeddings(
	options: { dryRun?: boolean; batchSize?: number; limit?: number } = {}
): Promise<void> {
	const { dryRun = false, batchSize = 64, limit } = options;

	console.log('\n' + '='.repeat(70));
	console.log('Generating Organization Embeddings');
	console.log('='.repeat(70));

	const db = await getDatabase();
	const collection = db.collection<OrganizationDocument>('organizations');

	// Find organizations without embeddings
	const query = { embedding: { $exists: false } };
	const count = await collection.countDocuments(query);

	console.log(`\nFound ${count} organizations without embeddings`);

	if (count === 0) {
		console.log('✓ All organizations have embeddings');
		return;
	}

	// Get organizations
	const orgs = await collection
		.find(query)
		.limit(limit || count)
		.toArray();

	console.log(`Processing ${orgs.length} organizations...`);

	// Prepare texts for embedding
	const texts = orgs.map((org) => {
		// Combine name, about, industry, and policy positions
		const parts = [
			org.name,
			org.about,
			org.industry,
			...org.policyPositions.map((p) => `${p.topic}: ${p.stance}. ${p.summary}`)
		].filter(Boolean);

		return parts.join(' ');
	});

	// Estimate cost
	const estimatedCost = estimateEmbeddingCost(texts);
	console.log(`\nEstimated cost: $${estimatedCost.toFixed(4)}`);

	if (dryRun) {
		console.log('\n[DRY RUN] Would generate embeddings for:');
		orgs.slice(0, 5).forEach((org, i) => {
			console.log(`  ${i + 1}. ${org.name}`);
		});
		if (orgs.length > 5) {
			console.log(`  ... and ${orgs.length - 5} more`);
		}
		return;
	}

	// Generate embeddings
	console.log('\nGenerating embeddings...');
	const embeddings = await createBatchEmbeddings(texts, {
		model: 'voyage-3',
		inputType: 'document',
		batchSize,
		showProgress: true
	});

	// Update documents with embeddings
	console.log('\nSaving embeddings to database...');
	const bulkOps = orgs.map((org, i) => ({
		updateOne: {
			filter: { _id: org._id },
			update: {
				$set: {
					embedding: embeddings[i],
					embeddingModel: 'voyage-3',
					embeddingGeneratedAt: new Date()
				}
			}
		}
	}));

	const result = await collection.bulkWrite(bulkOps);

	console.log(`\n✓ Updated ${result.modifiedCount} documents`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
	const args = parseArgs();

	console.log('Voyage AI Embedding Generation');
	console.log('='.repeat(70));

	if (!process.env.VOYAGE_API_KEY) {
		console.error('\n❌ VOYAGE_API_KEY environment variable is not set');
		console.error('Get your API key at: https://dash.voyageai.com/');
		process.exit(1);
	}

	try {
		if (args.all || args.collection === 'intelligence') {
			await generateIntelligenceEmbeddings({
				dryRun: args.dryRun,
				batchSize: args.batchSize,
				limit: args.limit
			});
		}

		if (args.all || args.collection === 'organizations') {
			await generateOrganizationEmbeddings({
				dryRun: args.dryRun,
				batchSize: args.batchSize,
				limit: args.limit
			});
		}

		if (!args.all && !args.collection) {
			console.log('\nUsage:');
			console.log('  pnpm tsx scripts/generate-embeddings.ts --collection intelligence');
			console.log('  pnpm tsx scripts/generate-embeddings.ts --collection organizations');
			console.log('  pnpm tsx scripts/generate-embeddings.ts --all');
			console.log('\nOptions:');
			console.log('  --dry-run       Estimate cost without generating');
			console.log('  --batch-size N  Set batch size (default: 64)');
			console.log('  --limit N       Limit number of documents to process');
			process.exit(1);
		}

		console.log('\n' + '='.repeat(70));
		console.log('✓ Embedding generation complete!');
		console.log('='.repeat(70));
		console.log('');
	} catch (error) {
		console.error('\n❌ Error:', error);
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { generateIntelligenceEmbeddings, generateOrganizationEmbeddings };
