<script lang="ts">
	import { templateStore } from '$lib/stores/templates';
	import { onMount } from 'svelte';
	import '../app.css';
	import Footer from '$lib/components/layout/Footer.svelte';

	let { children, data } = $props();

	// Progressive enhancement: Initialize with static data immediately, then fetch from API
	onMount(() => {
		// Initialize with static data for immediate render
		templateStore.initializeWithStaticData();

		// Then fetch fresh data from API (will auto-replace static data)
		templateStore.fetchTemplates();
	});
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-10">
	{@render children()}
	<Footer />
</div>
