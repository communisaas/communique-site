/**
 * MongoDB Atlas Vector Search Index Setup Script
 *
 * Creates vector search indexes for semantic search capabilities.
 *
 * IMPORTANT: This script requires MongoDB Atlas Admin API access.
 * Vector indexes cannot be created via the standard MongoDB driver -
 * they must be created through the Atlas Admin API or UI.
 *
 * Prerequisites:
 * 1. MongoDB Atlas M10+ cluster (vector search not available on free tier)
 * 2. Atlas Admin API credentials with Project Owner role
 * 3. Environment variables:
 *    - MONGODB_ATLAS_PUBLIC_KEY
 *    - MONGODB_ATLAS_PRIVATE_KEY
 *    - MONGODB_ATLAS_PROJECT_ID
 *
 * Usage:
 *   pnpm tsx scripts/setup-vector-indexes.ts
 *
 * For manual setup via Atlas UI:
 *   1. Go to Atlas Console > Database > Search
 *   2. Click "Create Search Index"
 *   3. Select "JSON Editor"
 *   4. Copy definitions from src/lib/server/mongodb/vector-indexes.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load index definitions
const indexesPath = path.join(
	__dirname,
	'../src/lib/server/mongodb/vector-indexes.json'
);
const indexDefinitions = JSON.parse(fs.readFileSync(indexesPath, 'utf-8'));

// Atlas Admin API configuration
const ATLAS_PUBLIC_KEY = process.env.MONGODB_ATLAS_PUBLIC_KEY;
const ATLAS_PRIVATE_KEY = process.env.MONGODB_ATLAS_PRIVATE_KEY;
const ATLAS_PROJECT_ID = process.env.MONGODB_ATLAS_PROJECT_ID;
const ATLAS_CLUSTER_NAME = process.env.MONGODB_ATLAS_CLUSTER_NAME || 'Cluster0';
const ATLAS_DATABASE_NAME = process.env.MONGODB_ATLAS_DATABASE || 'communique';

const ATLAS_API_BASE = 'https://cloud.mongodb.com/api/atlas/v2';

/**
 * Make authenticated request to Atlas Admin API
 */
