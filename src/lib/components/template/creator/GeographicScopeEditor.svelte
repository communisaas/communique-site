<script lang="ts">
	import type { ScopeMapping, ScopeAlternative } from '$lib/utils/scope-mapper-international';
	import { createEventDispatcher } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';

	interface Props {
		scope: ScopeMapping | null;
	}

	let { scope }: Props = $props();

	const dispatch = createEventDispatcher<{
		scopeChanged: { scope: ScopeMapping; validatedAgainst: 'user_edit' };
	}>();

	// Confidence tier classification
	let confidenceTier = $derived(
		!scope ? null : scope.confidence >= 0.9 ? 'high' : scope.confidence >= 0.7 ? 'medium' : 'low'
	);

	// Edit state
	let isEditing = $state(false);
	let selectedValue = $state<string>('');

	// Initialize selected value when scope changes
	$effect(() => {
		if (scope) {
			selectedValue = scope.display_text;
		}
	});

	function handleEditClick() {
		isEditing = true;
	}

	function handleSelectChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const value = target.value;

		if (!scope || !value) return;

		if (value === 'other') {
			// Show custom input (future enhancement)
			return;
		}

		// Find selected alternative or use current scope
		const selectedAlternative = scope.alternatives?.find(
			(alt: ScopeAlternative) => alt.display_text === value
		);

		if (selectedAlternative) {
			// Create updated scope from alternative
			const updatedScope: ScopeMapping = {
				country_code: selectedAlternative.country_code,
				scope_level: selectedAlternative.scope_level,
				display_text: selectedAlternative.display_text,
				region_code: selectedAlternative.region_code,
				locality_code: selectedAlternative.locality_code,
				district_code: selectedAlternative.district_code,
				confidence: 1.0, // User selection = 100% confidence
				extraction_method: 'user_confirmed'
			};

			selectedValue = value;
			dispatch('scopeChanged', {
				scope: updatedScope,
				validatedAgainst: 'user_edit'
			});
			isEditing = false;
		}
	}

	// Get all unique alternatives including current scope
	let allOptions = $derived(() => {
		if (!scope) return [];

		const options: Array<{ display_text: string; confidence: number }> = [
			{
				display_text: scope.display_text,
				confidence: scope.confidence
			}
		];

		if (scope.alternatives && scope.alternatives.length > 0) {
			options.push(...scope.alternatives);
		}

		// Deduplicate by display_text
		const seen = new Set<string>();
		return options.filter((opt) => {
			if (seen.has(opt.display_text)) return false;
			seen.add(opt.display_text);
			return true;
		});
	});
</script>

{#if scope}
	<div class="inline-flex items-baseline gap-1">
		<span class="text-slate-600">in</span>

		{#if confidenceTier === 'high' && !isEditing}
			<!-- High confidence: Static text + subtle edit button -->
			<span class="font-medium text-slate-900">{scope.display_text}</span>
			<button
				type="button"
				onclick={handleEditClick}
				class="group ml-1 inline-flex items-center gap-0.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
				title="Edit location"
			>
				<span class="underline decoration-dotted underline-offset-2">Edit</span>
				<ChevronDown class="h-3 w-3 transition-transform group-hover:translate-y-0.5" />
			</button>
		{:else if confidenceTier === 'medium'}
			<!-- Medium confidence: Inline select with alternatives -->
			<select
				bind:value={selectedValue}
				onchange={handleSelectChange}
				class="inline-flex cursor-pointer items-center border-none bg-transparent px-1 font-medium text-slate-900 underline decoration-slate-300 decoration-dotted underline-offset-2 transition-colors hover:bg-slate-50 hover:decoration-slate-500 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-participation-primary-500"
			>
				{#each allOptions() as option}
					<option value={option.display_text}>{option.display_text}</option>
				{/each}
				<option value="other">Other...</option>
			</select>
		{:else if confidenceTier === 'low'}
			<!-- Low confidence: Prominent select with amber warning -->
			<select
				bind:value={selectedValue}
				onchange={handleSelectChange}
				class="inline-flex cursor-pointer items-center border-b-2 border-amber-400 bg-amber-50 px-2 py-0.5 font-medium text-slate-900 transition-colors hover:bg-amber-100 focus:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
				title="Low confidence - please verify"
			>
				<option disabled selected={!selectedValue}>Choose location...</option>
				{#each allOptions() as option}
					<option value={option.display_text}>{option.display_text}</option>
				{/each}
				<option value="other">Other...</option>
			</select>
		{:else if isEditing}
			<!-- Expanded edit mode for high confidence -->
			<select
				bind:value={selectedValue}
				onchange={handleSelectChange}
				class="inline-flex cursor-pointer items-center border-b border-slate-300 bg-white px-1 font-medium text-slate-900 focus:border-participation-primary-500 focus:outline-none focus:ring-2 focus:ring-participation-primary-500"
			>
				{#each allOptions() as option}
					<option value={option.display_text}>{option.display_text}</option>
				{/each}
				<option value="other">Other...</option>
			</select>
		{/if}
	</div>
{/if}
