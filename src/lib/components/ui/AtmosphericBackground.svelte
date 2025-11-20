<script lang="ts">
	/**
	 * AtmosphericBackground: Coordination Workspace
	 *
	 * The brutalist verdict: Stop decorating. Build infrastructure.
	 *
	 * - Soft violet tint (2-3% opacity) on near-white base → civic credibility + memorable difference
	 * - Subtle grain (1.5% opacity) → editorial quality, like archival paper
	 * - Zero animation, zero parallax, zero computational geometry
	 *
	 * Visual interest comes from coordination data (CoordinationTicker, live counts),
	 * not from the background fighting the interface.
	 */

	// Props
	let { class: className = '' }: { class?: string } = $props();

	// Grain texture: editorial quality, like print design
	// baseFrequency 0.65 = fine grain, numOctaves 3 = natural variation
	const grainTexture = `data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.015'/%3E%3C/svg%3E`;
</script>

<!-- Coordination Workspace: Calm, credible infrastructure for civic action -->
<div
	class="pointer-events-none fixed inset-0 -z-10 {className}"
	aria-hidden="true"
	style="
    background:
      radial-gradient(ellipse at top right,
        rgba(99, 102, 241, 0.03) 0%,
        transparent 60%
      ),
      radial-gradient(ellipse at bottom left,
        rgba(168, 85, 247, 0.02) 0%,
        transparent 60%
      ),
      #fafbfc;
  "
>
	<!-- Grain overlay: editorial quality, like archival paper -->
	<div
		class="absolute inset-0"
		style="
      background-image: url('{grainTexture}');
      mix-blend-mode: overlay;
      opacity: 1.0;
    "
	></div>
</div>

<style>
	/* Respect user motion preferences */
	@media (prefers-reduced-motion: reduce) {
		div {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
