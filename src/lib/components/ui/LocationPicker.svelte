<script lang="ts">
	/**
	 * LocationPicker: Autocomplete search for geographic scopes
	 *
	 * Converts natural language search ("San Francisco") to structured GeoScope
	 * with ISO codes. Recognition over recall - users think in places, not codes.
	 *
	 * BEHAVIOR:
	 * - Debounced search (300ms) to respect Nominatim rate limits
	 * - Keyboard navigation (arrows, enter, escape)
	 * - "Worldwide" option always available
	 * - Click outside closes dropdown
	 * - Loading state during API calls
	 *
	 * ACCESSIBILITY:
	 * - Full keyboard support
	 * - ARIA labels and roles
	 * - Focus management
	 */

	import { searchLocations, type LocationHierarchy } from '$lib/core/location/geocoding-api';
	import { resolveToGeoScope } from '$lib/core/location/location-resolver';
	import type { GeoScope } from '$lib/core/agents/types';
	import { Search, Globe, Loader2, X } from '@lucide/svelte';
	import { browser } from '$app/environment';

	interface Props {
		value: GeoScope | null;
		onSelect: (scope: GeoScope) => void;
		placeholder?: string;
	}

	let { value, onSelect, placeholder = 'Search for a location...' }: Props = $props();

	// Component state
	let query = $state('');
	let results = $state<LocationHierarchy[]>([]);
	let isSearching = $state(false);
	let isOpen = $state(false);
	let selectedIndex = $state(-1); // -1 = "Worldwide", 0+ = results
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Refs for focus and click-outside management
	let containerRef: HTMLDivElement | null = $state(null);
	let inputRef: HTMLInputElement | null = $state(null);

	// Derived state: combined options (Worldwide + results)
	const allOptions = $derived([
		{ type: 'worldwide' as const },
		...results.map((r) => ({ type: 'location' as const, data: r }))
	]);

	// Debounced search handler
	function handleInput() {
		// Clear existing timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Empty or too short - clear results
		if (query.length < 2) {
			results = [];
			isSearching = false;
			selectedIndex = -1;
			return;
		}

		// Set new debounce timer (300ms)
		isSearching = true;
		debounceTimer = setTimeout(async () => {
			try {
				const searchResults = await searchLocations(query);
				results = searchResults;
				selectedIndex = 0; // Auto-select first result
			} catch (error) {
				console.error('[LocationPicker] Search failed:', error);
				results = [];
			} finally {
				isSearching = false;
			}
		}, 300);
	}

	// Handle result selection
	function handleSelect(option: (typeof allOptions)[number]) {
		if (option.type === 'worldwide') {
			onSelect({ type: 'international' });
		} else {
			const scope = resolveToGeoScope(option.data);
			onSelect(scope);
		}
		closeDropdown();
	}

	// Handle worldwide selection
	function selectWorldwide() {
		onSelect({ type: 'international' });
		closeDropdown();
	}

	// Open dropdown and focus input
	function openDropdown() {
		isOpen = true;
		selectedIndex = -1;
		setTimeout(() => inputRef?.focus(), 0);
	}

	// Close dropdown and clear state
	function closeDropdown() {
		isOpen = false;
		query = '';
		results = [];
		selectedIndex = -1;
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	}

	// Keyboard navigation
	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) return;

		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				closeDropdown();
				break;

			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, allOptions.length - 1);
				break;

			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				break;

			case 'Enter':
				e.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < allOptions.length) {
					handleSelect(allOptions[selectedIndex]);
				}
				break;
		}
	}

	// Click outside to close
	function handleClickOutside(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			closeDropdown();
		}
	}

	// Attach click-outside listener (browser only for SSR safety)
	$effect(() => {
		if (browser && isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});

	// Cleanup timeout on unmount
	$effect(() => {
		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
		};
	});
</script>

