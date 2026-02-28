<script lang="ts">
	interface Props {
		argumentCount: number;
		uniqueParticipants: number;
		totalStake: string; // BigInt serialized
		deadline: string; // ISO date string
		jurisdictionSize: number;
		status: 'active' | 'resolving' | 'resolved' | 'awaiting_governance' | 'under_appeal';
	}

	let {
		argumentCount,
		uniqueParticipants,
		totalStake,
		deadline,
		jurisdictionSize,
		status
	}: Props = $props();

	const formattedStake = $derived.by(() => {
		const amount = Number(BigInt(totalStake)) / 1e6;
		if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
		return `$${amount.toFixed(2)}`;
	});

	const timeRemaining = $derived.by(() => {
		if (status !== 'active') return status === 'resolved' ? 'Resolved' : 'Deadline passed';
		const now = Date.now();
		const end = new Date(deadline).getTime();
		const diff = end - now;
		if (diff <= 0) return 'Ended';
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		if (days > 0) return `${days}d ${hours}h left`;
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		if (hours > 0) return `${hours}h ${minutes}m left`;
		return `${minutes}m left`;
	});

	const participationDepth = $derived.by(() => {
		if (jurisdictionSize <= 0) return null;
		const pct = (uniqueParticipants / jurisdictionSize) * 100;
		return pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`;
	});
</script>

<p class="text-xs text-slate-500">
	<span class="font-medium text-slate-700">{uniqueParticipants}</span>
	participant{uniqueParticipants === 1 ? '' : 's'}
	{#if participationDepth}
		<span class="text-slate-400">({participationDepth})</span>
	{/if}
	<span class="text-slate-300">&middot;</span>
	<span class="font-medium text-slate-700">{formattedStake}</span> staked
	<span class="text-slate-300">&middot;</span>
	<span class="font-medium text-slate-700">{argumentCount}</span>
	argument{argumentCount === 1 ? '' : 's'}
	<span class="text-slate-300">&middot;</span>
	<span
		class="font-medium"
		class:text-amber-600={status === 'active'}
		class:text-slate-500={status !== 'active'}
	>
		{timeRemaining}
	</span>
</p>
