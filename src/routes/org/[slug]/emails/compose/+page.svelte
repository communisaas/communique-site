<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let subject = $state('');
	let bodyHtml = $state('');
	let fromName = $state(data.org.name);
	let fromEmail = $state(`${data.org.slug}@commons.email`);
	let campaignId = $state('');
	let verifiedFilter = $state('any');
	let selectedTagIds = $state<string[]>([]);
	let recipientCount = $state(data.subscribedCount);
	let countLoading = $state(false);
	let sending = $state(false);
	let showPreview = $state(false);

	const previewHtml = $derived(
		form && 'previewHtml' in form ? (form as { previewHtml: string }).previewHtml : null
	);
	const previewSubject = $derived(
		form && 'previewSubject' in form ? (form as { previewSubject: string }).previewSubject : null
	);
	const errorMsg = $derived(
		form && 'error' in form ? (form as { error: string }).error : null
	);

	function toggleTag(tagId: string) {
		if (selectedTagIds.includes(tagId)) {
			selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
		} else {
			selectedTagIds = [...selectedTagIds, tagId];
		}
	}

	// Debounced auto-recount when filters change
	let isFirstRun = true;
	let countDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const _v = verifiedFilter;
		const _t = selectedTagIds;

		if (isFirstRun) {
			isFirstRun = false;
			return;
		}

		if (countDebounceTimer) clearTimeout(countDebounceTimer);
		countDebounceTimer = setTimeout(() => {
			const countForm = document.querySelector('form[action="?/count"]') as HTMLFormElement;
			if (countForm) countForm.requestSubmit();
		}, 500);
	});

	const mergeFieldHints = [
		{ field: '{{firstName}}', desc: 'First name' },
		{ field: '{{lastName}}', desc: 'Last name' },
		{ field: '{{postalCode}}', desc: 'Postal code' },
		{ field: '{{tierContext}}', desc: 'Verification context message' }
	];

	function insertMergeField(field: string) {
		const textarea = document.getElementById('bodyHtml') as HTMLTextAreaElement;
		if (!textarea) {
			bodyHtml += field;
			return;
		}
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		bodyHtml = bodyHtml.slice(0, start) + field + bodyHtml.slice(end);
		tick().then(() => {
			textarea.selectionStart = textarea.selectionEnd = start + field.length;
			textarea.focus();
		});
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a
			href="/org/{data.org.slug}/emails"
			class="text-zinc-500 hover:text-zinc-300 transition-colors"
			aria-label="Back to emails"
		>
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
		</a>
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">Compose Email</h1>
			<p class="text-sm text-zinc-500 mt-1">Send an email blast to your supporters</p>
		</div>
	</div>

	{#if errorMsg}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
			{errorMsg}
		</div>
	{/if}

	<!-- Preview modal -->
	{#if showPreview && previewHtml}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
			<div class="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
				<div class="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
					<div>
						<p class="text-sm font-medium text-zinc-100">Email Preview</p>
						{#if previewSubject}
							<p class="text-xs text-zinc-500 mt-0.5">Subject: {previewSubject}</p>
						{/if}
					</div>
					<button
						type="button"
						class="text-zinc-400 hover:text-zinc-200 transition-colors"
						aria-label="Close preview"
						onclick={() => (showPreview = false)}
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="flex-1 overflow-auto p-1">
					<iframe
						srcdoc={previewHtml}
						title="Email preview"
						class="w-full h-full min-h-[400px] rounded border-0"
						sandbox=""
					></iframe>
				</div>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Main form -->
		<div class="lg:col-span-2 space-y-6">
			<!-- From / Subject -->
			<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="fromName" class="block text-sm font-medium text-zinc-300 mb-1.5">From Name</label>
						<input
							id="fromName"
							type="text"
							bind:value={fromName}
							class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
							placeholder="Organization name"
						/>
					</div>
					<div>
						<label for="fromEmail" class="block text-sm font-medium text-zinc-300 mb-1.5">From Email</label>
						<input
							id="fromEmail"
							type="email"
							bind:value={fromEmail}
							class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
							placeholder="noreply@commons.email"
						/>
					</div>
				</div>

				<div>
					<label for="subject" class="block text-sm font-medium text-zinc-300 mb-1.5">Subject Line</label>
					<input
						id="subject"
						type="text"
						bind:value={subject}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
						placeholder="Your email subject..."
					/>
				</div>

				<div>
					<label for="campaignId" class="block text-sm font-medium text-zinc-300 mb-1.5">
						Link to Campaign
						<span class="text-zinc-500 font-normal">(optional)</span>
					</label>
					<select
						id="campaignId"
						bind:value={campaignId}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					>
						<option value="">No campaign</option>
						{#each data.campaigns as campaign}
							<option value={campaign.id}>
								{campaign.title} ({campaign.status})
							</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Body editor -->
			<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-4">
				<div class="flex items-center justify-between">
					<label for="bodyHtml" class="block text-sm font-medium text-zinc-300">Email Body</label>
					<div class="flex items-center gap-1">
						{#each mergeFieldHints as hint}
							<button
								type="button"
								class="rounded px-2 py-1 text-xs font-mono text-zinc-500 hover:text-teal-400 hover:bg-zinc-800 transition-colors"
								title={hint.desc}
								onclick={() => insertMergeField(hint.field)}
							>
								{hint.field}
							</button>
						{/each}
					</div>
				</div>
				<textarea
					id="bodyHtml"
					bind:value={bodyHtml}
					rows={12}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 font-mono leading-relaxed focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-y"
					placeholder={'Write your email content here. Use merge fields like {{firstName}} for personalization. HTML is supported.'}
				></textarea>

				<!-- Verification context notice -->
				<div class="flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-4 py-3">
					<svg class="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
					</svg>
					<div>
						<p class="text-xs font-medium text-zinc-300">Verification context is structural</p>
						<p class="text-xs text-zinc-500 mt-0.5">
							Every email includes a verification context block showing recipient verification density.
							This block cannot be removed -- it is appended automatically.
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Sidebar: Filters + Actions -->
		<div class="space-y-6">
			<!-- Recipient filters -->
			<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-4">
				<h3 class="text-sm font-medium text-zinc-300">Recipients</h3>

				<!-- Verification filter -->
				<div>
					<label for="verified" class="block text-xs font-medium text-zinc-400 mb-1.5">Verification Status</label>
					<select
						id="verified"
						bind:value={verifiedFilter}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					>
						<option value="any">Any status</option>
						<option value="verified">Verified only</option>
						<option value="unverified">Unverified only</option>
					</select>
				</div>

				<!-- Tag filter -->
				{#if data.tags.length > 0}
					<div>
						<p class="text-xs font-medium text-zinc-400 mb-1.5">Tags</p>
						<div class="flex flex-wrap gap-2">
							{#each data.tags as tag (tag.id)}
								<button
									type="button"
									class="rounded-md border px-2.5 py-1 text-xs transition-colors {selectedTagIds.includes(tag.id)
										? 'bg-teal-500/20 text-teal-400 border-teal-500/30'
										: 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-600'}"
									onclick={() => toggleTag(tag.id)}
								>
									{tag.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recipient count -->
				<form
					method="POST"
					action="?/count"
					use:enhance={() => {
						countLoading = true;
						return async ({ result, update }) => {
							countLoading = false;
							if (result.type === 'success' && result.data && 'count' in result.data) {
								recipientCount = result.data.count as number;
							}
							await update({ reset: false });
						};
					}}
				>
					<input type="hidden" name="verified" value={verifiedFilter} />
					{#each selectedTagIds as tagId}
						<input type="hidden" name="tagIds" value={tagId} />
					{/each}
					<button
						type="submit"
						class="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
						disabled={countLoading}
					>
						{#if countLoading}
							Counting...
						{:else}
							Update Count
						{/if}
					</button>
				</form>

				<div class="rounded-lg bg-zinc-800/50 px-4 py-3 text-center">
					<p class="text-2xl font-mono tabular-nums text-zinc-100">{recipientCount.toLocaleString()}</p>
					<p class="text-xs text-zinc-500 mt-0.5">subscribed recipients</p>
				</div>
			</div>

			<!-- Actions -->
			<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-3">
				<!-- Preview -->
				<form
					method="POST"
					action="?/preview"
					use:enhance={() => {
						return async ({ update }) => {
							await update({ reset: false });
							showPreview = true;
						};
					}}
				>
					<input type="hidden" name="subject" value={subject} />
					<input type="hidden" name="bodyHtml" value={bodyHtml} />
					<button
						type="submit"
						class="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
						disabled={!bodyHtml.trim()}
					>
						Preview Email
					</button>
				</form>

				<!-- Send -->
				<form
					method="POST"
					action="?/send"
					use:enhance={({ cancel }) => {
						if (!confirm(`Send email to ${recipientCount.toLocaleString()} supporter${recipientCount === 1 ? '' : 's'}? This cannot be undone.`)) {
							cancel();
							return;
						}
						sending = true;
						return async ({ update }) => {
							sending = false;
							await update({ reset: false });
						};
					}}
				>
					<input type="hidden" name="subject" value={subject} />
					<input type="hidden" name="bodyHtml" value={bodyHtml} />
					<input type="hidden" name="fromName" value={fromName} />
					<input type="hidden" name="fromEmail" value={fromEmail} />
					<input type="hidden" name="campaignId" value={campaignId} />
					<input type="hidden" name="verified" value={verifiedFilter} />
					{#each selectedTagIds as tagId}
						<input type="hidden" name="tagIds" value={tagId} />
					{/each}
					<button
						type="submit"
						class="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={!subject.trim() || !bodyHtml.trim() || recipientCount === 0 || sending}
					>
						{#if sending}
							Sending...
						{:else}
							Send to {recipientCount.toLocaleString()} supporter{recipientCount === 1 ? '' : 's'}
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
</div>
