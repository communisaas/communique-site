<script lang="ts">
	import type { MessageGeographicScope } from '$lib/core/agents/types';
	import { ChevronDown } from '@lucide/svelte';

	interface Props {
		scope: MessageGeographicScope | null;
		onScopeChanged?: (scope: MessageGeographicScope) => void;
	}

	let { scope, onScopeChanged }: Props = $props();

	let isEditing = $state(false);
	let selectedLevel = $state<string>('');
	let customDisplay = $state('');

	const scopeLevels = [
		{ value: 'local', label: 'Local' },
		{ value: 'district', label: 'District' },
		{ value: 'metro', label: 'Metro area' },
		{ value: 'state', label: 'State' },
		{ value: 'national', label: 'National' },
		{ value: 'international', label: 'International' }
	] as const;

	$effect(() => {
		if (scope) {
			selectedLevel = scope.scope_level;
			customDisplay = scope.scope_display;
		}
	});

	function handleEditClick() {
		isEditing = true;
	}

	function handleSave() {
		if (!selectedLevel || !customDisplay.trim()) return;

		const updated: MessageGeographicScope = {
			scope_level: selectedLevel as MessageGeographicScope['scope_level'],
			scope_display: customDisplay.trim()
		};

		onScopeChanged?.(updated);
		isEditing = false;
	}

	function handleCancel() {
		if (scope) {
			selectedLevel = scope.scope_level;
			customDisplay = scope.scope_display;
		}
		isEditing = false;
	}
</script>

{#if scope}
	<div class="inline-flex items-baseline gap-1">
		<span class="text-slate-600">in</span>

		{#if !isEditing}
			<span class="font-medium text-slate-900">{scope.scope_display}</span>
			<button
				type="button"
				onclick={handleEditClick}
				class="group ml-1 inline-flex items-center gap-0.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
				title="Edit location"
			>
				<span class="underline decoration-dotted underline-offset-2">Edit</span>
				<ChevronDown class="h-3 w-3 transition-transform group-hover:translate-y-0.5" />
			</button>
		{:else}
			<div class="inline-flex items-center gap-2">
				<select
					bind:value={selectedLevel}
					class="rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-participation-primary-500 focus:outline-none focus:ring-1 focus:ring-participation-primary-500"
				>
					{#each scopeLevels as level}
						<option value={level.value}>{level.label}</option>
					{/each}
				</select>
				<input
					type="text"
					bind:value={customDisplay}
					class="rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-participation-primary-500 focus:outline-none focus:ring-1 focus:ring-participation-primary-500"
					placeholder="e.g. San Francisco, CA"
				/>
				<button
					type="button"
					onclick={handleSave}
					class="rounded bg-participation-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-participation-primary-700"
				>
					Save
				</button>
				<button
					type="button"
					onclick={handleCancel}
					class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
{/if}
