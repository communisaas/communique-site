<script lang="ts">
	import { IdCard, Shield, Scan, UsersRound } from '@lucide/svelte';

	const idChecks = [
		{
			icon: IdCard,
			title: 'Verified Constituent',
			description: 'Real person, verified identity'
		},
		{
			icon: Scan,
			title: 'Biometric Verification',
			description: 'Real person confirmation'
		},
		{
			icon: UsersRound,
			title: 'One Person, One Voice',
			description: 'No duplicate or anonymous messages'
		}
	];
</script>

<div class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
	<div class="flex items-center gap-2 border-b border-slate-200 pb-2">
		<IdCard class="h-5 w-5 text-slate-700" />
		<h4 class="font-medium text-slate-900">ID Protected Platform</h4>
	</div>

	<div class="grid gap-3">
		{#each idChecks as check}
			<div class="flex items-start gap-3">
				<div class="rounded border border-slate-100 bg-white p-1.5">
					<svelte:component this={check.icon} class="h-4 w-4 text-slate-600" />
				</div>
				<div>
					<div class="text-sm font-medium text-slate-900">{check.title}</div>
					<div class="text-sm text-slate-600">{check.description}</div>
				</div>
			</div>
		{/each}
	</div>
</div>
