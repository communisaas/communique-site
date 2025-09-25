<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import HowItWorks from './HowItWorks.svelte';

	// Check if element is in viewport
	function isInViewport(element: Element): boolean {
		const rect = element.getBoundingClientRect();
		const windowHeight = window.innerHeight || document.documentElement.clientHeight;
		const verticalCenter = windowHeight / 2;

		// Check if element's center is near viewport center (within 100px tolerance)
		const elementCenter = rect.top + rect.height / 2;
		return Math.abs(elementCenter - verticalCenter) < 100;
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
			Make Your Voice
			<span class="text-participation-accent-600">Count</span>
			<span class="mt-2 block text-xl font-normal text-gray-600 sm:text-2xl">On record.</span>
		</h1>

		<p class="mb-8 text-base leading-relaxed text-gray-600 sm:text-lg">
			Congress tracks millions of messages each year. Companies monitor customer sentiment. School
			boards count angry parents. The pattern is simple—coordinated messages get meetings. Scattered
			complaints get filed.
		</p>
	</div>

	<div class="flex gap-4">
		<Button
			variant="magical"
			size="lg"
			animationType="bounce"
			icon="sparkles"
			onclick={() => {
				const channelSection = document.querySelector('.w-full.max-w-4xl');
				if (channelSection) {
					// Check if already at the channel section
					if (isInViewport(channelSection)) {
						// Already there - trigger attention animation on channels
						window.dispatchEvent(new CustomEvent('drawAttentionToChannels'));
					} else {
						// Scroll to channel section
						channelSection.scrollIntoView({
							behavior: 'smooth',
							block: 'center'
						});
					}
				}
			}}
			text="Start Writing"
		/>
		<HowItWorks />
	</div>
</div>
