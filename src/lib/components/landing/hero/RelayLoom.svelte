<script lang="ts">
	import { onMount } from 'svelte';

	// ─────────────────────────────────────────────────────────────
	// Types
	// ─────────────────────────────────────────────────────────────

	type Node = {
		id: string;
		label: string;
		tone: 'sender' | 'target';
		badge?: string;
	};

	type PositionedNode = Node & { x: number; y: number };

	type Connection = {
		from: string;
		to: string;
		type: 'share' | 'deliver';
		phase: 'you-send' | 'you-share' | 'peers-send';
	};

	// ─────────────────────────────────────────────────────────────
	// Data
	// ─────────────────────────────────────────────────────────────

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

	// ─────────────────────────────────────────────────────────────
	// Layout Configuration
	// ─────────────────────────────────────────────────────────────

	const LAYOUT = {
		// Minimum node dimensions (px) - used to calculate spacing
		nodeWidth: 110,
		nodeHeight: 55,
		// Minimum gap between nodes (px)
		minGap: 16,
		// Padding from container edges (%)
		edgePadding: 8,
		// Vertical zones for sender/target tiers (%)
		// Wide screens: tight band for Gestalt proximity
		// Narrow screens: use staggered arc (10-40%) with clear corridor to targets
		senderZone: { min: 10, max: 40 }, // Expanded for mobile arc layout
		targetZone: { min: 60, max: 85 }  // Clear corridor from senders
	};

	// ─────────────────────────────────────────────────────────────
	// Dynamic viewBox for responsive SVG
	// ─────────────────────────────────────────────────────────────

	let containerEl = $state<HTMLElement | null>(null);
	let containerWidth = $state(100);
	let containerHeight = $state(100);

	// ViewBox matches container aspect ratio - coordinates in percentage space (0-100)
	// but scaled to actual pixel dimensions for proper circle rendering
	const viewBox = $derived(`0 0 ${containerWidth} ${containerHeight}`);

	// Scale factor to convert percentage positions to viewBox coordinates
	const scaleX = $derived(containerWidth / 100);
	const scaleY = $derived(containerHeight / 100);

	// Use average scale for uniform particle sizes
	const avgScale = $derived((scaleX + scaleY) / 2);
	const particleRadiusAmbient = $derived(1.5 * avgScale);
	const particleRadiusActive = $derived(2.5 * avgScale);
	const strokeWidth = $derived(1.3 * avgScale);
	const strokeWidthActive = $derived(1.8 * avgScale);

	// Dynamic font scale: shrink text when container gets narrow
	// This preserves edge visibility by making nodes smaller
	// Scale ranges: 1.0 at 500px+ width, down to 0.75 at 300px
	const fontScale = $derived(() => {
		const minWidth = 300;
		const maxWidth = 500;
		const minScale = 0.75;
		const maxScale = 1.0;

		if (containerWidth >= maxWidth) return maxScale;
		if (containerWidth <= minWidth) return minScale;

		// Linear interpolation
		const t = (containerWidth - minWidth) / (maxWidth - minWidth);
		return minScale + t * (maxScale - minScale);
	});

	// Computed font sizes based on scale
	const labelFontSize = $derived(`${12 * fontScale()}px`);
	const tagFontSize = $derived(`${10 * fontScale()}px`);
	const microFontSize = $derived(`${10 * fontScale()}px`);
	const nodePadding = $derived(`${8 * fontScale()}px ${10 * fontScale()}px`);
	const nodeMinWidth = $derived(`${96 * fontScale()}px`);
	const nodeMaxWidth = $derived(`${134 * fontScale()}px`);

	// ─────────────────────────────────────────────────────────────
	// Dynamic Node Positioning (bipartite graph layout)
	// ─────────────────────────────────────────────────────────────

	// Aspect ratio determines layout strategy
	const aspectRatio = $derived(containerWidth / containerHeight);

	// Calculate sender positions: "You" + peers on same horizontal band
	// All senders MUST stay within senderZone - never extend into delivery edge corridor
	function calculateSenderPositions(width: number, height: number): PositionedNode[] {
		const count = senders.length;
		const aspect = width / height;

		// Available horizontal space
		const availableWidth = 100 - 2 * LAYOUT.edgePadding;

		// CRITICAL: Senders must stay strictly above the green delivery edge corridor
		// The corridor between senders and targets must be clear for edges to flow
		const maxSenderY = LAYOUT.senderZone.max - 5; // Leave buffer above corridor

		// TABLET screens (0.5 < aspect < 0.9): CENTERED CHEVRON layout
		// Perceptual principle: Coalition must feel like ONE cohesive unit
		// Empty space should be AROUND the coalition, not INSIDE it
		// Vertically centered: shifted +8% for better balance
		if (aspect >= 0.5 && aspect < 0.9) {
			// Chevron pattern: "You" at apex, peers fan out below, creates unity
			// This communicates: You initiate → Peers join → Coalition forms
			const chevronPositions: Array<{ x: number; y: number }> = [
				{ x: 50, y: 18 },   // You - apex center (initiator)
				{ x: 28, y: 32 },   // Neighbors - left wing
				{ x: 72, y: 32 },   // Friends - right wing
				{ x: 50, y: 46 }    // Coworkers - base center
			];

			return senders.map((node, i) => ({
				...node,
				x: chevronPositions[i].x,
				y: chevronPositions[i].y
			}));
		}

		// NARROW screens (aspect < 0.5): PHONE CHEVRON
		// Embrace verticality as superpower - story unfolds top-to-bottom
		// Chevron shape: You at apex, peers fan out, base completes coalition
		// This mirrors the tablet chevron but uses FULL WIDTH for phone
		// Vertically centered: loom spans ~15-85%, center at 50%
		if (aspect < 0.5) {
			// Phone chevron - pushed to edges for maximum width utilization
			// Visual symmetry: senders chevron ↔ targets inverted chevron
			// Y positions shifted +9% for vertical centering
			const phoneChevronPositions: Array<{ x: number; y: number }> = [
				{ x: 50, y: 15 },   // You - apex center (initiator)
				{ x: 18, y: 27 },   // Neighbors - left wing (WIDE)
				{ x: 82, y: 27 },   // Friends - right wing (WIDE)
				{ x: 50, y: 41 }    // Coworkers - base center (coalition complete)
			];

			return senders.map((node, i) => ({
				...node,
				x: phoneChevronPositions[i].x,
				y: phoneChevronPositions[i].y
			}));
		}

		// Wide screens: all senders on one row with generous spacing
		// Use full width with nodes pushed toward edges
		const baseY = LAYOUT.senderZone.min + (LAYOUT.senderZone.max - LAYOUT.senderZone.min) * 0.5;

		// Position at 15%, 38%, 62%, 85% for maximum separation
		// This pushes nodes toward edges and creates clear center corridor
		const positions = [15, 38, 62, 85];

		return senders.map((node, i) => {
			// Subtle vertical stagger: wave pattern for collision avoidance
			// Pattern: up, down, up, down creates visual breathing room
			const stagger = i % 2 === 0 ? -3 : 3;
			return {
				...node,
				x: positions[i] ?? 50,
				y: baseY + stagger
			};
		});
	}

	// Calculate target positions: spread across bottom tier
	function calculateTargetPositions(width: number, height: number): PositionedNode[] {
		const count = targets.length;
		const aspect = width / height;

		// PHONE screens (aspect < 0.5): INVERTED CHEVRON
		// Mirrors sender chevron for visual symmetry
		// Perceptual principle: Coalition converges → Impact fans out → Lands
		// Y positions shifted +9% for vertical centering (matches sender shift)
		if (aspect < 0.5) {
			// Inverted chevron: 2 targets on top row (WIDE), 1 at bottom apex
			// Pushed to edges to match sender chevron width
			const invertedChevronPositions: Array<{ x: number; y: number }> = [
				{ x: 18, y: 69 },   // Representative - left (matches Neighbors X)
				{ x: 82, y: 69 },   // Mayor - right (matches Friends X)
				{ x: 50, y: 85 }    // CEO - apex inverted (matches You/Coworkers X)
			];

			return targets.map((node, i) => ({
				...node,
				x: invertedChevronPositions[i].x,
				y: invertedChevronPositions[i].y
			}));
		}

		// TABLET screens (0.5 ≤ aspect < 0.9): Explicit centered positions
		// Senders span 18-46%, so targets at 82% centers overall layout at 50%
		// (18 + 82) / 2 = 50% perfect vertical centering
		if (aspect >= 0.5 && aspect < 0.9) {
			const tabletTargetPositions: Array<{ x: number; y: number }> = [
				{ x: 20, y: 82 },   // Representative - left
				{ x: 50, y: 82 },   // Mayor - center
				{ x: 80, y: 82 }    // CEO - right
			];

			return targets.map((node, i) => ({
				...node,
				x: tabletTargetPositions[i].x,
				y: tabletTargetPositions[i].y
			}));
		}

		// WIDE screens (aspect >= 0.9): horizontal row layout
		// Senders at ~25% (with stagger 22-28%), targets at 75% for vertical centering
		// (25 + 75) / 2 = 50% perfect vertical centering
		const targetY = 75;

		// Use explicit positions for maximum separation
		// 3 targets: 20%, 50%, 80% for generous spacing
		const positions = [20, 50, 80];
		return targets.map((node, i) => ({
			...node,
			x: positions[i] ?? 50,
			y: targetY
		}));
	}

	// Reactive positioned nodes based on container dimensions
	const senderPositions = $derived(calculateSenderPositions(containerWidth, containerHeight));
	const targetPositions = $derived(calculateTargetPositions(containerWidth, containerHeight));

	const positioned = $derived([...senderPositions, ...targetPositions]);

	const nodeLookup = $derived(
		positioned.reduce<Record<string, PositionedNode>>(
			(acc, node) => ({ ...acc, [node.id]: node }),
			{}
		)
	);

	// ─────────────────────────────────────────────────────────────
	// Connections with semantic types AND temporal phases
	// (Use base node arrays, not positioned - connections are stable)
	// ─────────────────────────────────────────────────────────────

	// Phase 1: You send directly to targets
	const youDeliverConnections: Connection[] = targets.map((t) => ({
		from: 'you',
		to: t.id,
		type: 'deliver',
		phase: 'you-send'
	}));

	// Phase 2: You share with your network
	const shareConnections: Connection[] = senders
		.filter((s) => s.id !== 'you')
		.map((s) => ({ from: 'you', to: s.id, type: 'share', phase: 'you-share' }));

	// Phase 3: Your network sends to targets
	const peerDeliverConnections: Connection[] = senders
		.filter((s) => s.id !== 'you')
		.flatMap((s) =>
			targets.map((t) => ({
				from: s.id,
				to: t.id,
				type: 'deliver' as const,
				phase: 'peers-send' as const
			}))
		);

	// Ordered by narrative sequence
	const allConnections: Connection[] = [
		...youDeliverConnections,
		...shareConnections,
		...peerDeliverConnections
	];

	// ─────────────────────────────────────────────────────────────
	// Timing (perceptual rhythm + narrative sequence)
	// ─────────────────────────────────────────────────────────────

	const TIMING = {
		// Narrative reveal timing
		phase1Start: 0,          // You send
		phase2Start: 600,        // You share (after send lands)
		phase3Start: 1200,       // Peers send (after share spreads)
		edgeDrawDuration: 800,   // How long each edge takes to draw
		edgeStagger: 100,        // Stagger within a phase

		// Ambient particles (life after reveal)
		ambientDelay: 2400,      // Start after narrative completes
		ambientDuration: 5000,   // Slow breathing rhythm
		ambientStagger: 600,     // Offset between particles

		// Hover response
		activeDuration: 700,
		activeStagger: 180,

		// Transitions
		hoverTransition: 150
	};

	// ─────────────────────────────────────────────────────────────
	// Geometry helpers (using scaled coordinates)
	// ─────────────────────────────────────────────────────────────

	function getEdgePath(conn: Connection): string {
		const from = nodeLookup[conn.from];
		const to = nodeLookup[conn.to];

		// Scale percentage positions to viewBox coordinates
		const fromX = from.x * scaleX;
		const fromY = from.y * scaleY;
		const toX = to.x * scaleX;
		const toY = to.y * scaleY;

		const dx = toX - fromX;
		const dy = toY - fromY;
		const len = Math.sqrt(dx * dx + dy * dy) || 1;

		// Padding scales with container size (use average scale)
		const scale = (scaleX + scaleY) / 2;
		const pad = 4 * scale;
		const ox = (dx / len) * pad;
		const oy = (dy / len) * pad;

		const x1 = fromX + ox;
		const y1 = fromY + oy;
		const x2 = toX - ox;
		const y2 = toY - oy;

		if (conn.type === 'share') {
			// Share edges connect "You" to peers within the coalition
			// ALL share edges arc ABOVE the coalition - through top negative space
			// This ensures visibility and separates share from deliver edges
			const yDiff = Math.abs(y2 - y1);
			const horizontalThreshold = 8 * scaleY; // Tighter threshold

			if (yDiff < horizontalThreshold) {
				// Same row - gentle arc above (still visible, not hidden by nodes)
				const arcHeight = 12 * scaleY;
				const controlX = (x1 + x2) / 2;
				const controlY = Math.min(y1, y2) - arcHeight;
				return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
			}

			// Different rows - arc ABOVE row 1, through top negative space
			// This is critical: share edges must be visible above the coalition
			const distance = Math.abs(dx);

			// Arc height scales with distance, but always above row 1
			const minArcHeight = 18 * scaleY;
			const distanceBonus = distance * 0.2;
			const arcHeight = minArcHeight + distanceBonus;

			// Control point above the HIGHER node (row 1)
			const controlX = (x1 + x2) / 2;
			const controlY = Math.min(y1, y2) - arcHeight;

			return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
		} else {
			// Deliver edges: straight lines down to targets
			return `M ${x1} ${y1} L ${x2} ${y2}`;
		}
	}

	function getEdgeDelay(conn: Connection, indexInPhase: number): number {
		const phaseStart = {
			'you-send': TIMING.phase1Start,
			'you-share': TIMING.phase2Start,
			'peers-send': TIMING.phase3Start
		}[conn.phase];
		return phaseStart + indexInPhase * TIMING.edgeStagger;
	}

	function getConnectionsForNode(nodeId: string): Connection[] {
		return allConnections.filter((c) => c.from === nodeId || c.to === nodeId);
	}

	function getConnectedNodeIds(nodeId: string): string[] {
		const connections = getConnectionsForNode(nodeId);
		const ids = new Set<string>();
		connections.forEach((c) => {
			ids.add(c.from);
			ids.add(c.to);
		});
		ids.delete(nodeId);
		return Array.from(ids);
	}

	// ─────────────────────────────────────────────────────────────
	// State
	// ─────────────────────────────────────────────────────────────

	let reducedMotion = $state(false);
	let hoveredId = $state<string | null>(null);
	let mounted = $state(false);
	let narrativeComplete = $state(false);

	const connectedNodeIds = $derived(hoveredId ? getConnectedNodeIds(hoveredId) : []);
	const activeConnections = $derived(hoveredId ? getConnectionsForNode(hoveredId) : []);

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// Track container dimensions for responsive SVG
		let resizeObserver: ResizeObserver | null = null;
		if (containerEl) {
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					containerWidth = entry.contentRect.width || 100;
					containerHeight = entry.contentRect.height || 100;
				}
			});
			resizeObserver.observe(containerEl);

			// Initial measurement
			containerWidth = containerEl.clientWidth || 100;
			containerHeight = containerEl.clientHeight || 100;
		}

		// Start mount animation
		requestAnimationFrame(() => {
			mounted = true;
		});

		// Mark narrative complete after all edges drawn
		setTimeout(() => {
			narrativeComplete = true;
		}, TIMING.ambientDelay);

		return () => {
			resizeObserver?.disconnect();
		};
	});

	function isConnectionActive(conn: Connection): boolean {
		return activeConnections.some((ac) => ac.from === conn.from && ac.to === conn.to);
	}

	function getNodeState(nodeId: string): 'idle' | 'hovered' | 'connected' | 'dimmed' {
		if (!hoveredId) return 'idle';
		if (nodeId === hoveredId) return 'hovered';
		if (connectedNodeIds.includes(nodeId)) return 'connected';
		return 'dimmed';
	}

	// Track phase indices for stagger calculation
	let phase1Index = 0;
	let phase2Index = 0;
	let phase3Index = 0;

	function getPhaseIndex(conn: Connection): number {
		if (conn.phase === 'you-send') {
			const idx = youDeliverConnections.findIndex(
				(c) => c.from === conn.from && c.to === conn.to
			);
			return idx;
		} else if (conn.phase === 'you-share') {
			const idx = shareConnections.findIndex(
				(c) => c.from === conn.from && c.to === conn.to
			);
			return idx;
		} else {
			const idx = peerDeliverConnections.findIndex(
				(c) => c.from === conn.from && c.to === conn.to
			);
			return idx;
		}
	}
