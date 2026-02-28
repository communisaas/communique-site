<script lang="ts">
	interface Props {
		propositionText: string;
		propositionHash: string;
	}

	let { propositionText, propositionHash }: Props = $props();

	let expanded = $state(false);
	const shouldClamp = $derived(propositionText.length > 120);
</script>

<div>
	<p
		class="text-sm text-slate-700 leading-relaxed"
		class:line-clamp-2={!expanded && shouldClamp}
	>
		{propositionText}
	</p>
	{#if shouldClamp}
		<button
			class="text-xs text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? 'Less' : 'More'}
		</button>
	{/if}
	<button
		class="mt-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
		title={propositionHash}
	>
		Verified on-chain &rarr;
	</button>
</div>
