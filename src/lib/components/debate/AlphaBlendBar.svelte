<script lang="ts">
	/**
	 * Alpha-blend visualization showing AI vs Community contribution.
	 *
	 * The bar is split into two regions: violet for AI, indigo for Community.
	 * The split point IS the alpha value — making the governance parameter
	 * physically perceivable as a spatial proportion.
	 *
	 * Perceptual design: The two-color bar creates a strong figure-ground
	 * relationship. The boundary between colors is the "decision boundary"
	 * — the literal point where AI influence ends and community begins.
	 * This makes an abstract governance parameter (alpha) into something
	 * the body understands: a ratio of space.
	 */
	import { spring } from 'svelte/motion';

	interface Props {
		aiScore: number; // 0-10000
		communityScore: number; // 0-10000 (already normalized)
		alphaWeight: number; // basis points (e.g., 4000 = 40% AI)
		finalScore: number; // 0-10000
		compact?: boolean;
	}

	let { aiScore, communityScore, alphaWeight, finalScore, compact = false }: Props = $props();

	const alphaPct = $derived(alphaWeight / 100); // e.g., 40
	const communityPct = $derived(100 - alphaPct);

	const aiWidth = spring(0, { stiffness: 0.3, damping: 0.85 });
	const communityWidth = spring(0, { stiffness: 0.3, damping: 0.85 });

	$effect(() => {
		aiWidth.set(alphaPct);
		communityWidth.set(communityPct);
	});

	function formatBp(bp: number): string {
		return (bp / 100).toFixed(1) + '%';
	}
</script>

<div class="space-y-{compact ? '1' : '2'}">
	<!-- Score labels -->
	{#if !compact}
		<div class="flex items-center justify-between text-xs">
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-2 w-2 rounded-full bg-violet-500"></span>
				<span class="text-slate-600">AI Score</span>
				<span class="font-mono font-semibold text-violet-700">{formatBp(aiScore)}</span>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="inline-block h-2 w-2 rounded-full bg-indigo-500"></span>
				<span class="text-slate-600">Community</span>
				<span class="font-mono font-semibold text-indigo-700">{formatBp(communityScore)}</span>
			</div>
		</div>
	{/if}

	<!-- The blend bar -->
	<div
		class="flex w-full overflow-hidden rounded-lg {compact ? 'h-2' : 'h-3'}"
		role="img"
		aria-label="AI contributes {alphaPct.toFixed(0)}%, community {communityPct.toFixed(0)}%"
	>
		<div
			class="bg-violet-500 h-full transition-none"
			style="width: {$aiWidth.toFixed(1)}%;"
			title="AI: {alphaPct.toFixed(0)}% weight"
		></div>
		<div
			class="bg-indigo-400 h-full transition-none"
			style="width: {$communityWidth.toFixed(1)}%;"
			title="Community: {communityPct.toFixed(0)}% weight"
		></div>
	</div>

	<!-- Alpha label + final score -->
	<div class="flex items-center justify-between text-xs">
		<span class="text-slate-500">
			{alphaPct.toFixed(0)}% AI / {communityPct.toFixed(0)}% Community
		</span>
		<span class="font-mono font-semibold text-slate-800">
			Final: {formatBp(finalScore)}
		</span>
	</div>
</div>
