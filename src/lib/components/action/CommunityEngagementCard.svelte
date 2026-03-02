<script lang="ts">
	/**
	 * CommunityEngagementCard — Makes coordination visible.
	 *
	 * The conversion catalyst: "{N} coordinating across {M} districts"
	 * turns individual action into felt collective presence.
	 *
	 * Design: numbers in JetBrains Mono, spring physics on counts,
	 * user's district highlighted, top districts listed.
	 * Voice: confident, direct. No emotional framing.
	 */
	import { spring } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { MapPin, Users, TrendingUp } from '@lucide/svelte';

	export interface DistrictEngagement {
		district_code: string;
		support: number;
		oppose: number;
		total: number;
		support_percent: number;
		is_user_district: boolean;
	}

	export interface EngagementAggregate {
		total_districts: number;
		total_positions: number;
		total_support: number;
		total_oppose: number;
	}

	export interface EngagementData {
		template_id: string;
		districts: DistrictEngagement[];
		aggregate: EngagementAggregate;
	}

	let {
		engagement,
		userDistrict,
		onAddPosition
	}: {
		engagement: EngagementData | null;
		userDistrict?: string | null;
		onAddPosition?: () => void;
	} = $props();

	// Spring-animated total count
	const totalCount = spring(0, { stiffness: 0.15, damping: 0.8 });
	const districtCount = spring(0, { stiffness: 0.15, damping: 0.8 });

	$effect(() => {
		if (engagement) {
			totalCount.set(engagement.aggregate.total_positions);
			districtCount.set(engagement.aggregate.total_districts);
		}
	});

	// User's district data (highlighted)
	const userDistrictData = $derived(
		engagement?.districts.find((d) => d.is_user_district) ?? null
	);

	// Top districts (excluding user's, sorted by total)
	const topDistricts = $derived(
		(engagement?.districts ?? [])
			.filter((d) => !d.is_user_district)
			.slice(0, 4)
	);

	// Max count for bar width scaling
	const maxTotal = $derived(
		Math.max(
			...(engagement?.districts ?? []).map((d) => d.total),
			1
		)
	);

	// Only render if there's actual engagement data
	const hasData = $derived(
		engagement != null && engagement.aggregate.total_positions > 0
	);
</script>

{#if hasData}
	<div
		class="rounded-xl border border-slate-200/80 bg-white shadow-sm"
		in:fly={{ y: 12, duration: 300 }}
	>
		<!-- Headline: the number is the product -->
		<div class="px-5 pt-4 pb-3">
			<div class="flex items-center gap-2 mb-1">
				<Users class="h-4 w-4 text-teal-600" />
				<h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">
					Coordinating
				</h3>
			</div>
			<div class="flex items-baseline gap-2">
				<span class="font-mono text-3xl font-bold text-slate-900">
					{Math.round($totalCount).toLocaleString()}
				</span>
				<span class="text-sm text-slate-500">
					across
					<span class="font-mono font-semibold text-slate-700">
						{Math.round($districtCount)}
					</span>
					{Math.round($districtCount) === 1 ? 'district' : 'districts'}
				</span>
			</div>
		</div>

		<!-- User's district (highlighted if known) -->
		{#if userDistrictData}
			<div class="mx-4 mb-3 rounded-lg border border-teal-200/60 bg-teal-50/50 px-4 py-3">
				<div class="flex items-center justify-between mb-1.5">
					<div class="flex items-center gap-1.5">
						<MapPin class="h-3.5 w-3.5 text-teal-600" />
						<span class="text-sm font-semibold text-teal-900">
							{userDistrictData.district_code}
						</span>
						<span class="text-xs text-teal-600">your district</span>
					</div>
					<span class="font-mono text-sm font-bold text-teal-800">
						{userDistrictData.total}
					</span>
				</div>
				<!-- Stance bar -->
				<div class="flex h-1.5 overflow-hidden rounded-full bg-slate-200/60">
					<div
						class="bg-teal-500 transition-all duration-500"
						style="width: {userDistrictData.support_percent}%"
					></div>
					<div
						class="bg-slate-400 transition-all duration-500"
						style="width: {100 - userDistrictData.support_percent}%"
					></div>
				</div>
				<div class="mt-1 flex justify-between text-[11px] text-slate-500">
					<span>{userDistrictData.support} support</span>
					<span>{userDistrictData.oppose} oppose</span>
				</div>
			</div>
		{/if}

		<!-- Top districts -->
		{#if topDistricts.length > 0}
			<div class="px-5 pb-3">
				{#if userDistrictData}
					<p class="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Other districts</p>
				{/if}
				<div class="space-y-2">
					{#each topDistricts as district (district.district_code)}
						<div class="flex items-center gap-3">
							<span class="w-12 text-xs font-medium text-slate-600 shrink-0">
								{district.district_code}
							</span>
							<div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
								<div
									class="h-full rounded-full bg-slate-300 transition-all duration-500"
									style="width: {(district.total / maxTotal) * 100}%"
								></div>
							</div>
							<span class="font-mono text-xs font-semibold text-slate-700 w-8 text-right shrink-0">
								{district.total}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- CTA -->
		{#if onAddPosition}
			<div class="border-t border-slate-100 px-5 py-3">
				<button
					onclick={onAddPosition}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
				>
					<TrendingUp class="h-4 w-4" />
					Add your position
				</button>
			</div>
		{/if}
	</div>
{/if}
