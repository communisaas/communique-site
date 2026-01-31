<script lang="ts">
	import type { GeoScope } from '$lib/core/agents/types';
	import { displayGeoScope } from '$lib/core/location/location-resolver';
	import LocationPicker from '$lib/components/ui/LocationPicker.svelte';
	import { ChevronDown } from '@lucide/svelte';

	interface Props {
		scope: GeoScope | null;
		onScopeChanged?: (scope: GeoScope) => void;
	}

	let { scope, onScopeChanged }: Props = $props();

	let isEditing = $state(false);

	function handleSelect(newScope: GeoScope) {
		onScopeChanged?.(newScope);
		isEditing = false;
	}

	function handleCancel() {
		isEditing = false;
	}
</script>

{#if scope}
	<div class="inline-flex items-baseline gap-1">
		<span class="text-slate-600">in</span>

		{#if !isEditing}
			<span class="font-medium text-slate-900">{displayGeoScope(scope)}</span>
			<button
				type="button"
				onclick={() => (isEditing = true)}
				class="group ml-1 inline-flex items-center gap-0.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
				title="Edit location"
			>
				<span class="underline decoration-dotted underline-offset-2">Edit</span>
				<ChevronDown class="h-3 w-3 transition-transform group-hover:translate-y-0.5" />
			</button>
		{:else}
			<LocationPicker value={scope} onSelect={handleSelect} placeholder="Search..." />
			<button
				type="button"
				onclick={handleCancel}
				class="ml-1 text-xs text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-600"
			>
				cancel
			</button>
		{/if}
	</div>
{/if}
