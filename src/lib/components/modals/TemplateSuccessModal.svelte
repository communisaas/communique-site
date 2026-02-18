<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { CheckCircle, Clock, Share2, LayoutDashboard, X } from '@lucide/svelte';
	import type { Template } from '$lib/types/template';

	let {
		template,
		onclose,
		ondashboard
	}: {
		template: Template;
		onclose?: () => void;
		ondashboard?: () => void;
	} = $props();

	let copied = $state(false);
	let shareUrl = $derived(
		`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${template.slug}`
	);

	// Share message matching TemplateModal's medium format
	let shareMessage = $derived(
		(() => {
			const actionCount = template.metrics?.sent || 0;
			const category = template.category?.toLowerCase() || 'advocacy';
			return `Coordinating on ${category}.\n\n"${template.title}"\n\n${actionCount > 0 ? `${actionCount.toLocaleString()} people already sent. ` : ''}Takes 2 minutes: ${shareUrl}`;
		})()
	);

	// State-aware derived values for perceptual clarity
	let isPublished = $derived(template.status === 'published' && template.is_public);
	let isDraft = $derived(template.status === 'draft' || !template.is_public);
	let hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

	function handleClose() {
		onclose?.();
	}

	async function handleShare() {
		const shareData = {
			title: template.title,
			text: shareMessage,
			url: shareUrl
		};

		if (
			typeof navigator !== 'undefined' &&
			navigator.share &&
			navigator.canShare?.(shareData)
		) {
			try {
				await navigator.share(shareData);
			} catch (err) {
				if (err instanceof Error && err.name !== 'AbortError') {
					console.error('[Share] Native share failed:', err);
				}
			}
		} else {
			copyToClipboard();
		}
	}

	function copyToClipboard() {
		if (typeof navigator !== 'undefined') {
			navigator.clipboard.writeText(shareUrl).then(() => {
				copied = true;
				setTimeout(() => (copied = false), 2000);
			});
		}
	}

	function handleDashboard() {
		ondashboard?.();
		window.location.href = '/';
	}

	function handleViewTemplate() {
		window.open(shareUrl, '_blank');
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
	onclick={handleClose}
	onkeydown={(e) => {
		if (e.key === 'Escape') handleClose();
		if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
			handleClose();
		}
	}}
	role="dialog"
	aria-modal="true"
	aria-label="Template created successfully"
	tabindex="0"
	in:fade={{ duration: 200 }}
	out:fade={{ duration: 150 }}
>
	<div
		class="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
		role="document"
		onclick={(e) => e.stopPropagation()}
		in:scale={{
			duration: 300,
			start: 0.9,
			opacity: 0.5
		}}
	>
		<!-- Close button -->
		<button
			onclick={handleClose}
			class="absolute right-4 top-4 z-10 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
			aria-label="Close"
		>
			<X class="h-5 w-5" />
		</button>

		<!-- State-Aware Header -->
		<div
			class="px-6 pb-6 pt-8 text-center {isPublished
				? 'bg-gradient-to-br from-emerald-50 to-blue-50'
				: 'bg-gradient-to-br from-amber-50 to-orange-50'}"
		>
			<div
				class="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg"
				in:scale={{ duration: 600, delay: 200, start: 0 }}
			>
				{#if isPublished}
					<CheckCircle class="h-12 w-12 text-emerald-500" />
				{:else}
					<Clock class="h-12 w-12 text-amber-500" />
				{/if}
			</div>
			{#if isPublished}
				<h2 class="mb-2 text-2xl font-bold text-slate-900">Template Published!</h2>
				<p class="text-slate-600">Your template is live and ready to share</p>
			{:else}
				<h2 class="mb-2 text-2xl font-bold text-slate-900">Template Saved as Draft</h2>
				<p class="text-slate-600">
					Content is being reviewed. You'll be notified when it's published.
				</p>
			{/if}
		</div>

		<!-- Template Preview -->
		<div class="px-6 pb-4 pt-5">
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<h3 class="mb-1 font-semibold text-slate-900">
					{template.title}
				</h3>
				<p class="line-clamp-2 text-sm text-slate-600">
					{template.description || template.preview}
				</p>
				<div class="mt-3 flex items-center gap-2">
					<span
						class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
					>
						{template.category || 'General'}
					</span>
					<span
						class="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
					>
						{template.deliveryMethod === 'cwc' ? 'Congressional' : 'Direct'}
					</span>
				</div>
			</div>
		</div>

		{#if isPublished}
			<!-- Primary: Share Button -->
			<div class="px-6 pb-2 pt-1">
				<button
					onclick={handleShare}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-participation-primary-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-participation-primary-700 active:scale-95"
				>
					<Share2 class="h-5 w-5" />
					<span>{hasNativeShare ? 'Share template' : 'Copy share message'}</span>
				</button>
			</div>

			<!-- Tertiary: URL display with copy link -->
			<div class="px-6 pb-4">
				<div class="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
					<span class="flex-1 truncate font-mono text-xs text-slate-500">
						{shareUrl}
					</span>
					{#if copied}
						<span class="text-xs font-medium text-emerald-600" in:fade>Copied!</span>
					{:else}
						<button
							onclick={copyToClipboard}
							class="flex-shrink-0 text-xs font-medium text-participation-primary-600 hover:text-participation-primary-700"
						>
							Copy URL
						</button>
					{/if}
				</div>
			</div>

			<!-- Warm closing note -->
			<div class="px-6 pb-3 pt-1">
				<p class="text-center text-sm leading-relaxed text-slate-500">
					Every template starts with someone willing to share. Your voice can inspire others
					to act.
				</p>
			</div>

			<!-- Secondary: single text link -->
			<div class="flex justify-center px-6 pb-6">
				<button
					onclick={handleViewTemplate}
					class="text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 hover:decoration-slate-500"
				>
					View template
				</button>
			</div>
		{:else}
			<!-- Draft: Explain what's happening -->
			<div class="px-6 pb-4">
				<div class="rounded-lg bg-amber-50 p-4">
					<p class="text-sm font-medium text-amber-800">Why is my template a draft?</p>
					<p class="mt-1 text-sm text-amber-700">
						Our automated review couldn't verify the content. This usually resolves within
						a few minutes. Check your dashboard for updates.
					</p>
				</div>
			</div>

			<!-- Draft: Primary action -->
			<div class="px-6 pb-2">
				<button
					onclick={handleDashboard}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-participation-primary-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-participation-primary-700 active:scale-95"
				>
					<LayoutDashboard class="h-5 w-5" />
					Go to Dashboard
				</button>
			</div>

			<!-- Draft: What happens next (prose, not bullets) -->
			<div class="px-6 pb-3 pt-1">
				<p class="text-xs font-medium text-amber-800">What happens next</p>
				<p class="mt-1.5 text-xs leading-relaxed text-amber-700">
					Your template is being reviewed automatically. Most reviews complete within a few
					minutes — check your dashboard for updates.
				</p>
			</div>

			<!-- Draft: Secondary link -->
			<div class="flex justify-center px-6 pb-6">
				<button
					onclick={handleViewTemplate}
					class="text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700 hover:decoration-slate-500"
				>
					Preview draft
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
