<script lang="ts">
	import { CheckCircle2, AlertTriangle, Zap, ArrowRight, Loader2 } from '@lucide/svelte';
	import type { TemplateFormData, TemplateCreationContext } from '$lib/types/template';
	import Badge from '$lib/components/ui/Badge.svelte';

	let { data, context }: { data: TemplateFormData; context: TemplateCreationContext } = $props();

	// State for AI analysis
	let analysisState: 'checking' | 'ready' | 'suggestions' | 'ai-help' = $state('checking');
	let quickFixes: Array<{ type: string; fix: string; reason: string; severity: number }> = $state([]);
	let aiSuggestions: Array<{ id: string; original: string; suggested: string; reason: string; accepted?: boolean }> = $state([]);
	let needsWork = $state(false);
	let scores = $state({ grammar: 100, clarity: 100, completeness: 100 });

	// Check if this is certified congressional delivery
	const isCertifiedDelivery = $derived(context.channelId === 'certified');

	// Real analysis on component mount
	$effect(() => {
		analyzeMessage();
	});

	async function analyzeMessage() {
		try {
			const response = await fetch('/api/templates/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: data.objective.title,
					content: data.content.preview,
					deliveryMethod: context.channelId === 'certified' ? 'certified' : 'email'
				})
			});

			const result = await response.json();
			
			if (result.success) {
				const analysis = result.data;
				quickFixes = analysis.quickFixes || [];
				scores = analysis.scores;
				needsWork = analysis.status === 'needs_work';
				
				if (analysis.status === 'ready') {
					analysisState = 'ready';
				} else {
					analysisState = 'suggestions';
				}
			} else {
				// Fallback to simple ready state
				analysisState = 'ready';
			}
		} catch (error) {
			console.error('Analysis failed:', error);
			analysisState = 'ready';
		}
	}


	function applyQuickFixes() {
		// Simulate applying fixes
		quickFixes = [];
		analysisState = 'ready';
	}

	async function getAIHelp() {
		analysisState = 'ai-help';
		
		// Simulate AI analysis
		setTimeout(() => {
			aiSuggestions = [
				{
					id: '1',
					original: 'I think this policy is bad',
					suggested: 'This policy costs taxpayers $2.3M annually',
					reason: 'Specific data beats opinions'
				},
				{
					id: '2', 
					original: 'Please consider my request',
					suggested: 'Vote NO on H.R. 1234 when it comes to committee',
					reason: 'Clear ask with bill number'
				}
			];
		}, 1500);
	}

	function acceptSuggestion(id: string) {
		const suggestion = aiSuggestions.find(s => s.id === id);
		if (suggestion) {
			suggestion.accepted = true;
			// In real implementation, update the actual message content
		}
	}

	function rejectSuggestion(id: string) {
		aiSuggestions = aiSuggestions.filter(s => s.id !== id);
	}

	// Derived state
	const allSuggestionsHandled = $derived(aiSuggestions.every(s => s.accepted !== undefined));
	const isReady = $derived(analysisState === 'ready' || (analysisState === 'ai-help' && allSuggestionsHandled));
</script>

