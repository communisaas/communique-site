<script lang="ts">
	/**
	 * Intelligence Panel Demo
	 *
	 * Interactive demonstration of the IntelligencePanel component with:
	 * - Simulated streaming intelligence
	 * - Category filtering
	 * - Relevance-based sorting
	 * - Real-time updates
	 */

	import { IntelligencePanel } from '$lib/components/intelligence';
	import type { IntelligenceItem, IntelligenceQuery } from '$lib/core/intelligence/types';
	import { Play, StopCircle, RotateCcw } from '@lucide/svelte';
	import { onMount } from 'svelte';

	// Demo state
	let items = $state<IntelligenceItem[]>([]);
	let streaming = $state(false);
	let panelExpanded = $state(true);

	// Query configuration
	let queryTopics = $state('climate change, renewable energy, carbon emissions');
	let targetType = $state('congress');
	let timeframe = $state<'day' | 'week' | 'month'>('week');

	/**
	 * Simulate streaming intelligence items
	 * In production, this would call intelligenceOrchestrator.stream()
	 */
	async function simulateStreaming() {
		streaming = true;
		items = [];

		const mockItems: Omit<IntelligenceItem, 'id'>[] = [
			{
				category: 'news',
				title: 'Senate Passes Landmark Climate Bill with Bipartisan Support',
				summary: 'After months of negotiations, the Senate voted 68-32 to pass the Climate Action and Innovation Act, which allocates $500 billion for renewable energy infrastructure and carbon capture technology over the next decade.',
				sourceUrl: 'https://example.com/senate-climate-bill',
				sourceName: 'Washington Post',
				publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
				relevanceScore: 0.95,
				topics: ['climate', 'legislation', 'senate'],
				entities: [
					{ name: 'US Senate', type: 'organization' },
					{ name: 'Climate Action and Innovation Act', type: 'legislation' }
				],
				sentiment: 'positive'
			},
			{
				category: 'legislative',
				title: 'H.R. 2547: Clean Energy Investment Tax Credit Act',
				summary: 'Introduces new tax incentives for businesses investing in solar, wind, and battery storage systems. The bill extends existing credits through 2035 and creates a direct-pay option for tax-exempt entities.',
				sourceUrl: 'https://congress.gov/bill/118/hr2547',
				sourceName: 'Congress.gov',
				publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
				relevanceScore: 0.88,
				topics: ['renewable energy', 'tax policy', 'solar', 'wind'],
				entities: [
					{ name: 'Rep. Alexandria Ocasio-Cortez', type: 'person' },
					{ name: 'Ways and Means Committee', type: 'organization' }
				]
			},
			{
				category: 'news',
				title: 'Major Oil Companies Announce $100B Investment in Carbon Capture',
				summary: 'Five leading oil and gas companies unveiled a joint venture to develop carbon capture and storage facilities across the Gulf Coast. Environmental groups remain skeptical about the technology\'s effectiveness.',
				sourceUrl: 'https://example.com/oil-carbon-capture',
				sourceName: 'Bloomberg',
				publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
				relevanceScore: 0.82,
				topics: ['carbon capture', 'fossil fuels', 'climate technology'],
				entities: [
					{ name: 'ExxonMobil', type: 'organization' },
					{ name: 'Chevron', type: 'organization' },
					{ name: 'BP', type: 'organization' }
				],
				sentiment: 'mixed'
			},
			{
				category: 'regulatory',
				title: 'EPA Proposes Stricter Emissions Standards for Power Plants',
				summary: 'The Environmental Protection Agency released draft rules requiring coal and gas power plants to reduce carbon emissions by 60% by 2030. Industry groups have signaled they will challenge the regulations.',
				sourceUrl: 'https://example.com/epa-emissions',
				sourceName: 'New York Times',
				publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
				relevanceScore: 0.91,
				topics: ['emissions', 'regulations', 'power plants'],
				entities: [
					{ name: 'Environmental Protection Agency', type: 'organization' },
					{ name: 'Clean Air Act', type: 'legislation' }
				],
				sentiment: 'neutral'
			},
			{
				category: 'news',
				title: 'Study: Renewable Energy Could Power 80% of US Grid by 2035',
				summary: 'A new analysis from the National Renewable Energy Laboratory finds that wind, solar, and battery storage could feasibly supply 80% of the nation\'s electricity within 12 years, with minimal impact on reliability.',
				sourceUrl: 'https://example.com/renewable-study',
				sourceName: 'Scientific American',
				publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
				relevanceScore: 0.76,
				topics: ['renewable energy', 'grid', 'research'],
				entities: [
					{ name: 'National Renewable Energy Laboratory', type: 'organization' }
				],
				sentiment: 'positive'
			},
			{
				category: 'legislative',
				title: 'S. 891: Climate Resilience and Adaptation Act',
				summary: 'Establishes a $50 billion federal program to help communities prepare for climate impacts including sea level rise, extreme heat, and wildfire risk. The bill includes funding for green infrastructure and early warning systems.',
				sourceUrl: 'https://congress.gov/bill/118/s891',
				sourceName: 'Congress.gov',
				publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
				relevanceScore: 0.84,
				topics: ['climate adaptation', 'infrastructure', 'resilience'],
				entities: [
					{ name: 'Sen. Brian Schatz', type: 'person' },
					{ name: 'Environment and Public Works Committee', type: 'organization' }
				]
			},
			{
				category: 'corporate',
				title: 'Tesla Announces Plan to Manufacture Renewable Hydrogen Fuel Cells',
				summary: 'Tesla CEO announced the company will begin production of hydrogen fuel cell systems for heavy trucks and industrial applications, aiming to complement its battery electric vehicle lineup.',
				sourceUrl: 'https://example.com/tesla-hydrogen',
				sourceName: 'Reuters',
				publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
				relevanceScore: 0.69,
				topics: ['hydrogen', 'transportation', 'clean energy'],
				entities: [
					{ name: 'Tesla', type: 'organization' },
					{ name: 'Elon Musk', type: 'person' }
				],
				sentiment: 'positive'
			},
			{
				category: 'news',
				title: 'Climate Activists Stage Mass Protests at Federal Buildings',
				summary: 'Thousands of demonstrators gathered in Washington D.C. and 50 state capitals demanding faster action on climate legislation. The coordinated protests called for an end to fossil fuel subsidies and accelerated clean energy deployment.',
				sourceUrl: 'https://example.com/climate-protests',
				sourceName: 'AP News',
				publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
				relevanceScore: 0.71,
				topics: ['activism', 'climate movement', 'protests'],
				entities: [
					{ name: 'Sunrise Movement', type: 'organization' },
					{ name: 'Extinction Rebellion', type: 'organization' }
				],
				sentiment: 'neutral'
			},
			{
				category: 'social',
				title: 'Public Opinion Shifts: 72% Support Renewable Energy Transition',
				summary: 'New Pew Research poll shows growing bipartisan support for clean energy, with 72% of Americans favoring increased federal investment in wind and solar power. Support crosses party lines, with 85% of Democrats and 58% of Republicans in favor.',
				sourceUrl: 'https://example.com/climate-poll',
				sourceName: 'Pew Research Center',
				publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
				relevanceScore: 0.78,
				topics: ['public opinion', 'polling', 'renewable energy'],
				entities: [
					{ name: 'Pew Research Center', type: 'organization' }
				],
				sentiment: 'positive'
			},
			{
				category: 'news',
				title: 'Extreme Heat Warnings Issued Across Southwest as Grid Strains',
				summary: 'Record-breaking temperatures are testing electrical infrastructure across Arizona, Nevada, and Southern California. Grid operators urge conservation as renewable energy struggles to meet peak demand during evening hours.',
				sourceUrl: 'https://example.com/heat-grid',
				sourceName: 'Los Angeles Times',
				publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
				relevanceScore: 0.65,
				topics: ['extreme heat', 'grid stability', 'climate impacts'],
				entities: [
					{ name: 'California Independent System Operator', type: 'organization' }
				],
				sentiment: 'negative'
			}
		];

		// Simulate streaming delay
		for (let i = 0; i < mockItems.length; i++) {
			await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));

			items = [
				...items,
				{
					...mockItems[i],
					id: `item-${Date.now()}-${i}`
				}
			];
		}

		streaming = false;
	}

	function stopStreaming() {
		streaming = false;
	}

	function resetDemo() {
		items = [];
		streaming = false;
	}

	function handleItemClick(item: IntelligenceItem) {
		console.log('Item clicked:', item);
		// In production, this might add the item as a source citation
	}

	// Auto-start demo on mount
	onMount(() => {
		simulateStreaming();
	});
