<script lang="ts">
	import { enhance } from '$app/forms';
	import CountrySelector from '$lib/components/geographic/CountrySelector.svelte';
	import JurisdictionPicker from '$lib/components/geographic/JurisdictionPicker.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let debateEnabled = $state(false);
	let targetCountry = $state(form?.targetCountry ?? 'US');
	let targetJurisdiction = $state(form?.targetJurisdiction ?? '');
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<nav class="flex items-center gap-2 text-sm text-zinc-500 mb-4">
			<a href="/org/{data.org.slug}/campaigns" class="hover:text-zinc-300 transition-colors">
				Campaigns
			</a>
			<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
			</svg>
			<span class="text-zinc-400">New</span>
		</nav>
		<h1 class="text-xl font-semibold text-zinc-100">Create Campaign</h1>
		<p class="text-sm text-zinc-500 mt-1">Set up a new campaign to coordinate verified action.</p>
	</div>

	{#if form?.error}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
			{form.error}
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-6">
		<!-- Title -->
		<div>
			<label for="title" class="block text-sm font-medium text-zinc-300 mb-1.5">Title</label>
			<input
				type="text"
				id="title"
				name="title"
				required
				value={form?.title ?? ''}
				placeholder="e.g., District 5 Zoning Letter Drive"
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
			/>
		</div>

		<!-- Type -->
		<div>
			<label for="type" class="block text-sm font-medium text-zinc-300 mb-1.5">Type</label>
			<select
				id="type"
				name="type"
				required
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
			>
				<option value="LETTER" selected={form?.type === 'LETTER'}>Letter</option>
				<option value="EVENT" selected={form?.type === 'EVENT'}>Event</option>
				<option value="FORM" selected={form?.type === 'FORM'}>Form</option>
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
				placeholder="Describe this campaign's purpose and goals..."
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors resize-y"
			>{form?.body ?? ''}</textarea>
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
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
			>
				<option value="">None</option>
				{#each data.templates as template}
					<option value={template.id}>{template.title}</option>
				{/each}
			</select>
		</div>

		<!-- Geographic targeting -->
		<div class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4 space-y-4">
			<div>
				<p class="text-sm font-medium text-zinc-300">Geographic Targeting</p>
				<p class="text-xs text-zinc-500 mt-0.5">Set the country and jurisdiction for this campaign</p>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="targetCountry" class="block text-sm font-medium text-zinc-300 mb-1.5">Country</label>
					<input type="hidden" name="targetCountry" value={targetCountry} />
					<CountrySelector value={targetCountry} onchange={(c) => { targetCountry = c; targetJurisdiction = ''; }} />
				</div>
				<div>
					<label for="targetJurisdiction" class="block text-sm font-medium text-zinc-300 mb-1.5">
						Jurisdiction
						<span class="text-zinc-600 font-normal">(optional)</span>
					</label>
					<input type="hidden" name="targetJurisdiction" value={targetJurisdiction} />
					<JurisdictionPicker value={targetJurisdiction || null} country={targetCountry} onchange={(j) => { targetJurisdiction = j; }} />
				</div>
			</div>

			{#if targetJurisdiction}
				<p class="text-xs text-zinc-500">
					This campaign targets <span class="text-zinc-300 font-medium">{targetJurisdiction}</span> in <span class="text-zinc-300 font-medium">{targetCountry}</span>
				</p>
			{/if}
		</div>

		<!-- Debate settings -->
		<div class="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4 space-y-4">
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
						bind:checked={debateEnabled}
					/>
					<div class="w-9 h-5 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-teal-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600 peer-checked:after:bg-white"></div>
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
						value="50"
						class="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
					/>
				</div>
			{/if}
		</div>

		<!-- Submit -->
		<div class="flex items-center gap-3 pt-2">
			<button
				type="submit"
				class="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
			>
				Create Campaign
			</button>
			<a
				href="/org/{data.org.slug}/campaigns"
				class="rounded-lg px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
