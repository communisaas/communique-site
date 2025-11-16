<script lang="ts">
	import { Plus, X } from '@lucide/svelte';
	import { isValidEmail } from '$lib/utils/decision-maker-processing';

	interface Props {
		onadd: (recipient: { email: string; name: string; organization?: string }) => void;
		oncancel: () => void;
	}

	let { onadd, oncancel }: Props = $props();

	let email = $state('');
	let name = $state('');
	let organization = $state('');
	let error = $state<string | null>(null);

	function handleAdd() {
		error = null;

		// Validation
		if (!email.trim()) {
			error = 'Email is required';
			return;
		}

		if (!isValidEmail(email)) {
			error = 'Invalid email format';
			return;
		}

		if (!name.trim()) {
			error = 'Name is required';
			return;
		}

		// Call parent handler
		onadd({
			email: email.trim(),
			name: name.trim(),
			organization: organization.trim() || undefined
		});

		// Reset form
		email = '';
		name = '';
		organization = '';
	}
</script>

<div class="rounded-lg border-2 border-slate-200 bg-slate-50 p-4">
	<div class="flex items-center justify-between border-b border-slate-200 pb-3">
		<h4 class="font-medium text-slate-900">Add a decision-maker</h4>
		<button
			type="button"
			onclick={oncancel}
			class="text-slate-400 hover:text-slate-600"
			aria-label="Close"
		>
			<X class="h-5 w-5" />
		</button>
	</div>

	<div class="mt-4 space-y-3">
		<!-- Name -->
		<div>
			<label for="dm-name" class="block text-xs font-medium text-slate-700 md:text-sm">
				Name <span class="text-red-600">*</span>
			</label>
			<input
				id="dm-name"
				type="text"
				bind:value={name}
				placeholder="Jane Smith"
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
			/>
		</div>

		<!-- Title/Organization -->
		<div>
			<label for="dm-org" class="block text-xs font-medium text-slate-700 md:text-sm">
				Title / Organization
			</label>
			<input
				id="dm-org"
				type="text"
				bind:value={organization}
				placeholder="Director of Operations, Acme Corp"
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
			/>
		</div>

		<!-- Email -->
		<div>
			<label for="dm-email" class="block text-xs font-medium text-slate-700 md:text-sm">
				Email <span class="text-red-600">*</span>
			</label>
			<input
				id="dm-email"
				type="email"
				bind:value={email}
				onkeydown={(e) => e.key === 'Enter' && handleAdd()}
				placeholder="jane@example.com"
				class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500"
			/>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="rounded-lg border border-red-200 bg-red-50 p-2">
				<p class="text-xs text-red-700 md:text-sm">{error}</p>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex gap-2">
			<button
				type="button"
				onclick={handleAdd}
				class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-participation-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-participation-primary-700"
			>
				<Plus class="h-4 w-4" />
				Add
			</button>
			<button
				type="button"
				onclick={oncancel}
				class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
