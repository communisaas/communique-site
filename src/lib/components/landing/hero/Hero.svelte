<script lang="ts">
	import { Send } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import HowItWorks from './HowItWorks.svelte';
	
	let heroFlightState = $state('ready');
</script>

<div class="space-y-8">
	<div>
		<h1 class="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
			Make Your Voice
			<span class="text-blue-600">Count</span>
			<span class="mt-2 block text-xl font-normal text-gray-600 sm:text-2xl">On record.</span>
		</h1>

		<p class="mb-8 text-base text-gray-600 sm:text-lg leading-relaxed">
			Your rep tracks every email from their district. Companies count customer complaints. The school board knows exactly how many parents are angry. Messages matter when they add up.
		</p>
	</div>

	<div class="flex gap-4">
		<Button
			variant="magical"
			size="lg"
			enableFlight={true}
			flightDirection="down-right"
			bind:flightState={heroFlightState}
			onclick={() => {
				const channelSection = document.querySelector('.w-full.max-w-4xl');
				if (channelSection) {
					channelSection.scrollIntoView({
						behavior: 'smooth',
						block: 'center'
					});
				}
			}}
			text="Start Writing"
		/>
		<HowItWorks />
	</div>
</div>
