<script lang="ts">
	import '../../../app.css';
	import { page } from '$app/stores';
	import ErrorBoundary from '$lib/components/error/ErrorBoundary.svelte';
	import { coordinated } from '$lib/utils/timerCoordinator';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let {
		children,
		data
	}: {
		children: Snippet;
		data: LayoutData;
	} = $props();

	let _showCopied = $state(false);
	let showShareMenu = $state(false);

	const shareUrl = $derived($page.url.href);
	const template = $derived(data.template);

	const componentId = 'TemplateLayout_' + Math.random().toString(36).substr(2, 9);

	function _copyLink() {
		navigator.clipboard.writeText(shareUrl);
		_showCopied = true;
		coordinated.setTimeout(() => (_showCopied = false), 2000, 'feedback', componentId);
	}

	function _shareOnSocial(platform: 'twitter' | 'facebook' | 'linkedin') {
		const text = `Check out "${template?.title}" on Communiqué`;
		const encodedUrl = encodeURIComponent(shareUrl);
		const encodedText = encodeURIComponent(text);

		const urls = {
			twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
			facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
			linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
		};

		window.open(urls[platform], '_blank');
		showShareMenu = false;
	}
</script>

<!-- Template layout - header handled by parent layout -->
<main class="mx-auto max-w-4xl px-4 sm:px-6">
	<ErrorBoundary fallback="detailed" showRetry={true}>
		{@render children()}
	</ErrorBoundary>
</main>

<!-- Click outside to close share menu -->
{#if showShareMenu}
	<div
		class="fixed inset-0 z-0"
		onclick={() => (showShareMenu = false)}
		onkeydown={(e) => {
			if (e.key === 'Escape') showShareMenu = false;
		}}
		role="button"
		tabindex="-1"
		aria-label="Close share menu"
	></div>
{/if}
