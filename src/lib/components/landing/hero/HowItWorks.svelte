<script lang="ts">
	import Button from '../../ui/Button.svelte';
	import Popover from '../../ui/Popover.svelte';
	import { onMount } from 'svelte';
	import { steps } from '$lib/data/steps';
	let alignment: 'left' | 'right' = 'right';
	$: origin = alignment === 'left' ? 'origin-top-left' : 'origin-top-right';

	onMount(() => {
		const mediaQuery = window.matchMedia('(min-width: 768px)');
		const updateAlignment = (e: MediaQueryList | MediaQueryListEvent) => {
			alignment = e.matches ? 'left' : 'right';
		};

		updateAlignment(mediaQuery);
		mediaQuery.onchange = updateAlignment;

		return () => {
			mediaQuery.onchange = null;
		};
	});
</script>

<Popover let:open>
	<Button
		slot="trigger"
		variant="secondary"
		cursor="help"
		classNames="transition-all duration-200 hover:scale-[1.02] focus:scale-[1.02] hover:shadow-md focus:shadow-md hover:border-slate-300 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 relative"
	>
		How It Works
		<div class="absolute bottom-0 left-0 h-4 w-full translate-y-full"></div>
	</Button>

	<div
		class={`w-[280px] max-w-[calc(100vw-2rem)] p-4 md:w-[480px] ${origin} cursor-text hover:opacity-100`}
	>
		<div class="space-y-6">
			{#each steps as step, i}
				<div class="flex items-start gap-4 text-sm sm:text-base" class:opacity-0={!open}>
					<div class="rounded-lg bg-blue-50 p-2">
						<svelte:component this={step.icon} class="h-6 w-6 text-blue-400" />
					</div>
					<div>
						<h3 class="mb-1 font-medium text-slate-900">
							{step.title}
						</h3>
						<p class="text-sm text-slate-600">
							{step.desc}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</Popover>