</script>

<svelte:head>
	<title>Intelligence Panel Demo | Communiqué</title>
</svelte:head>

<div class="demo-page min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
	<div class="container mx-auto max-w-6xl">
		<!-- Header -->
		<header class="mb-8">
			<h1 class="text-3xl font-bold text-slate-900 mb-2">
				IntelligencePanel Component Demo
			</h1>
			<p class="text-slate-600 text-lg">
				Real-time streaming intelligence for template creation
			</p>
		</header>

		<!-- Demo Controls -->
		<div class="demo-controls rounded-xl border border-slate-200 bg-white p-6 mb-8 shadow-sm">
			<h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
				Demo Controls
			</h2>

			<!-- Query Config -->
			<div class="space-y-4 mb-6">
				<div>
					<label for="topics" class="block text-sm font-medium text-slate-700 mb-2">
						Topics
					</label>
					<input
						id="topics"
						type="text"
						bind:value={queryTopics}
						disabled={streaming}
						class="w-full rounded-lg border border-slate-300 px-4 py-2
							text-sm focus:border-participation-primary-500
							focus:ring-2 focus:ring-participation-primary-500/20
							disabled:opacity-50 disabled:cursor-not-allowed"
						placeholder="e.g., climate change, renewable energy"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="target-type" class="block text-sm font-medium text-slate-700 mb-2">
							Target Type
						</label>
						<select
							id="target-type"
							bind:value={targetType}
							disabled={streaming}
							class="w-full rounded-lg border border-slate-300 px-4 py-2
								text-sm focus:border-participation-primary-500
								focus:ring-2 focus:ring-participation-primary-500/20
								disabled:opacity-50"
						>
							<option value="congress">US Congress</option>
							<option value="state_legislature">State Legislature</option>
							<option value="corporate">Corporation</option>
						</select>
					</div>

					<div>
						<label for="timeframe" class="block text-sm font-medium text-slate-700 mb-2">
							Timeframe
						</label>
						<select
							id="timeframe"
							bind:value={timeframe}
							disabled={streaming}
							class="w-full rounded-lg border border-slate-300 px-4 py-2
								text-sm focus:border-participation-primary-500
								focus:ring-2 focus:ring-participation-primary-500/20
								disabled:opacity-50"
						>
							<option value="day">Last 24 hours</option>
							<option value="week">Past week</option>
							<option value="month">Past month</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-3">
				<button
					type="button"
					onclick={simulateStreaming}
					disabled={streaming}
					class="inline-flex items-center gap-2 rounded-lg bg-participation-primary-500
						px-4 py-2 text-sm font-medium text-white transition-all
						hover:bg-participation-primary-600 hover:shadow-md
						focus:outline-none focus-visible:ring-2
						focus-visible:ring-participation-primary-500 focus-visible:ring-offset-2
						disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Play class="h-4 w-4" strokeWidth={2} />
					Start Streaming
				</button>

				<button
					type="button"
					onclick={stopStreaming}
					disabled={!streaming}
					class="inline-flex items-center gap-2 rounded-lg border border-slate-300
						bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all
						hover:bg-slate-50 hover:border-slate-400
						focus:outline-none focus-visible:ring-2
						focus-visible:ring-slate-400 focus-visible:ring-offset-2
						disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<StopCircle class="h-4 w-4" strokeWidth={2} />
					Stop
				</button>

				<button
					type="button"
					onclick={resetDemo}
					disabled={streaming}
					class="inline-flex items-center gap-2 rounded-lg border border-slate-300
						bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all
						hover:bg-slate-50 hover:border-slate-400
						focus:outline-none focus-visible:ring-2
						focus-visible:ring-slate-400 focus-visible:ring-offset-2
						disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<RotateCcw class="h-4 w-4" strokeWidth={2} />
					Reset
				</button>
			</div>

			<!-- Stats -->
			<div class="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
				<div>
					<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Items</p>
					<p class="text-2xl font-bold text-slate-900">{items.length}</p>
				</div>
				<div>
					<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
					<p class="text-sm font-medium {streaming ? 'text-participation-primary-600' : 'text-emerald-600'}">
						{streaming ? 'Streaming...' : 'Ready'}
					</p>
				</div>
				<div>
					<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Panel State</p>
					<p class="text-sm font-medium text-slate-700">
						{panelExpanded ? 'Expanded' : 'Collapsed'}
					</p>
				</div>
			</div>
		</div>

		<!-- Component Demo -->
		<div class="component-demo">
			<h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
				Live Component
			</h2>

			<IntelligencePanel
				{items}
				{streaming}
				bind:expanded={panelExpanded}
				maxItems={20}
				onitemclick={handleItemClick}
			/>
		</div>

		<!-- Usage Notes -->
		<div class="usage-notes mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
			<h2 class="text-sm font-semibold text-slate-900 mb-3">
				Component Features
			</h2>
			<ul class="space-y-2 text-sm text-slate-700">
				<li class="flex items-start gap-2">
					<span class="text-participation-primary-500 mt-0.5">•</span>
					<span><strong>Real-time streaming:</strong> Items appear smoothly as they arrive, with fade-in animations</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-participation-primary-500 mt-0.5">•</span>
					<span><strong>Category filtering:</strong> Click category chips to filter by news, legislative, corporate, etc.</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-participation-primary-500 mt-0.5">•</span>
					<span><strong>Relevance sorting:</strong> High-relevance items appear first with visual emphasis</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-participation-primary-500 mt-0.5">•</span>
					<span><strong>Progressive disclosure:</strong> Summaries truncate with "Read more" expansion</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-participation-primary-500 mt-0.5">•</span>
					<span><strong>Accessibility:</strong> ARIA live regions, keyboard navigation, screen reader support</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-participation-primary-500 mt-0.5">•</span>
					<span><strong>Collapsible design:</strong> Minimizes to header bar to respect screen real estate</span>
				</li>
			</ul>
		</div>
	</div>
</div>

<style>
	.demo-page {
		font-family: 'Satoshi', ui-sans-serif, system-ui, -apple-system, sans-serif;
	}

	.container {
		animation: fadeIn 0.5s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
