<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import HowItWorks from './HowItWorks.svelte';
	import { PenLine } from '@lucide/svelte';

	const dispatch = createEventDispatcher<{
		createTemplate: void;
	}>();

	function scrollToTemplates() {
		const templateBrowser = document.getElementById('template-browser');
		if (templateBrowser) {
			templateBrowser.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	}
</script>

<div class="space-y-8">
	<div>
		<!-- Brand overture: the name as context before the narrative -->
		<p class="brand-overture">communiqué</p>

		<h1
			class="mb-6 text-4xl font-bold leading-[1.15] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
		>
			Your voice.
			<br />
			<span class="mt-2 block text-cyan-600">Sent together.</span>
		</h1>

		<p class="mb-3 max-w-2xl text-lg font-medium leading-relaxed text-gray-900">
			Write it once. Share the link. Everyone can send it.
		</p>

		<p class="max-w-xl text-base text-gray-600">
			One complaint gets buried. Coordinated messages make impact.
		</p>
	</div>

	<div class="flex flex-wrap gap-3">
		<Button
			variant="primary"
			size="lg"
			onclick={() => dispatch('createTemplate')}
			text="Start Writing"
		>
			<PenLine slot="icon" class="h-4 w-4" />
		</Button>
		<Button
			variant="secondary"
			size="lg"
			animationType="chevrons"
			icon="chevrons-down"
			onclick={scrollToTemplates}
			text="Browse Templates"
		/>
		<HowItWorks />
	</div>
</div>

<style>
	/*
	 * Brand Overture: Perceptual Engineering
	 *
	 * "Communiqué" = a message that demands attention.
	 * From movements. Urgent. Consequential. Human.
	 *
	 * The typography must feel like a VOICE, not a watermark.
	 * Not institutional quiet. Not bureaucratic gray.
	 * The warmth of people speaking together.
	 *
	 * Signals BEFORE conscious processing:
	 * - Warmth (amber undertone) = human, not system
	 * - Presence (weight + tracking) = this matters
	 * - Invitation = join us
	 */
	.brand-overture {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 1rem; /* 16px - presence, not whisper */
		font-weight: 600; /* Confident voice */
		letter-spacing: -0.015em; /* Dense = collective meaning */
		text-transform: lowercase;
		color: oklch(0.38 0.08 55); /* Warm amber-brown: human, not machine */
		margin-bottom: 1rem;

		/* Subtle entrance animation */
		opacity: 0;
		animation: brand-fade-in 0.8s ease-out 0.3s forwards;
	}

	@keyframes brand-fade-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Reduced motion: instant appearance */
	@media (prefers-reduced-motion: reduce) {
		.brand-overture {
			opacity: 1;
			animation: none;
		}
	}
</style>
