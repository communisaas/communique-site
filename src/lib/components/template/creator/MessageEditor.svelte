<script lang="ts">
	import { Lightbulb, Braces } from 'lucide-svelte';
	import type { TemplateCreationContext } from '$lib/types/template';

	export let data: {
		preview: string;
		variables: string[];
	};
	export let context: TemplateCreationContext;

	const senderVariables = ['[Name]', '[Address]', '[Personal Story]', '[Personal Reasoning]'];
	const requiredVariables = ['[Name]', '[Address]'];

	function ensureRequiredVariables() {
		if (!data.preview || data.preview.trim() === '') {
			return; // Don't add anything to empty template
		}

		let currentText = data.preview;
		let modified = false;

		// Check if required variables are present, if not add them at the end
		requiredVariables.forEach((variable) => {
			if (!currentText.includes(variable)) {
				// Add missing required variable at the end
				if (!currentText.endsWith('\n')) {
					currentText += '\n';
				}
				currentText += variable + '\n';
				modified = true;
			}
		});

		if (modified) {
			data.preview = currentText.trim(); // Remove trailing newline
		}

		// Update variables array
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];
	}

	function insertVariable(variable: string) {
		const textarea = document.querySelector('textarea');
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;

		data.preview = text.substring(0, start) + variable + text.substring(end);
		if (!data.variables.includes(variable)) {
			data.variables = [...data.variables, variable];
		}

		// Reset cursor position after variable
		setTimeout(() => {
			textarea.focus();
			const newPosition = start + variable.length;
			textarea.setSelectionRange(newPosition, newPosition);
		}, 0);
	}

	// Monitor changes to ensure required variables are always present when there's content
	$: {
		if (data.preview) {
			ensureRequiredVariables();
		}
	}

	$: wordCount = data.preview.trim().split(/\s+/).length;
	$: variableCount = (data.preview.match(/\[.*?\]/g) || []).length;
</script>

<div class="space-y-6">
	<!-- Template Guidelines -->
	<div class="rounded-lg border border-blue-100 bg-blue-50 p-4">
		<div class="flex items-start gap-3">
			<Lightbulb class="h-5 w-5 shrink-0 text-blue-600" />
			<div class="space-y-2">
				<h4 class="font-medium text-blue-900">Template Guidelines</h4>
				<div class="space-y-1 text-sm text-blue-700">
					<p>Write templates that work whether variables are filled or left empty:</p>
					<p class="font-medium text-green-700">
						✓ Good: "[Personal Story]" (standalone paragraph)
					</p>
					<p class="font-medium text-red-700">✗ Bad: "This affects me because [Personal Story]."</p>
					<p class="font-medium text-blue-700">
						[Name] and [Address] will be automatically added when you start typing.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Message Template Editor -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<label class="block text-sm font-medium text-slate-700">Template Message</label>
			<div class="text-sm text-slate-500">{wordCount} words | {variableCount} variables</div>
		</div>

		<textarea
			bind:value={data.preview}
			class="min-h-[300px] w-full resize-y rounded-md border-slate-300 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
			placeholder="Start writing your template message..."
		/>
	</div>

	<!-- Variable Insertion -->
	<div class="space-y-3">
		<label class="block text-sm font-medium text-slate-700">
			<div class="flex items-center gap-2">
				<Braces class="h-4 w-4 text-slate-400" />
				Add Sender Variables
			</div>
		</label>

		<div class="flex flex-wrap items-center gap-2">
			{#each senderVariables as variable}
				<button
					class="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200"
					on:click={() => insertVariable(variable)}
				>
					{variable}
				</button>
			{/each}
		</div>
	</div>
</div>
