<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Shield, User, MapPin, Eye, EyeOff } from 'lucide-svelte';

	export let value: 1 | 2 | 3 = 1;

	const dispatch = createEventDispatcher();

	const levels = [
		{
			level: 1,
			title: 'Anonymous Verified',
			description: 'Reveals only that you are a verified constituent.',
			icon: Shield,
			color: 'bg-emerald-500',
			data: ['Verified Constituent', 'District CA-12']
		},
		{
			level: 2,
			title: 'Verified Resident',
			description: 'Reveals your city and state.',
			icon: MapPin,
			color: 'bg-blue-500',
			data: ['Verified Resident', 'San Francisco, CA']
		},
		{
			level: 3,
			title: 'Full Identity',
			description: 'Reveals your name and address.',
			icon: User,
			color: 'bg-purple-500',
			data: ['Jane Doe', '123 Maple St, SF, CA']
		}
	];

	function selectLevel(level: number) {
		value = level as 1 | 2 | 3;
		dispatch('change', value);
	}
</script>

<div class="w-full max-w-md space-y-6 p-4">
	<!-- Slider Track -->
	<div class="relative h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
		<div
			class="absolute h-full rounded-full transition-all duration-300 ease-out {levels[value - 1]
				.color}"
			style="width: {((value - 1) / 2) * 100}%"
		></div>

		<!-- Knobs -->
		{#each levels as level, i}
			<button
				class="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2
				{value >= level.level ? level.color : 'bg-gray-300 dark:bg-gray-600'}"
				style="left: {(i / 2) * 100}%"
				onclick={() => selectLevel(level.level)}
				aria-label="Select Level {level.level}"
			></button>
		{/each}
	</div>

	<!-- Selected Level Card -->
	<div
		class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-lg p-2 text-white {levels[value - 1].color}">
					<svelte:component this={levels[value - 1].icon} size={20} />
				</div>
				<div>
					<h3 class="font-semibold text-gray-900 dark:text-white">
						{levels[value - 1].title}
					</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{levels[value - 1].description}
					</p>
				</div>
			</div>
		</div>

		<!-- Data Preview (Blur Effect) -->
		<div class="space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
			<div
				class="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-gray-400"
			>
				<span>Recipient Sees:</span>
				{#if value === 1}
					<EyeOff size={14} />
				{:else}
					<Eye size={14} />
				{/if}
			</div>

			{#each levels[2].data as item, i}
				<div class="flex items-center gap-2">
					{#if i < levels[value - 1].data.length}
						<!-- Revealed Data -->
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							{levels[value - 1].data[i]}
						</span>
						{#if i === 0 && value === 1}
							<span
								class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
							>
								Verified
							</span>
						{/if}
					{:else}
						<!-- Blurred Data -->
						<span class="h-4 w-24 rounded bg-gray-200 blur-sm dark:bg-gray-700"></span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
