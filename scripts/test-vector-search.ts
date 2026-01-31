/**
 * Test Vector Search Implementation
 *
 * Validates that vector search is working correctly by:
 * 1. Checking Voyage AI connectivity
 * 2. Verifying vector indexes exist
 * 3. Testing embedding generation
 * 4. Running sample searches
 *
 * Usage:
 *   pnpm tsx scripts/test-vector-search.ts
 */

import { SemanticSearchService } from '../src/lib/server/mongodb/semantic-service';
import { createEmbedding, cosineSimilarity, costTracker } from '../src/lib/server/embeddings';
import { getDatabase } from '../src/lib/server/mongodb';

/**
 * Test 1: Health Check
 */
async function testHealthCheck(): Promise<boolean> {
	console.log('\n' + '='.repeat(70));
	console.log('Test 1: Health Check');
	console.log('='.repeat(70));

	try {
		const health = await SemanticSearchService.healthCheck();

		console.log('\nResults:');
		console.log(`  Voyage AI:           ${health.voyageAI ? '✅' : '❌'}`);
		console.log(`  Intelligence Index:  ${health.intelligenceIndex ? '✅' : '❌'}`);
		console.log(`  Organization Index:  ${health.organizationIndex ? '✅' : '❌'}`);

		const allHealthy = health.voyageAI && health.intelligenceIndex && health.organizationIndex;

		if (allHealthy) {
			console.log('\n✅ All systems healthy');
		} else {
			console.log('\n⚠️  Some systems not healthy - check setup');
		}

		return allHealthy;
	} catch (error) {
		console.error('\n❌ Health check failed:', error);
		return false;
	}
}

/**
 * Test 2: Embedding Generation
 */
async function testEmbeddingGeneration(): Promise<boolean> {
	console.log('\n' + '='.repeat(70));
	console.log('Test 2: Embedding Generation');
	console.log('='.repeat(70));

	try {
		const testTexts = [
			'Climate change legislation and renewable energy policy',
			'Healthcare reform and universal coverage initiatives',
			'Education funding and teacher salary improvements'
		];

		console.log('\nGenerating embeddings for 3 test texts...');

		const [embedding1] = await createEmbedding(testTexts[0], { model: 'voyage-3' });
		const [embedding2] = await createEmbedding(testTexts[1], { model: 'voyage-3' });
		const [embedding3] = await createEmbedding(testTexts[2], { model: 'voyage-3' });

		console.log(`\nEmbedding dimensions: ${embedding1.length}`);
		console.log(`Expected: 1024`);

		if (embedding1.length !== 1024) {
			console.log('❌ Dimension mismatch!');
			return false;
		}

		// Test similarity calculations
		const sim1_2 = cosineSimilarity(embedding1, embedding2);
		const sim1_3 = cosineSimilarity(embedding1, embedding3);
		const sim2_3 = cosineSimilarity(embedding2, embedding3);

		console.log('\nSimilarity scores:');
		console.log(`  Climate <-> Healthcare:  ${sim1_2.toFixed(4)}`);
		console.log(`  Climate <-> Education:   ${sim1_3.toFixed(4)}`);
		console.log(`  Healthcare <-> Education: ${sim2_3.toFixed(4)}`);

		console.log('\n✅ Embedding generation successful');
		return true;
	} catch (error) {
		console.error('\n❌ Embedding generation failed:', error);
		return false;
	}
}

/**
 * Test 3: Intelligence Search
 */
async function testIntelligenceSearch(): Promise<boolean> {
	console.log('\n' + '='.repeat(70));
	console.log('Test 3: Intelligence Vector Search');
	console.log('='.repeat(70));

	try {
		const db = await getDatabase();
		const collection = db.collection('intelligence');

		// Check if we have data with embeddings
		const count = await collection.countDocuments({ embedding: { $exists: true } });

		console.log(`\nFound ${count} intelligence items with embeddings`);

		if (count === 0) {
			console.log('⚠️  No intelligence items with embeddings found');
			console.log('   Run: pnpm tsx scripts/generate-embeddings.ts --collection intelligence');
			return false;
		}

		// Test semantic search
		console.log('\nTesting semantic search...');

		const results = await SemanticSearchService.intelligence.search(
			'renewable energy and climate policy',
			{
				limit: 5
			}
		);

		console.log(`\nFound ${results.length} results`);

		if (results.length > 0) {
			console.log('\nTop results:');
			results.slice(0, 3).forEach((r, i) => {
				console.log(`  ${i + 1}. ${r.document.title}`);
				console.log(`     Score: ${r.score.toFixed(4)}`);
				console.log(`     Category: ${r.document.category}`);
			});
			console.log('\n✅ Intelligence search successful');
			return true;
		} else {
			console.log('⚠️  No results found - may need more test data');
			return false;
		}
	} catch (error) {
		console.error('\n❌ Intelligence search failed:', error);
		return false;
	}
}

