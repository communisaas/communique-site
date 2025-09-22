<script lang="ts">
	import { Link2, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from '@lucide/svelte';
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/stores';
	import type { TemplateCreationContext } from '$lib/types/template';

	interface Props {
		title?: string;
		slug?: string;
		context?: TemplateCreationContext | undefined;
	}

	let { title = '', slug = $bindable(''), context = undefined }: Props = $props();

	const _dispatch = createEventDispatcher();

	let __isChecking = false;
	let isAvailable: boolean | null = $state(null);
	let suggestions: string[] = $state([]);
	let customSlug = $state('');
	let showCustomInput = $state(false);

	// Generate slug from title
	function slugify(text: string): string {
		return text
			.toString()
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^\w-]+/g, '')
			.replace(/--+/g, '-')
			.replace(/^-+/, '')
			.replace(/-+$/, '');
	}

	// Generate creative variations
	function generateSuggestions(baseSlug: string): string[] {
		const variations = [];

		// Action-oriented prefixes
		const actionPrefixes = ['act', 'support', 'defend', 'protect', 'save', 'help'];
		const randomPrefix = actionPrefixes[Math.floor(Math.random() * actionPrefixes.length)];
		variations.push(`${randomPrefix}-${baseSlug}`);

		// Year suffix for campaigns
		const year = new Date().getFullYear();
		variations.push(`${baseSlug}-${year}`);

		// Shortened version
		const words = baseSlug.split('-');
		if (words.length > 3) {
			variations.push(words.slice(0, 3).join('-'));
		}

		// Acronym version if multi-word
		if (words.length > 1) {
			const acronym = words.map((w) => w[0]).join('');
			variations.push(`${acronym}-campaign`);
		}

		return variations.slice(0, 3);
	}

	// Check slug availability
	async function checkAvailability(slugToCheck: string) {
		__isChecking = true;
		isAvailable = null;

		try {
			// Convert channelId to deliveryMethod for API
			const deliveryMethod =
				context?.channelId === 'certified'
					? 'cwc'
					: context?.channelId === 'cwc'
						? 'cwc'
						: 'direct';

			const params = new URLSearchParams({
				slug: slugToCheck,
				...(title && { title }),
				deliveryMethod
			});

			const { api } = await import('$lib/core/api/client');
			const result = await api.get(`/templates/check-slug?${params}`);
			if (!result.success) throw new Error(result.error);
			const data = result.data as { available: boolean; suggestions?: string[] };
			isAvailable = data.available;

			if (!isAvailable && slugToCheck === slug) {
				// Use server-provided suggestions that are guaranteed to be available
				suggestions = data.suggestions || [];
			} else if (isAvailable && slugToCheck === slug) {
				// Clear suggestions if slug is available
				suggestions = [];
			}
		} catch (error) {
			/* Ignore slug check errors - slug availability remains unknown */
		} finally {
			__isChecking = false;
		}
	}

	// Update slug when title changes
	$effect(() => {
		if (title) {
			const newSlug = slugify(title);
			if (newSlug !== slug && !customSlug) {
				slug = newSlug;
				checkAvailability(slug);
			}
		}
	});

	// Handle custom slug input
	function handleCustomSlug() {
		if (customSlug) {
			slug = slugify(customSlug);
			checkAvailability(slug);
			showCustomInput = false;
			customSlug = '';
		}
	}

	// Regenerate suggestions by fetching from server
	async function regenerateSuggestions() {
		if (!title) return;

		try {
			// Convert channelId to deliveryMethod for API
			const deliveryMethod =
				context?.channelId === 'certified'
					? 'cwc'
					: context?.channelId === 'cwc'
						? 'cwc'
						: 'direct';

			const params = new URLSearchParams({
				slug: slug,
				title: title,
				deliveryMethod
			});

			const { api } = await import('$lib/core/api/client');
			const result = await api.get(`/templates/check-slug?${params}`);
			if (!result.success) throw new Error(result.error);
			const data = result.data as { available: boolean; suggestions?: string[] };

			if (!data.available) {
				suggestions = data.suggestions || [];
			}
		} catch (error) {
			// Fallback to client-side generation if server fails
			suggestions = generateSuggestions(slug);
		}
	}

	// Select a suggestion
	function selectSuggestion(suggestion: string) {
		slug = suggestion;
		checkAvailability(slug);
		// Don't clear suggestions here - let checkAvailability handle it
	}

	// Full URL for preview using dynamic hostname
	const _fullUrl = $derived(`${$page.url.origin}/${slug}`);
	const isValidSlug = $derived(slug.length > 0 && /^[a-z0-9-]+$/.test(slug));
