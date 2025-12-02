<script lang="ts">
	/**
	 * PrecisionUnlockCard: Contextual progression after value demonstration
	 *
	 * DESIGN PHILOSOPHY (Linear pattern):
	 * - Appears AFTER first template section (user has seen value)
	 * - Shows specific benefit (12 San Francisco templates)
	 * - Clear action-benefit relationship (Enter address → See city templates)
	 * - Gentle entrance animation (iOS spring curve)
	 *
	 * PLACEMENT:
	 * - Between template sections (natural pause point)
	 * - Only when next tier has templates (no empty promises)
	 * - After scroll engagement (not immediate interruption)
	 */

	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface PrecisionUnlockCardProps {
		nextUnlock: {
			level: 'city' | 'district';
			count: number;
		};
		onUnlock: () => void;
	}

	let { nextUnlock, onUnlock }: PrecisionUnlockCardProps = $props();

	// Benefit copy based on precision level
	const benefitText = $derived.by(() => {
		if (nextUnlock.level === 'city') {
			return 'See local campaigns in your area';
		}
		return 'See campaigns in your district';
	});
</script>

<div
	class="precision-unlock-card my-6 overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm transition-shadow hover:shadow-md"
	transition:slide={{ duration: 400, easing: cubicOut }}
>
	<div class="flex items-center gap-3">
		<!-- Visual attention hook -->
		<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
			<svg
				class="h-5 w-5 text-blue-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
		</div>

		<div class="min-w-0 flex-1">
			<!-- Value proposition (specific count) -->
			<h3 class="text-base font-semibold text-slate-900">
				{nextUnlock.count}
				{nextUnlock.level}
				{nextUnlock.count === 1 ? 'template' : 'templates'} available
			</h3>

			<!-- Benefit (what you'll see) -->
			<p class="text-sm text-slate-600">
				{benefitText}
			</p>
		</div>

		<!-- Action button (clear CTA) -->
		<button
			onclick={onUnlock}
			class="flex-shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:bg-blue-800"
		>
			Enter your {nextUnlock.level} →
		</button>
	</div>
</div>

<style>
	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.precision-unlock-card {
		animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.precision-unlock-card {
			animation: none;
		}
	}
</style>
