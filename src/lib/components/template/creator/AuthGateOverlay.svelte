<script lang="ts">
	/**
	 * AuthGateOverlay - Progressive Auth for Template Creation
	 *
	 * Perceptual Engineering:
	 * - Unified centered block: All elements as one cohesive unit
	 * - Consistent rhythm: Equal visual breathing room between sections
	 * - Background certainty: Full opacity, no ghost bleed-through
	 * - Integrated footer: Part of the flow, not orphaned
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade, fly } from 'svelte/transition';
	import { Sparkles, Search, Users, Building2, CheckCircle2, type Icon } from '@lucide/svelte';
	import AuthButtons from '$lib/components/auth/parts/AuthButtons.svelte';
	import type { ComponentType } from 'svelte';

	interface ProgressItem {
		label: string;
		value: string;
		secondary?: string;
	}

	interface Props {
		title?: string;
		description?: string;
		icon?: ComponentType<Icon>;
		progress?: ProgressItem[];
		subjectLine?: string;
		coreMessage?: string;
		onback?: () => void;
		/** Draft ID to resume after OAuth - enables seamless continuation */
		draftId?: string;
		/** Callback to save draft immediately before OAuth redirect */
		onSaveDraft?: () => void;
	}

	let {
		title = 'Unlock Decision-Maker Research',
		description = 'Free account to continue',
		icon: IconComponent = Search,
		progress = [],
		subjectLine,
		coreMessage,
		onback,
		draftId,
		onSaveDraft
	}: Props = $props();

	const normalizedProgress = $derived.by(() => {
		if (progress.length > 0) return progress;
		if (subjectLine) {
			return [{ label: 'Your message', value: subjectLine, secondary: coreMessage }];
		}
		return [];
	});

	async function handleAuth(provider: string) {
		// Save draft immediately before OAuth redirect
		// Ensures no work is lost during the redirect flow
		onSaveDraft?.();

		// Build returnTo URL with draft context for seamless resumption
		// After OAuth, landing page will detect resumeDraft param and auto-open modal
		let returnTo = '/';
		if (draftId) {
			returnTo = `/?create=true&resumeDraft=${encodeURIComponent(draftId)}`;
		}

		goto(`/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`);
	}

	// Preview hints
	const previewHints = [
		{ icon: Building2, label: 'Directors' },
		{ icon: Users, label: 'Council' },
		{ icon: Building2, label: 'Commissioners' }
	];
</script>

<!--
  Perceptual layout: Unified centered experience
  All content as one cohesive block with consistent rhythm
-->
<div
	class="absolute inset-0 z-10 flex items-center justify-center bg-white p-4"
	in:fade={{ duration: 200 }}
>
	<!-- Single unified content block -->
	<div class="w-full max-w-sm" in:fly={{ y: 8, duration: 300 }}>
		<!-- Progress confirmation (subtle, inline) -->
		{#if normalizedProgress.length > 0}
			<div class="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
				<CheckCircle2 class="h-4 w-4 flex-shrink-0 text-emerald-600" />
				<p class="truncate text-sm text-emerald-800">
					<span class="font-medium">Ready:</span> "{normalizedProgress[0].value}"
				</p>
			</div>
		{/if}

		<!-- Unlock prompt (centered, breathing room) -->
		<div class="mb-5 flex flex-col items-center text-center">
			<div class="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-participation-primary-100">
				<IconComponent class="h-5 w-5 text-participation-primary-600" />
			</div>
			<h2 class="text-lg font-semibold text-slate-900">{title}</h2>
			<p class="text-sm text-slate-500">{description}</p>
		</div>

		<!-- Preview hints (visual promise) -->
		<div class="mb-5 flex flex-wrap items-center justify-center gap-1.5">
			<span class="text-xs text-slate-400">Find:</span>
			{#each previewHints as hint}
				{@const HintIcon = hint.icon}
				<span class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
					<HintIcon class="h-3 w-3" />
					{hint.label}
				</span>
			{/each}
		</div>

		<!-- Auth buttons -->
		<div class="mb-4">
			<AuthButtons onAuth={handleAuth} />
		</div>

		<!-- Integrated footer (part of the flow) -->
		<div class="flex items-center justify-between text-xs text-slate-400">
			{#if onback}
				<button
					onclick={() => onback?.()}
					class="transition-colors hover:text-slate-600"
				>
					← Back
				</button>
			{:else}
				<span></span>
			{/if}
			<span class="flex items-center gap-1">
				<Sparkles class="h-3 w-3" />
				Draft saved
			</span>
		</div>
	</div>
</div>
