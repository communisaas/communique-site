<script lang="ts">
	/**
	 * DebateModal — Full argument composition flow
	 *
	 * State machine:
	 *   stance-selection → argument-composition → staking → proof-generation → submitting → complete
	 *
	 * Two modes:
	 *   - 'initiate': Create a new debate (proposeDebate)
	 *   - 'participate': Submit argument to existing debate (submitArgument)
	 */

	import { X, ArrowLeft } from '@lucide/svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
	import { debateState, type Stance } from '$lib/stores/debateState.svelte';
	import StanceSelector from './StanceSelector.svelte';
	import StakeVisualizer from './StakeVisualizer.svelte';
	import DebateProofGenerator from './DebateProofGenerator.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { DebateData } from '$lib/stores/debateState.svelte';
	import { walletState } from '$lib/stores/walletState.svelte';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		template: { id: string; title: string; slug: string; message_body?: string };
		user: { id: string; trust_tier?: number } | null;
		debate?: DebateData | null;
		mode: 'initiate' | 'participate' | 'cosign';
		/**
		 * Co-sign mode only: the index of the argument being co-signed.
		 * Must be provided when mode === 'cosign'.
		 */
		cosignArgumentIndex?: number;
	}

	let { template, user, debate = null, mode, cosignArgumentIndex }: Props = $props();

	type ModalPhase =
		| 'proposition'    // initiate mode only: enter the claim to debate
		| 'stance-selection'
		| 'argument-composition'
		| 'staking'
		| 'cosign-staking'  // cosign mode only: choose stake amount before proof generation
		| 'proof-generation'
		| 'submitting'
		| 'complete'
		| 'error';

	// cosign mode skips stance/body/staking and jumps straight to stake selection
	let phase = $state<ModalPhase>(
		mode === 'initiate' ? 'proposition' :
		mode === 'cosign'   ? 'cosign-staking' :
		                      'stance-selection'
	);
	let errorMessage = $state('');

	// Initiate mode: proposition text
	let propositionText = $state('');

	// Argument composition
	let stance = $state<Stance | null>(null);
	let body = $state('');
	let amendmentText = $state('');
	let stakeAmount = $state(1_000_000); // $1

	// Proof result (from DebateProofGenerator)
	let proofResult = $state<{
		proofHex: string;
		publicInputs: string[];
		nullifierHex: string;
		actionDomainHex: string;
	} | null>(null);

	// Derived
	const userTier = $derived(user?.trust_tier ?? 0);
	const canProceedFromStance = $derived(stance !== null);
	const canProceedFromBody = $derived(body.trim().length >= 20);
	const canProceedFromProposition = $derived(propositionText.trim().length >= 10);

	// For proof generation — we need the base domain and proposition hash
	// In participate mode, these come from the existing debate
	// In initiate mode, we compute them after proposition is entered
	const baseDomain = $derived(debate?.actionDomain ?? '');
	const debatePropositionHash = $derived(debate?.propositionHash ?? '');

	// Phase navigation
	function goBack() {
		if (phase === 'stance-selection' && mode === 'initiate') phase = 'proposition';
		else if (phase === 'argument-composition') phase = 'stance-selection';
		else if (phase === 'staking') phase = 'argument-composition';
		// cosign-staking has no meaningful back state — close instead
	}

	function goForward() {
		if (phase === 'proposition' && canProceedFromProposition) phase = 'stance-selection';
		else if (phase === 'stance-selection' && canProceedFromStance) phase = 'argument-composition';
		else if (phase === 'argument-composition' && canProceedFromBody) phase = 'staking';
		else if (phase === 'staking') phase = 'proof-generation';
		else if (phase === 'cosign-staking') phase = 'proof-generation';
	}

	function close() {
		debateState.resetDraft();
		modalActions.closeModal('debate-modal');
	}

	// Submit co-sign to API after proof is generated
	async function submitCoSign() {
		if (!proofResult) return;
		phase = 'submitting';

		// ── Client-side wallet signing path ──────────────────────────────
		if (walletState.connected && walletState.isEVM && walletState.provider) {
			try {
				const { clientCoSignArgument } = await import('$lib/core/wallet/debate-client');
				const { DISTRICT_GATE_ADDRESS, SCROLL_CHAIN_ID } = await import('$lib/core/contracts');

				const result = await clientCoSignArgument(walletState.provider, {
					debateId: debate!.debateIdOnchain,
					argumentIndex: cosignArgumentIndex!,
					stakeAmount: BigInt(stakeAmount),
					proof: proofResult.proofHex,
					publicInputs: proofResult.publicInputs,
					verifierDepth: 20,
					districtGateAddress: DISTRICT_GATE_ADDRESS,
					chainId: SCROLL_CHAIN_ID
				});

				const res = await fetch(`/api/debates/${debate!.id}/cosign`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						argumentIndex: cosignArgumentIndex,
						stakeAmount,
						proofHex: proofResult.proofHex,
						publicInputs: proofResult.publicInputs,
						nullifierHex: proofResult.nullifierHex,
						txHash: result.txHash
					})
				});
				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.message || 'Failed to record co-sign');
				}

				phase = 'complete';
				await invalidateAll();
				return;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Transaction failed';
				if (message.includes('ACTION_REJECTED') || message.includes('4001') || message.includes('user rejected')) {
					errorMessage = 'Transaction cancelled by user';
				} else {
					errorMessage = message;
				}
				phase = 'error';
				return;
			}
		}

		// ── Server relayer path (fallback when no wallet connected) ──────
		try {
			const res = await fetch(`/api/debates/${debate!.id}/cosign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					argumentIndex: cosignArgumentIndex,
					stakeAmount,
					proofHex: proofResult.proofHex,
					publicInputs: proofResult.publicInputs,
					nullifierHex: proofResult.nullifierHex
				})
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || 'Failed to co-sign argument');
			}

			phase = 'complete';
			await invalidateAll();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Co-sign failed';
			phase = 'error';
		}
	}

	// Submit to API after proof is generated
	async function submitArgument() {
		if (!proofResult || !stance) return;
		phase = 'submitting';

		// ── Client-side wallet signing path ──────────────────────────────
		if (walletState.connected && walletState.isEVM && walletState.provider) {
			try {
				const { clientSubmitArgument } = await import('$lib/core/wallet/debate-client');
				const { keccak256, toUtf8Bytes } = await import('ethers');
				const { DISTRICT_GATE_ADDRESS, SCROLL_CHAIN_ID } = await import('$lib/core/contracts');

				// For initiate mode, create the debate server-side first
				// (the debate must exist on-chain before we can submit an argument to it)
				let targetDebateId: string;
				let targetDebateIdOnchain: string;
				if (mode === 'initiate') {
					const createRes = await fetch('/api/debates/create', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							templateId: template.id,
							propositionText,
							bondAmount: stakeAmount
						})
					});
					if (!createRes.ok) {
						const err = await createRes.json();
						throw new Error(err.message || 'Failed to create debate');
					}
					const created = await createRes.json();
					targetDebateId = created.debateId;
					targetDebateIdOnchain = created.debateIdOnchain;
				} else {
					targetDebateId = debate!.id;
					targetDebateIdOnchain = debate!.debateIdOnchain;
				}

				const bodyHash = keccak256(toUtf8Bytes(body));
				const amendmentHash = stance === 'AMEND'
					? keccak256(toUtf8Bytes(amendmentText))
					: '0x' + '0'.repeat(64);

				const result = await clientSubmitArgument(walletState.provider, {
					debateId: targetDebateIdOnchain,
					stance: stance === 'SUPPORT' ? 0 : stance === 'OPPOSE' ? 1 : 2,
					bodyHash,
					amendmentHash,
					stakeAmount: BigInt(stakeAmount),
					proof: proofResult.proofHex,
					publicInputs: proofResult.publicInputs,
					verifierDepth: 20,
					districtGateAddress: DISTRICT_GATE_ADDRESS,
					chainId: SCROLL_CHAIN_ID
				});

				// On-chain tx succeeded -- record in server DB with txHash
				const res = await fetch(`/api/debates/${targetDebateId}/arguments`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						stance,
						body,
						amendmentText: stance === 'AMEND' ? amendmentText : undefined,
						stakeAmount,
						proofHex: proofResult.proofHex,
						publicInputs: proofResult.publicInputs,
						nullifierHex: proofResult.nullifierHex,
						txHash: result.txHash
					})
				});
				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.message || 'Failed to record argument');
				}

				phase = 'complete';
				await invalidateAll();
				return;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Transaction failed';
				if (message.includes('ACTION_REJECTED') || message.includes('4001') || message.includes('user rejected')) {
					errorMessage = 'Transaction cancelled by user';
				} else {
					errorMessage = message;
				}
				phase = 'error';
				return;
			}
		}

		// ── Server relayer path (fallback when no wallet connected) ──────
		try {
			if (mode === 'initiate') {
				// First create the debate
				const createRes = await fetch('/api/debates/create', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						templateId: template.id,
						propositionText,
						bondAmount: stakeAmount
					})
				});
				if (!createRes.ok) {
					const err = await createRes.json();
					throw new Error(err.message || 'Failed to create debate');
				}
				// Then submit the argument to the new debate
				const created = await createRes.json();
				const argRes = await fetch(`/api/debates/${created.debateId}/arguments`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						stance,
						body,
						amendmentText: stance === 'AMEND' ? amendmentText : undefined,
						stakeAmount,
						proofHex: proofResult.proofHex,
						publicInputs: proofResult.publicInputs,
						nullifierHex: proofResult.nullifierHex
					})
				});
				if (!argRes.ok) {
					const err = await argRes.json();
					throw new Error(err.message || 'Failed to submit argument');
				}
			} else {
				// Submit argument to existing debate
				const res = await fetch(`/api/debates/${debate!.id}/arguments`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						stance,
						body,
						amendmentText: stance === 'AMEND' ? amendmentText : undefined,
						stakeAmount,
						proofHex: proofResult.proofHex,
						publicInputs: proofResult.publicInputs,
						nullifierHex: proofResult.nullifierHex
					})
				});
				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.message || 'Failed to submit argument');
				}
			}

			phase = 'complete';
			// Refresh page data to show the new argument
			await invalidateAll();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Submission failed';
			phase = 'error';
		}
	}

	// Phase labels for header
	const phaseLabels: Record<ModalPhase, string> = {
		proposition: 'Open Deliberation',
		'stance-selection': 'Choose Your Stance',
		'argument-composition': 'Compose Argument',
		staking: 'Stake Your Credibility',
		'cosign-staking': 'Co-sign: Set Your Stake',
		'proof-generation': 'Generating Proof',
		submitting: walletState.connected && walletState.isEVM ? 'Signing & Submitting...' : 'Submitting...',
		complete: mode === 'cosign' ? 'Co-sign Submitted' : 'Argument Submitted',
		error: 'Error'
	};

	const showBackButton = $derived(
		['stance-selection', 'argument-composition', 'staking'].includes(phase) &&
			!(phase === 'stance-selection' && mode === 'participate')
		// cosign-staking intentionally excluded — no back state
	);
</script>

<!-- Header -->
<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
	<div class="flex items-center gap-3">
		{#if showBackButton}
			<button
				class="text-slate-400 hover:text-slate-600 transition-colors"
				onclick={goBack}
				aria-label="Go back"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
		{/if}
		<h2 class="text-lg font-semibold text-slate-900">
			{phaseLabels[phase]}
		</h2>
	</div>
	<button
		class="text-slate-400 hover:text-slate-600 transition-colors"
		onclick={close}
		aria-label="Close"
	>
		<X class="h-5 w-5" />
	</button>
</div>

<!-- Body -->
<div class="px-6 py-5">
	{#if phase === 'proposition'}
		<!-- Initiate mode: enter proposition -->
		<div class="space-y-4">
			<p class="text-sm text-slate-600">
				What specific claim from "{template.title}" do you want to debate?
			</p>
			<textarea
				class="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800
					placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100
					focus:outline-none resize-none"
				rows={3}
				placeholder="e.g., 'The SAVE Act will reduce government spending by 20%'"
				bind:value={propositionText}
			></textarea>
			<p class="text-xs text-slate-400">
				{propositionText.length} characters (minimum 10)
			</p>
		</div>

	{:else if phase === 'stance-selection'}
		<StanceSelector
			selected={stance}
			onselect={(s) => { stance = s; }}
		/>

	{:else if phase === 'argument-composition'}
		<div class="space-y-4">
			<div>
				<label for="argument-body" class="block text-sm font-medium text-slate-700 mb-1">
					Your argument
				</label>
				<textarea
					id="argument-body"
					class="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800
						placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100
						focus:outline-none resize-none"
					rows={5}
					placeholder="Make your case. This will be measured against other arguments."
					bind:value={body}
				></textarea>
				<p class="text-xs text-slate-400 mt-1">
					{body.length} characters (minimum 20)
				</p>
			</div>

			{#if stance === 'AMEND'}
				<div>
					<label for="amendment-text" class="block text-sm font-medium text-amber-700 mb-1">
						Proposed amendment
					</label>
					<textarea
						id="amendment-text"
						class="w-full rounded-lg border border-amber-200 p-3 text-sm text-slate-800
							placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100
							focus:outline-none resize-none"
						rows={3}
						placeholder="How should the template's framing change?"
						bind:value={amendmentText}
					></textarea>
				</div>
			{/if}
		</div>

	{:else if phase === 'staking'}
		<StakeVisualizer
			{stakeAmount}
			engagementTier={userTier}
			onchange={(amount) => { stakeAmount = amount; }}
		/>

	{:else if phase === 'cosign-staking'}
		<!--
			Co-sign stake selection. The user endorses an existing argument and adds
			their own stake weight. We reuse StakeVisualizer — same mental model as
			the participate flow, just no argument body to compose.
		-->
		<div class="space-y-4">
			<p class="text-sm text-slate-600 leading-relaxed">
				Co-signing adds your verified stake weight to argument #{cosignArgumentIndex}.
				Your identity stays private — only your stake contribution is recorded.
			</p>
			<StakeVisualizer
				{stakeAmount}
				engagementTier={userTier}
				onchange={(amount) => { stakeAmount = amount; }}
			/>
		</div>

	{:else if phase === 'proof-generation'}
		<DebateProofGenerator
			userId={user?.id ?? ''}
			baseDomain={baseDomain}
			propositionHash={debatePropositionHash}
			autoStart={true}
			oncomplete={(data) => {
				proofResult = data;
				if (mode === 'cosign') {
					submitCoSign();
				} else {
					submitArgument();
				}
			}}
			oncancel={close}
			onreverify={() => {
				// TODO: redirect to re-verification
				close();
			}}
			onerror={(data) => {
				errorMessage = data.message;
				phase = 'error';
			}}
		/>

	{:else if phase === 'submitting'}
		<div class="flex items-center gap-3 py-8 justify-center">
			<div class="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
			<span class="text-sm text-slate-600">
				{walletState.connected && walletState.isEVM
					? 'Confirm the transaction in your wallet...'
					: 'Submitting your argument on-chain...'}
			</span>
		</div>

	{:else if phase === 'complete'}
		<div class="text-center py-8">
			<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
				<svg class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			{#if mode === 'cosign'}
				<h3 class="text-lg font-semibold text-slate-900 mb-1">Co-sign submitted</h3>
				<p class="text-sm text-slate-600">
					Your stake has been added to argument #{cosignArgumentIndex}.
					Anonymous, verified, on-record.
				</p>
			{:else}
				<h3 class="text-lg font-semibold text-slate-900 mb-1">Argument submitted</h3>
				<p class="text-sm text-slate-600">
					Your anonymous, verified argument is now part of the deliberation.
				</p>
			{/if}
		</div>

	{:else if phase === 'error'}
		<div class="text-center py-8">
			<p class="text-sm text-red-600 mb-4">{errorMessage}</p>
			<div class="flex justify-center gap-2">
				<Button variant="secondary" onclick={() => { phase = mode === 'cosign' ? 'cosign-staking' : 'staking'; }}>
					Try again
				</Button>
				<Button variant="secondary" onclick={close}>
					Cancel
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Footer with navigation -->
{#if !['proof-generation', 'submitting', 'complete', 'error'].includes(phase)}
	<div class="flex items-center justify-between border-t border-slate-200 px-6 py-4">
		<button
			class="text-sm text-slate-500 hover:text-slate-700 transition-colors"
			onclick={close}
		>
			Cancel
		</button>
		<Button
			variant="primary"
			disabled={
				(phase === 'proposition' && !canProceedFromProposition) ||
				(phase === 'stance-selection' && !canProceedFromStance) ||
				(phase === 'argument-composition' && !canProceedFromBody)
			}
			onclick={goForward}
		>
			{(phase === 'staking' || phase === 'cosign-staking') ? 'Generate proof & submit' : 'Continue'}
		</Button>
	</div>
{:else if phase === 'complete'}
	<div class="flex justify-center border-t border-slate-200 px-6 py-4">
		<Button variant="primary" onclick={close}>
			Done
		</Button>
	</div>
{/if}
