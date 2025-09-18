<script lang="ts">
	import { Plus, Check } from '@lucide/svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { templateValidationRules } from '$lib/utils/validation';
	import ValidatedInput from '$lib/components/ui/ValidatedInput.svelte';
	import { spring } from 'svelte/motion';
	import { onMount } from 'svelte';

	const placeholderText = $derived.by(() => {
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

	// Spring animations for micro-interactions
	const buttonScale = spring(1, { stiffness: 0.4, damping: 0.7 });

	// Core variables that auto-fill from user profile
	const coreVariables = ['[Name]', '[Personal Connection]'];
	// Address is optional - useful but not required for all advocacy messages
	const optionalVariables = ['[Address]'];
	const congressionalVariables = ['[Representative Name]'];

	const isCongressional = $derived(context.channelId === 'certified');
	const availableVariables = $derived.by(() => {
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
					updatedPreview = updatedPreview.replace(
						/(\n\n(?:Sincerely|Best regards|Thank you))/m,
						'\n\n[Personal Connection]$1'
					);
				} else {
					updatedPreview += '\n\n[Personal Connection]';
				}
			}

			// Add signature with Name if missing
			if (needsName) {
				const signatureText = includeAddress
					? 'Sincerely,\n[Name]\n[Address]'
					: 'Sincerely,\n[Name]';
				if (!updatedPreview.match(/\n\n(?:Sincerely|Best regards|Thank you)/)) {
					updatedPreview += `\n\n${signatureText}`;
				} else if (!updatedPreview.includes('[Name]')) {
					// Add Name to existing signature
					const addressText = includeAddress ? '\n[Address]' : '';
					updatedPreview = updatedPreview.replace(
						/(\n\n(?:Sincerely|Best regards|Thank you),?\s*)$/m,
						`$1\n[Name]${addressText}`
					);
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

		// Micro-interaction: button scale animation
		buttonScale.set(0.9);
		setTimeout(() => buttonScale.set(1.05), 100);
		setTimeout(() => buttonScale.set(1), 200);

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

	// Character count for space awareness
	const charCount = $derived(data.preview.length);

	// Auto-resize textarea
	onMount(() => {
		const textarea = document.querySelector('textarea');
		if (textarea) {
			const adjustHeight = () => {
				textarea.style.height = 'auto';
				textarea.style.height = Math.min(textarea.scrollHeight, window.innerHeight * 0.6) + 'px';
			};
			textarea.addEventListener('input', adjustHeight);
			adjustHeight();

			return () => {
				textarea.removeEventListener('input', adjustHeight);
			};
		}
	});
</script>

<div class="flex h-full flex-col">
	<!-- Compact Variable Pills Row -->
	<div class="mb-3 flex-shrink-0">
		<div class="mb-2 flex items-center justify-between">
			<label class="text-xs font-medium text-slate-600">Click to insert variables:</label>
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
						{variable.replace(/[\[\]]/g, '')}
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
					<!-- Address toggle -->
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
						{:else}
							<span class="text-xs">📍</span>
						{/if}
						Address
					</label>
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
						{variable.replace(/[\[\]]/g, '')}
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
			<ValidatedInput
				bind:value={data.preview}
				type="textarea"
				placeholder={placeholderText()}
				rules={templateValidationRules.message_body}
				rows={12}
				class="composer-textarea h-full resize-none font-mono text-sm leading-relaxed"
				style="min-height: 250px; max-height: 60vh;"
			/>

			<!-- Floating Action Bar -->
			<div
				class="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between"
			>
				<!-- Personal Connection Helper (appears contextually) -->
				{#if data.variables.includes('[Personal Connection]') && data.preview.includes('[Personal Connection]')}
					<div
						class="animate-fade-in pointer-events-auto max-w-xs rounded-lg border border-purple-200 bg-purple-50/95 px-2 py-1 text-xs text-purple-700 backdrop-blur-sm"
					>
						<span class="font-medium">💡 Examples:</span>
						<span class="text-purple-600">"As a parent..." "Living here 15 years..."</span>
					</div>
				{:else}
					<div></div>
				{/if}

				<!-- Word/Character Count Badge -->
				<div
					class="pointer-events-auto flex items-center gap-2 rounded-full border bg-white/95 px-2 py-1 text-xs shadow-sm backdrop-blur-sm"
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

	.composer-textarea {
		padding-bottom: 4rem; /* Extra space for floating action bar */
	}

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

	.animate-fade-in {
		animation: fade-in 0.2s ease-out;
	}
</style>
