<script lang="ts">
	import { Users, Coins, Clock } from '@lucide/svelte';

	interface Props {
		argumentCount: number;
		uniqueParticipants: number;
		totalStake: string; // BigInt serialized
		deadline: string; // ISO date string
		jurisdictionSize: number;
		status: 'active' | 'resolved';
	}

	let {
		argumentCount,
		uniqueParticipants,
		totalStake,
		deadline,
		jurisdictionSize,
		status
	}: Props = $props();

	const formattedStake = $derived(() => {
		const amount = Number(BigInt(totalStake)) / 1e6;
		if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
		if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}k`;
		return `$${amount.toFixed(2)}`;
	});

	const timeRemaining = $derived(() => {
		if (status === 'resolved') return 'Resolved';
		const now = Date.now();
		const end = new Date(deadline).getTime();
		const diff = end - now;
		if (diff <= 0) return 'Ended';
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		if (days > 0) return `${days}d ${hours}h remaining`;
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		if (hours > 0) return `${hours}h ${minutes}m remaining`;
		return `${minutes}m remaining`;
	});

	const participationDepth = $derived(() => {
		if (jurisdictionSize <= 0) return null;
		const pct = (uniqueParticipants / jurisdictionSize) * 100;
		return pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`;
	});
</script>

<div class="flex flex-wrap items-center gap-4 text-sm text-slate-600">
	<div class="flex items-center gap-1.5" title="{uniqueParticipants} unique participants">
		<Users class="h-4 w-4 text-slate-400" />
		<span>
			<span class="font-medium text-slate-800">{uniqueParticipants}</span>
			participant{uniqueParticipants === 1 ? '' : 's'}
			{#if participationDepth()}
				<span class="text-slate-400">({participationDepth()} of district)</span>
			{/if}
		</span>
	</div>

	<div class="flex items-center gap-1.5" title="Total staked: {formattedStake()}">
		<Coins class="h-4 w-4 text-slate-400" />
		<span>
			<span class="font-medium text-slate-800">{formattedStake()}</span> staked
		</span>
	</div>

	<div class="flex items-center gap-1.5" title="{argumentCount} arguments submitted">
		<span class="font-medium text-slate-800">{argumentCount}</span>
		argument{argumentCount === 1 ? '' : 's'}
	</div>

	<div
		class="flex items-center gap-1.5"
		class:text-amber-700={status === 'active'}
		class:text-slate-500={status === 'resolved'}
	>
		<Clock class="h-4 w-4" />
		<span class="font-medium">{timeRemaining()}</span>
	</div>
</div>
