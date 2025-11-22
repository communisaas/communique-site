<script lang="ts">
	import { onMount } from 'svelte';

	type Node = {
		id: string;
		label: string;
		tone: 'sender' | 'target';
		badge?: string;
	};

	type PositionedNode = Node & { x: number; y: number };

	const senders: Node[] = [
		{ id: 'you', label: 'You', tone: 'sender' },
		{ id: 'neighbors', label: 'Neighbors', tone: 'sender' },
		{ id: 'friends', label: 'Friends', tone: 'sender' },
		{ id: 'coworkers', label: 'Coworkers', tone: 'sender' }
	];

	const targets: Node[] = [
		{ id: 'rep', label: 'Representative', badge: 'Government', tone: 'target' },
		{ id: 'mayor', label: 'Mayor', badge: 'City', tone: 'target' },
		{ id: 'ceo', label: 'CEO', badge: 'Company', tone: 'target' }
	];

	// Bipartite rings: senders inner, targets outer
	const senderPositions: PositionedNode[] = [
		{ ...senders[0], x: 16, y: 30 }, // You
		{ ...senders[1], x: 40, y: 34 }, // Neighbors
		{ ...senders[2], x: 64, y: 34 }, // Friends
		{ ...senders[3], x: 88, y: 30 } // Coworkers
	];

	const targetPositions: PositionedNode[] = [
		{ ...targets[0], x: 20, y: 78 },
		{ ...targets[1], x: 50, y: 86 },
		{ ...targets[2], x: 80, y: 78 }
	];

	const positioned: PositionedNode[] = [...senderPositions, ...targetPositions];

	const shareConnections = senderPositions
		.filter((s) => s.id !== 'you')
		.map((s) => ({ from: 'you', to: s.id }));

	const youRouteConnections = targetPositions.map((t) => ({ from: 'you', to: t.id }));

	const peerRouteConnections = senderPositions
		.filter((s) => s.id !== 'you')
		.flatMap((s) => targetPositions.map((t) => ({ from: s.id, to: t.id })));

	// Timing for simple staged opacity (no stroke-dash animations)
	const youDelayBase = 0;
	const youDuration = 2600;
	const youStagger = 80;

	const shareDelayBase = 400;
	const shareDuration = 2200;
	const shareStagger = 80;

	const peersDelayBase = 900;
	const peersDuration = 2200;
	const peersStagger = 80;

	const nodeLookup: Record<string, PositionedNode> = positioned.reduce(
		(acc, node) => ({ ...acc, [node.id]: node }),
		{}
	);

	function shrinkEndpoints(from: PositionedNode, to: PositionedNode, pad = 2) {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		const ox = (dx / len) * pad;
		const oy = (dy / len) * pad;
		return {
			x1: from.x + ox,
			y1: from.y + oy,
			x2: to.x - ox,
			y2: to.y - oy
		};
	}

	let reducedMotion = false;
	let hoveredId: string | null = null;

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});
</script>

<div
	class="relative isolate mx-auto w-full max-w-[820px] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 pb-10 pt-6 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)] ring-1 ring-white/60 lg:max-w-[860px] xl:max-w-[900px]"
