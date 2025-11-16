<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import type { ProcessedDecisionMaker, CustomRecipient } from '$lib/types/template';
	import DecisionMakerCard from './DecisionMakerCard.svelte';
	import CustomDecisionMakerForm from './CustomDecisionMakerForm.svelte';
	import { isDuplicateEmail } from '$lib/utils/decision-maker-processing';

	interface Props {
		decisionMakers: ProcessedDecisionMaker[];
		customRecipients: CustomRecipient[];
		includesCongress: boolean;
		onupdate: (data: {
			decisionMakers: ProcessedDecisionMaker[];
			customRecipients: CustomRecipient[];
			includesCongress: boolean;
		}) => void;
	}

	let { decisionMakers = $bindable(), customRecipients = $bindable(), includesCongress = $bindable() }: Props = $props();

	let showCustomForm = $state(false);
	let duplicateError = $state<string | null>(null);

	const totalRecipients = $derived(
		(decisionMakers?.length || 0) + (customRecipients?.length || 0) + (includesCongress ? 1 : 0)
	);

	function handleAddCustom(recipient: { email: string; name: string; organization?: string }) {
		// Check for duplicates
		if (isDuplicateEmail(recipient.email, decisionMakers || [], customRecipients || [])) {
			duplicateError = 'This email is already in your recipient list';
			return;
		}

		// Add to custom recipients
		customRecipients = [...(customRecipients || []), recipient];
		showCustomForm = false;
		duplicateError = null;
	}

	function handleRemoveDecisionMaker(index: number) {
		if (!decisionMakers) return;
		decisionMakers = decisionMakers.filter((_, i) => i !== index);
	}

	function handleRemoveCustom(index: number) {
		if (!customRecipients) return;
		customRecipients = customRecipients.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-6 py-4">
	<!-- Header -->
	<div>
		<h3 class="text-lg font-semibold text-slate-900 md:text-xl">
			{#if decisionMakers?.length > 0}
				We found {decisionMakers.length} decision-maker{decisionMakers.length === 1 ? '' : 's'}
			{:else}
				Add decision-makers
			{/if}
		</h3>
		{#if totalRecipients > 0}
			<p class="mt-1 text-sm text-slate-600">
				Total recipients: {totalRecipients}
			</p>
		{/if}
	</div>

	<!-- AI-Resolved Decision-Makers -->
	{#if decisionMakers?.length > 0}
		<div class="space-y-3">
			{#each decisionMakers as dm, i}
				<DecisionMakerCard decisionMaker={dm} onremove={() => handleRemoveDecisionMaker(i)} />
			{/each}
		</div>
	{/if}

	<!-- Custom Recipients -->
	{#if customRecipients?.length > 0}
		<div class="space-y-3">
			<h4 class="text-sm font-medium text-slate-700">Custom recipients</h4>
			{#each customRecipients as cr, i}
				<DecisionMakerCard
					decisionMaker={{
						name: cr.name,
						title: cr.organization || 'Custom recipient',
						organization: cr.organization || '',
						email: cr.email,
						provenance: 'Manually added by you',
						reasoning: 'Manually added recipient',
						isAiResolved: false
					}}
					onremove={() => handleRemoveCustom(i)}
				/>
			{/each}
		</div>
	{/if}

	<!-- Add Custom Decision-Maker -->
	{#if showCustomForm}
		<CustomDecisionMakerForm
			onadd={handleAddCustom}
			oncancel={() => {
				showCustomForm = false;
				duplicateError = null;
			}}
		/>
	{:else}
		<button
			type="button"
			onclick={() => (showCustomForm = true)}
			class="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-participation-primary-400 hover:bg-participation-primary-50 hover:text-participation-primary-700"
		>
			<Plus class="h-4 w-4" />
			Add another decision-maker
		</button>
	{/if}

	<!-- Duplicate Error -->
	{#if duplicateError}
		<div class="rounded-lg border border-red-200 bg-red-50 p-3">
			<p class="text-sm text-red-700">{duplicateError}</p>
		</div>
	{/if}

	<!-- Congressional Checkbox -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
		<label class="flex items-start gap-3">
			<input
				type="checkbox"
				bind:checked={includesCongress}
				class="mt-0.5 h-5 w-5 rounded border-slate-300 text-participation-primary-600 focus:ring-2 focus:ring-participation-primary-500"
			/>
			<div class="flex-1">
				<p class="font-medium text-slate-900">Also send to my congressional representatives</p>
				<p class="mt-0.5 text-sm text-slate-600">
					Your message will be sent via certified delivery to your House rep and both Senators
				</p>
			</div>
		</label>
	</div>

	<!-- Empty State -->
	{#if (decisionMakers?.length || 0) === 0 && (customRecipients?.length || 0) === 0 && !includesCongress}
		<div class="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
			<p class="text-sm text-slate-600">
				No decision-makers found. Add contacts manually or include congressional representatives.
			</p>
		</div>
	{/if}
</div>
