<script lang="ts">
	import { spring } from 'svelte/motion';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Sparkles } from '@lucide/svelte';

	interface ReputationGainProps {
		amount: number;
		label?: string;
		variant?: 'xp' | 'reputation' | 'impact';
		emphasize?: boolean;
		autoDismiss?: boolean;
		dismissDelay?: number;
		onDismiss?: () => void;
	}

	let {
		amount = 0,
		label = 'XP earned',
		variant = 'xp',
		emphasize = true,
		autoDismiss = true,
		dismissDelay = 2000,
		onDismiss
	}: ReputationGainProps = $props();

	// Spring physics for smooth, dopamine-pushing animation
	let displayAmount = spring(0, {
		stiffness: 0.15, // Slow spring = satisfying bounce
		damping: 0.6 // Moderate damping for 1-2 oscillations
	});

	// Scale animation for emphasis (dopamine trigger!)
	let scale = spring(0, {
		stiffness: 0.25,
		damping: 0.7
	});

	// Glow intensity for visual reward
	let glow = spring(0, {
		stiffness: 0.2,
		damping: 0.8
	});

	let visible = $state(true);
	let prefersReducedMotion = $state(false);

	// Variant color schemes
	const variantStyles = {
		xp: {
			bg: 'bg-gradient-to-r from-violet-500 to-purple-600',
			text: 'text-white',
			glow: 'shadow-violet-500/50',
			icon: 'text-violet-200'
		},
		reputation: {
			bg: 'bg-gradient-to-r from-emerald-500 to-green-600',
			text: 'text-white',
			glow: 'shadow-emerald-500/50',
			icon: 'text-emerald-200'
		},
		impact: {
			bg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
			text: 'text-white',
			glow: 'shadow-blue-500/50',
			icon: 'text-blue-200'
		}
	};

	const styles = variantStyles[variant];

	// Detect user's motion preference
	$effect(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mediaQuery.matches;

		const handleChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	});

	// Animate on mount
	$effect(() => {
		if (amount > 0) {
			// Delay initial animation slightly for better visual impact
			setTimeout(() => {
				displayAmount.set(amount);
				if (!prefersReducedMotion && emphasize) {
					scale.set(1);
					glow.set(1);

					// Pulse scale for dopamine feedback
					setTimeout(() => scale.set(1.1), 100);
					setTimeout(() => scale.set(1), 300);

					// Fade glow after initial burst
					setTimeout(() => glow.set(0.3), 500);
				} else {
					scale.set(1);
					glow.set(0.3);
				}
			}, 50);
		}
	});

	// Auto-dismiss after delay
	$effect(() => {
		if (autoDismiss && amount > 0) {
			const timeout = setTimeout(() => {
				dismiss();
			}, dismissDelay);
			return () => clearTimeout(timeout);
		}
	});

	function dismiss() {
		visible = false;
		onDismiss?.();
	}

	const shouldAnimate = !prefersReducedMotion;
</script>

{#if visible && amount > 0}
	<div
		class="fixed bottom-6 right-6 z-50"
		in:fly={{ y: 20, duration: 400, easing: quintOut }}
		out:fade={{ duration: 200 }}
		role="status"
		aria-live="polite"
		aria-label="+{amount} {label}"
	>
		<div
			class="
				{styles.bg}
				{styles.text}
				relative overflow-hidden
				rounded-full px-5 py-3
				shadow-lg {styles.glow}
				transition-shadow duration-300
			"
			style="
				transform: scale({shouldAnimate ? $scale : 1});
				transform-origin: center;
				box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2),
				            0 0 {30 * $glow}px {variant === 'xp'
				? 'rgba(139, 92, 246, 0.5)'
				: variant === 'reputation'
					? 'rgba(16, 185, 129, 0.5)'
					: 'rgba(59, 130, 246, 0.5)'};
			"
		>
			<!-- Animated background gradient -->
			<div
				class="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5"
				style="opacity: {$glow * 0.5}"
			></div>

			<!-- Content -->
			<div class="relative flex items-center gap-2.5">
				<!-- Icon: Sparkles for reward feedback -->
				<Sparkles
					class="h-5 w-5 {styles.icon}"
					style="
						transform: rotate({shouldAnimate ? $glow * 15 : 0}deg);
						transition: transform 0.3s ease-out;
					"
					aria-hidden="true"
				/>

				<!-- Amount: JetBrains Mono for data clarity -->
				<span
					class="font-mono text-lg font-bold tabular-nums"
					style="
						text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
					"
				>
					+{Math.floor($displayAmount).toLocaleString()}
				</span>

				<!-- Label: Satoshi for brand voice -->
				<span class="font-brand text-sm font-medium">
					{label}
				</span>
			</div>

			<!-- Shimmer effect (dopamine-pushing!) -->
			{#if shouldAnimate && emphasize}
				<div
					class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
					style="
						transform: translateX({-100 + $glow * 200}%);
						transition: transform 0.6s ease-out;
					"
				></div>
			{/if}
		</div>

		<!-- Dismiss button (optional manual dismiss) -->
		{#if !autoDismiss}
			<button
				onclick={dismiss}
				class="
					absolute -right-2 -top-2
					flex h-6 w-6 items-center justify-center
					rounded-full bg-white text-slate-600
					shadow-md transition-all hover:scale-110 hover:bg-slate-50
				"
				aria-label="Dismiss notification"
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		{/if}
	</div>
{/if}

<style>
	/* Ensure GPU acceleration for smooth animation */
	div {
		will-change: transform;
	}

	/* Override animations when motion should be reduced */
	@media (prefers-reduced-motion: reduce) {
		div {
			will-change: auto;
			transform: none !important;
			animation: none !important;
		}
	}
</style>