/**
 * Test 4: Organization Search
 */
async function testOrganizationSearch(): Promise<boolean> {
	console.log('\n' + '='.repeat(70));
	console.log('Test 4: Organization Vector Search');
	console.log('='.repeat(70));

	try {
		const db = await getDatabase();
		const collection = db.collection('organizations');

		// Check if we have data with embeddings
		const count = await collection.countDocuments({ embedding: { $exists: true } });

		console.log(`\nFound ${count} organizations with embeddings`);

		if (count === 0) {
			console.log('⚠️  No organizations with embeddings found');
			console.log('   Run: pnpm tsx scripts/generate-embeddings.ts --collection organizations');
			return false;
		}

		// Test semantic search
		console.log('\nTesting semantic search...');

		const results = await SemanticSearchService.organizations.search(
			'environmental advocacy and climate action',
			{
				limit: 5
			}
		);

		console.log(`\nFound ${results.length} results`);

		if (results.length > 0) {
			console.log('\nTop results:');
			results.slice(0, 3).forEach((r, i) => {
				console.log(`  ${i + 1}. ${r.document.name}`);
				console.log(`     Score: ${r.score.toFixed(4)}`);
				console.log(`     Industry: ${r.document.industry || 'N/A'}`);
			});
			console.log('\n✅ Organization search successful');
			return true;
		} else {
			console.log('⚠️  No results found - may need more test data');
			return false;
		}
	} catch (error) {
		console.error('\n❌ Organization search failed:', error);
		return false;
	}
}

/**
 * Test 5: Cost Tracking
 */
function testCostTracking(): void {
	console.log('\n' + '='.repeat(70));
	console.log('Test 5: Cost Tracking');
	console.log('='.repeat(70));

	const stats = costTracker.getStats();

	console.log('\nSession Statistics:');
	console.log(`  Total tokens:     ${stats.totalTokens.toLocaleString()}`);
	console.log(`  Embedding calls:  ${stats.embeddingCalls}`);
	console.log(`  Rerank calls:     ${stats.rerankCalls}`);
	console.log(`  Estimated cost:   $${stats.estimatedCost.toFixed(4)}`);

	console.log('\n✅ Cost tracking working');
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
	console.log('');
	console.log('╔' + '═'.repeat(68) + '╗');
	console.log('║' + ' '.repeat(15) + 'Vector Search Test Suite' + ' '.repeat(29) + '║');
	console.log('╚' + '═'.repeat(68) + '╝');

	let passed = 0;
	let failed = 0;

	// Test 1: Health Check
	const healthOk = await testHealthCheck();
	if (healthOk) passed++;
	else failed++;

	if (!healthOk) {
		console.log('\n⚠️  Skipping remaining tests due to health check failure');
		console.log('   Please check setup and environment variables');
		return;
	}

	// Test 2: Embedding Generation
	const embeddingOk = await testEmbeddingGeneration();
	if (embeddingOk) passed++;
	else failed++;

	// Test 3: Intelligence Search
	const intelligenceOk = await testIntelligenceSearch();
	if (intelligenceOk) passed++;
	else {
		failed++;
		console.log('\n   (This may be expected if you have no intelligence data yet)');
	}

	// Test 4: Organization Search
	const orgOk = await testOrganizationSearch();
	if (orgOk) passed++;
	else {
		failed++;
		console.log('\n   (This may be expected if you have no organization data yet)');
	}

	// Test 5: Cost Tracking
	testCostTracking();
	passed++;

	// Summary
	console.log('\n' + '='.repeat(70));
	console.log('Test Summary');
	console.log('='.repeat(70));
	console.log(`\nPassed: ${passed}/${passed + failed}`);
	console.log(`Failed: ${failed}/${passed + failed}`);

	if (failed === 0) {
		console.log('\n🎉 All tests passed!');
		console.log('\nVector search is ready to use.');
	} else {
		console.log('\n⚠️  Some tests failed');

		if (!intelligenceOk || !orgOk) {
			console.log('\nTo populate test data:');
			console.log('  1. Add intelligence items via intelligence providers');
			console.log('  2. Add organizations via Firecrawl provider');
			console.log('  3. Generate embeddings:');
			console.log('     pnpm tsx scripts/generate-embeddings.ts --all');
		}
	}

	console.log('');
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
	runTests().catch((error) => {
		console.error('\n❌ Test suite failed:', error);
		process.exit(1);
	});
}

export { runTests };
