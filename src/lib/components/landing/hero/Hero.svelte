<script lang="ts">
	import { Github, ArrowRight } from 'lucide-svelte';
	import Button from '../../ui/Button.svelte';
	import HowItWorks from './HowItWorks.svelte';
	import IdentityBadge from '$lib/components/verification/IdentityBadge.svelte';
</script>

<!-- New subheader above hero -->
<div class="mb-4 flex justify-end">
	<IdentityBadge />
</div>

<div class="space-y-6 sm:space-y-8">
	<div>
		<h1 class="mb-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
			Make Your Voice
			<span class="text-blue-600">Count</span>
			<span class="mt-2 block text-2xl font-normal text-slate-600 sm:text-3xl"> On record. </span>
		</h1>

		<p class="mb-8 text-base text-slate-600 sm:text-xl">
			Your rep tracks every email from their district. Companies count customer complaints. The
			school board knows exactly how many parents are angry. Messages matter when they add up.
		</p>
	</div>

	<div class="flex flex-col items-stretch gap-3 sm:items-start sm:gap-4">
		<div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
			<Button variant="primary" href="https://github.com/communisaas/communique-site">
				<Github class="h-4 w-4" />
				Follow Our Progress
			</Button>
			<HowItWorks />
		</div>

		<a
			href="https://github.com/communisaas/communique-site/discussions"
			class="group inline-flex items-center gap-2 text-sm text-slate-600 transition-colors duration-200 hover:text-blue-600 sm:text-base"
			target="_blank"
		>
			Join the discussion
			<ArrowRight
				class="h-4 w-4 transform transition-transform duration-200 group-hover:translate-x-1"
			/>
			<span
				class="block h-0.5 max-w-0 bg-blue-600 transition-all duration-500 group-hover:max-w-full"
			></span>
		</a>
	</div>
</div>
