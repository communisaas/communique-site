<script lang="ts">
	import { spring } from 'svelte/motion';
	import type { Stance } from '$lib/stores/debateState.svelte';

	interface Props {
		selected: Stance | null;
		onselect: (stance: Stance) => void;
	}

	let { selected, onselect }: Props = $props();

	const stances: {
		value: Stance;
		label: string;
		description: string;
		color: string;
		selectedBg: string;
		borderColor: string;
	}[] = [
		{
			value: 'SUPPORT',
			label: 'Support',
			description: 'This framing is right. I want to strengthen it.',
			color: 'text-indigo-700',
			selectedBg: 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200',
			borderColor: 'border-indigo-200 hover:border-indigo-300'
		},
		{
			value: 'OPPOSE',
			label: 'Oppose',
			description: 'This framing is wrong. Here is why.',
			color: 'text-red-700',
			selectedBg: 'bg-red-50 border-red-300 ring-2 ring-red-200',
			borderColor: 'border-red-200 hover:border-red-300'
		},
		{
			value: 'AMEND',
			label: 'Amend',
			description: 'The direction is right, but the framing needs revision.',
			color: 'text-amber-700',
			selectedBg: 'bg-amber-50 border-amber-300 ring-2 ring-amber-200',
			borderColor: 'border-amber-200 hover:border-amber-300'
		}
	];

	// Spring scale for button press feedback
	let pressedIndex = $state<number | null>(null);
	const scale = spring(1, { stiffness: 0.4, damping: 0.8 });

	function handleClick(stance: Stance, index: number) {
		pressedIndex = index;
		scale.set(0.97);
		setTimeout(() => {
			scale.set(1);
			pressedIndex = null;
		}, 150);
		onselect(stance);
	}
</script>

<div class="space-y-2">
	<p class="text-sm font-medium text-slate-700">What's your stance?</p>
	<div class="grid gap-2">
		{#each stances as stance, i}
			<button
				class="text-left rounded-lg border p-3 transition-all duration-150
					{selected === stance.value ? stance.selectedBg : `bg-white ${stance.borderColor}`}"
				style={pressedIndex === i ? `transform: scale(${$scale})` : ''}
				onclick={() => handleClick(stance.value, i)}
			>
				<span class="text-sm font-semibold {stance.color}">{stance.label}</span>
				<p class="text-xs text-slate-500 mt-0.5">{stance.description}</p>
			</button>
		{/each}
	</div>
</div>
