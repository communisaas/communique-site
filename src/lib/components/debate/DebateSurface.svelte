<script lang="ts">
	import ActiveDebatePanel from './ActiveDebatePanel.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Scale } from '@lucide/svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';

	interface Props {
		debate: DebateData | null;
		userTrustTier?: number;
		onInitiateDebate?: () => void;
		onParticipate?: () => void;
		onCoSign?: (argumentIndex: number) => void;
		onCommit?: (trade: {
			argumentIndex: number;
			direction: 'BUY' | 'SELL';
			stakeAmount: number;
			weightedAmount: number;
			noteCommitment: string;
			proof?: Uint8Array;
		}) => void;
	}

	let {
		debate,
		userTrustTier = 0,
		onInitiateDebate,
		onParticipate,
		onCoSign,
		onCommit
	}: Props = $props();

	// Only show to Tier 3+ or when a debate exists
	const shouldShow = $derived(debate !== null || userTrustTier >= 3);

	const canInitiate = $derived(userTrustTier >= 3 && debate === null);
</script>

{#if shouldShow}
	<div class="mt-8 rounded-xl border border-amber-200/50 bg-amber-50/30 p-6">
		{#if debate}
			<!-- Active or resolved debate -->
			<div class="mb-4 flex items-center gap-2">
				<Scale class="h-5 w-5 text-slate-700" />
				<h2 class="text-lg font-semibold text-slate-900">Deliberation</h2>
			</div>
			<ActiveDebatePanel
				{debate}
				{userTrustTier}
				{onParticipate}
				{onCoSign}
				{onCommit}
			/>
		{:else if canInitiate}
			<!-- No debate exists — offer to create one -->
			<div class="text-center py-6">
				<Scale class="h-8 w-8 text-slate-400 mx-auto mb-3" />
				<h3 class="text-lg font-semibold text-slate-800 mb-1">
					Disagree with this framing?
				</h3>
				<p class="text-sm text-slate-600 mb-4 max-w-md mx-auto">
					Open a deliberation. Stake your credibility on a counter-argument.
					Anonymous, verified, consequential.
				</p>
				<Button variant="secondary" onclick={onInitiateDebate}>
					Challenge this framing
				</Button>
			</div>
		{/if}
	</div>
{/if}
