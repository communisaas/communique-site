<script lang="ts">
	import { templateStore } from '$lib/stores/templates';
	import { onMount } from 'svelte';
	import { User, LogOut } from '@lucide/svelte';
	import '../app.css';
	import Footer from '$lib/components/layout/Footer.svelte';
	import ErrorBoundary from '$lib/components/error/ErrorBoundary.svelte';

	let { children, data } = $props();

	// Fetch templates from API
	onMount(() => {
		templateStore.fetchTemplates();
	});
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
	<!-- Simple Header with Auth Status -->
	{#if data.user}
		<div class="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
			<div class="mx-auto max-w-7xl px-6 py-3">
				<div class="flex items-center justify-between">
					<div class="text-sm text-slate-600">
						<span class="hidden sm:inline">Welcome back, </span>{data.user.name?.split(' ')[0] || 'User'}!
					</div>
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-1.5 text-xs text-green-600">
							<User class="h-3 w-3" />
							<span class="hidden sm:inline">Signed in</span>
						</div>
						<a 
							href="/auth/logout" 
							class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
							title="Sign out"
						>
							<LogOut class="h-3 w-3" />
							<span class="hidden sm:inline">Sign out</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}
	
	<div class="p-6 md:p-10">
		<ErrorBoundary fallback="detailed" showRetry={true}>
			{@render children()}
		</ErrorBoundary>
	</div>
	<Footer />
</div>
