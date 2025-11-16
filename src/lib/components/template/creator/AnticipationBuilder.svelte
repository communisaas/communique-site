<script lang="ts">
	import { Search, Building, Users, CheckCircle2 } from '@lucide/svelte';
	import { onMount } from 'svelte';

	// Phases cycle every 3-5 seconds (not tied to actual progress)
	const phases = [
		{
			icon: Search,
			text: 'Analyzing issue context',
			subtext: 'Understanding the problem domain'
		},
		{
			icon: Building,
			text: 'Identifying power structures',
			subtext: 'Mapping organizational hierarchies'
		},
		{
			icon: Users,
			text: 'Cross-referencing authority',
			subtext: 'Finding who has decision-making power'
		},
		{
			icon: CheckCircle2,
			text: 'Validating contact pathways',
			subtext: 'Verifying email addresses and roles'
		}
	];

	// Educational context (rotates)
	const educationalMessages = [
		'Most campaigns fail because they target the wrong person.',
		"We're finding who actually has the power to act.",
		'This takes 10-20 seconds. Worth it.',
		'Checking organizational charts and public records.'
	];

	let currentPhaseIndex = $state(0);
	let currentMessageIndex = $state(0);

	// Cycle through phases every 4 seconds
	onMount(() => {
		const phaseInterval = setInterval(() => {
			currentPhaseIndex = (currentPhaseIndex + 1) % phases.length;
		}, 4000);

		// Rotate educational messages every 6 seconds
		const messageInterval = setInterval(() => {
			currentMessageIndex = (currentMessageIndex + 1) % educationalMessages.length;
		}, 6000);

		return () => {
			clearInterval(phaseInterval);
			clearInterval(messageInterval);
		};
	});
</script>

<div class="space-y-6 py-8">
	<!-- Header -->
	<div class="text-center">
		<h3 class="text-lg font-semibold text-slate-900 md:text-xl">
			Finding who can actually fix this
		</h3>
	</div>

	<!-- Phase Indicators -->
	<div class="space-y-3">
		{#each phases as phase, i}
			{@const isActive = i === currentPhaseIndex}
			{@const isComplete = i < currentPhaseIndex}
			<div
				class="flex items-start gap-3 rounded-lg p-3 transition-all duration-300"
				class:bg-participation-primary-50={isActive}
				class:border={isActive}
				class:border-participation-primary-200={isActive}
			>
				<div
					class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300"
					class:bg-participation-primary-600={isActive}
					class:text-white={isActive}
					class:bg-green-100={isComplete}
					class:text-green-600={isComplete}
					class:bg-slate-100={!isActive && !isComplete}
					class:text-slate-400={!isActive && !isComplete}
				>
					<svelte:component this={phase.icon} class="h-4 w-4" />
				</div>

				<div class="flex-1">
					<p
						class="text-sm font-medium transition-colors duration-300 md:text-base"
						class:text-participation-primary-900={isActive}
						class:text-green-900={isComplete}
						class:text-slate-700={!isActive && !isComplete}
					>
						{phase.text}
					</p>
					{#if isActive}
						<p class="mt-0.5 text-xs text-participation-primary-700 md:text-sm">
							{phase.subtext}
						</p>
					{/if}
				</div>

				{#if isComplete}
					<CheckCircle2 class="mt-1 h-5 w-5 text-green-600" />
				{:else if isActive}
					<div class="mt-1 h-5 w-5">
						<div
							class="h-full w-full animate-spin rounded-full border-2 border-participation-primary-600 border-t-transparent"
						></div>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Educational Context -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
		<p class="text-center text-sm text-slate-700 transition-opacity duration-500 md:text-base">
			{educationalMessages[currentMessageIndex]}
		</p>
	</div>
</div>
