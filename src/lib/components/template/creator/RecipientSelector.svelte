<script lang="ts">
	import { Plus, X, Users, Building2 } from '@lucide/svelte';
	import type { TemplateFormData } from '$lib/types/template';

	let {
		data
	}: {
		data: TemplateFormData['audience'];
	} = $props();

	// State for recipient selection
	let includesCongress = $state(false);
	let customEmails = $state<Array<{ email: string; name: string }>>([]);
	let newEmail = $state('');
	let newName = $state('');

	// Sync state with data.recipientEmails
	// Multi-target format: congressional recipients use special format
	$effect(() => {
		const emails: string[] = [];

		if (includesCongress) {
			// Use special marker for congressional recipients
			emails.push('__CONGRESSIONAL__');
		}

		customEmails.forEach(({ email }) => {
			emails.push(email);
		});

		data.recipientEmails = emails;
	});

	function addCustomEmail() {
		if (!newEmail.trim()) return;

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(newEmail.trim())) {
			return;
		}

		customEmails = [
			...customEmails,
			{ email: newEmail.trim(), name: newName.trim() || newEmail.trim() }
		];

		newEmail = '';
		newName = '';
	}

	function removeCustomEmail(index: number) {
		customEmails = customEmails.filter((_, i) => i !== index);
	}

	// Validation: At least one recipient required
	const isValid = $derived(includesCongress || customEmails.length > 0);
</script>

<div class="space-y-4 md:space-y-6">
	<div>
		<h3 class="mb-2 text-base font-semibold text-slate-900 md:text-lg">
			Who should receive this message?
		</h3>
		<p class="text-xs text-slate-600 md:text-sm">
			Select decision-makers who should get this template.
		</p>
	</div>

	<!-- Congressional Representatives -->
	<label
		class="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 md:gap-3 md:p-4"
	>
		<input
			type="checkbox"
			bind:checked={includesCongress}
			class="mt-0.5 h-4 w-4 rounded border-slate-300 text-participation-primary-600 focus:ring-participation-primary-500 md:mt-1 md:h-5 md:w-5"
		/>
		<div class="flex-1">
			<div class="flex items-center gap-1.5 md:gap-2">
				<Users class="h-4 w-4 text-slate-600 md:h-5 md:w-5" />
				<span class="text-sm font-medium text-slate-900 md:text-base"
					>Congressional representatives</span
				>
			</div>
			<p class="mt-0.5 text-xs text-slate-600 md:mt-1 md:text-sm">
				Routes to sender's 2 Senators + House Rep based on their address.
			</p>
		</div>
	</label>

	<!-- Custom Email Recipients -->
	<div class="space-y-2 md:space-y-3">
		<div class="flex items-center gap-1.5 md:gap-2">
			<Building2 class="h-4 w-4 text-slate-600 md:h-5 md:w-5" />
			<h4 class="text-sm font-medium text-slate-900 md:text-base">Other decision-makers</h4>
		</div>

		{#if customEmails.length > 0}
			<div class="space-y-1.5 md:space-y-2">
				{#each customEmails as recipient, i}
					<div class="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 md:gap-2 md:p-3">
						<div class="flex-1">
							<div class="text-sm font-medium text-slate-900 md:text-base">
								{recipient.name}
							</div>
							<div class="text-xs text-slate-600 md:text-sm">{recipient.email}</div>
						</div>
						<button
							type="button"
							onclick={() => removeCustomEmail(i)}
							class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-red-600"
							aria-label="Remove {recipient.name}"
						>
							<X class="h-3.5 w-3.5 md:h-4 md:w-4" />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
			<input
				type="email"
				bind:value={newEmail}
				placeholder="email@example.com"
				onkeypress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomEmail())}
				class="rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500 md:px-3 md:text-base"
			/>
			<input
				type="text"
				bind:value={newName}
				placeholder="Name (optional)"
				onkeypress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomEmail())}
				class="rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500 md:px-3 md:text-base"
			/>
		</div>

		<button
			type="button"
			onclick={addCustomEmail}
			disabled={!newEmail.trim()}
			class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-participation-primary-300 bg-participation-primary-50 px-3 py-2 text-xs font-medium text-participation-primary-700 transition-colors hover:bg-participation-primary-100 disabled:cursor-not-allowed disabled:opacity-50 md:gap-2 md:px-4 md:text-sm"
		>
			<Plus class="h-3.5 w-3.5 md:h-4 md:w-4" />
			Add recipient
		</button>
	</div>

	{#if !isValid}
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 md:p-4">
			<p class="text-xs text-amber-900 md:text-sm">
				⚠️ At least one recipient is required. Select congressional representatives or add email
				addresses.
			</p>
		</div>
	{/if}
</div>
