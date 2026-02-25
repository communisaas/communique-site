<script lang="ts">
	/**
	 * Model agreement visualization.
	 *
	 * Shows N dots representing the model panel. Filled dots = models that
	 * agreed (within 20% of median). Empty dots = outliers.
	 *
	 * Perceptual design: Dots are the simplest possible encoding for
	 * "fraction of consensus" — perceivable at glance bandwidth.
	 * Color saturation encodes strength: full green = strong consensus,
	 * amber = weak, red = no consensus.
	 */

	interface Props {
		agreement: number; // 0-1 fraction
		modelCount: number;
		signatureCount: number;
		quorumRequired: number;
		compact?: boolean;
	}

	let { agreement, modelCount, signatureCount, quorumRequired, compact = false }: Props = $props();

	const agreeingCount = $derived(Math.round(agreement * modelCount));

	const consensusColor = $derived(() => {
		if (agreement >= 0.8) return { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Strong' };
		if (agreement >= 0.6) return { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Moderate' };
		return { dot: 'bg-red-500', text: 'text-red-700', label: 'Weak' };
	});

	const quorumMet = $derived(signatureCount >= quorumRequired);
</script>

<div class="flex items-center gap-{compact ? '2' : '3'}">
	<!-- Model dots -->
	<div class="flex items-center gap-1" title="{agreeingCount} of {modelCount} models agree">
		{#each Array(modelCount) as _, i}
			{@const agreed = i < agreeingCount}
			<div
				class="rounded-full transition-colors duration-300
					{compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}
					{agreed ? consensusColor().dot : 'bg-slate-200'}"
			></div>
		{/each}
	</div>

	<!-- Label -->
	<span class="text-xs font-medium {consensusColor().text}">
		{compact ? `${Math.round(agreement * 100)}%` : `${consensusColor().label} (${Math.round(agreement * 100)}%)`}
	</span>

	<!-- Quorum badge -->
	{#if !compact}
		<span
			class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset
				{quorumMet
					? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
					: 'bg-red-50 text-red-700 ring-red-600/20'}"
		>
			{signatureCount}/{quorumRequired} sigs
		</span>
	{/if}
</div>
