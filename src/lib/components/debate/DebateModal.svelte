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
	import { invalidateAll } from '$app/navigation';

	interface Props {
		template: { id: string; title: string; slug: string; message_body?: string };
		user: { id: string; trust_tier?: number } | null;
		debate?: DebateData | null;
		mode: 'initiate' | 'participate';
	}

	let { template, user, debate = null, mode }: Props = $props();

	type ModalPhase =
		| 'proposition'    // initiate mode only: enter the claim to debate
		| 'stance-selection'
		| 'argument-composition'
		| 'staking'
		| 'proof-generation'
		| 'submitting'
		| 'complete'
		| 'error';

	let phase = $state<ModalPhase>(mode === 'initiate' ? 'proposition' : 'stance-selection');
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
	}

	function goForward() {
		if (phase === 'proposition' && canProceedFromProposition) phase = 'stance-selection';
		else if (phase === 'stance-selection' && canProceedFromStance) phase = 'argument-composition';
		else if (phase === 'argument-composition' && canProceedFromBody) phase = 'staking';
		else if (phase === 'staking') phase = 'proof-generation';
	}

	function close() {
		debateState.resetDraft();
		modalActions.closeModal('debate-modal');
	}

	// Submit to API after proof is generated
	async function submitArgument() {
		if (!proofResult || !stance) return;
		phase = 'submitting';

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
		'proof-generation': 'Generating Proof',
		submitting: 'Submitting...',
		complete: 'Argument Submitted',
		error: 'Error'
	};

	const showBackButton = $derived(
		['stance-selection', 'argument-composition', 'staking'].includes(phase) &&
			!(phase === 'stance-selection' && mode === 'participate')
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

	{:else if phase === 'proof-generation'}
		<DebateProofGenerator
			userId={user?.id ?? ''}
			baseDomain={baseDomain}
			propositionHash={debatePropositionHash}
			autoStart={true}
			oncomplete={(data) => {
				proofResult = data;
				submitArgument();
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
			<span class="text-sm text-slate-600">Submitting your argument on-chain...</span>
		</div>

	{:else if phase === 'complete'}
		<div class="text-center py-8">
			<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
				<svg class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<h3 class="text-lg font-semibold text-slate-900 mb-1">Argument submitted</h3>
			<p class="text-sm text-slate-600">
				Your anonymous, verified argument is now part of the deliberation.
			</p>
		</div>

	{:else if phase === 'error'}
		<div class="text-center py-8">
			<p class="text-sm text-red-600 mb-4">{errorMessage}</p>
			<div class="flex justify-center gap-2">
				<Button variant="secondary" onclick={() => { phase = 'staking'; }}>
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
			{phase === 'staking' ? 'Generate proof & submit' : 'Continue'}
		</Button>
	</div>
{:else if phase === 'complete'}
	<div class="flex justify-center border-t border-slate-200 px-6 py-4">
		<Button variant="primary" onclick={close}>
			Done
		</Button>
	</div>
{/if}
