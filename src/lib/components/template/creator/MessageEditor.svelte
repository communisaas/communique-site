<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { templateValidationRules } from '$lib/utils/validation';
	import ValidatedInput from '$lib/components/ui/ValidatedInput.svelte';

	const placeholderText = $derived(() => {
		if (isCongressional) {
			return `Dear [Representative Name],\n\nI'm writing about the urgent need for action on housing affordability in our district. Rent increases have outpaced wages by 40% over the past five years, forcing families to choose between housing and basic needs.\n\n[Personal Connection]\n\nI urge you to support policies that address this crisis through zoning reform and affordable housing development.\n\nSincerely,\n[Name]\n[Address]`;
		} else {
			return `Subject: Urgent action needed on housing affordability\n\nI'm writing about the urgent need for action on housing affordability in our district. Rent increases have outpaced wages by 40% over the past five years, forcing families to choose between housing and basic needs.\n\n[Personal Connection]\n\nI urge you to support policies that address this crisis through zoning reform and affordable housing development.\n\nSincerely,\n[Name]\n[Address]`;
		}
	});

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

	let includeAddress = $state(false);

	// Core variables that auto-fill from user profile
	const coreVariables = ['[Name]', '[Personal Connection]'];
	// Address is optional - useful but not required for all advocacy messages  
	const optionalVariables = ['[Address]'];
	const congressionalVariables = ['[Representative Name]'];

	const isCongressional = $derived(context.channelId === 'certified');
	const availableVariables = $derived(() => {
		const vars = [...coreVariables, ...optionalVariables];
		if (isCongressional) vars.push(...congressionalVariables);
		return vars;
	});
	const unusedVariables = $derived(availableVariables.filter((v) => !data.variables.includes(v)));
	const hasPersonalTouch = $derived(data.variables.includes('[Personal Connection]'));
	const hasAuthenticity = $derived(
		data.variables.includes('[Name]') || data.variables.includes('[Address]')
	);


	function ensureRequiredVariables(currentPreview: string) {
		// Auto-include Name and Personal Connection as user types
		let updatedPreview = currentPreview;
		const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
		const cursorPosition = textarea?.selectionStart || 0;
		
		// Auto-add required blocks after first character
		if (currentPreview.trim().length >= 1) {
			const needsName = !updatedPreview.includes('[Name]');
			const needsPersonal = !updatedPreview.includes('[Personal Connection]');
			
			// Add Personal Connection block if missing
			if (needsPersonal) {
				// Insert before any existing signature
				if (updatedPreview.match(/\n\n(Sincerely|Best regards|Thank you)/)) {
					updatedPreview = updatedPreview.replace(/(\n\n(?:Sincerely|Best regards|Thank you))/m, '\n\n[Personal Connection]$1');
				} else {
					updatedPreview += '\n\n[Personal Connection]';
				}
			}
			
			// Add signature with Name if missing
			if (needsName) {
				const signatureText = includeAddress ? 'Sincerely,\n[Name]\n[Address]' : 'Sincerely,\n[Name]';
				if (!updatedPreview.match(/\n\n(?:Sincerely|Best regards|Thank you)/)) {
					updatedPreview += `\n\n${signatureText}`;
				} else if (!updatedPreview.includes('[Name]')) {
					// Add Name to existing signature
					const addressText = includeAddress ? '\n[Address]' : '';
					updatedPreview = updatedPreview.replace(/(\n\n(?:Sincerely|Best regards|Thank you),?\s*)$/m, `$1\n[Name]${addressText}`);
				}
			}
			
			if (updatedPreview !== currentPreview) {
				data.preview = updatedPreview;
				// Preserve cursor position after auto-add
				setTimeout(() => {
					if (textarea && cursorPosition <= currentPreview.length) {
						textarea.focus();
						textarea.setSelectionRange(cursorPosition, cursorPosition);
					}
				}, 0);
			}
		}

		// Keep variables array in sync with text
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
		
		// Keep variables array in sync
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];

		// Reset cursor position after variable
		setTimeout(() => {
			if (textarea) {
				textarea.focus();
				const newPosition = start + variable.length;
				textarea.setSelectionRange(newPosition, newPosition);
			}
		}, 0);
	}

	// Monitor changes to keep variables in sync
	$effect(() => {
		ensureRequiredVariables(data.preview);
	});

	// Word count excluding variables
	const wordCount = $derived.by(() => {
		const withoutVars = data.preview.replace(/\[.*?\]/g, ' ').trim();
		if (!withoutVars) return 0;
		return withoutVars.split(/\s+/).length;
	});

	// Sample data for preview
	const sampleData = {
		'[Name]': 'Alex Johnson',
		'[Personal Connection]': 'As a working parent of two children in local public schools',
		'[Address]': '123 Oak Street, Springfield, CA 94102',
		'[Representative Name]': 'Representative Sarah Wilson'
	};

	// Generate preview with sample data
	const previewWithSamples = $derived.by(() => {
		if (!data.preview.trim()) return '';
		let preview = data.preview;
		Object.entries(sampleData).forEach(([variable, value]) => {
			const regex = new RegExp(variable.replace(/[[\]]/g, '\\$&'), 'g');
			preview = preview.replace(regex, value);
		});
		return preview;
	});
