<script lang="ts">
	import { Lightbulb, Braces, Plus, Wand2, Sparkles, TrendingUp } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { onMount, onDestroy } from 'svelte';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';
	import { predictPerformance } from '$lib/services/template-intelligence';
	import { debounce } from '$lib/utils/debounce';
	import { templateValidationRules } from '$lib/utils/validation';
	import ValidatedInput from '$lib/components/ui/ValidatedInput.svelte';

	const placeholderText = `The math doesn't work anymore.\n\n[Insert devastating numerical contrast here]\n\nFrom [Address] where [local impact].\n\n[Personal Connection]\n\nWhich [option] do you defend?\n\n💡 Tip: Use stark numbers, personal stakes, and devastating questions that force a choice.`;

	let {
		data = $bindable(),
		context
	}: {
		data: {
			preview: string;
			variables: string[];
		};
		context: TemplateCreationContext;
	} = $props();

	// Variables depend on template type
	const senderVariables = ['[Personal Connection]', '[Name]', '[Address]'];
	const congressionalVariables = [
		'[Personal Connection]',
		'[Representative Name]',
		'[Name]',
		'[Address]'
	];

	const isCongressional = $derived(context.channelId === 'certified');
	const availableVariables = $derived(isCongressional ? congressionalVariables : senderVariables);
	const unusedVariables = $derived(availableVariables.filter((v) => !data.variables.includes(v)));
	const hasPersonalTouch = $derived(data.variables.includes('[Personal Connection]'));
	const hasAuthenticity = $derived(
		data.variables.includes('[Name]') || data.variables.includes('[Address]')
	);

	let autoAddSignature = $state(true);
	let screenReaderAnnouncement = $state('');
	let showAiSuggestions = $state(false);
	let performanceScore = $state(0);
	let predictedReach = $state(0);
	let isAnalyzing = $state(false);
	let aiSuggestions = $state<any[]>([]);
	let showSnippets = $state(false);

	// Cutting template snippets that trigger sharing while passing filters
	const viralSnippets = [
		{
			label: "The Math Opening",
			text: "The math doesn't work anymore.\n\n"
		},
		{
			label: "Corporate vs People",
			text: "[Corporation] made $[X] billion.\n[Regular people] lost $[Y] billion.\nThe transfer: [outcome]."
		},
		{
			label: "Devastating Question",
			text: "Which [option A or option B] do you defend?\n\nPlease explain this to your constituents."
		},
		{
			label: "Local Impact",
			text: "From [Address] where [local consequence]."
		},
		{
			label: "Tax Hypocrisy",
			text: "[Rich entity] pays [low %] tax rate.\n[Working entity] pays [high %] tax rate.\nThe math: [working people] fund [rich people]."
		},
		{
			label: "Housing Math",
			text: "[Corporation] owns [X] homes.\n[Regular people] lost [Y] homes to eviction.\nThe transfer: Homes move from families to Wall Street."
		},
		{
			label: "Profit vs Purpose",
			text: "[Industry] profits: $[X] billion.\n[Public service] budget: $[Y] million.\nThe gap: Profit beats purpose."
		}
	];

	// Component ID for timer coordination
	const componentId = 'message-editor-' + Math.random().toString(36).substring(2, 15);

	// Cleanup timers on destroy
	onDestroy(() => {
		useTimerCleanup(componentId)();
	});

	function ensureRequiredVariables(currentPreview: string, previousPreview: string) {
		// On first keystroke in an empty editor, enforce core block-level variables
		if (previousPreview.trim() === '' && currentPreview.trim() !== '') {
			const textarea = document.querySelector('textarea[placeholder*="devastating"]');
			const originalCursor = textarea ? textarea.selectionStart : currentPreview.length;

			// Prefix: Personal Connection block
			let addedPrefix = '';
			if (!currentPreview.includes('[Personal Connection]')) {
				addedPrefix = '[Personal Connection]\n\n';
			}

			// Suffix: signature with Name/Address when enabled
			let addedSuffix = '';
			if (autoAddSignature) {
				const needsName = !currentPreview.includes('[Name]');
				const needsAddress = !currentPreview.includes('[Address]');
				if (needsName || needsAddress) {
					addedSuffix =
						'\n\nSincerely,\n' + (needsName ? '[Name]\n' : '') + (needsAddress ? '[Address]' : '');
				}
			}

			if (addedPrefix || addedSuffix) {
				data.preview = `${addedPrefix}${currentPreview}${addedSuffix}`;

				// Announce changes and restore cursor accounting for prefix length
				screenReaderAnnouncement = 'Personalization blocks inserted automatically';
				coordinated.setTimeout(
					() => {
						if (textarea) {
							textarea.focus();
							const newPos = originalCursor + addedPrefix.length;
							textarea.setSelectionRange(newPos, newPos);
						}
						coordinated.setTimeout(
							() => {
								screenReaderAnnouncement = '';
							},
							1000,
							'feedback',
							componentId
						);
					},
					0,
					'dom',
					componentId
				);
			}
		}

		// Keep variables array in sync with text
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];
	}

	function insertSnippet(snippet: string) {
		const textarea = document.querySelector('textarea[placeholder*="devastating"]');
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;

		// Add snippet at cursor position with proper spacing
		let textToInsert = snippet;
		const textBefore = text.substring(0, start);
		const textAfter = text.substring(end);

		// Add spacing if needed
		if (textBefore.length > 0 && !textBefore.endsWith('\n\n')) {
			textToInsert = '\n\n' + textToInsert;
		}
		if (textAfter.length > 0 && !textAfter.startsWith('\n\n')) {
			textToInsert = textToInsert + '\n\n';
		}

		data.preview = text.substring(0, start) + textToInsert + text.substring(end);

		// Update variables array
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];

		// Reset cursor position after snippet
		coordinated.setTimeout(
			() => {
				if (textarea) {
					textarea.focus();
					const newPosition = start + textToInsert.length;
					textarea.setSelectionRange(newPosition, newPosition);
				}
			},
			0,
			'dom',
			componentId
		);
	}

	function insertVariable(variable: string) {
		const textarea = document.querySelector('textarea[placeholder*="devastating"]');
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;

		let textToInsert = variable;
		if (variable !== '[Name]' && variable !== '[Address]') {
			let prefix = '\n\n';
			let suffix = '\n\n';

			const textBefore = text.substring(0, start);
			const textAfter = text.substring(end);

			// Adjust prefix
			if (textBefore.length === 0 || textBefore.endsWith('\n\n')) {
				prefix = '';
			} else if (textBefore.endsWith('\n')) {
				prefix = '\n';
			}

			// Adjust suffix
			if (textAfter.length === 0 || textAfter.startsWith('\n\n')) {
				suffix = '';
			} else if (textAfter.startsWith('\n')) {
				suffix = '\n';
			}

			textToInsert = `${prefix}${variable}${suffix}`;
		}

		data.preview = text.substring(0, start) + textToInsert + text.substring(end);
		if (!data.variables.includes(variable)) {
			data.variables = [...data.variables, variable];
		}

		// Announce variable insertion to screen readers
		screenReaderAnnouncement = `Variable ${variable} inserted`;

		// Reset cursor position after variable
		coordinated.setTimeout(
			() => {
				if (textarea) {
					textarea.focus();
					const newPosition = start + textToInsert.length;
					textarea.setSelectionRange(newPosition, newPosition);
					// Clear announcement
					coordinated.setTimeout(
						() => {
							screenReaderAnnouncement = '';
						},
						1000,
						'feedback',
						componentId
					);
				}
			},
			0,
			'dom',
			componentId
		);
	}

	let previousPreview = data.preview;

	// Monitor changes to ensure required variables are always present when there's content
	$effect(() => {
		if (data.preview !== previousPreview) {
			ensureRequiredVariables(data.preview, previousPreview);
			previousPreview = data.preview;
		}
	});

	// Words should exclude variable tokens like [Name]
	const wordCount = $derived.by(() => {
		const withoutVars = data.preview.replace(/\[.*?\]/g, ' ').trim();
		if (!withoutVars) return 0;
		return withoutVars.split(/\s+/).length;
	});
	const variableCount = $derived((data.preview.match(/\[.*?\]/g) || []).length);

	// Auto-analyze message for performance prediction
	const analyzeMessage = debounce(async () => {
		if (data.preview.length < 50) return;

		isAnalyzing = true;
		try {
			const detectedVars = data.preview.match(/\[.*?\]/g) || [];
			const performance = predictPerformance(
				data.preview,
				detectedVars,
				context.channelId || 'general'
			);
			performanceScore = performance.engagementScore;
			predictedReach = performance.predictedReach;

			// Generate contextual AI suggestions - cutting and provocative
			aiSuggestions = [];
			if (!data.variables.includes('[Personal Connection]')) {
				aiSuggestions.push({
					text: 'Add personal stake - what\'s this costing YOU personally?',
					action: () => insertVariable('[Personal Connection]')
				});
			}
			if (wordCount < 100) {
				aiSuggestions.push({
					text: 'Too polite. Add devastating numerical contrasts that trigger sharing.',
					action: () => {}
				});
			}
			if (!data.preview.includes('math doesn\'t work')) {
				aiSuggestions.push({
					text: 'Try opening with "The math doesn\'t work anymore" - proven viral trigger',
					action: () => {
						const currentText = data.preview;
						data.preview = `The math doesn't work anymore.\n\n${currentText}`;
					}
				});
			}
			if (!data.preview.match(/\$[\d,]+/)) {
				aiSuggestions.push({
					text: 'Add specific dollar amounts - numbers cut deeper than words',
					action: () => {}
				});
			}
			if (!data.preview.includes('Which') && !data.preview.includes('Who')) {
				aiSuggestions.push({
					text: 'End with a devastating question: "Which [x] do you defend?"',
					action: () => {}
				});
			}
		} finally {
			isAnalyzing = false;
		}
	}, 500);

	$effect(() => {
		if (data.preview) analyzeMessage();
	});
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{screenReaderAnnouncement}
</div>

