<script lang="ts">
	import AddressCollectionModal from '$lib/components/auth/AddressCollectionModal.svelte';
	import DecisionMakerSearch from './DecisionMakerSearch.svelte';
	import type { Template } from '$lib/types/template';

	interface DecisionMaker {
		name: string;
		role: string;
		company: string;
		email: string;
		confidence: number;
		source: string;
		verified: boolean;
	}

	let {
		template,
		onComplete
	}: {
		template: Template;
		onComplete: (data: { address?: string; recipients?: DecisionMaker[] }) => void;
	} = $props();

	// Decide which path based on template metadata
	const requiresAddress =
		template.deliveryMethod === 'cwc' || template.targetType === 'government';

	function handleAddressComplete(event: CustomEvent<{ address: string }>) {
		onComplete({ address: event.detail.address });
	}

	function handleLookupComplete(data: { recipients: DecisionMaker[] }) {
		onComplete({ recipients: data.recipients });
	}
</script>

{#if requiresAddress}
	<!-- Path A: Government (address required) -->
	<AddressCollectionModal {template} on:complete={handleAddressComplete} />
{:else}
	<!-- Path B: Public Email (lookup) -->
	<DecisionMakerSearch {template} onComplete={handleLookupComplete} />
{/if}