<div bind:this={containerRef} class="relative inline-block">
	<!-- Search Input - compact to fit inline metadata contexts -->
	<div class="relative">
		<div class="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2">
			{#if isSearching}
				<Loader2 class="h-3 w-3 animate-spin text-slate-400" />
			{:else}
				<Search class="h-3 w-3 text-slate-400" />
			{/if}
		</div>

		<input
			bind:this={inputRef}
			type="text"
			bind:value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={openDropdown}
			{placeholder}
			class="w-32 rounded border border-slate-200 px-5 py-0.5 text-xs text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
			autocomplete="off"
			spellcheck="false"
			aria-label="Search for a location"
			aria-haspopup="listbox"
			aria-expanded={isOpen}
		/>

		{#if query.length > 0}
			<button
				onclick={() => {
					query = '';
					results = [];
					inputRef?.focus();
				}}
				class="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
				aria-label="Clear search"
			>
				<X class="h-3 w-3" />
			</button>
		{/if}
	</div>

	<!-- Dropdown Results - wider than input to show full location names -->
	{#if isOpen}
		<div
			class="absolute left-0 top-full z-50 mt-1 min-w-[240px] rounded border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
		>
			<ul role="listbox" class="max-h-56 overflow-y-auto py-0.5">
				<!-- Worldwide Option (always available) -->
				<li
					role="option"
					aria-selected={selectedIndex === -1}
					tabindex={selectedIndex === -1 ? 0 : -1}
					onclick={selectWorldwide}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							selectWorldwide();
						}
					}}
					class="group flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs transition-colors"
					class:bg-blue-50={selectedIndex === -1}
					class:text-blue-900={selectedIndex === -1}
					class:hover:bg-slate-50={selectedIndex !== -1}
				>
					<Globe
						class="h-3 w-3 flex-shrink-0 {selectedIndex === -1 ? 'text-blue-600' : 'text-slate-400'}"
					/>
					<span class="font-medium text-slate-900">Worldwide</span>
				</li>

				<!-- Divider -->
				{#if results.length > 0}
					<li class="my-0.5 border-t border-slate-100"></li>
				{/if}

				<!-- Search Results -->
				{#if isSearching && results.length === 0}
					<!-- Loading State -->
					<li class="flex items-center justify-center gap-2 px-2 py-3 text-xs text-slate-500">
						<Loader2 class="h-3 w-3 animate-spin text-slate-400" />
						<span>Searching...</span>
					</li>
				{:else if results.length === 0 && query.length >= 2}
					<!-- No Results -->
					<li class="px-2 py-3 text-center text-xs text-slate-500">
						No locations found
					</li>
				{:else if results.length === 0}
					<!-- Empty State (no query yet) -->
					<li class="px-2 py-2 text-center text-xs text-slate-400">
						Type to search locations
					</li>
				{:else}
					<!-- Results List -->
					{#each results as result, i}
						{@const adjustedIndex = i + 1} <!-- +1 because "Worldwide" is index 0 -->
						<li
							role="option"
							aria-selected={selectedIndex === adjustedIndex}
							tabindex={selectedIndex === adjustedIndex ? 0 : -1}
							onclick={() => handleSelect({ type: 'location', data: result })}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleSelect({ type: 'location', data: result });
								}
							}}
							class="cursor-pointer px-2 py-1.5 text-xs transition-colors"
							class:bg-blue-50={selectedIndex === adjustedIndex}
							class:text-blue-900={selectedIndex === adjustedIndex}
							class:hover:bg-slate-50={selectedIndex !== adjustedIndex}
						>
							<!-- Compact: primary name, then context -->
							<div class="font-medium text-slate-900">
								{#if result.city}
									{result.city.name}{#if result.state}, {result.state.code || result.state.name}{/if}
								{:else if result.state}
									{result.state.name}, {result.country.name}
								{:else}
									{result.country.name}
								{/if}
							</div>
						</li>
					{/each}
				{/if}
			</ul>
		</div>
	{/if}
</div>
