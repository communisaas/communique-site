/**
 * Batch Organization Discovery Example
 *
 * This example demonstrates how to use Firecrawl's batch operations
 * to discover multiple organizations in parallel, achieving ~4x speedup.
 *
 * Run with:
 *   FIRECRAWL_API_KEY=your_key tsx batch-discovery-example.ts
 */

import { getFirecrawlClient } from '../firecrawl-client';
import { FirecrawlDecisionMakerProvider } from '../firecrawl-provider';

// ============================================================================
// Example 1: Basic Batch Discovery (Client-Level)
// ============================================================================

async function basicBatchDiscovery() {
	console.log('\n=== Example 1: Basic Batch Discovery ===\n');

	const client = getFirecrawlClient();

	const organizations = [
		'Patagonia',
		'Ben & Jerry\'s',
		'Seventh Generation',
		'Allbirds'
	];

	const topics = ['sustainability', 'climate', 'environment'];

	console.log(`Discovering ${organizations.length} organizations in parallel...`);
	console.log(`Topics: ${topics.join(', ')}\n`);

	const startTime = Date.now();

	const result = await client.discoverOrganizationsBatch(
		organizations,
		topics,
		{
			concurrency: 4,
			onProgress: (progress) => {
				const percentage = Math.round((progress.completed / progress.total) * 100);
				console.log(`Progress: ${progress.completed}/${progress.total} (${percentage}%)`);

				if (progress.currentOrg) {
					const orgResult = progress.results.find(r => r.organization === progress.currentOrg);
					if (orgResult?.status === 'completed') {
						console.log(`  ✅ ${progress.currentOrg} - Discovery complete`);
					} else if (orgResult?.status === 'failed') {
						console.log(`  ❌ ${progress.currentOrg} - Failed: ${orgResult.error}`);
					} else if (orgResult?.status === 'processing') {
						console.log(`  🔄 ${progress.currentOrg} - Processing...`);
					}
				}
				console.log('');
			}
		}
	);

	const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

	console.log('\n=== Results ===\n');
	console.log(`✅ Successful: ${result.successful.length}`);
	console.log(`❌ Failed: ${result.failed.length}`);
	console.log(`💰 Total credits used: ${result.totalCreditsUsed}`);
	console.log(`⏱️  Total time: ${elapsedSeconds}s`);
	console.log(`📊 Avg time per org: ${Math.round(result.totalTimeMs / organizations.length / 1000)}s`);

	// Show successful discoveries
	if (result.successful.length > 0) {
		console.log('\n=== Successful Discoveries ===\n');
		result.successful.forEach(({ organization, profile }) => {
			console.log(`${organization}:`);
			console.log(`  Name: ${profile.name}`);
			console.log(`  Website: ${profile.website || 'N/A'}`);
			console.log(`  Leadership found: ${profile.leadership.length}`);
			console.log(`  Policy positions: ${profile.policyPositions.length}`);
			console.log('');
		});
	}

	// Show failures
	if (result.failed.length > 0) {
		console.log('\n=== Failed Discoveries ===\n');
		result.failed.forEach(({ organization, error }) => {
			console.log(`${organization}: ${error}`);
		});
	}

	return result;
}

// ============================================================================
// Example 2: Provider-Level Batch Resolution (with caching)
// ============================================================================

async function providerBatchResolution() {
	console.log('\n=== Example 2: Provider-Level Batch Resolution ===\n');

	const provider = new FirecrawlDecisionMakerProvider();

	const organizations = [
		'Microsoft',
		'Google',
		'Amazon'
	];

	console.log(`Resolving decision-makers for ${organizations.length} organizations...`);
	console.log('This includes cache checking, discovery, and relevance filtering.\n');

	const startTime = Date.now();

	const results = await provider.resolveBatch(
		organizations,
		{
			targetType: 'corporate',
			subjectLine: 'Climate Action and Sustainability Initiative',
			coreMessage: 'We encourage your organization to commit to carbon neutrality by 2030',
			topics: ['climate', 'sustainability', 'carbon-neutrality'],
			streaming: {
				onPhase: (phase, message) => {
					console.log(`[${phase.toUpperCase()}] ${message}`);
				},
				onThought: (thought, phase) => {
					console.log(`  💭 ${thought}`);
				}
			}
		}
	);

	const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

	console.log('\n=== Results Summary ===\n');
	console.log(`Total organizations: ${results.length}`);
	console.log(`Total decision-makers found: ${results.reduce((sum, r) => sum + r.decisionMakers.length, 0)}`);
	console.log(`Cache hits: ${results.filter(r => r.cacheHit).length}`);
	console.log(`New discoveries: ${results.filter(r => !r.cacheHit).length}`);
	console.log(`⏱️  Total time: ${elapsedSeconds}s\n`);

	// Show detailed results per organization
	results.forEach((result, idx) => {
		console.log(`\n${organizations[idx]}:`);
		console.log(`  Decision-makers: ${result.decisionMakers.length}`);
		console.log(`  Cache hit: ${result.cacheHit ? 'Yes' : 'No'}`);
		console.log(`  Provider: ${result.provider}`);
		console.log(`  Summary: ${result.researchSummary}`);

		if (result.decisionMakers.length > 0) {
			console.log('\n  Decision-Makers:');
			result.decisionMakers.forEach(dm => {
				console.log(`    - ${dm.name} (${dm.title})`);
				console.log(`      Email: ${dm.email || 'N/A'} ${dm.emailSource ? `[${dm.emailSource}]` : ''}`);
				console.log(`      Power Level: ${dm.powerLevel}`);
				console.log(`      Confidence: ${Math.round((dm.confidence || 0) * 100)}%`);
			});
		}
	});

	return results;
}

