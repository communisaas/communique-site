<script lang="ts">
	import { Link2, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from '@lucide/svelte';
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/stores';

	interface Props {
		title?: string;
		slug?: string;
		context?: { channelId: 'certified' | 'direct' } | undefined;
	}

	let { title = '', slug = $bindable(''), context = undefined }: Props = $props();

	const dispatch = createEventDispatcher();

	let isChecking = false;
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
			.replace(/[^\w\-]+/g, '')
			.replace(/\-\-+/g, '-')
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
		isChecking = true;
		isAvailable = null;

		try {
			// Convert channelId to deliveryMethod for API
			const deliveryMethod = context?.channelId === 'certified' ? 'both' : 'email';

			const params = new URLSearchParams({
				slug: slugToCheck,
				...(title && { title }),
				deliveryMethod
			});

			const { api } = await import('$lib/core/api/client');
			const result = await api.get(`/api/templates/check-slug?${params}`);
			if (!result.success) throw new Error(result.error);
			const data = result.data;
			isAvailable = data.available;

			if (!isAvailable && slugToCheck === slug) {
				// Use server-provided suggestions that are guaranteed to be available
				suggestions = data.suggestions || [];
			} else if (isAvailable && slugToCheck === slug) {
				// Clear suggestions if slug is available
				suggestions = [];
			}
		} catch (error) {
		} finally {
			isChecking = false;
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
			const deliveryMethod = context?.channelId === 'certified' ? 'both' : 'email';

			const params = new URLSearchParams({
				slug: slug,
				title: title,
				deliveryMethod
			});

			const { api } = await import('$lib/core/api/client');
			const result = await api.get(`/api/templates/check-slug?${params}`);
			if (!result.success) throw new Error(result.error);
			const data = result.data;

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
	const fullUrl = $derived(`${$page.url.origin}/${slug}`);
	const isValidSlug = $derived(slug.length > 0 && /^[a-z0-9-]+$/.test(slug));
</script>

<div class="space-y-2 md:space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<label class="flex items-center gap-1 md:gap-2 text-[10px] md:text-sm font-medium text-slate-700">
			<Link2 class="h-2.5 md:h-4 w-2.5 md:w-4" />
			Campaign Link
		</label>
		{#if isAvailable === true}
			<span class="flex items-center gap-1 text-[9px] md:text-xs text-green-600" in:fade>
				<CheckCircle2 class="h-2 md:h-3 w-2 md:w-3" />
				Available
			</span>
		{:else if isAvailable === false}
			<span class="flex items-center gap-1 text-[9px] md:text-xs text-amber-600" in:fade>
				<AlertCircle class="h-2 md:h-3 w-2 md:w-3" />
				Already taken
			</span>
		{/if}
	</div>

	<!-- URL Preview -->
	<div class="rounded border border-slate-200 bg-slate-50 p-1.5 md:p-3">
		<div class="flex items-center gap-0.5 md:gap-2 font-mono text-[9px] md:text-sm">
			<span class="text-slate-500 break-all">{$page.url.origin}/</span>
			<span class="font-semibold text-slate-900">{slug || 'your-campaign'}</span>
		</div>
	</div>

	<!-- Validation Messages -->
	{#if slug && !isValidSlug}
		<p class="text-[9px] md:text-xs text-red-600">
			Links can only contain lowercase letters, numbers, and hyphens
		</p>
	{/if}

	<!-- Suggestions when slug is taken -->
	{#if isAvailable === false && suggestions.length > 0}
		<div class="space-y-1 md:space-y-2" in:fly={{ y: 10, duration: 200 }}>
			<p class="text-[9px] md:text-xs text-slate-600">Try one of these alternatives:</p>
			<div class="flex flex-wrap gap-1 md:gap-2">
				{#each suggestions as suggestion}
					<button
						type="button"
						onclick={() => selectSuggestion(suggestion)}
						class="inline-flex items-center gap-0.5 md:gap-1 rounded-full bg-blue-50 px-1.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
					>
						<Sparkles class="h-2 md:h-3 w-2 md:w-3" />
						{suggestion}
					</button>
				{/each}
				<button
					type="button"
					onclick={regenerateSuggestions}
					class="inline-flex items-center gap-0.5 md:gap-1 rounded-full bg-slate-100 px-1.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
				>
					<RefreshCw class="h-2 md:h-3 w-2 md:w-3" />
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
				class="flex-1 rounded border-slate-300 text-xs md:text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1 px-2"
			/>
			<button
				type="button"
				onclick={handleCustomSlug}
				class="rounded bg-blue-600 px-2 md:px-3 py-1 text-xs md:text-sm text-white hover:bg-blue-700"
			>
				Set
			</button>
			<button
				type="button"
				onclick={() => (showCustomInput = false)}
				class="rounded border border-slate-300 bg-white px-2 md:px-3 py-1 text-xs md:text-sm text-slate-600 hover:bg-slate-50"
			>
				Cancel
			</button>
		</div>
	{:else}
		<button
			type="button"
			onclick={() => (showCustomInput = true)}
			class="text-[9px] md:text-xs text-blue-600 hover:text-blue-700"
		>
			Customize link
		</button>
	{/if}

	<!-- Info box -->
	<div class="rounded bg-blue-50 p-2 md:p-3 text-[9px] md:text-xs text-blue-700">
		<p>Anyone with this link can instantly use your template. Share it.</p>
	</div>
</div>
