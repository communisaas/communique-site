<script lang="ts">
	/**
	 * Deliberation Surface — always visible, graduated affordance.
	 *
	 * The deliberation layer is a core product commitment: every template's
	 * framing can be challenged through structured, staked argument. This
	 * surface must be visible at EVERY trust tier — what changes is the
	 * available action, not the awareness.
	 *
	 * Perceptual design:
	 * - Always present: signals the platform takes its own framing seriously
	 * - Dormant state (no debate): quiet tension — "nobody has challenged this yet"
	 * - Active state (debate exists): warm amber, alive with arguments
	 * - Affordance graduates: read at any tier, participate at Tier 3+
	 * - The dormant state is itself informative — unchallenged framing has meaning
	 *
	 * Atmosphere: warm amber boundary zone between the template's claim
	 * and the community's capacity to interrogate it.
	 */
	import ActiveDebatePanel from './ActiveDebatePanel.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Scale, MessageSquare, ShieldCheck } from '@lucide/svelte';
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
		onAppeal?: () => void;
		onEscalate?: () => void;
		onVerifyIdentity?: () => void;
	}

	let {
		debate,
		userTrustTier = 0,
		onInitiateDebate,
		onParticipate,
		onCoSign,
		onCommit,
		onAppeal,
		onEscalate,
		onVerifyIdentity
	}: Props = $props();

	const canInitiate = $derived(userTrustTier >= 3 && debate === null);
</script>

<div class="rounded-xl border border-amber-200/50 bg-amber-50/30 p-4 sm:p-6" data-debate-surface>
	{#if debate}
		<!-- Active or resolved debate — full panel, visible to all tiers -->
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
			{onAppeal}
			{onEscalate}
			{onVerifyIdentity}
		/>
	{:else if canInitiate}
		<!-- Tier 3+, no debate — full initiation affordance -->
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
	{:else}
		<!-- Tier 0-2, no debate — dormant deliberation surface -->
		<!-- Visible to everyone: signals the platform's commitment to discourse -->
		<div class="py-5">
			<div class="flex items-center gap-2 mb-3">
				<Scale class="h-5 w-5 text-slate-400" />
				<h2 class="text-base font-semibold text-slate-600">Deliberation</h2>
			</div>

			<div class="flex items-start gap-3">
				<div class="shrink-0 mt-0.5">
					<MessageSquare class="h-4 w-4 text-slate-400" />
				</div>
				<div class="flex-1">
					<p class="text-sm text-slate-600 leading-relaxed">
						Every template on Communiqué can be challenged through structured deliberation.
						Verified participants stake their credibility on counter-arguments —
						anonymous, transparent, consequential.
					</p>
					<p class="text-xs text-slate-500 mt-2">
						No one has challenged this framing yet.
					</p>

					{#if userTrustTier < 3 && onVerifyIdentity}
						<button
							class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700
								hover:text-amber-800 transition-colors"
							onclick={onVerifyIdentity}
						>
							<ShieldCheck class="h-3.5 w-3.5" />
							Verify your identity to participate
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