</script>

<div class="space-y-4">
	<!-- Variable Status -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-3 md:p-4">
		<h3 class="text-sm font-medium text-slate-700 mb-3">
			Template Variables
		</h3>

		<!-- Mobile: Simplified Variable Display -->
		<div class="sm:hidden space-y-3">
			{#each availableVariables as variable}
				{@const isUsed = data.variables.includes(variable)}
				{@const isCore = coreVariables.includes(variable)}
				{@const isAddress = variable === '[Address]'}
				{@const isPersonalConnection = variable === '[Personal Connection]'}
				
				{#if !isAddress}
					<div class="flex items-center justify-between rounded-md border p-2"
						 class:bg-emerald-50={isUsed}
						 class:border-emerald-200={isUsed}
						 class:bg-purple-50={isPersonalConnection && !isUsed}
						 class:border-purple-200={isPersonalConnection && !isUsed}
						 class:bg-slate-100={!isUsed && !isPersonalConnection}
						 class:border-slate-200={!isUsed && !isPersonalConnection}>
						<div class="flex-1">
							<p class="text-sm font-medium"
							   class:text-emerald-700={isUsed}
							   class:text-purple-700={isPersonalConnection && !isUsed}
							   class:text-slate-700={!isUsed && !isPersonalConnection}>
								{variable.replace(/[\[\]]/g, '')}
							</p>
							{#if isPersonalConnection && !isUsed}
								<p class="text-xs text-purple-600 mt-0.5">Adding personal experience increases message impact ✨</p>
							{/if}
						</div>
						<button
							type="button"
							class="flex items-center justify-center h-8 w-8 rounded-full"
							class:bg-emerald-100={isUsed}
							class:text-emerald-600={isUsed}
							class:bg-purple-100={isPersonalConnection && !isUsed}
							class:text-purple-600={isPersonalConnection && !isUsed}
							class:bg-slate-200={!isUsed && !isPersonalConnection}
							class:text-slate-600={!isUsed && !isPersonalConnection}
							onclick={() => insertVariable(variable)}
							disabled={isCore && isUsed}
						>
							{#if isUsed}
								<span class="text-sm">✓</span>
							{:else}
								<Plus class="h-4 w-4" />
							{/if}
						</button>
					</div>
				{/if}
			{/each}
			
			<!-- Address toggle for mobile -->
			<label class="flex items-center justify-between rounded-md border p-2 cursor-pointer"
				   class:bg-blue-50={includeAddress}
				   class:border-blue-200={includeAddress}
				   class:bg-slate-100={!includeAddress}
				   class:border-slate-200={!includeAddress}>
				<div class="flex items-center gap-2">
					<span class="text-sm">📍</span>
					<span class="text-sm font-medium"
						  class:text-blue-700={includeAddress}
						  class:text-slate-600={!includeAddress}>Address</span>
				</div>
				<input type="checkbox" bind:checked={includeAddress} class="sr-only" />
				<div class="h-5 w-5 rounded border-2 flex items-center justify-center"
					 class:bg-blue-600={includeAddress}
					 class:border-blue-600={includeAddress}
					 class:border-slate-300={!includeAddress}>
					{#if includeAddress}
						<span class="text-white text-xs">✓</span>
					{/if}
				</div>
			</label>
		</div>

		<!-- Desktop: Compact Button Layout -->
		<div class="hidden sm:flex flex-wrap items-center gap-2">
			{#each availableVariables as variable}
				{@const isUsed = data.variables.includes(variable)}
				{@const isCore = coreVariables.includes(variable)}
				{@const isAddress = variable === '[Address]'}
				{@const isPersonalConnection = variable === '[Personal Connection]'}
				
				{#if isAddress}
					<!-- Address toggle -->
					<label class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors cursor-pointer"
						   class:bg-blue-50={includeAddress}
						   class:border-blue-200={includeAddress}
						   class:text-blue-700={includeAddress}
						   class:bg-slate-100={!includeAddress}
						   class:border-slate-200={!includeAddress}
						   class:text-slate-600={!includeAddress}>
						<input type="checkbox" bind:checked={includeAddress} class="sr-only" />
						<span class="text-xs">📍</span>
						Address
					</label>
				{:else}
					<!-- Variable status button -->
					<div class="relative">
						<button
							type="button"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors"
							class:bg-emerald-50={isUsed}
							class:border-emerald-200={isUsed}
							class:text-emerald-700={isUsed}
							class:bg-slate-100={!isUsed}
							class:border-slate-200={!isUsed}
							class:text-slate-600={!isUsed}
							class:hover:bg-emerald-100={!isUsed}
							class:ring-2={isPersonalConnection && !isUsed}
							class:ring-purple-200={isPersonalConnection && !isUsed}
							class:bg-purple-50={isPersonalConnection && !isUsed}
							class:border-purple-200={isPersonalConnection && !isUsed}
							class:text-purple-700={isPersonalConnection && !isUsed}
							onclick={() => insertVariable(variable)}
							disabled={isCore && isUsed}
						>
							{#if isUsed}
								<span class="text-xs">✓</span>
							{:else}
								<Plus class="h-3 w-3" />
							{/if}
							{variable.replace(/[\[\]]/g, '')}
							{#if isPersonalConnection && !isUsed}
								<span class="text-xs">✨</span>
							{/if}
						</button>
						
						<!-- Contextual tip for Personal Connection -->
						{#if isPersonalConnection && !isUsed}
							<div class="absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md bg-purple-600 px-2 py-1 text-xs text-white shadow-lg">
								Adding personal experience increases message impact
								<div class="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-purple-600"></div>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
		
		<p class="mt-3 text-xs text-slate-500">
			Core variables auto-add as you write. <span class="hidden sm:inline">Click to re-add if removed.</span>
		</p>
	</div>

	<!-- Message Template Editor -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<label for="message-template" class="text-sm font-medium text-slate-700">
				Your Message
			</label>
			<span class="text-sm text-slate-500">{wordCount} words</span>
		</div>

		<!-- Enhanced editor with variable highlighting -->
		<div class="relative">
			<ValidatedInput
				bind:value={data.preview}
				type="textarea"
				placeholder={placeholderText()}
				rules={templateValidationRules.message_body}
				rows={10}
				class="font-mono text-sm leading-relaxed"
			/>
			
			<!-- Variable preview overlay -->
			{#if data.variables.length > 0}
				<div class="mt-2 rounded-md bg-slate-50 p-2">
					<p class="text-xs font-medium text-slate-600 mb-1">Variables in your message:</p>
					<div class="flex flex-wrap gap-1">
						{#each data.variables as variable}
							<span class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
								<span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
								{variable}
							</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Variable example showcase -->
		{#if data.variables.includes('[Personal Connection]') && data.preview.includes('[Personal Connection]')}
			<div class="rounded-lg border border-purple-200 bg-purple-50 p-3">
				<p class="text-xs font-medium text-purple-700 mb-2">💡 Personal Connection Examples:</p>
				<div class="space-y-1 text-xs text-purple-600">
					<p>• "As a parent of two school-age children..."</p>
					<p>• "My family has lived in this district for 15 years..."</p>
					<p>• "I work downtown and see this issue daily..."</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Live Preview -->
	{#if data.preview.trim() && data.variables.length > 0}
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h4 class="text-sm font-medium text-slate-700">Preview with Sample Data</h4>
				<span class="text-xs text-slate-500">How your message will look</span>
			</div>
			
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<div class="prose prose-sm max-w-none">
					<div class="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
						{previewWithSamples}
					</div>
				</div>
			</div>
			
			<p class="text-xs text-slate-500">
				Variables will be automatically filled with real user data when sent.
			</p>
		</div>
	{/if}

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