// ============================================================================
// Example 3: Custom Concurrency and Rate Limiting
// ============================================================================

async function customConcurrencyExample() {
	console.log('\n=== Example 3: Custom Concurrency Settings ===\n');

	const client = getFirecrawlClient();

	const organizations = [
		'Apple',
		'Tesla',
		'Nvidia',
		'Meta',
		'Netflix',
		'Adobe',
		'Salesforce',
		'Intel'
	];

	console.log(`Discovering ${organizations.length} organizations with custom settings...`);
	console.log('Using higher concurrency (6) and reduced rate limiting (250ms)\n');

	const result = await client.discoverOrganizationsBatch(
		organizations,
		['technology', 'innovation'],
		{
			concurrency: 6, // More aggressive parallelism
			rateLimitDelayMs: 250, // Faster job starts
			onProgress: (progress) => {
				console.log(`${progress.completed}/${progress.total} - ${progress.currentOrg || 'processing'}`);
			}
		}
	);

	console.log('\n=== Performance Metrics ===\n');
	console.log(`Successful: ${result.successful.length}`);
	console.log(`Failed: ${result.failed.length}`);
	console.log(`Total time: ${Math.round(result.totalTimeMs / 1000)}s`);
	console.log(`Avg per org: ${Math.round(result.totalTimeMs / organizations.length / 1000)}s`);
	console.log(`Speedup vs sequential: ~${Math.round(organizations.length / (result.totalTimeMs / 30000))}x`);

	return result;
}

// ============================================================================
// Example 4: Error Handling and Partial Results
// ============================================================================

async function errorHandlingExample() {
	console.log('\n=== Example 4: Error Handling ===\n');

	const client = getFirecrawlClient();

	const organizations = [
		'Patagonia', // Real org - should succeed
		'NonExistentCompany123456', // Fake org - should fail
		'Ben & Jerry\'s', // Real org - should succeed
		'AnotherFakeCompanyXYZ', // Fake org - should fail
		'Seventh Generation' // Real org - should succeed
	];

	console.log('Testing error isolation with mix of real and fake organizations...\n');

	const result = await client.discoverOrganizationsBatch(
		organizations,
		['environment'],
		{
			concurrency: 3,
			onProgress: (progress) => {
				const orgResult = progress.results.find(r => r.organization === progress.currentOrg);
				if (orgResult) {
					const icon = orgResult.status === 'completed' ? '✅' :
					             orgResult.status === 'failed' ? '❌' :
					             orgResult.status === 'processing' ? '🔄' : '⏳';
					console.log(`${icon} ${orgResult.organization} - ${orgResult.status}`);
				}
			}
		}
	);

	console.log('\n=== Error Isolation Results ===\n');
	console.log(`Total organizations: ${organizations.length}`);
	console.log(`✅ Successful: ${result.successful.length}`);
	console.log(`❌ Failed: ${result.failed.length}`);
	console.log('\nKey Point: Failed orgs did not block successful ones!\n');

	// Show which ones failed and why
	if (result.failed.length > 0) {
		console.log('Failed organizations:');
		result.failed.forEach(({ organization, error }) => {
			console.log(`  - ${organization}: ${error}`);
		});
	}

	return result;
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
	console.log('🚀 Firecrawl Batch Operations Examples\n');
	console.log('These examples demonstrate ~4x faster organization discovery');
	console.log('through parallel execution with controlled concurrency.\n');

	// Check for API key
	if (!process.env.FIRECRAWL_API_KEY) {
		console.error('❌ Error: FIRECRAWL_API_KEY environment variable not set');
		console.error('Set it with: export FIRECRAWL_API_KEY=your_key_here\n');
		process.exit(1);
	}

	try {
		// Run example 1
		await basicBatchDiscovery();

		// Uncomment to run other examples:
		// await providerBatchResolution();
		// await customConcurrencyExample();
		// await errorHandlingExample();

		console.log('\n✅ All examples completed successfully!\n');
	} catch (error) {
		console.error('\n❌ Error running examples:', error);
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export {
	basicBatchDiscovery,
	providerBatchResolution,
	customConcurrencyExample,
	errorHandlingExample
};
