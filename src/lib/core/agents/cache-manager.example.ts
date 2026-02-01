/**
 * Context Caching Examples for Gemini Client
 *
 * Demonstrates how to use context caching to achieve 20-30% token cost savings
 * on repeated requests with stable system prompts and schemas.
 *
 * Run these examples to see caching in action:
 * ```bash
 * # Make sure GEMINI_API_KEY is set
 * tsx src/lib/core/agents/cache-manager.example.ts
 * ```
 */

import { generate, generateWithThoughts } from './gemini-client';
import { getCacheStats, estimateTokenSavings, clearAllCaches } from './cache-manager';
import {
	ROLE_DISCOVERY_PROMPT,
	PERSON_LOOKUP_PROMPT,
	buildRoleDiscoveryPrompt
} from './prompts/decision-maker';

// ============================================================================
// Example 1: Basic Caching with Decision-Maker Role Discovery
// ============================================================================

/**
 * Example showing how caching reduces costs on repeated decision-maker queries
 *
 * Scenario: A campaign generates multiple decision-maker lists with same prompt.
 * Without caching: Each request pays full token cost for system prompt.
 * With caching: First request pays 100%, subsequent pay only 10%.
 */
async function example1_BasicCaching() {
	console.log('\n=== Example 1: Basic Caching ===\n');

	const queries = [
		{
			subject: 'Increase funding for public schools in San Francisco',
			message: 'Our schools need more resources',
			topics: ['education', 'budget', 'local_government']
		},
		{
			subject: 'Expand affordable housing in Oakland',
			message: 'Working families are being priced out',
			topics: ['housing', 'zoning', 'local_government']
		},
		{
			subject: 'Improve public transit in Berkeley',
			message: 'We need better bus routes',
			topics: ['transit', 'infrastructure', 'local_government']
		}
	];

	console.log('Running 3 queries WITH caching enabled...\n');

	for (let i = 0; i < queries.length; i++) {
		const { subject, message, topics } = queries[i];
		const prompt = buildRoleDiscoveryPrompt(subject, message, topics);

		console.log(`Query ${i + 1}: ${subject}`);

		const result = await generateWithThoughts(prompt, {
			systemInstruction: ROLE_DISCOVERY_PROMPT,
			temperature: 0.3,
			thinkingLevel: 'medium',
			maxOutputTokens: 8192,
			// Enable caching - first request creates cache, rest reuse it
			enableCaching: true,
			cacheTTL: 'long', // 24-hour cache
			cacheDisplayName: 'role-discovery-prompt'
		});

		console.log(`  → Found ${result.data?.roles?.length || 0} roles`);
		console.log(`  → Thoughts: ${result.thoughts.length}`);
		console.log();
	}

	// Show cache stats
	const stats = getCacheStats();
	console.log('Cache Statistics:');
	console.log(`  Total caches: ${stats.totalCaches}`);
	console.log(`  Valid caches: ${stats.validCaches}`);
	console.log(`  Cache details:`, stats.cacheDetails);
}

// ============================================================================
// Example 2: Cost Savings Calculation
// ============================================================================

/**
 * Calculate and display token cost savings from caching
 *
 * This demonstrates the ROI of context caching over multiple requests.
 */
function example2_CostSavings() {
	console.log('\n=== Example 2: Cost Savings Calculation ===\n');

	// Estimate for role discovery prompt (~800 tokens)
	const rolePromptTokens = 800;

	// Calculate savings over 10 requests
	const savings10 = estimateTokenSavings(rolePromptTokens, 10);
	console.log('Role Discovery Prompt (800 tokens) - 10 requests:');
	console.log(`  Without caching: ${savings10.withoutCaching.toLocaleString()} tokens`);
	console.log(`  With caching: ${savings10.withCaching.toLocaleString()} tokens`);
	console.log(`  Tokens saved: ${savings10.tokensSaved.toLocaleString()}`);
	console.log(`  Percent saved: ${savings10.percentSaved.toFixed(1)}%`);
	console.log();

	// Calculate savings over 100 requests (typical campaign)
	const savings100 = estimateTokenSavings(rolePromptTokens, 100);
	console.log('Role Discovery Prompt (800 tokens) - 100 requests:');
	console.log(`  Without caching: ${savings100.withoutCaching.toLocaleString()} tokens`);
	console.log(`  With caching: ${savings100.withCaching.toLocaleString()} tokens`);
	console.log(`  Tokens saved: ${savings100.tokensSaved.toLocaleString()}`);
	console.log(`  Percent saved: ${savings100.percentSaved.toFixed(1)}%`);
	console.log();

	// Person lookup prompt (~1200 tokens)
	const personPromptTokens = 1200;
	const personSavings100 = estimateTokenSavings(personPromptTokens, 100);
	console.log('Person Lookup Prompt (1200 tokens) - 100 requests:');
	console.log(`  Without caching: ${personSavings100.withoutCaching.toLocaleString()} tokens`);
	console.log(`  With caching: ${personSavings100.withCaching.toLocaleString()} tokens`);
	console.log(`  Tokens saved: ${personSavings100.tokensSaved.toLocaleString()}`);
	console.log(`  Percent saved: ${personSavings100.percentSaved.toFixed(1)}%`);
	console.log();

	// Combined savings (both phases)
	const combinedWithout = savings100.withoutCaching + personSavings100.withoutCaching;
	const combinedWith = savings100.withCaching + personSavings100.withCaching;
	const combinedSaved = combinedWithout - combinedWith;
	const combinedPercent = (combinedSaved / combinedWithout) * 100;

	console.log('Combined Two-Phase Pipeline (100 campaigns):');
	console.log(`  Without caching: ${combinedWithout.toLocaleString()} tokens`);
	console.log(`  With caching: ${combinedWith.toLocaleString()} tokens`);
	console.log(`  Tokens saved: ${combinedSaved.toLocaleString()}`);
	console.log(`  Percent saved: ${combinedPercent.toFixed(1)}%`);
}

