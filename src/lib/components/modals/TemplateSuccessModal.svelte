<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import {
		CheckCircle,
		Share2,
		ExternalLink,
		PlusCircle,
		LayoutDashboard,
		Copy,
		X
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { Template } from '$lib/types/template';

	let {
		template,
		onclose
	}: {
		template: Template;
		onclose?: () => void;
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		dashboard: void;
		createAnother: void;
	}>();

	let copied = $state(false);
	let shareUrl = $derived(
		`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${template.slug}`
	);

	function handleClose() {
		onclose?.();
		dispatch('close');
	}

	function handleShare() {
		if (typeof navigator !== 'undefined' && navigator.share) {
			navigator.share({
				title: template.title,
				text: `Check out this advocacy template: ${template.title}`,
				url: shareUrl
			});
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
		dispatch('dashboard');
		window.location.href = '/';
	}

	function handleCreateAnother() {
		dispatch('createAnother');
		handleClose();
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

		<!-- Success Icon Animation -->
		<div class="bg-gradient-to-br from-emerald-50 to-blue-50 px-6 pb-6 pt-8 text-center">
			<div
				class="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg"
				in:scale={{ duration: 600, delay: 200, start: 0 }}
			>
				<CheckCircle class="h-12 w-12 text-emerald-500" />
			</div>
			<h2 class="mb-2 text-2xl font-bold text-slate-900">Template Created!</h2>
			<p class="text-slate-600">Your template is ready to share and make an impact</p>
		</div>

		<!-- Template Preview -->
		<div class="border-b border-slate-200 px-6 py-4">
			<div class="rounded-lg bg-slate-50 p-4">
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
						{template.deliveryMethod === 'certified' ? 'Congressional' : 'Direct'}
					</span>
				</div>
			</div>
		</div>

		<!-- Share Section -->
		<div class="border-b border-slate-200 px-6 py-4">
			<div class="mb-3 flex items-center justify-between">
				<span class="text-sm font-medium text-slate-700">Share your template</span>
				{#if copied}
					<span class="text-xs font-medium text-emerald-600" in:fade> Copied! </span>
				{/if}
			</div>
			<div class="flex gap-2">
				<div class="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
					{shareUrl}
				</div>
				<button
					onclick={copyToClipboard}
					class="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
					aria-label="Copy link"
				>
					<Copy class="h-5 w-5" />
				</button>
				<button
					onclick={handleShare}
					class="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
					aria-label="Share"
				>
					<Share2 class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="space-y-2 px-6 py-4">
			<Button variant="primary" size="sm" classNames="w-full" onclick={handleViewTemplate}>
				<ExternalLink class="mr-2 h-4 w-4" />
				View Template
			</Button>

			<div class="grid grid-cols-2 gap-2">
				<Button variant="secondary" size="sm" onclick={handleDashboard}>
					<LayoutDashboard class="mr-1.5 h-4 w-4" />
					Dashboard
				</Button>

				<Button variant="secondary" size="sm" onclick={handleCreateAnother}>
					<PlusCircle class="mr-1.5 h-4 w-4" />
					Create Another
				</Button>
			</div>
		</div>

		<!-- Tips Section -->
		<div class="bg-blue-50 px-6 py-4">
			<p class="mb-2 text-xs font-medium text-blue-900">💡 Next steps:</p>
			<ul class="space-y-1 text-xs text-blue-700">
				<li>• Share your template on social media to gather support</li>
				<li>• Track engagement from your dashboard</li>
				<li>• Customize messaging for different audiences</li>
			</ul>
		</div>
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
