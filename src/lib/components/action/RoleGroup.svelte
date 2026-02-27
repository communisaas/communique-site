<script lang="ts">
	import DecisionMakerLandscapeCard from './DecisionMakerLandscapeCard.svelte';
	import DistrictOfficialCard from './DistrictOfficialCard.svelte';
	import type { RoleGroupData, LandscapeMember } from '$lib/utils/landscapeMerge';

	let {
		group,
		contactedRecipients = new Set(),
		departingRecipients = new Set(),
		onWriteTo,
		isDistrictGroup = false
	}: {
		group: RoleGroupData | { label: string; members: LandscapeMember[] };
		contactedRecipients: Set<string>;
		departingRecipients: Set<string>;
		onWriteTo: (member: LandscapeMember) => void;
		isDistrictGroup?: boolean;
	} = $props();
</script>

<div>
	<h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
		{group.label}
	</h3>
	<div class="flex flex-col gap-3">
		{#each group.members as member (member.id)}
			{#if member.source === 'district' || isDistrictGroup}
				<DistrictOfficialCard
					{member}
					contacted={contactedRecipients.has(member.id)}
					departing={departingRecipients.has(member.id)}
					{onWriteTo}
				/>
			{:else}
				<DecisionMakerLandscapeCard
					{member}
					contacted={contactedRecipients.has(member.id)}
					departing={departingRecipients.has(member.id)}
					{onWriteTo}
				/>
			{/if}
		{/each}
	</div>
</div>