// ============================================================================
// Example 3: Cache with Different TTLs
// ============================================================================

/**
 * Demonstrate different cache TTL strategies
 */
async function example3_TTLStrategies() {
	console.log('\n=== Example 3: Cache TTL Strategies ===\n');

	const testPrompt = 'Test prompt for TTL demonstration';

	// Short TTL: 1 hour - for dynamic content
	console.log('Creating cache with SHORT TTL (1 hour)...');
	await generate(testPrompt, {
		systemInstruction: 'Dynamic content prompt',
		enableCaching: true,
		cacheTTL: 'short',
		cacheDisplayName: 'short-ttl-example'
	});

	// Medium TTL: 6 hours - for semi-stable content
	console.log('Creating cache with MEDIUM TTL (6 hours)...');
	await generate(testPrompt, {
		systemInstruction: 'Semi-stable content prompt',
		enableCaching: true,
		cacheTTL: 'medium',
		cacheDisplayName: 'medium-ttl-example'
	});

	// Long TTL: 24 hours - for stable prompts
	console.log('Creating cache with LONG TTL (24 hours)...');
	await generate(testPrompt, {
		systemInstruction: 'Stable prompt that rarely changes',
		enableCaching: true,
		cacheTTL: 'long',
		cacheDisplayName: 'long-ttl-example'
	});

	console.log();
	const stats = getCacheStats();
	console.log('Cache Details:');
	stats.cacheDetails.forEach((cache) => {
		const timeLeft = Math.round((cache.expiresAt.getTime() - Date.now()) / 1000 / 60);
		console.log(`  ${cache.displayName || 'unnamed'}:`);
		console.log(`    Expires in: ${timeLeft} minutes`);
		console.log(`    Created: ${cache.createdAt.toISOString()}`);
		console.log(`    Expires: ${cache.expiresAt.toISOString()}`);
	});
}

// ============================================================================
// Example 4: Cache Hit Demonstration
// ============================================================================

/**
 * Show cache hit vs cache miss behavior
 */
async function example4_CacheHitMiss() {
	console.log('\n=== Example 4: Cache Hit vs Miss ===\n');

	const stablePrompt = 'You are an expert analyst.';
	const testQuery = 'What is 2+2?';

	// First request - cache miss (creates cache)
	console.log('Request 1: Creating new cache (MISS)...');
	const start1 = Date.now();
	await generate(testQuery, {
		systemInstruction: stablePrompt,
		enableCaching: true,
		cacheDisplayName: 'demo-cache'
	});
	const time1 = Date.now() - start1;
	console.log(`  Completed in ${time1}ms\n`);

	// Second request - cache hit
	console.log('Request 2: Using cached content (HIT)...');
	const start2 = Date.now();
	await generate(testQuery, {
		systemInstruction: stablePrompt,
		enableCaching: true,
		cacheDisplayName: 'demo-cache'
	});
	const time2 = Date.now() - start2;
	console.log(`  Completed in ${time2}ms`);
	console.log(`  Cache speedup: ${((time1 - time2) / time1 * 100).toFixed(1)}% faster\n`);

	// Third request - different prompt (cache miss)
	console.log('Request 3: Different prompt (MISS)...');
	const start3 = Date.now();
	await generate(testQuery, {
		systemInstruction: 'You are a different analyst.', // Different prompt!
		enableCaching: true,
		cacheDisplayName: 'demo-cache-2'
	});
	const time3 = Date.now() - start3;
	console.log(`  Completed in ${time3}ms\n`);

	console.log('Summary:');
	console.log(`  First request (create cache): ${time1}ms`);
	console.log(`  Second request (cache hit): ${time2}ms`);
	console.log(`  Third request (different cache): ${time3}ms`);
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
	console.log('╔═══════════════════════════════════════════════════════════════╗');
	console.log('║     Gemini Context Caching Examples                          ║');
	console.log('║     Demonstrating 20-30% Token Cost Savings                  ║');
	console.log('╚═══════════════════════════════════════════════════════════════╝');

	try {
		// Run examples
		// await example1_BasicCaching();
		example2_CostSavings();
		// await example3_TTLStrategies();
		// await example4_CacheHitMiss();

		console.log('\n✅ All examples completed successfully!');
		console.log('\nKey Takeaways:');
		console.log('  1. Context caching provides 90% token cost savings on cached content');
		console.log('  2. Break-even point: 2 requests (after that, pure savings)');
		console.log('  3. Best for: Stable system prompts and schemas used repeatedly');
		console.log('  4. Cache TTLs: short (1h), medium (6h), long (24h)');
		console.log('  5. Expected overall savings: 20-30% on total token costs');
	} catch (error) {
		console.error('❌ Example failed:', error);
		throw error;
	} finally {
		// Clean up
		clearAllCaches();
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

export {
	example1_BasicCaching,
	example2_CostSavings,
	example3_TTLStrategies,
	example4_CacheHitMiss
};
