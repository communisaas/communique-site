<script lang="ts">
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import VerificationPacket from '$lib/components/org/VerificationPacket.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let debateEnabled = $state(data.campaign.debateEnabled);
	let embedOpen = $state(false);
	let embedCopied = $state(false);

	const embedCode = $derived(
		`<iframe\n  src="https://commons.email/embed/campaign/${data.campaign.id}"\n  style="width:100%;border:none;min-height:400px"\n  sandbox="allow-forms allow-scripts allow-same-origin"\n  loading="lazy"\n></iframe>`
	);

	async function copyEmbed() {
		if (!browser) return;
		try {
			await navigator.clipboard.writeText(embedCode);
			embedCopied = true;
			setTimeout(() => { embedCopied = false; }, 2000);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = embedCode;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			embedCopied = true;
			setTimeout(() => { embedCopied = false; }, 2000);
		}
	}

	const canEdit = $derived(
		data.membership.role === 'owner' || data.membership.role === 'editor'
	);

	const isEditable = $derived(data.campaign.status !== 'COMPLETE');

	// Status transition helpers
	const transitions = $derived(getTransitions(data.campaign.status));

	function getTransitions(status: string): Array<{ target: string; label: string; style: string }> {
		switch (status) {
			case 'DRAFT':
				return [
					{ target: 'ACTIVE', label: 'Go Live', style: 'bg-emerald-600 hover:bg-emerald-500 text-white' }
				];
			case 'ACTIVE':
				return [
					{ target: 'PAUSED', label: 'Pause', style: 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30' },
					{ target: 'COMPLETE', label: 'Complete', style: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200' }
				];
			case 'PAUSED':
				return [
					{ target: 'ACTIVE', label: 'Resume', style: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
					{ target: 'COMPLETE', label: 'Complete', style: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200' }
				];
			default:
				return [];
		}
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'DRAFT':
				return 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30';
			case 'ACTIVE':
				return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
			case 'PAUSED':
				return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
			case 'COMPLETE':
				return 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20';
			default:
				return 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20';
		}
	}

	function typeBadgeClass(type: string): string {
		switch (type) {
			case 'LETTER':
				return 'bg-teal-500/15 text-teal-400 border-teal-500/20';
			case 'EVENT':
				return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20';
			case 'FORM':
				return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
			default:
				return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
		}
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="flex items-center gap-2 text-sm text-zinc-500">
		<a href="/org/{data.org.slug}/campaigns" class="hover:text-zinc-300 transition-colors">
			Campaigns
		</a>
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
		<span class="text-zinc-400 truncate">{data.campaign.title}</span>
	</nav>

	<!-- Status bar -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<span class="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono {statusBadgeClass(data.campaign.status)}">
				{data.campaign.status}
			</span>
			<span class="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono {typeBadgeClass(data.campaign.type)}">
				{data.campaign.type}
			</span>
			<span class="font-mono text-xs text-zinc-500">
				Updated {formatDate(data.campaign.updatedAt)}
			</span>
		</div>

		{#if canEdit && transitions.length > 0}
			<div class="flex items-center gap-2">
				{#each transitions as t}
					<form method="POST" action="?/updateStatus" use:enhance>
						<input type="hidden" name="status" value={t.target} />
						<button
							type="submit"
							class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {t.style}"
						>
							{t.label}
						</button>
					</form>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Error/success messages -->
	{#if form?.error}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
			{form.newStatus ? `Status updated to ${form.newStatus}` : 'Campaign saved'}
		</div>
	{/if}

	<!-- Edit form -->
	<form method="POST" action="?/update" use:enhance class="space-y-6">
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6 space-y-5">
			<!-- Title -->
			<div>
				<label for="title" class="block text-sm font-medium text-zinc-300 mb-1.5">Title</label>
				<input
					type="text"
					id="title"
					name="title"
					required
					disabled={!canEdit || !isEditable}
					value={data.campaign.title}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				/>
			</div>

			<!-- Type -->
			<div>
				<label for="type" class="block text-sm font-medium text-zinc-300 mb-1.5">Type</label>
				<select
					id="type"
					name="type"
					required
					disabled={!canEdit || !isEditable}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<option value="LETTER" selected={data.campaign.type === 'LETTER'}>Letter</option>
					<option value="EVENT" selected={data.campaign.type === 'EVENT'}>Event</option>
					<option value="FORM" selected={data.campaign.type === 'FORM'}>Form</option>
				</select>
			</div>

			<!-- Body -->
			<div>
				<label for="body" class="block text-sm font-medium text-zinc-300 mb-1.5">
					Description
					<span class="text-zinc-600 font-normal">(optional)</span>
				</label>
				<textarea
					id="body"
					name="body"
					rows="4"
					disabled={!canEdit || !isEditable}
					placeholder="Describe this campaign's purpose and goals..."
					class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors resize-y disabled:opacity-50 disabled:cursor-not-allowed"
				>{data.campaign.body ?? ''}</textarea>
			</div>

			<!-- Template -->
			<div>
				<label for="templateId" class="block text-sm font-medium text-zinc-300 mb-1.5">
					Template
					<span class="text-zinc-600 font-normal">(optional)</span>
				</label>
				<select
					id="templateId"
					name="templateId"
					disabled={!canEdit || !isEditable}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<option value="">None</option>
					{#each data.templates as template}
						<option value={template.id} selected={data.campaign.templateId === template.id}>
							{template.title}
						</option>
					{/each}
				</select>
			</div>

			<!-- Debate settings -->
			<div class="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-4 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-zinc-300">Debate Market</p>
						<p class="text-xs text-zinc-500 mt-0.5">Enable on-chain debate for this campaign</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							name="debateEnabled"
							class="sr-only peer"
							disabled={!canEdit || !isEditable}
							bind:checked={debateEnabled}
						/>
						<div class="w-9 h-5 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-teal-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600 peer-checked:after:bg-white disabled:opacity-50"></div>
					</label>
				</div>

				{#if debateEnabled}
					<div>
						<label for="debateThreshold" class="block text-sm font-medium text-zinc-300 mb-1.5">
							Threshold
							<span class="text-zinc-600 font-normal">(minimum verified participants)</span>
						</label>
						<input
							type="number"
							id="debateThreshold"
							name="debateThreshold"
							min="1"
							disabled={!canEdit || !isEditable}
							value={data.campaign.debateThreshold}
							class="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						/>
					</div>
				{/if}
			</div>

			<!-- Save button -->
			{#if canEdit && isEditable}
				<div class="pt-2">
					<button
						type="submit"
						class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
					>
						Save Changes
					</button>
				</div>
			{/if}
		</div>
	</form>

	<!-- Verification Packet -->
	<VerificationPacket
		packet={data.packet}
		showDebate={data.campaign.debateEnabled}
	/>

	<!-- Report delivery link -->
	{#if data.campaign.status === 'ACTIVE' || data.campaign.status === 'PAUSED' || data.campaign.status === 'COMPLETE'}
		<div class="flex items-center">
			<a
				href="/org/{data.org.slug}/campaigns/{data.campaign.id}/report"
				class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
				</svg>
				Preview Report
			</a>
		</div>
	{/if}

	<!-- Embed widget -->
	{#if data.campaign.status === 'ACTIVE' || data.campaign.status === 'PAUSED'}
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30">
			<button
				type="button"
				onclick={() => { embedOpen = !embedOpen; }}
				class="flex w-full items-center justify-between px-6 py-4 text-left"
			>
				<div class="flex items-center gap-3">
					<svg class="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
					</svg>
					<span class="text-sm font-medium text-zinc-300">Embed Widget</span>
				</div>
				<svg
					class="h-4 w-4 text-zinc-500 transition-transform {embedOpen ? 'rotate-180' : ''}"
					fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
				</svg>
			</button>

			{#if embedOpen}
				<div class="border-t border-zinc-800/60 px-6 py-4 space-y-3">
					<p class="text-xs text-zinc-500">
						Paste this code on your website to embed the campaign action form.
					</p>
					<div class="relative">
						<pre class="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-xs text-zinc-300 leading-relaxed">{embedCode}</pre>
						<button
							type="button"
							onclick={copyEmbed}
							class="absolute right-2 top-2 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
						>
							{embedCopied ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Metadata footer -->
	<div class="flex items-center gap-6 text-xs text-zinc-600 border-t border-zinc-800/60 pt-4">
		<span>ID: <code class="font-mono text-zinc-500">{data.campaign.id}</code></span>
		<span>Created: <span class="font-mono text-zinc-500">{formatDate(data.campaign.createdAt)}</span></span>
	</div>
</div>
