<script lang="ts">
	import { Lightbulb, Braces, Plus } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { onMount } from 'svelte';
	import type { spellcheckerService as SpellcheckerServiceType } from '$lib/services/spellchecker';

	const placeholderText = `Start writing your template message...\n\n💡 Tip: Click the buttons above to add personalization.\n✨ Variables work even when left empty.`;

	export let data: {
		preview: string;
		variables: string[];
	};
	export let context: TemplateCreationContext;

	// Variables depend on template type
	const senderVariables = ['[Why This Matters]', '[Name]', '[Address]'];
	const congressionalVariables = [
		'[Why This Matters]',
		'[Representative Name]',
		'[Name]',
		'[Address]'
	];

	$: isCongressional = context.channelId === 'certified';
	$: availableVariables = isCongressional ? congressionalVariables : senderVariables;
	$: unusedVariables = availableVariables.filter((v) => !data.variables.includes(v));
	$: hasPersonalTouch = data.variables.includes('[Why This Matters]');
	$: hasAuthenticity = data.variables.includes('[Name]') || data.variables.includes('[Address]');

	let autoAddSignature = true;
	let screenReaderAnnouncement = '';
	let misspelledWords: Set<string> = new Set();
	let highlightedText = '';
	let debounceTimer: number;

	let spellcheckerService: typeof SpellcheckerServiceType;

	function ensureRequiredVariables(currentPreview: string, previousPreview: string) {
		// Only auto-add variables if user is starting to type in an empty editor and has auto-signature enabled
		if (autoAddSignature && previousPreview.trim() === '' && currentPreview.trim() !== '') {
			const textarea = document.querySelector('textarea');
			const cursorPosition = textarea ? textarea.selectionStart : currentPreview.length;

			const closing = '\n\nSincerely,\n[Name]\n[Address]';
			data.preview = currentPreview + closing;

			// Announce the change to screen readers
			screenReaderAnnouncement = 'Signature automatically added to message';

			// Restore cursor position after the signature is added
			setTimeout(() => {
				if (textarea) {
					textarea.focus();
					textarea.setSelectionRange(cursorPosition, cursorPosition);
				}
				// Clear announcement after a brief delay
				setTimeout(() => {
					screenReaderAnnouncement = '';
				}, 1000);
			}, 0);
		}

		// Always ensure the variables array is up-to-date
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];
	}

	function insertVariable(variable: string) {
		const textarea = document.querySelector('textarea');
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
		setTimeout(() => {
			if (textarea) {
				textarea.focus();
				const newPosition = start + textToInsert.length;
				textarea.setSelectionRange(newPosition, newPosition);
				// Clear announcement
				setTimeout(() => {
					screenReaderAnnouncement = '';
				}, 1000);
			}
		}, 0);
	}

	let previousPreview = data.preview;
	async function checkSpelling(text: string) {
		if (!spellcheckerService) return;
		misspelledWords = await spellcheckerService.getMisspelledWords(text);
		updateHighlightedText(text);
	}

	function updateHighlightedText(text: string) {
		const words = text.split(/(\s+|[.,;!?])/);
		const seenVariables = new Set<string>();

		highlightedText = words
			.map((word) => {
				const isVariable = word.startsWith('[') && word.endsWith(']');
				const cleanWord = word.replace(/[.,;!?]/g, '');
				const classes = [];

				if (isVariable) {
					if (seenVariables.has(word)) {
						classes.push('duplicate-variable');
					}
					seenVariables.add(word);
				}

				if (misspelledWords.has(cleanWord.toLowerCase())) {
					classes.push('misspelled');
				}

				if (classes.length > 0) {
					return `<span class="${classes.join(' ')}">${word}</span>`;
				}

				return word;
			})
			.join('');
	}

	onMount(async () => {
		const serviceModule = await import('$lib/services/spellchecker');
		spellcheckerService = serviceModule.spellcheckerService;
		await checkSpelling(data.preview);
	});

	// Monitor changes to ensure required variables are always present when there's content
	$: {
		if (data.preview !== previousPreview) {
			ensureRequiredVariables(data.preview, previousPreview);
			updateHighlightedText(data.preview);
			previousPreview = data.preview;

			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				checkSpelling(data.preview);
			}, 300);
		}
	}

	$: wordCount = data.preview.trim().split(/\s+/).length;
	$: variableCount = (data.preview.match(/\[.*?\]/g) || []).length;
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
					{@const isPersonal = variable === '[Why This Matters]'}
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
						on:click={() => insertVariable(variable)}
						disabled={isUsed}
						title={isUsed ? 'Variable already in use' : `Insert ${variable} variable`}
						aria-label={`Insert ${variable} variable`}
					>
						<Plus class="h-3 w-3" />
						{variable.replace(/[\[\]]/g, '')}
						{#if isPersonal}
							<span class="ml-1 text-xs opacity-75">💭</span>
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
						{#if !hasPersonalTouch && unusedVariables.includes('[Why This Matters]')}
							<span class="font-medium">💭 Make it personal:</span>
							Share your story, reasoning, or perspective to help your message resonate.
						{:else if !hasAuthenticity && unusedVariables.some( (v) => ['[Name]', '[Address]'].includes(v) )}
							<span class="font-medium">🔒 Add authenticity:</span>
							Name and address help establish credibility with recipients.
						{:else if isCongressional && !data.variables.includes('[Representative Name]')}
							<span class="font-medium">🏛️ Congressional tip:</span>
							Including the representative's name personalizes your message.
						{:else}
							<span class="font-medium">✨ Great work!</span>
							You can add more personalization if you'd like, or your template is ready as-is.
						{/if}
					</div>
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

		<div class="relative">
			<div class="mirror-text" aria-hidden="true">
				{@html highlightedText}
			</div>
			<textarea
				id="message-template"
				bind:value={data.preview}
				class="editor-textarea"
				placeholder={placeholderText}
				aria-describedby="message-help"
				spellcheck="false"
			></textarea>
		</div>
		<p id="message-help" class="text-xs text-slate-500">
			Click personalization buttons above or type variables manually using [square brackets]
		</p>
	</div>

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
				<li>• Write messages that work with or without personalization</li>
				<li>• Variables are optional - use them to enhance, not replace, your core message</li>
				<li>• Personal touches help build connection, but generic templates work too</li>
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

	.mirror-text,
	.editor-textarea {
		min-height: 200px;
		width: 100%;
		resize: vertical;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-family: monospace;
		font-size: 0.875rem;
		line-height: 1.25rem;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.mirror-text {
		color: transparent;
		z-index: 1;
		pointer-events: none;
		border: 1px solid transparent;
	}

	.editor-textarea {
		position: absolute;
		top: 0;
		left: 0;
		background-color: transparent;
		z-index: 2;
		border: 1px solid #d1d5db; /* border-slate-300 */
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
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

	/* svelte-ignore css-unused-selector */
	.misspelled {
		text-decoration: underline wavy red;
		text-decoration-skip-ink: none;
	}
	/* svelte-ignore css-unused-selector */
	.duplicate-variable {
		text-decoration: underline wavy orange;
		text-decoration-skip-ink: none;
	}
</style>
