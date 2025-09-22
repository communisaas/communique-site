<script lang="ts">
	import { AlertCircle } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		loading: boolean;
		error?: string | null;
		skeleton?: Snippet;
		errorMessage?: string;
		retryAction?: () => void;
		children: Snippet;
		minLoadTime?: number;
		fadeIn?: boolean;
	}

	let {
		loading,
		error = null,
		skeleton,
		errorMessage = 'Something went wrong',
		retryAction,
		children,
		minLoadTime = 0,
		fadeIn = true
	}: Props = $props();

	let showContent = $state(!loading);
	let minLoadTimeElapsed = $state(!minLoadTime);

	// Handle minimum load time for smooth transitions
	$effect(() => {
		if (loading && minLoadTime > 0) {
			minLoadTimeElapsed = false;
			const timer = setTimeout(() => {
				minLoadTimeElapsed = true;
			}, minLoadTime);

			return () => clearTimeout(timer);
		} else {
			minLoadTimeElapsed = true;
		}
	});

	$effect(() => {
		showContent = !loading && minLoadTimeElapsed;
	});
</script>

{#if loading && !minLoadTimeElapsed}
	{#if skeleton}
		<!-- Custom skeleton loader -->
		{@render skeleton()}
	{:else}
		<!-- Default loading state -->
		<div class="flex items-center justify-center py-8">
			<div class="h-8 w-8 text-blue-600">
				<svg class="animate-spin" fill="none" viewBox="0 0 24 24">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="2"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			</div>
			<span class="ml-3 text-slate-600">Loading...</span>
		</div>
	{/if}
{:else if error}
	<!-- Error state -->
	<div class="rounded-lg border border-red-200 bg-red-50 p-6">
		<div class="flex items-start gap-3">
			<AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
			<div class="flex-1">
				<h3 class="font-semibold text-red-900">{errorMessage}</h3>
				{#if error !== errorMessage}
					<p class="mt-1 text-sm text-red-700">{error}</p>
				{/if}
				{#if retryAction}
					<button
						onclick={retryAction}
						class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
					>
						Try Again
					</button>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<!-- Content -->
	<div class="loading-content" class:fade-in={fadeIn && showContent}>
		{@render children()}
	</div>
{/if}

<style>
	.loading-content {
		@apply transition-opacity duration-300;
	}

	.loading-content.fade-in {
		animation: fadeIn 0.3s ease-out;
	}

	@keyframes fadeIn {
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
