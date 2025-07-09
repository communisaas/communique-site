<script lang="ts">
	import { Lightbulb, Users, Landmark } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { onMount } from 'svelte';

	export let data: {
		recipientEmails: string[];
	};
	export let context: TemplateCreationContext;

	let emailInput = '';
	$: isCongressional = context.channelId === 'certified';

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

	// For congressional templates, we'll auto-populate with a placeholder
	function handleCongressionalSetup() {
		// For now, set up congressional targeting as "auto-routed"
		data.recipientEmails = ['congress-auto-route@cwc.system'];
		emailInput = 'Congressional representatives (auto-routed via CWC)';
	}

	// Auto-setup congressional targeting when component loads
	onMount(() => {
		if (isCongressional && (!data.recipientEmails || data.recipientEmails.length === 0)) {
			handleCongressionalSetup();
		}
	});
</script>

<div class="space-y-6">
	<!-- Guidelines -->
	<div class="rounded-lg border border-blue-100 bg-blue-50 p-4">
		<div class="flex items-start gap-3">
			<Lightbulb class="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
			<div class="space-y-2">
				<h4 class="font-medium text-blue-900">
					{#if isCongressional}
						Congressional Delivery
					{:else}
						Audience Tips
					{/if}
				</h4>
				<ul class="space-y-1 text-sm text-blue-700">
					{#if isCongressional}
						<li>
							• Messages are delivered through the Congressional Web Communication (CWC) system
						</li>
						<li>
							• Recipients are automatically determined based on each sender's congressional
							district
						</li>
						<li>• Each sender will reach their House representative and both senators</li>
						<li>• No specific email addresses needed - the system handles routing</li>
					{:else}
						<li>• Paste specific email addresses for direct delivery</li>
						<li>• Recipients will receive emails directly from senders</li>
						<li>• Ensure your email list is clean for best delivery rates</li>
					{/if}
				</ul>
			</div>
		</div>
	</div>

	{#if isCongressional}
		<!-- Congressional Targeting Display -->
		<div class="space-y-3">
			<label class="block text-sm font-medium text-slate-700">
				<div class="flex items-center gap-2">
					<Landmark class="h-4 w-4 text-slate-400" />
					Congressional Targeting
				</div>
			</label>
			<div class="rounded-lg border border-green-200 bg-green-50 p-4">
				<div class="flex items-center gap-2">
					<Users class="h-5 w-5 text-green-600" />
					<div>
						<div class="font-medium text-green-900">Automatic Congressional Routing</div>
						<div class="text-sm text-green-700">
							Each sender's message will be delivered to their representatives based on their
							address
						</div>
					</div>
				</div>
			</div>
			<p class="text-xs text-slate-500">
				✓ Congressional representatives will be automatically determined per sender
			</p>
		</div>
	{:else}
		<!-- Direct Email Input -->
		<div class="space-y-3">
			<label for="email-list" class="block text-sm font-medium text-slate-700">
				<div class="flex items-center gap-2">
					<Users class="h-4 w-4 text-slate-400" />
					Recipient Email Addresses
				</div>
			</label>
			<textarea
				id="email-list"
				bind:value={emailInput}
				on:input={updateEmailCount}
				on:blur={reformatEmailInput}
				placeholder="Paste a list of email addresses, separated by commas, semicolons, or new lines."
				class="h-48 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				spellcheck="true"
			/>
			<p class="text-xs text-slate-500">
				{data.recipientEmails?.length || 0} unique email addresses detected.
			</p>
		</div>
	{/if}
</div>