<div class="space-y-4">
	<!-- Personalization Tools - Moved to top for better agency -->
	<div class="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<Plus class="h-5 w-5 text-blue-600" />
				<h3 class="font-semibold text-blue-900">
					{#if isCongressional}
						Add Congressional Variables
					{:else}
						Add Personalization
					{/if}
				</h3>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#each availableVariables as variable}
					{@const isUsed = data.variables.includes(variable)}
					{@const isPersonal = variable === '[Personal Connection]'}
					{@const isAuthenticity = ['[Name]', '[Address]', '[Representative Name]'].includes(
						variable
					)}
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
						class:bg-blue-600={!isUsed}
						class:text-white={!isUsed}
						class:shadow-md={!isUsed}
						class:hover:bg-blue-700={!isUsed}
						class:bg-slate-200={isUsed}
						class:text-slate-500={isUsed}
						class:cursor-not-allowed={isUsed}
						onclick={() => insertVariable(variable)}
						disabled={isUsed}
						title={isUsed ? 'Variable already in use' : `Insert ${variable} variable`}
						aria-label={`Insert ${variable} variable`}
					>
						<Plus class="h-3 w-3" />
						{variable.replace(/[\[\]]/g, '')}
						{#if isPersonal}
							<span class="ml-1 text-xs opacity-75">✨</span>
						{:else if isAuthenticity}
							<span class="ml-1 text-xs opacity-75">🔒</span>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Personalization Coach - Encouraging, not demanding -->
			{#if data.preview.trim() && unusedVariables.length > 0}
				<div class="mt-2 rounded-md border border-blue-100 bg-blue-50 p-2">
					<div class="text-xs text-blue-700">
						{#if !hasAuthenticity && unusedVariables.some( (v) => ['[Name]', '[Address]'].includes(v) )}
							<span class="font-medium">🔒 Make it real:</span>
							Your name and address prove this isn't corporate astroturf.
						{:else if isCongressional && !data.variables.includes('[Representative Name]')}
							<span class="font-medium">🏛️ Congressional power move:</span>
							Force them to own their position by name.
						{:else}
							<span class="font-medium">⚡ Cutting edge!</span>
							This message barely passes filters but triggers maximum sharing.
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Viral Snippets - Pre-built cutting messages -->
	<div class="rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-3">
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<Wand2 class="h-5 w-5 text-red-600" />
				<h3 class="font-semibold text-red-900">Viral Message Snippets</h3>
				<button 
					type="button"
					class="ml-auto text-xs text-red-600 hover:text-red-800"
					onclick={() => showSnippets = !showSnippets}
				>
					{showSnippets ? 'Hide' : 'Show'} Cutting Templates
				</button>
			</div>

			{#if showSnippets}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					{#each viralSnippets as snippet}
						<button
							type="button"
							class="p-2 text-left rounded border border-red-200 bg-white hover:bg-red-50 transition-colors"
							onclick={() => insertSnippet(snippet.text)}
							title="Insert this viral snippet into your message"
						>
							<div class="font-medium text-xs text-red-800 mb-1">{snippet.label}</div>
							<div class="text-xs text-slate-600 line-clamp-2">{snippet.text.replace(/\n/g, ' ')}</div>
						</button>
					{/each}
				</div>
				<div class="text-xs text-red-700 bg-red-100 rounded p-2">
					⚡ These snippets are designed to trigger viral sharing while barely passing congressional filters.
					Replace bracketed placeholders with specific numbers and entities.
				</div>
			{/if}
		</div>
	</div>

	<!-- Message Template Editor -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<label for="message-template" class="text-sm font-semibold text-slate-800">
				Your Template Message
			</label>
			<div class="flex items-center gap-4 text-sm text-slate-500">
				<span>{wordCount} words</span>
				<span>{variableCount} variables</span>
			</div>
		</div>

		<ValidatedInput
			bind:value={data.preview}
			type="textarea"
			placeholder={placeholderText}
			rules={templateValidationRules.message_body}
			rows={8}
		/>
		<p id="message-help" class="text-xs text-slate-500">
			Write messages that cut through the noise. Use [variables] to make it personal. Think viral, but congressional-approved.
		</p>
	</div>

	<!-- AI Suggestions -->
	{#if aiSuggestions.length > 0}
		<div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
			<div class="mb-2 flex items-center gap-2">
				<Sparkles class="h-4 w-4 text-blue-600" />
				<h4 class="text-sm font-medium text-blue-900">AI Suggestions</h4>
			</div>
			<div class="space-y-2">
				{#each aiSuggestions as suggestion}
					<button
						class="w-full rounded p-2 text-left text-sm text-blue-800 transition-colors hover:bg-blue-100"
						onclick={suggestion.action}
					>
						💡 {suggestion.text}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Performance Prediction -->
	{#if performanceScore > 0}
		<div class="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-3">
			<div class="mb-2 flex items-center gap-2">
				<TrendingUp class="h-4 w-4 text-purple-600" />
				<h4 class="text-sm font-medium text-purple-900">Performance Prediction</h4>
			</div>
			<div class="mb-2 grid grid-cols-2 gap-4">
				<div>
					<div class="text-lg font-bold text-purple-600">{performanceScore}%</div>
					<div class="text-xs text-gray-600">Engagement Score</div>
				</div>
				<div>
					<div class="text-lg font-bold text-blue-600">{predictedReach}</div>
					<div class="text-xs text-gray-600">Predicted Reach</div>
				</div>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-gray-200">
				<div
					class="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
					style="width: {performanceScore}%"
				/>
			</div>
		</div>
	{/if}

	<!-- Settings - Compact -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				bind:checked={autoAddSignature}
				class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
			/>
			<span class="text-sm text-slate-700">Auto-add signature when typing</span>
		</label>
	</div>

	<!-- Guidelines - Compact -->
	<details class="group rounded-lg border border-slate-200">
		<summary
			class="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
		>
			<Lightbulb class="h-4 w-4 text-slate-400" />
			Template Guidelines
			<span class="ml-auto text-xs text-slate-400 group-open:hidden">Show tips</span>
		</summary>
		<div class="border-t border-slate-200 p-3 text-sm text-slate-600">
			<ul class="space-y-1">
				<li>• Lead with devastating numerical contrasts that expose hypocrisy</li>
				<li>• End with forcing a choice: "Which [x] do you defend?"</li>
				<li>• Use specific dollar amounts - numbers cut deeper than words</li>
				<li>• Make it personal: "From [Address] where [local impact]"</li>
				<li>• Barely pass filters but trigger viral sharing</li>
			</ul>
		</div>
	</details>
</div>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.editor-textarea {
		min-height: 200px;
		width: 100%;
		resize: vertical;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 0.875rem;
		line-height: 1.25rem;
		white-space: pre-wrap;
		word-wrap: break-word;
		border: 1px solid #d1d5db; /* border-slate-300 */
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
		background-color: white;
	}

	.editor-textarea:focus {
		border-color: #3b82f6; /* focus:border-blue-500 */
		outline: 2px solid transparent;
		outline-offset: 2px;
		--tw-ring-color: #3b82f6; /* focus:ring-blue-500 */
		--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width)
			var(--tw-ring-offset-color);
		--tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width))
			var(--tw-ring-color);
		box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
	}
</style>