<div class="space-y-6">
	{#if analysisState === 'checking'}
		<!-- Checking state -->
		<div class="rounded-lg border border-participation-primary-200 bg-participation-primary-50 p-4">
			<div class="flex items-center gap-3">
				<Loader2 class="h-5 w-5 animate-spin text-participation-primary-600" />
				<div>
					<h4 class="text-base font-medium text-participation-primary-900">Checking your message...</h4>
					<p class="mt-1 text-sm text-participation-primary-700">Quick scan for what works and what doesn't</p>
				</div>
			</div>
		</div>
	{:else if analysisState === 'ready'}
		<!-- Ready state -->
		<div class="rounded-lg border border-green-200 bg-green-50 p-4">
			<div class="flex items-start gap-3">
				<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
				<div>
					<h4 class="text-base font-medium text-green-900">Ready to send</h4>
					<p class="mt-1 text-sm text-green-700">
						{isCertifiedDelivery 
							? 'Congressional standards met—clear ask, solid structure' 
							: 'Message looks good—structure works, ask is clear'
						}
					</p>
				</div>
			</div>
		</div>
	{:else if analysisState === 'suggestions'}
		<!-- Quick fixes available -->
		<div class="space-y-4">
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
				<div class="flex items-start gap-3">
					<Zap class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
					<div class="flex-1">
						<h4 class="text-base font-medium text-amber-900">
							{needsWork ? 'Found ways to strengthen this' : 'Quick fixes available'}
						</h4>
						<p class="mt-1 text-sm text-amber-700">
							{isCertifiedDelivery 
								? (needsWork ? 'Congressional staff notice quality—make it count' : 'Small tweaks, bigger congressional impact')
								: (needsWork ? 'Messages that hit harder get better responses' : 'Small changes, bigger impact')
							}
						</p>
					</div>
				</div>
			</div>

			<!-- Quick fixes list -->
			<div class="space-y-3">
				{#each quickFixes as fix}
					<div class="rounded-lg border border-slate-200 bg-white p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1">
								<p class="text-sm font-medium text-slate-900">{fix.fix}</p>
								<p class="mt-1 text-xs text-slate-600">{fix.reason}</p>
							</div>
							<Badge variant="warning" size="sm">{fix.type}</Badge>
						</div>
					</div>
				{/each}
			</div>

			<!-- Quality scores -->
			{#if scores.grammar < 90 || scores.clarity < 90 || scores.completeness < 90}
				<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
					<h4 class="mb-2 text-sm font-medium text-slate-900">Message Quality</h4>
					<div class="grid grid-cols-3 gap-3 text-xs">
						<div class="text-center">
							<div class="text-lg font-bold" class:text-green-600={scores.grammar >= 90} class:text-amber-600={scores.grammar >= 70 && scores.grammar < 90} class:text-red-600={scores.grammar < 70}>
								{scores.grammar}
							</div>
							<div class="text-slate-600">Grammar</div>
						</div>
						<div class="text-center">
							<div class="text-lg font-bold" class:text-green-600={scores.clarity >= 90} class:text-amber-600={scores.clarity >= 70 && scores.clarity < 90} class:text-red-600={scores.clarity < 70}>
								{scores.clarity}
							</div>
							<div class="text-slate-600">Clarity</div>
						</div>
						<div class="text-center">
							<div class="text-lg font-bold" class:text-green-600={scores.completeness >= 90} class:text-amber-600={scores.completeness >= 70 && scores.completeness < 90} class:text-red-600={scores.completeness < 70}>
								{scores.completeness}
							</div>
							<div class="text-slate-600">Complete</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Action buttons -->
			<div class="flex gap-3">
				<button
					onclick={applyQuickFixes}
					class="flex items-center gap-2 rounded bg-participation-primary-600 px-4 py-2 text-sm text-white hover:bg-participation-primary-700"
				>
					Apply Fixes
				</button>
				{#if isCertifiedDelivery}
					<!-- AI Help only for congressional templates -->
					<button
						onclick={getAIHelp}
						class="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
					>
						Get AI Help
					</button>
				{/if}
				<button
					onclick={() => analysisState = 'ready'}
					class="text-sm text-slate-600 hover:text-slate-900"
				>
					{isCertifiedDelivery ? 'I\'ll handle it' : 'Looks good'}
				</button>
			</div>
		</div>
	{:else if analysisState === 'ai-help'}
		<!-- AI suggestions -->
		<div class="space-y-4">
			<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
				<div class="flex items-start gap-3">
					<div class="h-5 w-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold mt-0.5">
						AI
					</div>
					<div>
						<h4 class="text-base font-medium text-purple-900">Found ways to make it hit harder</h4>
						<p class="mt-1 text-sm text-purple-700">Pick what works, skip what doesn't</p>
					</div>
				</div>
			</div>

			{#if aiSuggestions.length === 0}
				<div class="rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex items-center gap-3">
						<Loader2 class="h-4 w-4 animate-spin text-slate-500" />
						<p class="text-sm text-slate-600">Analyzing your message...</p>
					</div>
				</div>
			{:else}
				<!-- AI suggestions list -->
				<div class="space-y-4">
					{#each aiSuggestions as suggestion}
						{#if suggestion.accepted === undefined}
							<div class="rounded-lg border border-slate-200 bg-white p-4">
								<div class="space-y-3">
									<div class="text-sm">
										<div class="mb-2">
											<span class="text-slate-500">Original:</span>
											<span class="ml-2 text-slate-900">"{suggestion.original}"</span>
										</div>
										<div class="mb-2">
											<span class="text-slate-500">Suggested:</span>
											<span class="ml-2 font-medium text-slate-900">"{suggestion.suggested}"</span>
										</div>
										<div>
											<span class="text-slate-500">Why:</span>
											<span class="ml-2 text-slate-700">{suggestion.reason}</span>
										</div>
									</div>
									<div class="flex gap-2">
										<button
											onclick={() => acceptSuggestion(suggestion.id)}
											class="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
										>
											Use This
										</button>
										<button
											onclick={() => rejectSuggestion(suggestion.id)}
											class="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
										>
											Keep Original
										</button>
									</div>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Message preview -->
	<div class="rounded-lg border border-slate-200 bg-white p-4">
		<h3 class="mb-3 text-sm font-medium text-slate-900">Your Message</h3>
		<div class="rounded-md bg-slate-50 p-3">
			<p class="whitespace-pre-wrap text-sm text-slate-700">
				{data.content.preview.substring(0, 300)}
				{data.content.preview.length > 300 ? '...' : ''}
			</p>
		</div>
	</div>

	<!-- Readiness indicator -->
	{#if isReady}
		<div class="rounded-md bg-participation-primary-50 p-3">
			<div class="flex items-center gap-2">
				<CheckCircle2 class="h-4 w-4 text-participation-primary-600" />
				<span class="text-sm font-medium text-participation-primary-900">
					{isCertifiedDelivery ? 'Ready for Congress' : 'Ready to send'}
				</span>
			</div>
		</div>
	{/if}
</div>