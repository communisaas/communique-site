<script lang="ts">
	import { spring } from 'svelte/motion';

	interface Props {
		stakeAmount: number; // In USDC smallest unit (1e6 = $1)
		engagementTier: number;
		minStake?: number;
		maxStake?: number;
		onchange: (amount: number) => void;
	}

	let {
		stakeAmount,
		engagementTier,
		minStake = 1_000_000, // $1 USDC
		maxStake = 100_000_000, // $100 USDC
		onchange
	}: Props = $props();

	// Human-readable amounts
	const dollarAmount = $derived(stakeAmount / 1e6);
	const minDollar = $derived(minStake / 1e6);
	const maxDollar = $derived(maxStake / 1e6);

	// Formula: sqrt(stake) * 2^tier
	const sqrtStake = $derived(Math.sqrt(dollarAmount));
	const tierMultiplier = $derived(Math.pow(2, engagementTier));
	const weight = $derived(sqrtStake * tierMultiplier);

	// Spring-animated weight display
	const animatedWeight = spring(weight, { stiffness: 0.4, damping: 0.8 });
	$effect(() => {
		animatedWeight.set(weight);
	});

	// Slider position (0-100)
	const sliderPosition = $derived(
		((dollarAmount - minDollar) / (maxDollar - minDollar)) * 100
	);

	function handleSlider(e: Event) {
		const target = e.target as HTMLInputElement;
		const ratio = Number(target.value) / 100;
		const val = minDollar + ratio * (maxDollar - minDollar);
		const rounded = Math.round(val * 100) / 100;
		onchange(Math.round(rounded * 1e6));
	}

	// Preset amounts (dollars)
	const presets = [1, 5, 10, 25, 50, 100];
</script>

<div class="space-y-4">
	<p class="text-sm font-medium text-slate-700">Stake your credibility</p>

	<!-- Formula visualization -->
	<div class="rounded-lg bg-slate-50 border border-slate-200 p-4">
		<div class="flex items-center justify-center gap-2 text-lg">
			<span class="font-mono text-slate-800">
				√(<span class="text-indigo-600 font-semibold">${dollarAmount.toFixed(2)}</span>)
			</span>
			<span class="text-slate-400">×</span>
			<span class="font-mono text-slate-800">
				2<sup class="text-xs">{engagementTier}</sup>
			</span>
			<span class="text-slate-400">=</span>
			<span class="font-mono text-2xl font-bold text-slate-900">
				{$animatedWeight.toFixed(1)}
			</span>
		</div>
		<p class="text-xs text-slate-500 text-center mt-1">
			argument weight
		</p>
	</div>

	<!-- Slider -->
	<div class="space-y-2">
		<input
			type="range"
			min="0"
			max="100"
			value={sliderPosition}
			oninput={handleSlider}
			class="w-full h-2 rounded-lg appearance-none cursor-pointer
				bg-gradient-to-r from-slate-200 via-indigo-200 to-indigo-400
				[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
				[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600
				[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab
				[&::-webkit-slider-thumb]:active:cursor-grabbing"
		/>
		<div class="flex justify-between text-xs text-slate-400">
			<span>${minDollar}</span>
			<span>${maxDollar}</span>
		</div>
	</div>

	<!-- Preset buttons -->
	<div class="flex flex-wrap gap-1.5">
		{#each presets as preset}
			<button
				class="px-2.5 py-1 text-xs font-medium rounded-md border transition-colors
					{dollarAmount === preset
					? 'bg-indigo-50 border-indigo-300 text-indigo-700'
					: 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}"
				onclick={() => onchange(Math.round(preset * 1e6))}
			>
				${preset}
			</button>
		{/each}
	</div>

	<!-- Context note -->
	<p class="text-xs text-slate-500">
		{#if engagementTier >= 3}
			Your Tier {engagementTier} verification gives your argument
			<span class="font-medium text-slate-700">{tierMultiplier}x</span> the weight.
			A $5 stake from you carries the same weight as ${(5 * tierMultiplier * tierMultiplier).toFixed(0)} at Tier 1.
		{:else}
			Higher verification tiers increase your argument's weight through the trust multiplier.
		{/if}
	</p>
</div>