</script>

<div
	class="relay-loom"
	class:mounted
	class:narrative-complete={narrativeComplete}
	class:reduced-motion={reducedMotion}
	style:--label-font-size={labelFontSize}
	style:--tag-font-size={tagFontSize}
	style:--micro-font-size={microFontSize}
	style:--node-padding={nodePadding}
	style:--node-min-width={nodeMinWidth}
	style:--node-max-width={nodeMaxWidth}
>
	<div class="canvas-container" bind:this={containerEl}>
		<svg viewBox={viewBox} class="edge-canvas" aria-hidden="true">
			<defs>
				<!-- Glow filter for active particles -->
				<filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				<!-- Define paths for each connection -->
				{#each allConnections as conn, i}
					<path id="edge-path-{i}" d={getEdgePath(conn)} />
				{/each}
			</defs>

			<!-- Layer 1: Edges with staged reveal -->
			<g class="edges-layer">
				{#each allConnections as conn, i}
					{@const phaseIndex = getPhaseIndex(conn)}
					{@const delay = getEdgeDelay(conn, phaseIndex)}
					{@const isActive = isConnectionActive(conn)}
					<use
						href="#edge-path-{i}"
						class="edge-drawing"
						class:share={conn.type === 'share'}
						class:deliver={conn.type === 'deliver'}
						class:active={isActive}
						style:--draw-delay="{delay}ms"
						style:--draw-duration="{TIMING.edgeDrawDuration}ms"
						style:--stroke-width="{isActive ? strokeWidthActive : strokeWidth}"
					/>
				{/each}
			</g>

			<!-- Layer 2: Ambient particles (after narrative completes) -->
			{#if !reducedMotion && narrativeComplete}
				<g class="particles-ambient">
					{#each allConnections as conn, i}
						{@const stagger = i * TIMING.ambientStagger}
						<circle
							r={particleRadiusAmbient}
							class="particle ambient"
							class:share={conn.type === 'share'}
							class:deliver={conn.type === 'deliver'}
							style:--particle-delay="{stagger}ms"
						>
							<animateMotion
								dur="{TIMING.ambientDuration}ms"
								repeatCount="indefinite"
								begin="{stagger}ms"
								calcMode="spline"
								keySplines="0.4 0 0.2 1"
								keyTimes="0;1"
							>
								<mpath href="#edge-path-{i}" />
							</animateMotion>
						</circle>
					{/each}
				</g>
			{/if}

			<!-- Layer 3: Active particles (hover response) -->
			{#if !reducedMotion && hoveredId}
				<g class="particles-active" filter="url(#particle-glow)">
					{#each activeConnections as conn}
						{@const pathIndex = allConnections.findIndex(
							(c) => c.from === conn.from && c.to === conn.to
						)}
						{#each [0, 1, 2] as particleIndex}
							{@const stagger = particleIndex * TIMING.activeStagger}
							<circle
								r={particleRadiusActive}
								class="particle active"
								class:share={conn.type === 'share'}
								class:deliver={conn.type === 'deliver'}
							>
								<animateMotion
									dur="{TIMING.activeDuration}ms"
									repeatCount="indefinite"
									begin="{stagger}ms"
									calcMode="spline"
									keySplines="0.33 1 0.68 1"
									keyTimes="0;1"
								>
									<mpath href="#edge-path-{pathIndex}" />
								</animateMotion>
							</circle>
						{/each}
					{/each}
				</g>
			{/if}
		</svg>

		<!-- Nodes -->
		{#each senderPositions as node}
			{@const state = getNodeState(node.id)}
			<button
				class="node sender"
				class:hovered={state === 'hovered'}
				class:connected={state === 'connected'}
				class:dimmed={state === 'dimmed'}
				style:left="{node.x}%"
				style:top="{node.y}%"
				onmouseenter={() => (hoveredId = node.id)}
				onmouseleave={() => (hoveredId = null)}
				onfocus={() => (hoveredId = node.id)}
				onblur={() => (hoveredId = null)}
			>
				<span class="glow-ring"></span>
				<span class="node-content">
					<span class="label" class:you-label={node.id === 'you'}>{node.label}</span>
					<span class="tag">{node.id === 'you' ? 'Write once' : 'Share link'}</span>
				</span>
			</button>
		{/each}

		{#each targetPositions as node}
			{@const state = getNodeState(node.id)}
			<button
				class="node target"
				class:hovered={state === 'hovered'}
				class:connected={state === 'connected'}
				class:dimmed={state === 'dimmed'}
				style:left="{node.x}%"
				style:top="{node.y}%"
				onmouseenter={() => (hoveredId = node.id)}
				onmouseleave={() => (hoveredId = null)}
				onfocus={() => (hoveredId = node.id)}
				onblur={() => (hoveredId = null)}
			>
				<span class="glow-ring"></span>
				<span class="node-content">
					<span class="label">{node.label}</span>
					{#if node.badge}
						<span class="micro">{node.badge}</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>
</div>

<style>
	/* ─────────────────────────────────────────────────────────────
	   Container
	   ───────────────────────────────────────────────────────────── */

	.relay-loom {
		--share-color: oklch(0.7 0.15 270);
		--share-color-bright: oklch(0.8 0.18 270);
		--share-glow: oklch(0.75 0.12 270 / 0.5);

		--deliver-color: oklch(0.75 0.14 175);
		--deliver-color-bright: oklch(0.85 0.16 175);
		--deliver-glow: oklch(0.8 0.12 175 / 0.5);

		--transition-fast: 150ms;
		--transition-normal: 220ms;

		position: relative;
		isolation: isolate;
		width: 100%;
		max-width: 820px;
		margin: 0 auto;
		padding: 1.5rem 1.75rem 2.5rem;
		border-radius: 0.75rem;
		border: 1px solid oklch(0.85 0.02 250);
		background: linear-gradient(
			to bottom right,
			oklch(0.99 0.005 250),
			oklch(0.97 0.01 250),
			oklch(0.96 0.015 250)
		);
		box-shadow:
			0 1px 3px oklch(0 0 0 / 0.04),
			0 18px 60px -45px oklch(0.25 0.05 250 / 0.45);
		overflow: hidden;
	}

	@media (min-width: 1024px) {
		.relay-loom {
			max-width: 860px;
		}
	}

	@media (min-width: 1280px) {
		.relay-loom {
			max-width: 900px;
		}
	}

	.canvas-container {
		position: relative;
		height: 520px;
		width: 100%;
	}

	@media (min-width: 640px) {
		.canvas-container {
			height: 560px;
		}
	}

	@media (min-width: 1024px) {
		.canvas-container {
			height: 580px;
		}
	}

	/* ─────────────────────────────────────────────────────────────
	   SVG Canvas
	   ───────────────────────────────────────────────────────────── */

	.edge-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	/* ─────────────────────────────────────────────────────────────
	   Edges with Staged Drawing Animation
	   ───────────────────────────────────────────────────────────── */

	.edge-drawing {
		fill: none;
		stroke-width: var(--stroke-width, 1.3);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 1000;
		stroke-dashoffset: 1000;
		opacity: 0;
		transition:
			stroke var(--transition-fast) ease-out,
			stroke-width var(--transition-fast) ease-out;
	}

	.edge-drawing.share {
		stroke: var(--share-color);
	}

	.edge-drawing.deliver {
		stroke: var(--deliver-color);
	}

	/* Staged reveal animation */
	.relay-loom.mounted .edge-drawing {
		animation: draw-edge var(--draw-duration, 800ms) ease-out forwards;
		animation-delay: var(--draw-delay, 0ms);
	}

	@keyframes draw-edge {
		0% {
			stroke-dashoffset: 1000;
			opacity: 0;
		}
		15% {
			opacity: 0.7;
		}
		100% {
			stroke-dashoffset: 0;
			opacity: 0.5;
		}
	}

	/* After narrative completes, edges settle to final state */
	.relay-loom.narrative-complete .edge-drawing {
		stroke-dasharray: none;
		stroke-dashoffset: 0;
		opacity: 0.4;
	}

	/* Hover intensifies connected edges */
	.edge-drawing.active {
		opacity: 0.75 !important;
	}

	.edge-drawing.active.share {
		stroke: var(--share-color-bright);
	}

	.edge-drawing.active.deliver {
		stroke: var(--deliver-color-bright);
	}

	/* Reduced motion: skip animation, show final state */
	.relay-loom.reduced-motion .edge-drawing {
		animation: none !important;
		stroke-dasharray: none !important;
		stroke-dashoffset: 0 !important;
		opacity: 0.4;
	}

	/* ─────────────────────────────────────────────────────────────
	   Particles
	   ───────────────────────────────────────────────────────────── */

	.particle {
		will-change: transform;
	}

	.particle.ambient {
		opacity: 0;
	}

	.particle.ambient.share {
		fill: var(--share-color);
	}

	.particle.ambient.deliver {
		fill: var(--deliver-color);
	}

	/* Fade in ambient particles after narrative - use animation delay to sync with SMIL begin */
	.relay-loom.narrative-complete .particle.ambient {
		animation: particle-fade-in 400ms ease-out forwards;
		animation-delay: var(--particle-delay, 0ms);
	}

	@keyframes particle-fade-in {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 0.55;
		}
	}

	.particle.active {
		opacity: 0.95;
	}

	.particle.active.share {
		fill: var(--share-color-bright);
	}

	.particle.active.deliver {
		fill: var(--deliver-color-bright);
	}

	/* Reduced motion: hide all particles */
	.relay-loom.reduced-motion .particles-ambient,
	.relay-loom.reduced-motion .particles-active {
		display: none;
	}

	/* ─────────────────────────────────────────────────────────────
	   Nodes
	   ───────────────────────────────────────────────────────────── */

	.node {
		position: absolute;
		transform: translate(-50%, -50%);
		min-width: var(--node-min-width, 96px);
		max-width: var(--node-max-width, 134px);
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		text-align: center;
		outline: none;
		/* Smooth position transitions during resize - perceptual continuity */
		transition:
			left 280ms cubic-bezier(0.4, 0, 0.2, 1),
			top 280ms cubic-bezier(0.4, 0, 0.2, 1),
			min-width 280ms cubic-bezier(0.4, 0, 0.2, 1),
			max-width 280ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.glow-ring {
		position: absolute;
		inset: -10px;
		border-radius: 18px;
		background: radial-gradient(
			circle at center,
			var(--node-glow, transparent) 0%,
			transparent 70%
		);
		opacity: 0;
		transition: opacity var(--transition-fast) ease-out;
		pointer-events: none;
	}

	.node-content {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: var(--node-padding, 8px 10px);
		border-radius: 12px;
		border: 1px solid oklch(0.7 0.02 250 / 0.45);
		background: oklch(1 0 0 / 0.92);
		box-shadow:
			inset 0 1px 6px oklch(0 0 0 / 0.06),
			0 20px 50px -28px oklch(0.2 0.05 250 / 0.4);
		backdrop-filter: blur(4px);
		transition:
			transform var(--transition-normal) ease-out,
			box-shadow var(--transition-normal) ease-out,
			border-color var(--transition-normal) ease-out,
			opacity var(--transition-fast) ease-out,
			padding var(--transition-normal) ease-out;
	}

	.node.sender {
		--node-glow: var(--share-glow);
	}

	.node.sender .node-content {
		border-color: oklch(0.65 0.15 270 / 0.5);
	}

	.node.target {
		--node-glow: var(--deliver-glow);
	}

	.node.target .node-content {
		border-color: oklch(0.7 0.12 175 / 0.45);
		background:
			radial-gradient(circle at 80% 20%, oklch(0.85 0.1 175 / 0.08), transparent 60%),
			oklch(1 0 0 / 0.92);
	}

	/* States */
	.node.hovered .glow-ring {
		opacity: 1;
	}

	.node.hovered .node-content,
	.node:focus-visible .node-content {
		transform: scale(1.04);
		box-shadow:
			inset 0 1px 6px oklch(0 0 0 / 0.06),
			0 24px 60px -24px oklch(0.3 0.1 270 / 0.35);
	}

	.node.sender.hovered .node-content,
	.node.sender:focus-visible .node-content {
		border-color: oklch(0.6 0.18 270 / 0.7);
	}

	.node.target.hovered .node-content,
	.node.target:focus-visible .node-content {
		border-color: oklch(0.65 0.15 175 / 0.7);
		box-shadow:
			inset 0 1px 6px oklch(0 0 0 / 0.06),
			0 24px 60px -24px oklch(0.4 0.12 175 / 0.35);
	}

	.node.connected .node-content {
		border-color: oklch(0.6 0.1 250 / 0.6);
	}

	.node.connected .glow-ring {
		opacity: 0.4;
	}

	.node.dimmed .node-content {
		opacity: 0.5;
		filter: saturate(0.7);
	}

	/* Focus visible ring */
	.node:focus-visible .node-content {
		outline: 2px solid oklch(0.6 0.15 270 / 0.5);
		outline-offset: 2px;
	}

	/* ─────────────────────────────────────────────────────────────
	   Node Labels
	   ───────────────────────────────────────────────────────────── */

	.label {
		font-weight: 600;
		font-size: var(--label-font-size, 12px);
		color: oklch(0.25 0.02 250);
		transition: font-size var(--transition-normal) ease-out;
	}

	.you-label {
		color: oklch(0.55 0.18 220);
	}

	.tag {
		font-size: var(--tag-font-size, 10px);
		color: oklch(0.5 0.02 250);
		transition: font-size var(--transition-normal) ease-out;
	}

	.micro {
		display: inline-flex;
		padding: 4px 7px;
		border-radius: 999px;
		background: oklch(0.7 0.02 250 / 0.12);
		font-size: var(--micro-font-size, 10px);
		color: oklch(0.45 0.02 250);
		transition: font-size var(--transition-normal) ease-out;
	}
</style>
