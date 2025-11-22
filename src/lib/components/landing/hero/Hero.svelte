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
