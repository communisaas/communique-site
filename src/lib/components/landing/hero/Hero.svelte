<script lang="ts">
	import { Send } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import HowItWorks from './HowItWorks.svelte';
</script>

<div class="space-y-8">
	<div>
		<h1 class="mb-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
			Make Your Voice
			<span class="text-blue-600">Count</span>
			<span class="mt-2 block text-2xl font-normal text-slate-600 sm:text-3xl"> On record. </span>
		</h1>

		<p class="mb-8 text-base text-slate-600 sm:text-xl">
			Reach and influence decision makers at every level. From Congress to corporate leaders, make
			your voice heard where it matters most.
		</p>
	</div>

	<div class="flex gap-4">
		<Button
			variant="primary"
			onclick={() => {
				document.querySelector('.w-full.max-w-4xl')?.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
			}}
		>
			Start Writing
			<Send class="h-4 w-4" />
		</Button>
		<HowItWorks />
	</div>
</div>
