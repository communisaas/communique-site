<script lang="ts">
	import { Lightbulb } from 'lucide-svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { onMount } from 'svelte';

	export let data: {
		recipientEmails: string[];
	};
	export let context: TemplateCreationContext;

	let emailInput = '';

	onMount(() => {
		if (data.recipientEmails && data.recipientEmails.length > 0) {
			emailInput = data.recipientEmails.join('\n');
		}
	});

	function updateEmailCount() {
		const emails = emailInput
			.split(/[\n,;]+/)
			.map((email) => email.trim())
			.filter((email) => email.length > 0 && email.includes('@'));
		data.recipientEmails = [...new Set(emails)]; // Remove duplicates
	}

	function reformatEmailInput() {
		// On blur, reformat the input to show the user what was accepted
		if (data.recipientEmails) {
			emailInput = data.recipientEmails.join('\n');
		}
	}
</script>

<div class="space-y-6">
	<!-- Guidelines -->
	<div class="rounded-lg border border-blue-100 bg-blue-50 p-4">
		<div class="flex items-start gap-3">
			<Lightbulb class="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
			<div class="space-y-2">
				<h4 class="font-medium text-blue-900">Audience Tips</h4>
				<ul class="space-y-1 text-sm text-blue-700">
					{#if context.channelId === 'certified'}
						<li>
							• For congressional members, we will automatically find the correct CWC endpoint.
						</li>
						<li>• You can provide a list of member emails or Bioguide IDs.</li>
					{:else}
						<li>• Paste emails for direct delivery.</li>
						<li>• Ensure your list is clean for best results.</li>
					{/if}
				</ul>
			</div>
		</div>
	</div>

	<!-- Recipient Emails -->
	<div class="space-y-3">
		<label for="email-list" class="block text-sm font-medium text-slate-700">
			Recipient Email Addresses
		</label>
		<textarea
			id="email-list"
			bind:value={emailInput}
			on:input={updateEmailCount}
			on:blur={reformatEmailInput}
			placeholder="Paste a list of email addresses, separated by commas, semicolons, or new lines."
			class="h-48 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
		/>
		<p class="text-xs text-slate-500">
			{data.recipientEmails?.length || 0} unique email addresses detected.
		</p>
	</div>
</div>
