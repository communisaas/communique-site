<script lang="ts">
	import { Check, Loader2, ArrowRight } from '@lucide/svelte';
	import { positionState } from '$lib/stores/positionState.svelte';
	import PositionCount from './PositionCount.svelte';

	let {
		templateId,
		identityCommitment,
		districtCode = undefined,
		onRegistered = undefined,
		recipientCount = 0,
		isCongressional = false
	}: {
		templateId: string;
		identityCommitment: string;
		districtCode?: string;
		onRegistered?: (stance: 'support' | 'oppose') => void;
		recipientCount?: number;
		isCongressional?: boolean;
	} = $props();

	const recipientLabel = $derived(
		recipientCount > 0
			? isCongressional
				? `${recipientCount} representative${recipientCount !== 1 ? 's' : ''}`
				: `${recipientCount} decision-maker${recipientCount !== 1 ? 's' : ''}`
			: isCongressional
				? 'your congressional representatives'
				: 'decision-makers'
	);

	async function handleRegister(selectedStance: 'support' | 'oppose') {
		if (positionState.registrationState !== 'idle') return;

		// Minimum 200ms delay so the registering state feels intentional
		const [success] = await Promise.all([
			positionState.register(selectedStance, identityCommitment, districtCode),
			new Promise((resolve) => setTimeout(resolve, 200))
		]);

		if (success) {
			onRegistered?.(selectedStance);
		}
	}
</script>

<div>
	{#if positionState.isRegistered}
		<!-- Registered state — horizontal inline -->
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1" role="status" aria-live="polite">
			{#if positionState.stance === 'support'}
				<Check class="h-4 w-4 text-channel-verified-600" />
				<span class="text-sm font-medium text-channel-verified-600">You support this</span>
			{:else}
				<Check class="h-4 w-4 text-slate-600" />
				<span class="text-sm font-medium text-slate-600">You oppose this</span>
			{/if}
			{#if positionState.totalCount > 0}
				<span class="text-slate-300">&middot;</span>
				<PositionCount count={positionState.count} />
			{/if}
		</div>
	{:else}
		<!-- Pre-registration: framing context + stance buttons -->
		<div class="space-y-3">
			<p class="flex items-center gap-1.5 text-sm text-slate-600">
				<span>Contact {recipientLabel}</span>
				<ArrowRight class="h-3.5 w-3.5 text-slate-400" />
				<span class="text-slate-500">first, where do you stand?</span>
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<button
					class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-participation-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-participation-primary-700 disabled:opacity-50 sm:flex-none"
					disabled={positionState.registrationState === 'registering'}
					onclick={() => handleRegister('support')}
				>
					{#if positionState.registrationState === 'registering' && positionState.stance === 'support'}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						I support this
					{/if}
				</button>

				<button
					class="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
					disabled={positionState.registrationState === 'registering'}
					onclick={() => handleRegister('oppose')}
				>
					{#if positionState.registrationState === 'registering' && positionState.stance === 'oppose'}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						I oppose this
					{/if}
				</button>

				{#if positionState.totalCount > 0}
					<PositionCount count={positionState.count} />
				{/if}
			</div>
		</div>
	{/if}
</div>
