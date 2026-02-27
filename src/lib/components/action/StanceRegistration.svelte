<script lang="ts">
	import { Check, Loader2 } from '@lucide/svelte';
	import { positionState } from '$lib/stores/positionState.svelte';
	import PositionCount from './PositionCount.svelte';

	let {
		templateId,
		identityCommitment,
		districtCode = undefined,
		onRegistered = undefined
	}: {
		templateId: string;
		identityCommitment: string;
		districtCode?: string;
		onRegistered?: (stance: 'support' | 'oppose') => void;
	} = $props();

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

<div class="w-full">
	{#if positionState.isRegistered}
		<!-- Registered state -->
		<div role="status" aria-live="polite">
			<div class="flex items-center gap-2 py-3">
				{#if positionState.stance === 'support'}
					<Check class="h-4 w-4 text-channel-verified-600" />
					<span class="text-sm font-medium text-channel-verified-600">You support this</span>
				{:else}
					<Check class="h-4 w-4 text-slate-600" />
					<span class="text-sm font-medium text-slate-600">You oppose this</span>
				{/if}
			</div>
		</div>

		<PositionCount count={positionState.count} />
	{:else}
		<!-- Pre-registration: stance buttons -->
		<div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
			<div class="flex w-full gap-3 sm:w-auto">
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
			</div>
		</div>

		{#if positionState.totalCount > 0}
			<div class="mt-3">
				<PositionCount count={positionState.count} />
			</div>
		{/if}
	{/if}
</div>
