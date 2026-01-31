#!/usr/bin/env tsx
/**
 * MongoDB Initialization Script
 *
 * This script:
 * 1. Tests the MongoDB connection
 * 2. Creates all necessary indexes
 * 3. Displays collection statistics
 *
 * Run with: npx tsx scripts/init-mongodb.ts
 */

import {
	testMongoConnection,
	getDatabase,
	closeMongoClient
} from '../src/lib/server/mongodb';
import { ensureAllIndexes } from '../src/lib/server/mongodb/indexes';
import { COLLECTIONS } from '../src/lib/server/mongodb/schema';

async function main() {
	console.log('🚀 MongoDB Initialization Script');
	console.log('================================\n');

	try {
		// Step 1: Test connection
		console.log('📡 Step 1: Testing MongoDB connection...');
		const isConnected = await testMongoConnection();

		if (!isConnected) {
			console.error('❌ MongoDB connection failed!');
			process.exit(1);
		}

		console.log('✅ Connection successful!\n');

		// Step 2: Create indexes
		console.log('🔧 Step 2: Creating indexes...');
		await ensureAllIndexes();
		console.log('✅ All indexes created!\n');

		// Step 3: Display statistics
		console.log('📊 Step 3: Collection statistics...');
		const db = await getDatabase();

		for (const collectionName of Object.values(COLLECTIONS)) {
			try {
				const collection = db.collection(collectionName);
				const count = await collection.countDocuments();
				const indexes = await collection.listIndexes().toArray();

				console.log(`\n📁 ${collectionName}:`);
				console.log(`   Documents: ${count}`);
				console.log(`   Indexes: ${indexes.length}`);

				indexes.forEach((index) => {
					console.log(`   - ${index.name}`);
				});
			} catch (error) {
				console.log(
					`\n📁 ${collectionName}: Collection will be created on first insert`
				);
			}
		}

		console.log('\n✨ MongoDB initialization complete!');
		console.log('\n⚠️  Note: Vector search indexes must be created via Atlas UI');
		console.log('   See: src/lib/server/mongodb/README.md for instructions\n');
	} catch (error) {
		console.error('\n❌ Initialization failed:');
		console.error(error);
		process.exit(1);
	} finally {
		// Close connection
		await closeMongoClient();
	}
}

// Run the script
main();
