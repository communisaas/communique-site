<!--
  Confetti.svelte

  Lightweight celebration particles for successful delivery.

  Perceptual Engineering Principles:
  - Celebration feels earned, not excessive
  - Short duration matches CELEBRATION_PULSE (~400-600ms)
  - Particles follow natural physics (gravity, deceleration)
  - Colors match success palette (green/blue tints)
  - Respects prefers-reduced-motion
  - CSS-based for performance (no canvas)
-->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		/** Number of particles (default: 24 for subtle effect) */
		count?: number;
		/** Duration in ms before cleanup (default: 2000) */
		duration?: number;
		/** Whether to auto-trigger on mount */
		active?: boolean;
	}

	let { count = 24, duration = 2000, active = true }: Props = $props();

	// Generate particles with varied properties
	interface Particle {
		id: number;
		x: number; // Start X position (%)
		delay: number; // Animation delay (ms)
		size: number; // Particle size (px)
		color: string; // Particle color
		drift: number; // Horizontal drift direction
	}

	let particles = $state<Particle[]>([]);
	let visible = $state(false);

	// Success-themed colors (green/blue palette)
	const colors = [
		'oklch(0.75 0.18 145)', // Bright green
		'oklch(0.70 0.15 145)', // Medium green
		'oklch(0.80 0.12 160)', // Teal
		'oklch(0.75 0.10 200)', // Light blue
		'oklch(0.85 0.08 145)', // Pale green
		'oklch(0.70 0.20 130)' // Yellow-green
	];

	function generateParticles() {
		particles = Array.from({ length: count }, (_, i) => ({
			id: i,
			x: 20 + Math.random() * 60, // Cluster in center 60%
			delay: Math.random() * 200, // Stagger start
			size: 4 + Math.random() * 6, // 4-10px
			color: colors[Math.floor(Math.random() * colors.length)],
			drift: (Math.random() - 0.5) * 2 // -1 to 1
		}));
	}

	function trigger() {
		generateParticles();
		visible = true;

		// Cleanup after animation
		setTimeout(() => {
			visible = false;
			particles = [];
		}, duration);
	}

	onMount(() => {
		if (active) {
			// Small delay to ensure component is rendered
			requestAnimationFrame(() => trigger());
		}
	});

	// Allow external triggering
	export function fire() {
		trigger();
	}
</script>

{#if visible}
	<div class="confetti-container" aria-hidden="true">
		{#each particles as particle (particle.id)}
			<div
				class="particle"
				style="
					left: {particle.x}%;
					animation-delay: {particle.delay}ms;
					--size: {particle.size}px;
					--color: {particle.color};
					--drift: {particle.drift};
				"
			></div>
		{/each}
	</div>
{/if}

<style>
	.confetti-container {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 10;
	}

	.particle {
		position: absolute;
		top: 30%;
		width: var(--size);
		height: var(--size);
		background: var(--color);
		border-radius: 2px;
		opacity: 0;
		animation: confetti-fall 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
		transform-origin: center;
	}

	@keyframes confetti-fall {
		0% {
			opacity: 1;
			transform: translateY(0) translateX(0) rotate(0deg) scale(1);
		}
		20% {
			opacity: 1;
			transform: translateY(20px)
				translateX(calc(var(--drift) * 30px))
				rotate(calc(var(--drift) * 90deg))
				scale(1);
		}
		100% {
			opacity: 0;
			transform: translateY(150px)
				translateX(calc(var(--drift) * 80px))
				rotate(calc(var(--drift) * 360deg))
				scale(0.5);
		}
	}

	/* Reduced motion: simple fade instead of movement */
	@media (prefers-reduced-motion: reduce) {
		.particle {
			animation: confetti-fade 0.8s ease-out forwards;
		}

		@keyframes confetti-fade {
			0% {
				opacity: 1;
				transform: scale(1);
			}
			100% {
				opacity: 0;
				transform: scale(0.8);
			}
		}
	}
</style>