>
	<div class="relative h-[520px] w-full sm:h-[560px] lg:h-[580px]">
		<svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full">
			{#each youRouteConnections as connection, index}
				{@const from = nodeLookup[connection.from]}
				{@const to = nodeLookup[connection.to]}
				{@const coords = shrinkEndpoints(from, to, 4)}
				<line
					x1={coords.x1}
					y1={coords.y1}
					x2={coords.x2}
					y2={coords.y2}
					class={`stroke-[1.3] ${reducedMotion ? '' : 'animate-flow-once'}`}
					style={`stroke: rgba(59, 196, 184, 0.9); stroke-linecap: round; stroke-linejoin: round; animation-delay: ${youDelayBase + index * youStagger}ms; animation-duration: ${youDuration}ms; animation-fill-mode: forwards; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12)); opacity: 0.9;`}
					stroke-linecap="round"
				/>
				{#if !reducedMotion && hoveredId && (connection.from === hoveredId || connection.to === hoveredId)}
					<line
						x1={coords.x1}
						y1={coords.y1}
						x2={coords.x2}
						y2={coords.y2}
						class="animate-trace stroke-[1.1]"
						style={`stroke: rgba(59, 196, 184, 0.7); mix-blend-mode: screen;`}
						stroke-linecap="round"
					/>
				{/if}
			{/each}

			{#each shareConnections as connection, index}
				{@const from = nodeLookup[connection.from]}
				{@const to = nodeLookup[connection.to]}
				{@const coords = shrinkEndpoints(from, to, 4)}
				{@const dx = coords.x2 - coords.x1}
				{@const controlOffset = Math.abs(dx) < 6 ? (dx >= 0 ? 8 : -8) : dx * 0.35}
				{@const controlY = (coords.y1 + coords.y2) / 2 - 6}
				<path
					d={`M ${coords.x1} ${coords.y1} Q ${coords.x1 + controlOffset} ${controlY} ${coords.x2} ${coords.y2}`}
					class={`fill-none stroke-[1.3] ${reducedMotion ? '' : 'animate-flow-once'}`}
					style={`stroke: rgba(79, 70, 229, 0.9); stroke-linecap: round; stroke-linejoin: round; animation-delay: ${shareDelayBase + index * shareStagger}ms; animation-duration: ${shareDuration}ms; animation-fill-mode: forwards; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12)); opacity: 0.9;`}
					stroke-linecap="round"
				/>
				{#if !reducedMotion && hoveredId && (connection.from === hoveredId || connection.to === hoveredId)}
					<path
						d={`M ${coords.x1} ${coords.y1} Q ${coords.x1 + controlOffset} ${controlY} ${coords.x2} ${coords.y2}`}
						class="animate-trace fill-none stroke-[1.1]"
						style={`stroke: rgba(79, 70, 229, 0.7); mix-blend-mode: screen;`}
						stroke-linecap="round"
					/>
				{/if}
			{/each}

			{#each peerRouteConnections as connection, index}
				{@const from = nodeLookup[connection.from]}
				{@const to = nodeLookup[connection.to]}
				{@const coords = shrinkEndpoints(from, to, 4)}
				<line
					x1={coords.x1}
					y1={coords.y1}
					x2={coords.x2}
					y2={coords.y2}
					class={`stroke-[1.3] ${reducedMotion ? '' : 'animate-flow-once'}`}
					style={`stroke: rgba(59, 196, 184, 0.9); stroke-linecap: round; stroke-linejoin: round; animation-delay: ${peersDelayBase + index * peersStagger}ms; animation-duration: ${peersDuration}ms; animation-fill-mode: forwards; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12)); opacity: 0.9;`}
					stroke-linecap="round"
				/>
				{#if !reducedMotion && hoveredId && (connection.from === hoveredId || connection.to === hoveredId)}
					<line
						x1={coords.x1}
						y1={coords.y1}
						x2={coords.x2}
						y2={coords.y2}
						class="animate-trace stroke-[1.1]"
						style={`stroke: rgba(59, 196, 184, 0.7); mix-blend-mode: screen;`}
						stroke-linecap="round"
					/>
				{/if}
			{/each}

			<defs></defs>
		</svg>

		<!-- Senders -->
		{#each senderPositions as node}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="node sender"
				style={`left:${node.x}%; top:${node.y}%; transform: translate(-50%, -50%);`}
				on:mouseenter={() => (hoveredId = node.id)}
				on:mouseleave={() => (hoveredId = null)}
			>
				<div class="label" class:you-label={node.id === 'you'}>{node.label}</div>
				<div class="tag">{node.id === 'you' ? 'Write once' : 'Share link'}</div>
			</div>
		{/each}

		<!-- Targets -->
		{#each targetPositions as node}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="node target"
				style={`left:${node.x}%; top:${node.y}%; transform: translate(-50%, -50%);`}
				on:mouseenter={() => (hoveredId = node.id)}
				on:mouseleave={() => (hoveredId = null)}
			>
				<div class="label">{node.label}</div>
				{#if node.badge}
					<span class="micro">{node.badge}</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.node {
		position: absolute;
		transform: translate(-50%, -50%);
		min-width: 96px;
		max-width: 134px;
		padding: 8px 10px;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.45);
		background: rgba(255, 255, 255, 0.9);
		box-shadow:
			inset 0 1px 6px rgba(0, 0, 0, 0.08),
			0 20px 50px -28px rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		color: #0f172a;
		pointer-events: auto;
		text-align: center;
		transition:
			transform 220ms ease,
			box-shadow 220ms ease,
			border-color 220ms ease;
	}

	.node.sender {
		border-color: rgba(79, 70, 229, 0.7);
	}

	.node.target {
		border-color: rgba(69, 226, 212, 0.55);
		background:
			radial-gradient(circle at 80% 20%, rgba(69, 226, 212, 0.08), transparent 60%),
			rgba(255, 255, 255, 0.9);
	}

	.you-label {
		color: #0ea5e9;
	}

	.label {
		font-weight: 600;
		font-size: 12px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-weight: 700;
		font-size: 11px;
		color: #0f172a;
		background: linear-gradient(135deg, #45e2d4, #6bd8ff);
		padding: 5px 8px;
		border-radius: 8px;
		box-shadow: 0 8px 22px -20px rgba(69, 226, 212, 0.55);
	}

	.tag {
		margin-top: 2px;
		font-size: 10px;
		color: #475569;
	}

	.micro {
		margin-top: 2px;
		display: inline-flex;
		padding: 4px 7px;
		border-radius: 999px;
		background: rgba(148, 163, 184, 0.12);
		font-size: 10px;
		color: #475569;
	}

	.node:hover,
	.node:focus-visible {
		outline: 1px solid rgba(99, 102, 241, 0.35);
		transform: translate(-50%, -50%) scale(1.02);
	}

	.node.sender:hover,
	.node.sender:focus-visible {
		box-shadow:
			inset 0 1px 6px rgba(0, 0, 0, 0.08),
			0 16px 45px -24px rgba(79, 70, 229, 0.32);
	}

	.animate-flow-once {
		stroke-dasharray: 120;
		stroke-dashoffset: 120;
		animation: flow-once ease-out forwards;
	}

	.animate-trace {
		stroke-dasharray: 40;
		stroke-dashoffset: 40;
		animation: trace-loop 2600ms ease-in-out infinite;
	}

	@keyframes flow-once {
		0% {
			stroke-dashoffset: 120;
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		65% {
			stroke-dashoffset: 0;
			opacity: 1;
		}
		100% {
			stroke-dashoffset: 0;
			opacity: 1;
		}
	}

	@keyframes trace-loop {
		0% {
			stroke-dashoffset: 40;
			opacity: 0;
		}
		25% {
			opacity: 0.5;
		}
		50% {
			stroke-dashoffset: 0;
			opacity: 0.85;
		}
		75% {
			opacity: 0.5;
		}
		100% {
			stroke-dashoffset: -40;
			opacity: 0;
		}
	}
</style>
