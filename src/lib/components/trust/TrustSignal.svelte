<script lang="ts">
	import { MapPin, ShieldCheck, BadgeCheck, User } from '@lucide/svelte';
	import { TRUST_TIER_LABELS, type TrustTier } from '$lib/core/identity/authority-level';

	let {
		trustTier,
		showUpgrade = false,
		onUpgradeClick,
		compact = false
	}: {
		trustTier: number;
		showUpgrade?: boolean;
		onUpgradeClick?: () => void;
		compact?: boolean;
	} = $props();

	// Clamp to valid tier range
	const safeTier: TrustTier = $derived(
		(Math.max(0, Math.min(5, Math.floor(trustTier))) as TrustTier)
	);

	const label = $derived(TRUST_TIER_LABELS[safeTier]);

	// Tier-based color schemes
	const colorClasses = $derived(
		({
			0: 'text-slate-500 bg-slate-50 border-slate-200',
			1: 'text-blue-700 bg-blue-50 border-blue-200',
			2: 'text-emerald-700 bg-emerald-50 border-emerald-200',
			3: 'text-purple-700 bg-purple-50 border-purple-200',
			4: 'text-indigo-700 bg-indigo-50 border-indigo-200',
			5: 'text-amber-700 bg-amber-50 border-amber-200'
		})[safeTier]
	);

	const iconColorClass = $derived(
		({
			0: 'text-slate-400',
			1: 'text-blue-500',
			2: 'text-emerald-500',
			3: 'text-purple-500',
			4: 'text-indigo-500',
			5: 'text-amber-500'
		})[safeTier]
	);

	// Whether to show upgrade affordance
	const shouldShowUpgrade = $derived(showUpgrade && safeTier < 2);
</script>

<div
	class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 {colorClasses}"
	class:text-xs={compact}
	class:text-sm={!compact}
	class:px-2={compact}
	class:px-2.5={!compact}
	class:py-0.5={compact}
	class:py-1={!compact}
>
	<!-- Tier-appropriate icon -->
	{#if safeTier === 0}
		<!-- Guest: conceptual tier, rarely rendered -->
		<User class="h-3 w-3 {iconColorClass}" />
	{:else if safeTier === 1}
		<!-- Authenticated (OAuth) -->
		<User class="h-3 w-3 {iconColorClass}" />
	{:else if safeTier === 2}
		<MapPin class="h-3 w-3 {iconColorClass}" />
	{:else if safeTier === 3}
		<ShieldCheck class="h-3 w-3 {iconColorClass}" />
	{:else if safeTier === 4}
		<ShieldCheck class="h-3 w-3 {iconColorClass}" />
	{:else if safeTier === 5}
		<BadgeCheck class="h-3 w-3 {iconColorClass}" />
	{/if}

	<span class="font-medium leading-none">{label}</span>
</div>

{#if shouldShowUpgrade}
	<button
		type="button"
		class="mt-1 text-xs text-emerald-600 underline decoration-emerald-300 underline-offset-2 transition-colors hover:text-emerald-700 hover:decoration-emerald-500"
		onclick={() => onUpgradeClick?.()}
	>
		Verify your address for faster delivery
	</button>
{/if}
