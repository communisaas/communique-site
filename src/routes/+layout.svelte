<script lang="ts">
	import { templateStore } from '$lib/stores/templates';
	import { onMount } from 'svelte';
	import '../app.css';
	import Footer from '$lib/components/layout/Footer.svelte';

	let { children } = $props();

	// Initialize templates on app load
	onMount(() => {
		// Load templates from API
		templateStore.fetchTemplates();
	});
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-10">
	{@render children()}
	<Footer />
</div>
