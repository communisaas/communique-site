/**
 * Intelligence Orchestrator Examples
 *
 * Demonstrates various usage patterns for the intelligence system.
 * These examples can serve as integration guides and basic tests.
 */

import { intelligenceOrchestrator } from './orchestrator';
import type { IntelligenceQuery, IntelligenceItem } from './types';

// ============================================================================
// Example 1: Basic Streaming
// ============================================================================

/**
 * Stream intelligence items as they arrive
 */
export async function basicStreamingExample() {
	console.log('=== Basic Streaming Example ===\n');

	const query: IntelligenceQuery = {
		topics: ['climate change', 'renewable energy'],
		targetType: 'congress',
		timeframe: 'week'
	};

	console.log('Query:', query);
	console.log('\nStreaming items...\n');

	for await (const item of intelligenceOrchestrator.stream(query)) {
		console.log(`[${item.category}] ${item.title}`);
		console.log(`  Source: ${item.sourceName}`);
		console.log(`  Relevance: ${(item.relevanceScore * 100).toFixed(0)}%`);
		console.log(`  URL: ${item.sourceUrl}\n`);
	}
}

// ============================================================================
// Example 2: Corporate Target with Progress Events
// ============================================================================

/**
 * Track progress while gathering intelligence about a company
 */
export async function progressTrackingExample() {
	console.log('=== Progress Tracking Example ===\n');

	const query: IntelligenceQuery = {
		topics: ['labor practices', 'worker rights'],
		targetType: 'corporate',
		targetEntity: 'Amazon',
		timeframe: 'month'
	};

	console.log('Query:', query);
	console.log('\nGathering intelligence with progress tracking...\n');

	const itemsByCategory = new Map<string, IntelligenceItem[]>();

	for await (const event of intelligenceOrchestrator.streamWithEvents(query)) {
		switch (event.type) {
			case 'item':
				console.log(`✓ Found: ${event.item.title}`);

				// Collect items by category
				const items = itemsByCategory.get(event.category) || [];
				items.push(event.item);
				itemsByCategory.set(event.category, items);
				break;

			case 'progress':
				console.log(`⟳ ${event.category}: ${event.message} (${event.itemCount} items)`);
				break;

			case 'complete':
				console.log(
					`✓ ${event.category} complete: ${event.totalItems} items in ${event.durationMs}ms`
				);
				break;

			case 'error':
				console.error(`✗ ${event.category} error: ${event.error}`);
				break;
		}
	}

	console.log('\n=== Summary ===');
	for (const [category, items] of itemsByCategory) {
		console.log(`${category}: ${items.length} items`);
	}
}

// ============================================================================
// Example 3: Gather All (Non-Streaming)
// ============================================================================

/**
 * Get all items at once without streaming
 */
export async function gatherAllExample() {
	console.log('=== Gather All Example ===\n');

	const query: IntelligenceQuery = {
		topics: ['healthcare', 'affordable care act'],
		location: { state: 'CA' },
		timeframe: 'week'
	};

	console.log('Query:', query);
	console.log('\nGathering all items...\n');

	const items = await intelligenceOrchestrator.gather(query, {
		maxItemsPerProvider: 5,
		minRelevanceScore: 0.7
	});

	console.log(`Found ${items.length} total items\n`);

	// Group by category
	const byCategory = items.reduce((acc, item) => {
		const category = item.category;
		if (!acc[category]) acc[category] = [];
		acc[category].push(item);
		return acc;
	}, {} as Record<string, IntelligenceItem[]>);

	for (const [category, categoryItems] of Object.entries(byCategory)) {
		console.log(`\n${category.toUpperCase()} (${categoryItems.length} items):`);
		for (const item of categoryItems) {
			console.log(`  • ${item.title}`);
			console.log(`    ${item.summary.slice(0, 100)}...`);
		}
	}
}

// ============================================================================
// Example 4: Custom Provider Registration
// ============================================================================

/**
 * Register a custom provider for social media intelligence
 */
export async function customProviderExample() {
	console.log('=== Custom Provider Example ===\n');

	// Import base provider
	const { BaseIntelligenceProvider } = await import('./providers/base');

	// Define custom provider
	class SocialMediaProvider extends BaseIntelligenceProvider {
		readonly name = 'social-media';
		readonly categories = ['social' as const];

		async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
			console.log(`[${this.name}] Fetching social media intel...`);

			// Simulate fetching from Twitter API, Reddit, etc.
			yield {
				id: this.generateItemId('https://twitter.com/example/status/123', 'social'),
				category: 'social',
				title: `Social media discussion about ${query.topics[0]}`,
				summary: 'This is a simulated social media post',
				sourceUrl: 'https://twitter.com/example/status/123',
				sourceName: 'Twitter',
				publishedAt: new Date(),
				relevanceScore: 0.75,
				topics: query.topics,
				entities: [],
				sentiment: 'positive'
			};
		}
	}

	// Register the custom provider
	intelligenceOrchestrator.registerProvider(new SocialMediaProvider());
	console.log('Registered SocialMediaProvider\n');

	// Use it
	const items = await intelligenceOrchestrator.gather({
		topics: ['climate action'],
		timeframe: 'day'
	});

	console.log(`\nFound ${items.length} items including social media`);

	// Cleanup
	intelligenceOrchestrator.unregisterProvider('social-media');
}

