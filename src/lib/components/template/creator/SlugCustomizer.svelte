<script lang="ts">
	import { Link2, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from '@lucide/svelte';
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/stores';
	
	export let title: string = '';
	export let slug: string = '';
	export let context: { channelId: 'certified' | 'direct' } | undefined = undefined;
	
	const dispatch = createEventDispatcher();
	
	let isChecking = false;
	let isAvailable: boolean | null = null;
	let suggestions: string[] = [];
	let customSlug = '';
	let showCustomInput = false;
	
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
			const acronym = words.map(w => w[0]).join('');
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
			
			const response = await fetch(`/api/templates/check-slug?${params}`);
			const data = await response.json();
			isAvailable = data.available;
			
			if (!isAvailable && slugToCheck === slug) {
				// Use server-provided suggestions that are guaranteed to be available
				suggestions = data.suggestions || [];
			} else if (isAvailable && slugToCheck === slug) {
				// Clear suggestions if slug is available
				suggestions = [];
			}
		} catch (error) {
			console.error('Error checking slug:', error);
		} finally {
			isChecking = false;
		}
	}
	
	// Update slug when title changes
	$: if (title) {
		const newSlug = slugify(title);
		if (newSlug !== slug && !customSlug) {
			slug = newSlug;
			checkAvailability(slug);
		}
	}
	
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
			
			const response = await fetch(`/api/templates/check-slug?${params}`);
			const data = await response.json();
			
			if (!data.available) {
				suggestions = data.suggestions || [];
			}
		} catch (error) {
			console.error('Error regenerating suggestions:', error);
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
	$: fullUrl = `${$page.url.origin}/${slug}`;
	$: isValidSlug = slug.length > 0 && /^[a-z0-9-]+$/.test(slug);
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<label class="flex items-center gap-2 text-sm font-medium text-slate-700">
			<Link2 class="h-4 w-4" />
			Campaign Link
		</label>
		{#if isAvailable === true}
			<span class="flex items-center gap-1 text-xs text-green-600" in:fade>
				<CheckCircle2 class="h-3 w-3" />
				Available
			</span>
		{:else if isAvailable === false}
			<span class="flex items-center gap-1 text-xs text-amber-600" in:fade>
				<AlertCircle class="h-3 w-3" />
				Already taken
			</span>
		{/if}
	</div>
	
	<!-- URL Preview -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
		<div class="flex items-center gap-2 font-mono text-sm">
			<span class="text-slate-500">{$page.url.origin}/</span>
			<span class="font-semibold text-slate-900">{slug || 'your-campaign'}</span>
		</div>
	</div>
	
	<!-- Validation Messages -->
	{#if slug && !isValidSlug}
		<p class="text-xs text-red-600">
			Links can only contain lowercase letters, numbers, and hyphens
		</p>
	{/if}
	
	<!-- Suggestions when slug is taken -->
	{#if isAvailable === false && suggestions.length > 0}
		<div class="space-y-2" in:fly={{ y: 10, duration: 200 }}>
			<p class="text-xs text-slate-600">Try one of these alternatives:</p>
			<div class="flex flex-wrap gap-2">
				{#each suggestions as suggestion}
					<button
						type="button"
						on:click={() => selectSuggestion(suggestion)}
						class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
					>
						<Sparkles class="h-3 w-3" />
						{suggestion}
					</button>
				{/each}
				<button
					type="button"
					on:click={regenerateSuggestions}
					class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
				>
					<RefreshCw class="h-3 w-3" />
					More
				</button>
			</div>
		</div>
	{/if}
	
	<!-- Custom slug input -->
	{#if showCustomInput}
		<div class="flex gap-2" in:fly={{ y: -10, duration: 200 }}>
			<input
				type="text"
				bind:value={customSlug}
				on:keydown={(e) => e.key === 'Enter' && handleCustomSlug()}
				placeholder="enter-custom-link"
				class="flex-1 rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
			/>
			<button
				type="button"
				on:click={handleCustomSlug}
				class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
			>
				Set
			</button>
			<button
				type="button"
				on:click={() => showCustomInput = false}
				class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
			>
				Cancel
			</button>
		</div>
	{:else}
		<button
			type="button"
			on:click={() => showCustomInput = true}
			class="text-xs text-blue-600 hover:text-blue-700"
		>
			Customize link
		</button>
	{/if}
	
	<!-- Info box -->
	<div class="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
		<p class="font-medium mb-1">🔗 Direct Access Link</p>
		<p>Anyone with this link can instantly use your template. Share it on social media, in emails, or embed it on websites to maximize your campaign's reach.</p>
	</div>
</div>