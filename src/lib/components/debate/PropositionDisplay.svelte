<script lang="ts">
	interface Props {
		propositionText: string;
		propositionHash: string;
		status?: 'active' | 'resolved';
	}

	let { propositionText, propositionHash, status = 'active' }: Props = $props();

	const truncatedHash = $derived(
		propositionHash.length > 18
			? `${propositionHash.slice(0, 10)}...${propositionHash.slice(-6)}`
			: propositionHash
	);
</script>

<div class="border-l-4 border-slate-700 pl-4 py-3">
	<p class="text-lg font-semibold text-slate-900 leading-relaxed">
		{propositionText}
	</p>
	<div class="mt-2 flex items-center gap-2">
		{#if status === 'active'}
			<span class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 border border-amber-200">
				<span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
				Open for deliberation
			</span>
		{:else}
			<span class="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5 border border-slate-200">
				Resolved
			</span>
		{/if}
		<span class="font-mono text-xs text-slate-400" title={propositionHash}>
			{truncatedHash}
		</span>
	</div>
</div>