</script>

<div class="space-y-2 md:space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<label class="flex items-center gap-1 text-xs font-medium text-slate-700 md:gap-2 md:text-sm">
			<Link2 class="h-3 w-3 md:h-4 md:w-4" />
			Campaign Link
		</label>
		{#if isAvailable === true}
			<span class="flex items-center gap-1 text-xs text-green-600 md:text-xs" in:fade>
				<CheckCircle2 class="h-3 w-3 md:h-3 md:w-3" />
				Available
			</span>
		{:else if isAvailable === false}
			<span class="flex items-center gap-1 text-xs text-amber-600 md:text-xs" in:fade>
				<AlertCircle class="h-3 w-3 md:h-3 md:w-3" />
				Already taken
			</span>
		{/if}
	</div>

	<!-- URL Preview -->
	<div class="rounded border border-slate-200 bg-slate-50 p-1.5 md:p-3">
		<div class="flex items-center gap-1 font-mono text-xs md:gap-2 md:text-sm">
			<span class="break-all text-slate-500">{$page.url.origin}/</span>
			<span class="font-semibold text-slate-900">{slug || 'your-campaign'}</span>
		</div>
	</div>

	<!-- Validation Messages -->
	{#if slug && !isValidSlug}
		<p class="text-xs text-red-600 md:text-xs">
			Links can only contain lowercase letters, numbers, and hyphens
		</p>
	{/if}

	<!-- Suggestions when slug is taken -->
	{#if isAvailable === false && suggestions.length > 0}
		<div class="space-y-1 md:space-y-2" in:fly={{ y: 10, duration: 200 }}>
			<p class="text-xs text-slate-600 md:text-xs">Try one of these alternatives:</p>
			<div class="flex flex-wrap gap-1 md:gap-2">
				{#each suggestions as suggestion}
					<button
						type="button"
						onclick={() => selectSuggestion(suggestion)}
						class="inline-flex items-center gap-1 rounded-full bg-participation-primary-50 px-2 py-1 text-xs font-medium text-participation-primary-700 transition-colors hover:bg-participation-primary-100 md:gap-1 md:px-3 md:py-1 md:text-xs"
					>
						<Sparkles class="h-3 w-3 md:h-3 md:w-3" />
						{suggestion}
					</button>
				{/each}
				<button
					type="button"
					onclick={regenerateSuggestions}
					class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 md:gap-1 md:px-3 md:py-1 md:text-xs"
				>
					<RefreshCw class="h-3 w-3 md:h-3 md:w-3" />
					More
				</button>
			</div>
		</div>
	{/if}

	<!-- Custom slug input -->
	{#if showCustomInput}
		<div class="flex gap-1 md:gap-2" in:fly={{ y: -10, duration: 200 }}>
			<input
				type="text"
				bind:value={customSlug}
				onkeydown={(e) => e.key === 'Enter' && handleCustomSlug()}
				placeholder="enter-custom-link"
				class="flex-1 rounded border-slate-300 px-2 py-1 text-xs shadow-sm focus:border-participation-primary-500 focus:ring-participation-primary-500 md:text-sm"
			/>
			<button
				type="button"
				onclick={handleCustomSlug}
				class="rounded bg-participation-primary-600 px-2 py-1 text-xs text-white hover:bg-participation-primary-700 md:px-3 md:text-sm"
			>
				Set
			</button>
			<button
				type="button"
				onclick={() => (showCustomInput = false)}
				class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 md:px-3 md:text-sm"
			>
				Cancel
			</button>
		</div>
	{:else}
		<button
			type="button"
			onclick={() => (showCustomInput = true)}
			class={isAvailable === false
				? 'rounded bg-participation-primary-600 px-3 py-1.5 text-xs text-white hover:bg-participation-primary-700'
				: 'text-xs text-participation-primary-600 hover:text-participation-primary-700 md:text-xs'}
		>
			{isAvailable === false ? 'Create Custom Link' : 'Customize link'}
		</button>
	{/if}

	<!-- Share Context -->
	<div
		class="rounded bg-participation-primary-50 p-2 text-xs text-participation-primary-700 md:p-3"
	>
		<p>Anyone with this link can instantly use your template. Share it.</p>
	</div>
</div>
