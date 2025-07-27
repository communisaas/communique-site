<script lang="ts">
	import { IdCard, Scan, UsersRound } from '@lucide/svelte';
	import Popover from '$lib/components/ui/Popover.svelte';

	const idChecks = [
		{
			icon: IdCard,
			title: 'Verified Constituent',
			description: 'Real person, verified identity'
		},
		{
			icon: Scan,
			title: 'Biometric Verification',
			description: 'Liveliness check'
		},
		{
			icon: UsersRound,
			title: 'One Person, One Voice',
			description: 'No duplicate or anonymous messages'
		}
	];
</script>

<div class="flex">
	<Popover let:open>
		<button
			slot="trigger"
			class="inline-flex cursor-alias items-center gap-2 rounded-lg border border-slate-200 bg-slate-50
                   px-2 py-1.5 text-slate-700 transition-all
                   duration-200 hover:scale-[1.02] hover:border-slate-300 hover:shadow-md sm:px-3"
		>
			<IdCard class="h-4 w-4 shrink-0" />
			<span class="whitespace-nowrap text-xs font-medium md:text-sm">ID increases impact</span>
		</button>

		<div class="w-[280px] max-w-[calc(100vw-2rem)] cursor-text p-3 sm:p-4 md:w-[320px]">
			<div class="space-y-6">
				{#each idChecks as check}
					<div
						class="flex items-start gap-4 text-sm tracking-normal sm:text-base"
						class:opacity-0={!open}
					>
						<div class="rounded-lg bg-blue-50 p-2">
							<svelte:component this={check.icon} class="h-6 w-6 text-blue-400" />
						</div>
						<div>
							<h3 class="mb-1 font-medium text-slate-900">
								{check.title}
							</h3>
							<p class="text-sm font-normal text-slate-600">
								{check.description}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</Popover>
</div>
