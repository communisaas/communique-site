<script lang="ts">
	import { CheckCircle2, Mail, ExternalLink, X, User, ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { ProcessedDecisionMaker } from '$lib/types/template';

	interface Props {
		decisionMaker: ProcessedDecisionMaker;
		onremove?: () => void;
	}

	let { decisionMaker, onremove }: Props = $props();

	let expanded = $state(false);
	let showProvenance = $state(false);

	function copyEmail() {
		if (decisionMaker.email) {
			navigator.clipboard.writeText(decisionMaker.email);
		}
	}
</script>

<div class="rounded-lg border border-slate-200 bg-white transition-all duration-200">
	<!-- Compact View -->
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50"
	>
		<div class="flex items-start gap-3">
			<!-- Icon/Avatar -->
			<div
				class="flex h-10 w-10 items-center justify-center rounded-full"
				class:bg-green-100={decisionMaker.isAiResolved}
				class:bg-slate-100={!decisionMaker.isAiResolved}
			>
				{#if decisionMaker.isAiResolved}
					<CheckCircle2 class="h-5 w-5 text-green-600" />
				{:else}
					<User class="h-5 w-5 text-slate-600" />
				{/if}
			</div>

			<!-- Name & Title -->
			<div class="flex-1">
				<h4 class="font-semibold text-slate-900">{decisionMaker.name}</h4>
				<p class="text-sm text-slate-600">
					{decisionMaker.title} • {decisionMaker.organization}
				</p>
			</div>
		</div>

		<!-- Expand/Collapse Icon -->
		<div class="ml-2">
			{#if expanded}
				<ChevronUp class="h-5 w-5 text-slate-400" />
			{:else}
				<ChevronDown class="h-5 w-5 text-slate-400" />
			{/if}
		</div>
	</button>

	<!-- Expanded View -->
	{#if expanded}
		<div class="space-y-3 border-t border-slate-100 p-4">
			<!-- Why This Matters -->
			<div>
				<p class="text-xs font-medium text-slate-500 md:text-sm">Why this matters:</p>
				<p class="mt-1 text-sm text-slate-700 md:text-base">{decisionMaker.reasoning}</p>
			</div>

			<!-- Email -->
			{#if decisionMaker.email}
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (showProvenance = true)}
						class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						<Mail class="h-4 w-4" />
						{decisionMaker.email}
					</button>
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex items-center gap-2 border-t border-slate-100 pt-3">
				{#if decisionMaker.source}
					<a
						href={decisionMaker.source}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-xs text-participation-primary-600 hover:text-participation-primary-700 md:text-sm"
					>
						<ExternalLink class="h-3.5 w-3.5" />
						View source
					</a>
				{/if}

				{#if onremove}
					<button
						type="button"
						onclick={onremove}
						class="ml-auto inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 md:text-sm"
					>
						<X class="h-3.5 w-3.5" />
						Remove
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Provenance Popover (Modal) -->
{#if showProvenance}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) showProvenance = false;
		}}
	>
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
			<h3 class="text-lg font-semibold text-slate-900">Contact Details</h3>

			<div class="mt-4 space-y-4">
				<!-- Contact Info -->
				<div>
					<p class="text-base font-semibold text-slate-900">{decisionMaker.name}</p>
					{#if decisionMaker.email}
						<p class="mt-1 font-mono text-sm text-slate-700">{decisionMaker.email}</p>
					{/if}
				</div>

				<!-- How We Verified -->
				<div>
					<p class="text-sm font-medium text-slate-700">How we verified this:</p>
					<p class="mt-1 text-sm text-slate-600">{decisionMaker.provenance}</p>
				</div>

				<!-- Source Link -->
				{#if decisionMaker.source}
					<div>
						<p class="text-sm font-medium text-slate-700">Source:</p>
						<a
							href={decisionMaker.source}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-1 inline-flex items-center gap-1 text-sm text-participation-primary-600 hover:text-participation-primary-700"
						>
							<ExternalLink class="h-3.5 w-3.5" />
							{decisionMaker.source}
						</a>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="mt-6 flex gap-2">
				{#if decisionMaker.source}
					<a
						href={decisionMaker.source}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 rounded-lg bg-participation-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-participation-primary-700"
					>
						<ExternalLink class="h-4 w-4" />
						View source
					</a>
				{/if}

				{#if decisionMaker.email}
					<button
						type="button"
						onclick={copyEmail}
						class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						<Mail class="h-4 w-4" />
						Copy email
					</button>
				{/if}

				<button
					type="button"
					onclick={() => (showProvenance = false)}
					class="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
