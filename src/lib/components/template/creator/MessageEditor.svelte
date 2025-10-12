<script lang="ts">
	import { Plus, Check, Info } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { getVariableTipMessage } from '$lib/utils/variable-styling';
	import CodeMirrorEditor from './CodeMirrorEditor.svelte';
	import { resolveTemplate } from '$lib/utils/templateResolver';
	import { spring } from 'svelte/motion';

	const placeholderText = $derived.by(() => {
		if (isCongressional) {
			return `Dear [Representative],\n\nI'm writing about the urgent need for action on housing affordability in our district. Rent increases have outpaced wages by 40% over the past five years, forcing families to choose between housing and basic needs.\n\n[Personal Connection]\n\nI urge you to support policies that address this crisis through zoning reform and affordable housing development.\n\nSincerely,\n[Name]\n[Address]`;
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
	let showVariableTip = $state(false);
	let currentVariableTip = $state<string>('');
	let showPreview = $state(false);
	let previewContent = $state<string>('');
	let tipTimeout: number | null = null;
	let codeMirrorInsertVariable: ((variable: string) => void) | undefined = $state();
	let codeMirrorAppendToDocument: ((text: string, preserveCursor?: boolean) => void) | undefined =
		$state();

	// Spring animations for micro-interactions
	const buttonScale = spring(1, { stiffness: 0.4, damping: 0.7 });
	const tipScale = spring(0, { stiffness: 0.3, damping: 0.6 });
	const previewScale = spring(0, { stiffness: 0.3, damping: 0.6 });

	// Core variables that are ALWAYS included in templates
	const coreVariables = ['[Name]', '[Personal Connection]'];
	// Address is essential for government communications (constituent verification)
	const addressVariable = ['[Address]'];
	const congressionalVariables = ['[Representative]'];

	const isCongressional = $derived(context.channelId === 'certified');
	const availableVariables = $derived.by(() => {
		const vars = [...coreVariables, ...addressVariable];
		if (isCongressional) vars.push(...congressionalVariables);
		return vars;
	});
	const _unusedVariables = $derived(availableVariables.filter((v) => !data.variables.includes(v)));
	const _hasPersonalTouch = $derived(data.variables.includes('{personalConnection}'));
	const _hasAuthenticity = $derived(
		data.variables.includes('{name}') || data.variables.includes('{address}')
	);

	function ensureRequiredVariables(currentPreview: string) {
		// Auto-include Name and Personal Connection as user types
		if (currentPreview.trim().length >= 1 && codeMirrorAppendToDocument) {
			const needsName = !currentPreview.includes('[Name]');
			const needsPersonal = !currentPreview.includes('[Personal Connection]');

			// Build the text to append
			let textToAppend = '';

			// Add Personal Connection block if missing
			if (needsPersonal) {
				// Check if we already have a signature block
				if (currentPreview.match(/\n\n(Sincerely|Best regards|Thank you)/)) {
					// Insert before existing signature using string replacement
					const withPersonal = currentPreview.replace(
						/(\n\n(?:Sincerely|Best regards|Thank you))/m,
						'\n\n[Personal Connection]$1'
					);
					if (withPersonal !== currentPreview) {
						// This is a complex replacement, need to update the whole document
						data.preview = withPersonal;
						return; // Exit early to avoid double-processing
					}
				} else {
					textToAppend += '\n\n[Personal Connection]';
				}
			}

			// Add signature with Name if missing (Address handled separately by handleAddressToggle)
			if (needsName) {
				const signatureText = 'Sincerely,\n[Name]';

				if (!currentPreview.match(/\n\n(?:Sincerely|Best regards|Thank you)/)) {
					textToAppend += `\n\n${signatureText}`;
				} else if (!currentPreview.includes('[Name]')) {
					// Need to modify existing signature - use string replacement
					const withName = currentPreview.replace(
						/(\n\n(?:Sincerely|Best regards|Thank you),?\s*)$/m,
						'$1\n[Name]'
					);
					if (withName !== currentPreview) {
						data.preview = withName;
						return; // Exit early
					}
				}
			}

			// Append the built text if any
			if (textToAppend) {
				codeMirrorAppendToDocument(textToAppend, true); // preserveCursor = true
			}
		}

		// Keep variables array in sync with text
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];
	}

	// Smart Address insertion/removal function
	function handleAddressToggle() {
		if (!data.preview) return;

		const hasAddress = data.preview.includes('[Address]');
		
		if (includeAddress && !hasAddress) {
			// Need to add [Address] - find signature and insert after [Name]
			const signaturePattern = /((?:Sincerely|Best regards|Thank you),?\s*\n\[Name\])/m;
			const match = data.preview.match(signaturePattern);
			
			if (match) {
				// Insert [Address] after [Name] in existing signature
				const newContent = data.preview.replace(
					signaturePattern,
					'$1\n[Address]'
				);
				data.preview = newContent;
			} else {
				// No signature found, need to add complete signature block
				const needsNewline = data.preview.trim() && !data.preview.endsWith('\n\n');
				const signatureBlock = `${needsNewline ? '\n\n' : ''}Sincerely,\n[Name]\n[Address]`;
				
				if (codeMirrorAppendToDocument) {
					codeMirrorAppendToDocument(signatureBlock, true);
				} else {
					data.preview += signatureBlock;
				}
			}
		} else if (!includeAddress && hasAddress) {
			// Need to remove [Address]
			// Remove line with [Address], handling various spacing patterns
			const newContent = data.preview
				.replace(/\n\[Address\]\n/g, '\n') // Address between other lines
				.replace(/\n\[Address\]$/g, '') // Address at end
				.replace(/^\[Address\]\n/g, '') // Address at start (unlikely)
				.replace(/\[Address\]/g, ''); // Any remaining Address variables
			
			data.preview = newContent;
		}
		
		// Keep variables array in sync
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];
	}

	function showVariableTipAnimated(variable: string) {
		// Clear any existing timeout to handle conflicts
		if (tipTimeout) {
			clearTimeout(tipTimeout);
			tipTimeout = null;
		}

		// If another tip is already showing, animate it out first
		if (showVariableTip) {
			tipScale.set(0, { duration: 150 }).then(() => {
				// Show new tip after old one is hidden
				currentVariableTip = getVariableTipMessage(variable);
				showVariableTip = true;
				tipScale.set(1, { duration: 300 });

				// Auto-hide after 4 seconds
				tipTimeout = setTimeout(() => {
					hideVariableTip();
				}, 4000);
			});
		} else {
			// No existing tip, show immediately
			currentVariableTip = getVariableTipMessage(variable);
			showVariableTip = true;
			tipScale.set(1, { duration: 300 });

			// Auto-hide after 4 seconds
			tipTimeout = setTimeout(() => {
				hideVariableTip();
			}, 4000);
		}
	}

	function hideVariableTip() {
		if (tipTimeout) {
			clearTimeout(tipTimeout);
			tipTimeout = null;
		}
		tipScale.set(0, { duration: 200 }).then(() => {
			showVariableTip = false;
			currentVariableTip = '';
		});
	}

	// Removed complex overlay event handlers - will implement proper CodeMirror solution

	function insertVariable(variable: string) {
		// Micro-interaction: button scale animation
		buttonScale.set(0.9);
		setTimeout(() => buttonScale.set(1.05), 100);
		setTimeout(() => buttonScale.set(1), 200);

		// Use CodeMirror's insertion method to preserve cursor position
		if (codeMirrorInsertVariable) {
			codeMirrorInsertVariable(variable);
		}

		// Keep variables array in sync
		const allVariables = data.preview.match(/\[.*?\]/g) || [];
		data.variables = [...new Set(allVariables)];
	}

	// Create resolved variable values using templateResolver
	const _resolvedVariableValues = $derived.by(() => {
		// Create a mock template for resolution
		const mockTemplate = {
			id: 'preview',
			title: 'Preview Template',
			message_body: data.preview || placeholderText,
			deliveryMethod: 'email' as const,
			type: 'direct' as const,
			subject: 'Preview'
		};

		try {
			// Use templateResolver with preserveVariables option for preview
			resolveTemplate(mockTemplate, null, { preserveVariables: true });

			// Extract variable values by comparing original and resolved
			const values: Record<string, string | null> = {};

			// For preview mode, we want to show placeholder values
			values['Name'] = null; // Will show [Name]
			values['Personal Connection'] = null; // Will show [Personal Connection]
			values['Address'] = null; // Will show [Address]
			values['Representative'] = null; // Will show [Representative]

			return values;
		} catch (error) {
			console.warn('Template resolution failed:', error);
			return {};
		}
	});

	// Monitor changes to keep variables in sync
	$effect(() => {
		ensureRequiredVariables(data.preview);
	});

	// Reactive effect to handle Address toggle
	$effect(() => {
		// This effect runs when includeAddress changes
		handleAddressToggle();
	});

	// Word count excluding variables
	const wordCount = $derived.by(() => {
		const withoutVars = data.preview.replace(/\[.*?\]/g, ' ').trim();
		if (!withoutVars) return 0;
		return withoutVars.split(/\s+/).length;
	});

	// Character count for space awareness
	const charCount = $derived(data.preview.length);

	// Sample data for preview
	const sampleData = {
		'[Name]': 'Jane Smith',
		'[Personal Connection]': "As a parent of two children in our local schools, I've seen firsthand how this issue affects our community",
		'[Address]': '123 Main Street, San Francisco, CA 94102',
		'[Representative]': 'Representative Nancy Pelosi',
		'[Senator]': 'Senator Alex Padilla',
		'[City]': 'San Francisco',
		'[State]': 'CA',
		'[ZIP]': '94102',
		'[Congressional District]': 'CA-12'
	};

	function generatePreview() {
		if (!data.preview) {
			previewContent = '';
			return;
		}

		// Replace all variables with sample data
		let preview = data.preview;
		for (const [variable, value] of Object.entries(sampleData)) {
			preview = preview.replace(new RegExp(variable.replace(/[\[\]]/g, '\\$&'), 'g'), value);
		}
		previewContent = preview;
	}

	function togglePreview() {
		if (showPreview) {
			// Hide preview
			previewScale.set(0, { duration: 200 }).then(() => {
				showPreview = false;
				previewContent = '';
			});
		} else {
			// Generate and show preview
			generatePreview();
			showPreview = true;
			previewScale.set(1, { duration: 300 });
		}
	}

	// Removed legacy textarea code - now using CodeMirror
</script>

<div class="flex h-full flex-col">
	<!-- Compact Variable Pills Row -->
	<div class="mb-3 flex-shrink-0">
		<div class="mb-2 flex items-center justify-between">
			{#if isCongressional}
				<span class="text-xs font-medium text-slate-700">
					Core elements • <span class="text-blue-600 font-semibold">Address validates constituents</span>
				</span>
			{:else}
				<span class="text-xs font-medium text-slate-600">Core elements for your template</span>
			{/if}
			<span class="text-xs text-slate-500">Auto-adds as you type</span>
		</div>

		<!-- Mobile: Horizontal scrollable pills -->
		<div class="scrollbar-hide flex gap-3 overflow-x-auto px-1 pb-2 sm:hidden">
			{#each availableVariables as variable}
				{@const isUsed = data.variables.includes(variable)}
				{@const isCore = coreVariables.includes(variable)}
				{@const isAddress = variable === '[Address]'}
				{@const isPersonalConnection = variable === '[Personal Connection]'}

				{#if !isAddress}
					<button
						type="button"
						class="inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all active:scale-95"
						class:bg-emerald-50={isUsed}
						class:border-emerald-200={isUsed}
						class:text-emerald-700={isUsed}
						class:bg-purple-50={isPersonalConnection && !isUsed}
						class:border-purple-200={isPersonalConnection && !isUsed}
						class:text-purple-700={isPersonalConnection && !isUsed}
						class:bg-slate-50={!isUsed && !isPersonalConnection}
						class:border-slate-200={!isUsed && !isPersonalConnection}
						class:text-slate-600={!isUsed && !isPersonalConnection}
						onclick={() => insertVariable(variable)}
						disabled={isCore && isUsed}
						style="transform: scale({$buttonScale})"
					>
						{#if isUsed}
							<Check class="h-3 w-3" />
						{:else}
							<Plus class="h-3 w-3" />
						{/if}
						{variable.replace(/[{}]/g, '')}
						{#if isPersonalConnection && !isUsed}
							<span class="text-xs">✨</span>
						{/if}
					</button>
				{/if}
			{/each}

			<!-- Address toggle for mobile -->
			<label
				class="inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all active:scale-95"
				class:bg-blue-50={includeAddress}
				class:border-blue-200={includeAddress}
				class:text-blue-700={includeAddress}
				class:bg-slate-50={!includeAddress}
				class:border-slate-200={!includeAddress}
				class:text-slate-600={!includeAddress}
			>
				<input type="checkbox" bind:checked={includeAddress} class="sr-only" />
				{#if includeAddress}
					<Check class="h-3 w-3" />
				{:else}
					<span class="text-xs">📍</span>
				{/if}
				Address
			</label>
		</div>

		<!-- Desktop: Compact Pill Layout -->
		<div class="hidden flex-wrap items-center gap-2 sm:flex">
			{#each availableVariables as variable}
				{@const isUsed = data.variables.includes(variable)}
				{@const isCore = coreVariables.includes(variable)}
				{@const isAddress = variable === '[Address]'}
				{@const isPersonalConnection = variable === '[Personal Connection]'}

				{#if isAddress}
					<!-- Address toggle with contextual info -->
					<div class="group relative">
						<label
							class="inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all hover:scale-105"
							class:bg-blue-50={includeAddress}
							class:border-blue-200={includeAddress}
							class:text-blue-700={includeAddress}
							class:bg-slate-50={!includeAddress}
							class:border-slate-200={!includeAddress}
							class:text-slate-600={!includeAddress}
						>
							<input type="checkbox" bind:checked={includeAddress} class="sr-only" />
							{#if includeAddress}
								<Check class="h-3 w-3" />
							{:else if isCongressional}
								<span class="text-xs font-bold">★</span>
							{:else}
								<span class="text-xs">📍</span>
							{/if}
							Address
						</label>

						<!-- Contextual tooltip on hover -->
						<div
							class="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-56 -translate-x-1/2 transform rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs text-blue-800 opacity-0 shadow-sm transition-opacity group-hover:block group-hover:opacity-100"
						>
							{#if isCongressional}
								<strong>Essential for government.</strong> Verifies senders as actual constituents — required by Congress, city councils, and county offices
							{:else}
								Includes sender's address from their profile for authenticity
							{/if}
						</div>
					</div>
				{:else}
					<!-- Variable pill button -->
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all hover:scale-105 active:scale-95"
						class:bg-emerald-50={isUsed}
						class:border-emerald-200={isUsed}
						class:text-emerald-700={isUsed}
						class:bg-purple-50={isPersonalConnection && !isUsed}
						class:border-purple-200={isPersonalConnection && !isUsed}
						class:text-purple-700={isPersonalConnection && !isUsed}
						class:shadow-sm={isPersonalConnection && !isUsed}
						class:shadow-purple-200={isPersonalConnection && !isUsed}
						class:bg-slate-50={!isUsed && !isPersonalConnection}
						class:border-slate-200={!isUsed && !isPersonalConnection}
						class:text-slate-600={!isUsed && !isPersonalConnection}
						class:hover:bg-slate-100={!isUsed && !isPersonalConnection}
						onclick={() => insertVariable(variable)}
						disabled={isCore && isUsed}
					>
						{#if isUsed}
							<Check class="h-3 w-3" />
						{:else}
							<Plus class="h-3 w-3" />
						{/if}
						{variable.replace(/[{}]/g, '')}
						{#if isPersonalConnection && !isUsed}
							<span class="text-xs">✨</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Message Composer with Floating Action Bar -->
	<div class="flex min-h-0 flex-1 flex-col">
		<!-- Enhanced editor with variable highlighting -->
		<div class="relative flex-1">
			<!-- Preview overlay when preview is active -->
			{#if showPreview}
				<div 
					class="absolute inset-0 z-10 flex flex-col bg-white rounded-lg border border-blue-200 shadow-lg"
					style="transform: scale({$previewScale}); transform-origin: center center;"
				>
					<!-- Preview header -->
					<div class="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-4 py-2 rounded-t-lg">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-blue-900">Preview with Sample Data</span>
							<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
								Not real-time
							</span>
						</div>
						<button
							type="button"
							class="text-blue-600 hover:text-blue-800 transition-colors"
							onclick={togglePreview}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					
					<!-- Preview content -->
					<div class="flex-1 overflow-auto p-4">
						<div class="prose prose-sm max-w-none">
							<pre class="whitespace-pre-wrap font-sans text-sm text-gray-700">{previewContent}</pre>
						</div>
					</div>
					
					<!-- Sample data legend -->
					<div class="border-t border-blue-100 bg-blue-50/50 px-4 py-2 rounded-b-lg">
						<p class="text-xs text-blue-600">
							Showing with sample recipient data. Actual values will vary for each sender.
						</p>
					</div>
				</div>
			{/if}

			<!-- Styled overlay showing variables -->
			<!-- Removed XSS-vulnerable overlay - will implement CodeMirror 6 -->

			<!-- CodeMirror editor with proper variable decorations -->
			<CodeMirrorEditor
				bind:value={data.preview}
				bind:insertVariable={codeMirrorInsertVariable}
				bind:appendToDocument={codeMirrorAppendToDocument}
				onVariableClick={showVariableTipAnimated}
				class="h-full"
			/>

			<!-- Floating Action Bar -->
			<div
				class="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between"
				style="z-index: 3;"
			>
				<!-- Variable Tip (appears when user tries to edit template variables) -->
				{#if showVariableTip}
					<div
						class="pointer-events-auto max-w-xs rounded-lg border border-blue-200 bg-blue-50/95 px-3 py-2 text-xs text-blue-700 backdrop-blur-sm transition-all"
						style="transform: scale({$tipScale}); transform-origin: left center;"
					>
						<div class="flex items-center gap-2">
							<Info class="h-3 w-3 flex-shrink-0 text-blue-600" />
							<span>{currentVariableTip}</span>
						</div>
					</div>
				{:else}
					<div></div>
				{/if}

				<!-- Word/Character Count Badge with Preview Button -->
				<div class="pointer-events-auto flex items-center gap-2">
					<!-- Preview button -->
					{#if !showPreview && data.preview.length > 20}
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/95 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm backdrop-blur-sm transition-all hover:bg-blue-100 hover:scale-105 active:scale-95"
							onclick={togglePreview}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
							Preview
						</button>
					{/if}
					
					<!-- Word/character count -->
					<div
						class="flex items-center gap-2 rounded-full border bg-white/95 px-2 py-1 text-xs shadow-sm backdrop-blur-sm"
						class:border-slate-200={wordCount < 50}
						class:border-emerald-200={wordCount >= 50 && wordCount <= 150}
						class:border-amber-200={wordCount > 150 && wordCount <= 200}
						class:border-red-200={wordCount > 200}
					>
						<span
							class="font-medium transition-colors"
							class:text-slate-500={wordCount < 50}
							class:text-emerald-600={wordCount >= 50 && wordCount <= 150}
							class:text-amber-600={wordCount > 150 && wordCount <= 200}
							class:text-red-600={wordCount > 200}
						>
							{wordCount} words
						</span>
						<span class="text-slate-400">•</span>
						<span class="text-slate-400">{charCount} chars</span>
					</div>
				</div>
			</div>
		</div>
	</div>
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

	/* Padding handled via Tailwind pb-16 class */

	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
