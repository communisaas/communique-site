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

<div class="mb-6 text-center">
	<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
		<CheckCircle2 class="h-6 w-6 text-green-600" />
	</div>
	<h2 class="mb-2 text-xl font-bold text-slate-900">Ready to send</h2>
	<p class="text-slate-600">Your credentials strengthen your message's impact</p>
</div>

<!-- Summary Card -->
<div class="mb-6 space-y-3 rounded-lg bg-slate-50 p-4">
	<div class="flex items-start justify-between">
		<span class="text-sm text-slate-600">Role:</span>
		<span class="max-w-[60%] text-right text-sm font-medium text-slate-900">
			{selectedRole === 'other' ? customRole : selectedRole.replace(/-/g, ' ')}
			{#if organization}
				<br /><span class="text-slate-600">at {organization}</span>
			{/if}
		</span>
	</div>
	<div class="flex items-start justify-between">
		<span class="text-sm text-slate-600">Connection:</span>
		<span class="max-w-[60%] text-right text-sm font-medium text-slate-900">
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
		<span class="max-w-[60%] text-right text-sm font-medium text-slate-900">{template.title}</span>
	</div>
</div>

<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3">
	<p class="text-sm text-blue-800">
		💡 These details help decision-makers understand why your voice matters and increases the
		likelihood of a response.
	</p>
</div>

<div class="flex gap-3">
	<button
		type="button"
		class="flex-1 rounded-lg border border-blue-200 bg-white px-6 py-3 text-sm font-medium text-blue-600 transition-all hover:border-blue-300 disabled:opacity-50"
		onclick={onPrev}
		disabled={isTransitioning}
	>
		Back
	</button>
	<button
		type="button"
		class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50"
		onclick={onComplete}
		disabled={isTransitioning}
	>
		<CheckCircle2 class="h-4 w-4" />
		Send Message
	</button>
</div>
