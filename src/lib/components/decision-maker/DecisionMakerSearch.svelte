<script lang="ts">
	import { Search, Check, AlertCircle, Loader2 } from '@lucide/svelte';

	interface DecisionMaker {
		name: string;
		role: string;
		company: string;
		email: string;
		confidence: number;
		source: string;
		verified: boolean;
		selected?: boolean;
	}

	let {
		template,
		onComplete
	}: {
		template: { title: string; id: string };
		onComplete: (data: { recipients: DecisionMaker[] }) => void;
	} = $props();

	let query = $state('');
	let results = $state<DecisionMaker[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function searchDecisionMakers() {
		if (!query.trim()) return;

		loading = true;
		error = null;

		try {
			const response = await fetch(
				`/api/decision-makers/search?q=${encodeURIComponent(query)}&templateId=${template.id}`
			);

			if (!response.ok) {
				throw new Error('Failed to find decision-makers');
			}

			const data = await response.json();
			results = data.results || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Search failed';
			results = [];
		} finally {
			loading = false;
		}
	}

	function toggleSelection(index: number) {
		results[index].selected = !results[index].selected;
		results = [...results]; // Trigger reactivity
	}

	function sendToSelected() {
		const selected = results.filter((r) => r.selected);
		if (selected.length === 0) return;
		onComplete({ recipients: selected });
	}

	const selectedCount = $derived(results.filter((r) => r.selected).length);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="text-center">
		<h2 class="mb-2 text-2xl font-bold text-slate-900">Find decision-makers</h2>
		<p class="text-sm text-slate-600">
			Search by company name or person (e.g., "Tim Cook" or "Apple CEO")
		</p>
	</div>

	<!-- Search Input -->
	<div class="relative">
		<input
			type="text"
			bind:value={query}
			onkeydown={(e) => e.key === 'Enter' && searchDecisionMakers()}
			placeholder="Company or person name..."
			class="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 text-slate-900 placeholder-slate-400 focus:border-participation-accent-500 focus:outline-none focus:ring-2 focus:ring-participation-accent-500/20"
		/>
		<Search class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
	</div>

	<!-- Search Button -->
	<button
		onclick={searchDecisionMakers}
		disabled={loading || !query.trim()}
		class="w-full rounded-lg bg-participation-accent-600 px-4 py-3 font-medium text-white transition-colors hover:bg-participation-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if loading}
			<span class="flex items-center justify-center gap-2">
				<Loader2 class="h-5 w-5 animate-spin" />
				Searching...
			</span>
		{:else}
			Search
		{/if}
	</button>

	<!-- Error Message -->
	{#if error}
		<div class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
			<AlertCircle class="h-5 w-5 shrink-0 text-red-600" />
			<p class="text-sm text-red-800">{error}</p>
		</div>
	{/if}

	<!-- Results -->
	{#if results.length > 0}
		<div class="space-y-4">
			<p class="text-sm font-medium text-slate-700">Who should receive this?</p>

			<div class="space-y-3">
				{#each results as person, index}
					<button
						onclick={() => toggleSelection(index)}
						class="w-full rounded-lg border p-4 text-left transition-all {person.selected
							? 'border-participation-accent-500 bg-participation-accent-50'
							: 'border-slate-200 bg-white hover:border-slate-300'}"
					>
						<div class="flex items-start gap-3">
							<!-- Checkbox -->
							<div
								class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border {person.selected
									? 'border-participation-accent-600 bg-participation-accent-600'
									: 'border-slate-300 bg-white'}"
							>
								{#if person.selected}
									<Check class="h-4 w-4 text-white" />
								{/if}
							</div>

							<!-- Person Info -->
							<div class="flex-1">
								<p class="font-medium text-slate-900">{person.name}</p>
								<p class="text-sm text-slate-600">
									{person.role}, {person.company}
								</p>
								<p class="mt-1 text-xs text-slate-500">{person.email}</p>

								<!-- Confidence Score -->
								{#if person.confidence < 80}
									<div class="mt-2 flex items-center gap-1.5">
										<div
											class="h-1.5 w-full max-w-[100px] overflow-hidden rounded-full bg-slate-200"
										>
											<div class="h-full bg-yellow-500" style="width: {person.confidence}%"></div>
										</div>
										<span class="text-xs text-slate-500">~{person.confidence}% verified</span>
									</div>
								{:else}
									<div class="mt-2 flex items-center gap-1">
										<Check class="h-3 w-3 text-green-600" />
										<span class="text-xs text-green-600">Verified</span>
									</div>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Send Button -->
			<button
				onclick={sendToSelected}
				disabled={selectedCount === 0}
				class="w-full rounded-lg bg-participation-accent-600 px-4 py-3 font-medium text-white transition-colors hover:bg-participation-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Send to Selected ({selectedCount})
			</button>
		</div>
	{/if}

	<!-- Progressive Disclosure -->
	<details class="text-center">
		<summary class="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
			How do we find emails? →
		</summary>
		<div class="mt-3 space-y-2 text-xs text-slate-600">
			<p>We use public APIs (Hunter.io, Clearbit) to find verified business emails.</p>
			<p>If unavailable, we search company websites and LinkedIn public data.</p>
			<p>Confidence scores show verification reliability.</p>
		</div>
	</details>
</div>
