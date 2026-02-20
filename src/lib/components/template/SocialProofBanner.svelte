<script lang="ts">
	import { Users, TrendingUp, MapPin, Flame } from '@lucide/svelte';
	import { spring } from 'svelte/motion';
	import { onMount } from 'svelte';
	import { formatDistrictName } from '$lib/utils/district-names';

	let {
		totalActions,
		totalDistricts = 0,
		totalStates = 0,
		userDistrictCount = 0,
		userDistrictCode = null,
		showTrending = true
	}: {
		totalActions: number;
		totalDistricts?: number;
		totalStates?: number;
		userDistrictCount?: number;
		userDistrictCode?: string | null;
		showTrending?: boolean;
	} = $props();

	// Animated counter for visual appeal
	let displayCount = spring(0, { stiffness: 0.2, damping: 0.8 });

	onMount(() => {
		displayCount.set(totalActions);
	});

	$effect(() => {
		displayCount.set(totalActions);
	});

	// Determine visual style based on action count
	const visualStyle = $derived(() => {
		if (totalActions >= 10000) return 'viral';
		if (totalActions >= 1000) return 'trending';
		if (totalActions >= 100) return 'growing';
		return 'starting';
	});

	const styleConfig = {
		viral: {
			borderColor: 'border-red-200',
			bgColor: 'bg-red-50',
			iconBg: 'bg-red-100',
			iconColor: 'text-red-600',
			textColor: 'text-red-900',
			accentColor: 'text-red-600',
			icon: Flame,
			label: 'Viral movement'
		},
		trending: {
			borderColor: 'border-green-200',
			bgColor: 'bg-green-50',
			iconBg: 'bg-green-100',
			iconColor: 'text-green-600',
			textColor: 'text-green-900',
			accentColor: 'text-green-600',
			icon: TrendingUp,
			label: 'Trending'
		},
		growing: {
			borderColor: 'border-participation-primary-200',
			bgColor: 'bg-participation-primary-50',
			iconBg: 'bg-participation-primary-100',
			iconColor: 'text-participation-primary-600',
			textColor: 'text-participation-primary-900',
			accentColor: 'text-participation-primary-600',
			icon: Users,
			label: 'Growing movement'
		},
		starting: {
			borderColor: 'border-slate-200',
			bgColor: 'bg-slate-50',
			iconBg: 'bg-slate-100',
			iconColor: 'text-slate-600',
			textColor: 'text-slate-900',
			accentColor: 'text-slate-600',
			icon: Users,
			label: 'Join the movement'
		}
	};

	const config = $derived(styleConfig[visualStyle()]);
	const Icon = $derived(config.icon);

	// Human-readable district name for the user's district
	const userDistrictLabel = $derived(
		userDistrictCode ? formatDistrictName(userDistrictCode) : null
	);
</script>

<div
	class="rounded-lg border-2 p-4 transition-all duration-300 {config.borderColor} {config.bgColor}"
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
		<!-- Icon -->
		<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full {config.iconBg}">
			<Icon class="h-6 w-6 {config.iconColor}" />
		</div>

		<!-- Main Content -->
		<div class="flex-1">
			<div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
				<!-- Action Count -->
				<span class="text-3xl font-bold {config.textColor} sm:text-2xl">
					{Math.floor($displayCount).toLocaleString()}
				</span>
				<span class="text-sm text-slate-600 sm:text-base">people have taken action</span>

				<!-- Trending Indicator -->
				{#if showTrending && totalActions >= 1000}
					<span class="inline-flex items-center gap-1 text-sm font-medium {config.accentColor}">
						{#if visualStyle() === 'viral'}
							<Flame class="h-4 w-4" />
							<span>Viral!</span>
						{:else}
							<TrendingUp class="h-4 w-4" />
							<span>Trending</span>
						{/if}
					</span>
				{/if}
			</div>

			<!-- Personalized "in YOUR district" -->
			{#if userDistrictCount > 0 && userDistrictLabel}
				<div class="mt-2 flex items-center gap-2 text-sm font-medium text-participation-primary-700">
					<MapPin class="h-3.5 w-3.5 shrink-0" />
					<span>
						{userDistrictCount.toLocaleString()} constituent{userDistrictCount === 1 ? '' : 's'} in your district ({userDistrictLabel}) sent this
					</span>
				</div>
			{:else if totalDistricts > 0}
				<!-- Aggregate district coverage (no user context) -->
				<div class="mt-2 flex items-center gap-2 text-xs text-slate-600 sm:text-sm">
					<MapPin class="h-3 w-3 shrink-0" />
					<span>
						Active in {totalDistricts.toLocaleString()} district{totalDistricts === 1 ? '' : 's'} across {totalStates} state{totalStates === 1 ? '' : 's'}
					</span>
				</div>
			{/if}
		</div>
	</div>
</div>