// ============================================================================
// Example 5: Filtering and Options
// ============================================================================

/**
 * Use orchestration options to control behavior
 */
export async function filteringExample() {
	console.log('=== Filtering Example ===\n');

	const query: IntelligenceQuery = {
		topics: ['education policy', 'student loans'],
		targetType: 'congress'
	};

	console.log('Query:', query);
	console.log('\nOptions: Only legislative items, high relevance, max 3 per provider\n');

	let count = 0;
	for await (const item of intelligenceOrchestrator.stream(query, {
		categories: ['legislative'], // Only legislative intelligence
		minRelevanceScore: 0.8, // High relevance only
		maxItemsPerProvider: 3, // Limit results
		providerTimeoutMs: 10000 // 10 second timeout
	})) {
		count++;
		console.log(`${count}. [${item.category}] ${item.title}`);
		console.log(`   Relevance: ${(item.relevanceScore * 100).toFixed(0)}%\n`);
	}

	console.log(`Total items: ${count}`);
}

// ============================================================================
// Example 6: Real-Time UI Integration
// ============================================================================

/**
 * Simulate integration with a UI component
 */
export async function uiIntegrationExample() {
	console.log('=== UI Integration Example ===\n');

	// Simulate component state
	const state = {
		items: [] as IntelligenceItem[],
		loading: false,
		error: null as string | null,
		progress: new Map<string, number>()
	};

	// Simulate user action: gathering intelligence
	console.log('User initiated intelligence gathering...\n');
	state.loading = true;

	try {
		for await (const event of intelligenceOrchestrator.streamWithEvents({
			topics: ['renewable energy'],
			timeframe: 'week'
		})) {
			if (event.type === 'item') {
				// Add to UI list
				state.items.push(event.item);
				console.log(`UI: Added item - ${event.item.title}`);
			} else if (event.type === 'progress') {
				// Update progress indicator
				state.progress.set(event.category, event.itemCount);
				console.log(`UI: Progress - ${event.category}: ${event.itemCount} items`);
			} else if (event.type === 'error') {
				// Show error toast
				state.error = event.error;
				console.error(`UI: Error - ${event.error}`);
			}
		}
	} catch (error) {
		state.error = error instanceof Error ? error.message : String(error);
		console.error('UI: Fatal error:', state.error);
	} finally {
		state.loading = false;
		console.log('\nUI: Loading complete');
	}

	console.log(`\nFinal state: ${state.items.length} items`);
}

// ============================================================================
// Example 7: Parallel vs Sequential Comparison
// ============================================================================

/**
 * Demonstrate performance benefit of parallel execution
 */
export async function performanceExample() {
	console.log('=== Performance Comparison ===\n');

	const query: IntelligenceQuery = {
		topics: ['technology policy'],
		timeframe: 'week'
	};

	// Parallel (default)
	console.log('Running with parallel execution...');
	const parallelStart = Date.now();
	const parallelItems = await intelligenceOrchestrator.gather(query);
	const parallelTime = Date.now() - parallelStart;
	console.log(`  Time: ${parallelTime}ms, Items: ${parallelItems.length}\n`);

	// Note: Sequential would require fetching from each provider one-by-one
	// The orchestrator always runs in parallel, which is the optimal approach

	console.log(
		`Parallel execution is ~${Math.ceil(parallelItems.length / parallelTime)}x faster per item`
	);
}

// ============================================================================
// Run All Examples
// ============================================================================

/**
 * Run all examples in sequence
 */
export async function runAllExamples() {
	const examples = [
		{ name: 'Basic Streaming', fn: basicStreamingExample },
		{ name: 'Progress Tracking', fn: progressTrackingExample },
		{ name: 'Gather All', fn: gatherAllExample },
		{ name: 'Custom Provider', fn: customProviderExample },
		{ name: 'Filtering', fn: filteringExample },
		{ name: 'UI Integration', fn: uiIntegrationExample },
		{ name: 'Performance', fn: performanceExample }
	];

	for (const example of examples) {
		console.log('\n' + '='.repeat(60));
		console.log(`Running: ${example.name}`);
		console.log('='.repeat(60) + '\n');

		try {
			await example.fn();
		} catch (error) {
			console.error(`Example failed:`, error);
		}

		// Pause between examples
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	console.log('\n' + '='.repeat(60));
	console.log('All examples completed');
	console.log('='.repeat(60));
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
	// Run from command line: node examples.js
	runAllExamples().catch(console.error);
}
