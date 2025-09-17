<script lang="ts">
	import { onMount } from 'svelte';
	import TemplatePerformanceCard from './TemplatePerformanceCard.svelte';
	import DeliveryTracker from './DeliveryTracker.svelte';
	import SkeletonCard from '$lib/components/ui/SkeletonCard.svelte';
	import SkeletonStat from '$lib/components/ui/SkeletonStat.svelte';
	import SkeletonList from '$lib/components/ui/SkeletonList.svelte';
	import SkeletonTable from '$lib/components/ui/SkeletonTable.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface CampaignOverview {
		total_templates: number;
		active_campaigns: number;
		total_activations: number;
		avg_viral_coefficient: number;
		top_performers: Array<{
			id: string;
			title: string;
			activations: number;
			viral_status: string;
		}>;
		recent_activity: Array<{
			timestamp: string;
			event: string;
			template_id: string;
			template_title: string;
		}>;
	}

	let { userId }: { userId: string } = $props();

	let overview: CampaignOverview | null = $state(null);
	let userTemplates: any[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedTimeframe = $state<'24h' | '7d' | '30d'>('7d');

	onMount(async () => {
		await Promise.all([loadOverview(), loadUserTemplates()]);
		loading = false;
	});

	async function loadOverview() {
		try {
			const response = await fetch(`/api/analytics/overview?timeframe=${selectedTimeframe}`);
			const data = await response.json();

			if (data.success) {
				overview = data.overview;
			}
		} catch (_error) {
			console.error('Failed to load overview:', _error);
		}
	}

	async function loadUserTemplates() {
		try {
			const response = await fetch('/api/user/templates');
			const data = await response.json();

			if (data.success) {
				userTemplates = data.templates || [];
			}
		} catch (_error) {
			console.error('Failed to load templates:', _error);
		}
	}

	async function handleTimeframeChange(timeframe: '24h' | '7d' | '30d') {
		selectedTimeframe = timeframe;
		loading = true;
		await loadOverview();
		loading = false;
	}

	function getActivityIcon(event: string): string {
		switch (event) {
			case 'template_created':
				return '✨';
			case 'campaign_launched':
				return '🚀';
			case 'viral_threshold':
				return '🔥';
			case 'activation_spike':
				return '📈';
			default:
				return '📊';
		}
	}

	function getActivityColor(event: string): string {
		switch (event) {
			case 'viral_threshold':
				return 'text-green-600 bg-green-50';
			case 'activation_spike':
				return 'text-participation-primary-600 bg-participation-primary-50';
			case 'campaign_launched':
				return 'text-purple-600 bg-purple-50';
			default:
				return 'text-gray-600 bg-gray-50';
		}
	}
</script>

<div class="space-y-6">
	<!-- Header with Timeframe Selector -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Campaign Dashboard</h1>
			<p class="mt-1 text-gray-600">Monitor your template performance and campaign analytics</p>
		</div>
		<div class="flex rounded-lg bg-gray-100 p-1">
			<button
				onclick={() => handleTimeframeChange('24h')}
				class={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
					selectedTimeframe === '24h'
						? 'bg-white text-participation-primary-700 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'
				}`}
			>
				24h
			</button>
			<button
				onclick={() => handleTimeframeChange('7d')}
				class={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
					selectedTimeframe === '7d'
						? 'bg-white text-participation-primary-700 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'
				}`}
			>
				7d
			</button>
			<button
				onclick={() => handleTimeframeChange('30d')}
				class={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
					selectedTimeframe === '30d'
						? 'bg-white text-participation-primary-700 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'
				}`}
			>
				30d
			</button>
		</div>
	</div>

	{#if loading}
		<!-- Overview Cards Skeleton -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}
				<div class="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-6">
					<SkeletonStat />
				</div>
			{/each}
		</div>

		<!-- Top Performers Skeleton -->
		<SkeletonCard lines={5} showActions={false} classNames="mt-6" />

		<!-- Recent Activity Skeleton -->
		<SkeletonList items={3} showAvatar={true} classNames="mt-6" />

		<!-- Performance Cards Skeleton -->
		<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<SkeletonCard lines={6} />
			<SkeletonCard lines={6} />
		</div>
	{:else}
		<!-- Overview Cards -->
		{#if overview}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				<div
					class="rounded-xl bg-gradient-to-br from-participation-primary-50 to-participation-primary-100 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-participation-primary-600">Templates</p>
							<p class="text-3xl font-bold text-participation-primary-900">
								{overview.total_templates}
							</p>
						</div>
						<div class="rounded-full bg-participation-primary-500 p-3">
							<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								></path>
							</svg>
						</div>
					</div>
					<p class="mt-2 text-xs text-participation-primary-600">
						{overview.active_campaigns} active campaigns
					</p>
				</div>

				<div class="rounded-xl bg-gradient-to-br from-green-50 to-green-100 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-green-600">Total Activations</p>
							<p class="text-3xl font-bold text-green-900">{overview.total_activations}</p>
						</div>
						<div class="rounded-full bg-green-500 p-3">
							<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
								></path>
							</svg>
						</div>
					</div>
					<p class="mt-2 text-xs text-green-600">Across all templates</p>
				</div>

				<div class="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-purple-600">Avg. Viral Coefficient</p>
							<p class="text-3xl font-bold text-purple-900">
								{overview.avg_viral_coefficient.toFixed(2)}
							</p>
						</div>
						<div class="rounded-full bg-purple-500 p-3">
							<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
								></path>
							</svg>
						</div>
					</div>
					<p class="mt-2 text-xs text-purple-600">
						{overview.avg_viral_coefficient > 1 ? 'Self-sustaining growth' : 'Needs optimization'}
					</p>
				</div>

				<div class="rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-orange-600">Performance Score</p>
							<p class="text-3xl font-bold text-orange-900">
								{Math.round(
									(overview.avg_viral_coefficient + overview.total_activations / 100) * 10
								)}
							</p>
						</div>
						<div class="rounded-full bg-orange-500 p-3">
							<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								></path>
							</svg>
						</div>
					</div>
					<p class="mt-2 text-xs text-orange-600">Combined effectiveness metric</p>
				</div>
			</div>
		{/if}

		<!-- Template Performance Grid -->
		<div>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-gray-900">Template Performance</h2>
				<a
					href="/"
					class="text-sm font-medium text-participation-primary-600 hover:text-participation-primary-700"
				>
					Create New Template →
				</a>
			</div>

			{#if userTemplates.length > 0}
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{#each userTemplates.slice(0, 6) as template}
						<TemplatePerformanceCard
							templateId={template.id}
							title={template.title}
							compact={false}
						/>
					{/each}
				</div>

				{#if userTemplates.length > 6}
					<div class="mt-6 text-center">
						<button
							class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
						>
							Show All {userTemplates.length} Templates
						</button>
					</div>
				{/if}
			{:else}
				<div class="rounded-xl bg-gray-50 p-8 text-center">
					<svg
						class="mx-auto mb-4 h-16 w-16 text-gray-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						></path>
					</svg>
					<h3 class="mb-2 text-lg font-medium text-gray-600">No Templates Yet</h3>
					<p class="mb-4 text-gray-500">
						Create your first template to start tracking performance metrics
					</p>
					<a
						href="/"
						class="inline-flex items-center rounded-lg bg-participation-primary-600 px-4 py-2 text-white transition-colors hover:bg-participation-primary-700"
					>
						Create First Template
					</a>
				</div>
			{/if}
		</div>

		<!-- Real-Time Delivery Tracking -->
		<div class="mb-8">
			<DeliveryTracker {userId} realTime={true} />
		</div>

		<!-- Recent Activity & Top Performers -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Recent Activity -->
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h3>
				{#if overview?.recent_activity && overview.recent_activity.length > 0}
					<div class="space-y-3">
						{#each overview.recent_activity.slice(0, 5) as activity}
							<div class="flex items-center space-x-3">
								<div
									class={`flex h-8 w-8 items-center justify-center rounded-full ${getActivityColor(activity.event)}`}
								>
									<span class="text-sm">{getActivityIcon(activity.event)}</span>
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium text-gray-900">
										{activity.event.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
									</p>
									<p class="truncate text-xs text-gray-500">
										{activity.template_title}
									</p>
								</div>
								<div class="text-xs text-gray-400">
									{new Date(activity.timestamp).toLocaleDateString()}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-6 text-center text-gray-500">
						<p class="text-sm">No recent activity</p>
					</div>
				{/if}
			</div>

			<!-- Top Performers -->
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Top Performers</h3>
				{#if overview?.top_performers && overview.top_performers.length > 0}
					<div class="space-y-3">
						{#each overview.top_performers.slice(0, 5) as performer, index}
							<div class="flex items-center space-x-3">
								<div
									class={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
										index === 0
											? 'bg-yellow-100 text-yellow-800'
											: index === 1
												? 'bg-gray-100 text-gray-600'
												: index === 2
													? 'bg-orange-100 text-orange-600'
													: 'bg-participation-primary-50 text-participation-primary-600'
									}`}
								>
									{index + 1}
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-gray-900">
										{performer.title}
									</p>
									<div class="flex items-center space-x-2">
										<span class="text-xs text-gray-500">
											{performer.activations} activations
										</span>
										<Badge variant="neutral" size="sm">
											{performer.viral_status}
										</Badge>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-6 text-center text-gray-500">
						<p class="text-sm">No performance data yet</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
