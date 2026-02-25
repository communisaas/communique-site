<script lang="ts">
	import type { PageData } from './$types';
	import DebateSurface from '$lib/components/debate/DebateSurface.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import { debateState } from '$lib/stores/debateState.svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';
	import { ArrowLeft } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	const debate = $derived(data.debate as DebateData);
	const template = $derived(data.template);

	// Connect SSE on mount, disconnect on destroy
	$effect(() => {
		if (debate?.debateIdOnchain && debate.marketStatus === 'active') {
			debateState.connectSSE(debate.debateIdOnchain);
			debateState.startEpochCountdown();
		}
		return () => {
			debateState.disconnectSSE();
		};
	});
</script>

<svelte:head>
	<title>{debate?.propositionText ? `Debate: ${debate.propositionText.slice(0, 60)}` : 'Debate'} | Communiqué</title>
</svelte:head>

<div class="py-8">
	<!-- Back to template -->
	<a
		href="/s/{template?.slug}"
		class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to {template?.title ?? 'template'}
	</a>

	<!-- Template context (compact) -->
	{#if template}
		<div class="mb-6 rounded-lg border border-slate-200 bg-white p-4">
			<h1 class="text-lg font-semibold text-slate-900">{template.title}</h1>
			{#if template.description}
				<p class="text-sm text-slate-600 mt-1 line-clamp-2">{template.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Debate surface (expanded, pre-loaded) -->
	<DebateSurface
		{debate}
		userTrustTier={data.user?.trust_tier ?? 0}
		onParticipate={() => {
			modalActions.openModal('debate-modal', 'debate', {
				template,
				user: data.user,
				debate,
				mode: 'participate'
			});
		}}
		onCommit={async (trade) => {
			const res = await fetch(`/api/debates/${debate.id}/commit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					commitHash: '', // Populated by relayer
					weightedAmount: trade.weightedAmount,
					noteCommitment: trade.noteCommitment,
					proof: trade.proof ? Array.from(trade.proof) : [],
					argumentIndex: trade.argumentIndex,
					direction: trade.direction,
					stakeAmount: trade.stakeAmount,
				})
			});
			if (!res.ok) {
				console.error('Trade commit failed:', await res.text());
			}
		}}
	/>
</div>
