<script lang="ts">
	import type { PageData } from './$types';
	import DebateSurface from '$lib/components/debate/DebateSurface.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import { debateState } from '$lib/stores/debateState.svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { ArrowLeft } from '@lucide/svelte';
	import { FEATURES } from '$lib/config/features';

	let appealPending = $state(false);
	let appealError = $state<string | null>(null);

	let { data }: { data: PageData } = $props();

	// Redirect to template page when debate feature is hidden
	$effect(() => {
		if (!FEATURES.DEBATE) {
			goto(`/s/${data.template?.slug ?? ''}`, { replaceState: true });
		}
	});

	const debate = $derived(data.debate as DebateData);
	const template = $derived(data.template);

	// Seed the store with server-loaded debate (includes aiResolution)
	$effect(() => {
		if (debate) {
			debateState.setDebate(debate);
		}
	});

	// Connect SSE on mount for any non-terminal debate state
	// Active debates get market price updates + AI resolution events
	// Resolving/under_appeal debates get resolution state transitions
	$effect(() => {
		const shouldStream =
			debate?.debateIdOnchain &&
			(debate.status === 'active' ||
				debate.status === 'resolving' ||
				debate.status === 'under_appeal' ||
				debate.status === 'awaiting_governance');

		if (shouldStream) {
			debateState.connectSSE(debate.debateIdOnchain);
			if (debate.marketStatus === 'active') {
				debateState.startEpochCountdown();
			}
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
		onAppeal={async () => {
			if (!debate.id || appealPending) return;
			appealPending = true;
			appealError = null;
			try {
				const res = await fetch(`/api/debates/${debate.id}/appeal`, { method: 'POST' });
				if (!res.ok) {
					const msg = await res.text();
					appealError = msg || 'Appeal failed';
					console.error('Appeal failed:', msg);
				}
			} catch (err) {
				appealError = 'Network error';
				console.error('Appeal network error:', err);
			} finally {
				appealPending = false;
			}
		}}
		onEscalate={() => {
			// Navigate to governance dashboard (placeholder)
			window.location.href = '/governance';
		}}
		onParticipate={() => {
			modalActions.openModal('debate-modal', 'debate', {
				template,
				user: data.user,
				debate,
				mode: 'participate'
			});
		}}
		onCoSign={(argumentIndex) => {
			modalActions.openModal('debate-modal', 'debate', {
				template,
				user: data.user,
				debate,
				mode: 'cosign',
				cosignArgumentIndex: argumentIndex
			});
		}}
		onVerifyIdentity={async () => {
			if (data.user?.trust_tier != null && data.user.trust_tier < 2) {
				modalActions.openModal('address-modal', 'address', {
					template,
					user: data.user,
					context: 'debate'
				});
			} else {
				const res = await fetch('/demo/verify-identity', { method: 'POST' });
				const result = await res.json();
				if (result.identity_commitment && data.user?.id) {
					try {
						const { bootstrapDemoCredential } = await import('$lib/core/demo/bootstrap-credential');
						await bootstrapDemoCredential(data.user.id, result.identity_commitment);
					} catch (e) {
						console.error('[Demo] Credential bootstrap failed:', e);
					}
				}
				await invalidateAll();
			}
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
