<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertCircle, Save, RotateCcw } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface Props {
		templateId: string;
		templateTitle: string;
		defaultMessage?: string;
		maxChars?: number;
		onSave?: (personalStory: string) => void;
	}

	const {
		templateId,
		templateTitle,
		defaultMessage = '',
		maxChars = 500,
		onSave
	}: Props = $props();

	// State management with Svelte 5 runes
	let personalStory = $state<string>(defaultMessage);
	let charCount = $derived(personalStory.length);
	let remainingChars = $derived(maxChars - charCount);
	let isOverLimit = $derived(charCount > maxChars);
	let lastSaved = $state<Date | null>(null);
	let isAutoSaving = $state<boolean>(false);

	// localStorage key for this template
	const storageKey = $derived(`template-draft-${templateId}`);

	// Auto-save timer
	let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

	// Load draft from localStorage on mount
	onMount(() => {
		const savedDraft = localStorage.getItem(storageKey);
		if (savedDraft) {
			try {
				const draft = JSON.parse(savedDraft);
				personalStory = draft.content;
				lastSaved = new Date(draft.timestamp);
			} catch (error) {
				console.error('Failed to load draft:', error);
			}
		}
	});

	// Auto-save to localStorage (debounced)
	$effect(() => {
		// Trigger on personalStory changes
		void personalStory;

		if (autoSaveTimer) clearTimeout(autoSaveTimer);

		autoSaveTimer = setTimeout(() => {
			saveDraft();
		}, 1000); // Auto-save after 1 second of inactivity
	});

	function saveDraft(): void {
		try {
			isAutoSaving = true;
			const draft = {
				content: personalStory,
				timestamp: new Date().toISOString(),
				templateId
			};
			localStorage.setItem(storageKey, JSON.stringify(draft));
			lastSaved = new Date();

			// Clear auto-saving indicator after animation
			setTimeout(() => {
				isAutoSaving = false;
			}, 500);
		} catch (error) {
			console.error('Failed to save draft:', error);
		}
	}

	function handleSave(): void {
		if (isOverLimit) return;

		saveDraft();
		onSave?.(personalStory);
	}

	function handleReset(): void {
		if (confirm('Clear your personal story? This will remove the saved draft.')) {
			personalStory = '';
			localStorage.removeItem(storageKey);
			lastSaved = null;
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		// Allow Ctrl/Cmd+S to save
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			handleSave();
		}
	}

	// Format last saved time
	function formatLastSaved(date: Date | null): string {
		if (!date) return 'Never saved';

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSecs = Math.floor(diffMs / 1000);

		if (diffSecs < 60) return 'Just now';
		if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} min ago`;
		if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;

		return date.toLocaleDateString();
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Header -->
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1">
			<h2 class="text-xl font-semibold text-gray-900 md:text-2xl">Add Your Personal Story</h2>
			<p class="mt-1 text-sm text-gray-600">
				Share why <strong>{templateTitle}</strong> matters to you
			</p>
		</div>

		<!-- Auto-save indicator -->
		<div class="flex items-center gap-2">
			{#if isAutoSaving}
				<Badge variant="success" size="sm" pulse={true}>Saving...</Badge>
			{:else if lastSaved}
				<span class="text-xs text-gray-500">
					Saved {formatLastSaved(lastSaved)}
				</span>
			{/if}
		</div>
	</div>

	<!-- Character count indicator -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 text-sm">
			<span class="text-gray-600">
				{charCount} / {maxChars} characters
			</span>
			{#if isOverLimit}
				<div class="flex items-center gap-1 text-red-600">
					<AlertCircle class="h-4 w-4" aria-hidden="true" />
					<span class="font-medium">
						{Math.abs(remainingChars)} over limit
					</span>
				</div>
			{:else if remainingChars < 50}
				<span class="font-medium text-amber-600">
					{remainingChars} left
				</span>
			{/if}
		</div>
	</div>

	<!-- Editor textarea -->
	<div class="relative">
		<textarea
			bind:value={personalStory}
			onkeydown={handleKeydown}
			placeholder="Example: This issue affects my community because..."
			class="min-h-[200px] w-full resize-y rounded-lg border px-4 py-3 text-base focus:outline-none focus:ring-2"
			class:border-gray-300={!isOverLimit}
			class:focus:border-congressional-500={!isOverLimit}
			class:focus:ring-congressional-500={!isOverLimit}
			class:border-red-300={isOverLimit}
			class:focus:border-red-500={isOverLimit}
			class:focus:ring-red-500={isOverLimit}
			aria-label="Personal story"
			aria-describedby="char-count-desc"
			data-testid="template-editor-textarea"
		></textarea>

		<!-- Screen reader helper -->
		<div id="char-count-desc" class="sr-only" aria-live="polite" aria-atomic="true">
			{charCount} of {maxChars} characters used. {remainingChars} characters remaining.
		</div>
	</div>

	<!-- Guidelines -->
	<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
		<h3 class="text-sm font-medium text-blue-900">Writing Tips</h3>
		<ul class="mt-2 space-y-1 text-sm text-blue-700">
			<li>• Be specific about how this issue affects you or your community</li>
			<li>• Share personal experiences that make your message authentic</li>
			<li>• Keep it concise and focused (max {maxChars} characters)</li>
			<li>• Your personal story will be added to the template message</li>
		</ul>
	</div>

	<!-- Action buttons -->
	<div class="flex items-center justify-between gap-3">
		<button
			type="button"
			onclick={handleReset}
			class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={!personalStory}
			aria-label="Clear personal story"
		>
			<RotateCcw class="h-4 w-4" aria-hidden="true" />
			Clear
		</button>

		<button
			type="button"
			onclick={handleSave}
			class="flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
			class:bg-congressional-500={!isOverLimit}
			class:hover:bg-congressional-600={!isOverLimit}
			class:bg-red-500={isOverLimit}
			class:hover:bg-red-600={isOverLimit}
			disabled={!personalStory || isOverLimit}
			aria-label="Save personal story"
			data-testid="template-editor-save-button"
		>
			<Save class="h-4 w-4" aria-hidden="true" />
			{isOverLimit ? 'Shorten to Save' : 'Save & Continue'}
		</button>
	</div>

	<!-- Keyboard shortcut hint -->
	<p class="text-center text-xs text-gray-500">
		Press <kbd class="rounded bg-gray-100 px-2 py-0.5">Ctrl+S</kbd> or
		<kbd class="rounded bg-gray-100 px-2 py-0.5">⌘S</kbd> to save
	</p>
</div>
