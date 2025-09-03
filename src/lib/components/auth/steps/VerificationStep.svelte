<script lang="ts">
	import { CheckCircle2 } from '@lucide/svelte';
	
	let {
		template,
		selectedRole,
		customRole,
		organization,
		selectedConnection,
		connectionDetails,
		location,
		isTransitioning,
		onPrev,
		onComplete
	}: {
		template: { title: string };
		selectedRole: string;
		customRole: string;
		organization: string;
		selectedConnection: string;
		connectionDetails: string;
		location: string;
		isTransitioning: boolean;
		onPrev: () => void;
		onComplete: () => void;
	} = $props();
</script>

<div class="text-center mb-6">
	<div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
		<CheckCircle2 class="h-6 w-6 text-green-600" />
	</div>
	<h2 class="text-xl font-bold text-slate-900 mb-2">
		Ready to send
	</h2>
	<p class="text-slate-600">
		Your credentials strengthen your message's impact
	</p>
</div>

<!-- Summary Card -->
<div class="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
	<div class="flex items-start justify-between">
		<span class="text-sm text-slate-600">Role:</span>
		<span class="text-sm font-medium text-slate-900 text-right max-w-[60%]">
			{selectedRole === 'other' ? customRole : selectedRole.replace(/-/g, ' ')}
			{#if organization}
				<br><span class="text-slate-600">at {organization}</span>
			{/if}
		</span>
	</div>
	<div class="flex items-start justify-between">
		<span class="text-sm text-slate-600">Connection:</span>
		<span class="text-sm font-medium text-slate-900 text-right max-w-[60%]">
			{selectedConnection === 'other' ? connectionDetails : selectedConnection.replace(/-/g, ' ')}
		</span>
	</div>
	{#if location}
		<div class="flex items-start justify-between">
			<span class="text-sm text-slate-600">Location:</span>
			<span class="text-sm font-medium text-slate-900">{location}</span>
		</div>
	{/if}
	<div class="flex items-start justify-between">
		<span class="text-sm text-slate-600">Template:</span>
		<span class="text-sm font-medium text-slate-900 text-right max-w-[60%]">{template.title}</span>
	</div>
</div>

<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
	<p class="text-sm text-blue-800">
		💡 These details help decision-makers understand why your voice matters and increases the likelihood of a response.
	</p>
</div>

<div class="flex gap-3">
	<button
		type="button"
		class="flex-1 bg-white text-blue-600 border border-blue-200 hover:border-blue-300 rounded-lg px-6 py-3 text-sm font-medium transition-all disabled:opacity-50"
		onclick={onPrev}
		disabled={isTransitioning}
	>
		Back
	</button>
	<button
		type="button"
		class="flex items-center justify-center gap-1 flex-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-6 py-3 text-sm font-medium transition-all disabled:opacity-50"
		onclick={onComplete}
		disabled={isTransitioning}
	>
		<CheckCircle2 class="h-4 w-4" />
		Send Message
	</button>
</div>