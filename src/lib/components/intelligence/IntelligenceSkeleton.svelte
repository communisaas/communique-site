<script lang="ts">
	/**
	 * IntelligenceSkeleton: Loading placeholder for streaming items
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Mimics actual card structure to reduce layout shift
	 * - Pulse animation signals "loading" without text
	 * - Randomized widths create organic feel (not robotic)
	 * - Low contrast to avoid competing with real content
	 */

	interface Props {
		count?: number;
	}

	let { count = 3 }: Props = $props();

	// Randomize widths for organic appearance
	const randomWidth = (min: number, max: number) =>
		Math.floor(Math.random() * (max - min + 1)) + min;
</script>

{#each Array(count) as _, i}
	<div
		class="skeleton-item rounded-lg border border-slate-200 bg-white p-4 space-y-3
			shadow-sm animate-pulse"
		aria-hidden="true"
	>
		<!-- Header: Icon + Title -->
		<div class="flex items-start gap-3">
			<div class="skeleton-icon h-8 w-8 rounded-md bg-slate-200"></div>
			<div class="flex-1 space-y-2">
				<div class="skeleton-title h-4 bg-slate-200 rounded" style="width: {randomWidth(60, 90)}%"></div>
				<div class="skeleton-title h-4 bg-slate-200 rounded" style="width: {randomWidth(40, 70)}%"></div>
			</div>
			<div class="skeleton-badge h-5 w-12 bg-slate-200 rounded-full"></div>
		</div>

		<!-- Metadata line -->
		<div class="flex items-center gap-2">
			<div class="h-3 w-20 bg-slate-200 rounded"></div>
			<div class="h-2 w-2 bg-slate-200 rounded-full"></div>
			<div class="h-3 w-16 bg-slate-200 rounded"></div>
		</div>

		<!-- Summary lines -->
		<div class="space-y-2">
			<div class="h-3 bg-slate-200 rounded" style="width: 100%"></div>
			<div class="h-3 bg-slate-200 rounded" style="width: {randomWidth(75, 95)}%"></div>
			<div class="h-3 bg-slate-200 rounded" style="width: {randomWidth(60, 85)}%"></div>
		</div>

		<!-- Topic chips -->
		<div class="flex gap-1.5">
			{#each Array(randomWidth(2, 4)) as _}
				<div class="h-5 w-16 bg-slate-200 rounded-full"></div>
			{/each}
		</div>
	</div>
{/each}

<style>
	/* Pulse animation with slight delay per item for cascade effect */
	.skeleton-item {
		animation-duration: 1.5s;
		animation-iteration-count: infinite;
	}

	.skeleton-item:nth-child(2) {
		animation-delay: 0.1s;
	}

	.skeleton-item:nth-child(3) {
		animation-delay: 0.2s;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