async function atlasRequest(
	endpoint: string,
	method: 'GET' | 'POST' | 'DELETE' = 'GET',
	body?: unknown
): Promise<any> {
	if (!ATLAS_PUBLIC_KEY || !ATLAS_PRIVATE_KEY || !ATLAS_PROJECT_ID) {
		throw new Error(
			'Missing Atlas API credentials. Required environment variables:\n' +
				'  MONGODB_ATLAS_PUBLIC_KEY\n' +
				'  MONGODB_ATLAS_PRIVATE_KEY\n' +
				'  MONGODB_ATLAS_PROJECT_ID\n\n' +
				'Get credentials at: https://cloud.mongodb.com/v2#/org/{orgId}/access/apiKeys'
		);
	}

	// Create digest auth header
	const auth = Buffer.from(`${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}`).toString('base64');

	const url = `${ATLAS_API_BASE}${endpoint}`;

	const response = await fetch(url, {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Basic ${auth}`
		},
		...(body && { body: JSON.stringify(body) })
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(
			`Atlas API request failed (${response.status}): ${error}`
		);
	}

	return response.json();
}

/**
 * List existing search indexes
 */
async function listIndexes(): Promise<any[]> {
	const endpoint = `/groups/${ATLAS_PROJECT_ID}/clusters/${ATLAS_CLUSTER_NAME}/search/indexes/${ATLAS_DATABASE_NAME}`;

	try {
		const response = await atlasRequest(endpoint);
		return response || [];
	} catch (error) {
		console.warn('Could not list existing indexes:', error);
		return [];
	}
}

/**
 * Create a vector search index
 */
async function createVectorIndex(indexDef: any): Promise<void> {
	const endpoint = `/groups/${ATLAS_PROJECT_ID}/clusters/${ATLAS_CLUSTER_NAME}/search/indexes`;

	const payload = {
		database: ATLAS_DATABASE_NAME,
		collectionName: indexDef.collection,
		name: indexDef.name,
		type: indexDef.type,
		definition: indexDef.definition
	};

	console.log(`\nCreating ${indexDef.type} index: ${indexDef.name}`);
	console.log(`  Collection: ${indexDef.collection}`);
	console.log(`  Description: ${indexDef.description}`);

	try {
		await atlasRequest(endpoint, 'POST', payload);
		console.log(`  ✓ Created successfully`);
	} catch (error) {
		if (error instanceof Error && error.message.includes('already exists')) {
			console.log(`  ⚠ Index already exists, skipping`);
		} else {
			throw error;
		}
	}
}

/**
 * Verify vector search is available
 */
async function verifyVectorSearchAvailability(): Promise<void> {
	const endpoint = `/groups/${ATLAS_PROJECT_ID}/clusters/${ATLAS_CLUSTER_NAME}`;

	try {
		const cluster = await atlasRequest(endpoint);

		// Check cluster tier (vector search requires M10+)
		const tierName = cluster.clusterType || cluster.instanceSizeName;

		if (tierName?.includes('M0') || tierName?.includes('M2') || tierName?.includes('M5')) {
			console.error(
				'\n❌ ERROR: Vector Search requires MongoDB Atlas M10+ cluster tier.'
			);
			console.error(`   Current tier: ${tierName}`);
			console.error('   Please upgrade your cluster to use vector search.');
			console.error('\n   Upgrade at: https://cloud.mongodb.com/v2#/clusters/edit');
			process.exit(1);
		}

		console.log(`✓ Cluster tier: ${tierName} (vector search supported)`);
	} catch (error) {
		console.warn('Could not verify cluster tier:', error);
	}
}

/**
 * Main setup function
 */
async function setupVectorIndexes(): Promise<void> {
	console.log('='.repeat(70));
	console.log('MongoDB Atlas Vector Search Index Setup');
	console.log('='.repeat(70));

	console.log('\nConfiguration:');
	console.log(`  Project ID: ${ATLAS_PROJECT_ID}`);
	console.log(`  Cluster: ${ATLAS_CLUSTER_NAME}`);
	console.log(`  Database: ${ATLAS_DATABASE_NAME}`);

	// Verify cluster supports vector search
	console.log('\nVerifying cluster capabilities...');
	await verifyVectorSearchAvailability();

	// List existing indexes
	console.log('\nChecking existing indexes...');
	const existing = await listIndexes();
	console.log(`  Found ${existing.length} existing search indexes`);

	// Create each index
	console.log('\nCreating vector search indexes...');

	for (const indexDef of indexDefinitions.indexes) {
		await createVectorIndex(indexDef);
	}

	console.log('\n' + '='.repeat(70));
	console.log('✓ Vector search index setup complete!');
	console.log('='.repeat(70));

	console.log('\nNext steps:');
	console.log('  1. Wait 2-5 minutes for indexes to build');
	console.log('  2. Verify at: https://cloud.mongodb.com/v2#/clusters/search');
	console.log('  3. Test with: pnpm tsx scripts/test-vector-search.ts');
	console.log('');
}

/**
 * Print manual setup instructions
 */
function printManualInstructions(): void {
	console.log('='.repeat(70));
	console.log('Manual Vector Index Setup Instructions');
	console.log('='.repeat(70));

	console.log('\n1. Go to MongoDB Atlas Console');
	console.log('   https://cloud.mongodb.com/');

	console.log('\n2. Navigate to your cluster');
	console.log('   Database > Search');

	console.log('\n3. For each index definition in:');
	console.log('   src/lib/server/mongodb/vector-indexes.json');

	console.log('\n4. Click "Create Search Index"');
	console.log('   - Select "JSON Editor"');
	console.log('   - Copy the definition from the file');
	console.log('   - Set the name and collection');
	console.log('   - Click "Create"');

	console.log('\n5. Wait for indexes to build (2-5 minutes)');

	console.log('\n6. Verify indexes are active');
	console.log('');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
	if (!ATLAS_PUBLIC_KEY || !ATLAS_PRIVATE_KEY || !ATLAS_PROJECT_ID) {
		console.error('\n❌ Missing Atlas API credentials\n');
		printManualInstructions();
		process.exit(1);
	}

	setupVectorIndexes().catch((error) => {
		console.error('\n❌ Setup failed:', error);
		console.log('\nFalling back to manual setup instructions:\n');
		printManualInstructions();
		process.exit(1);
	});
}

export { setupVectorIndexes, printManualInstructions };
