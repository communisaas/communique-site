<script lang="ts">
	import { spring } from 'svelte/motion';
	// // import { fade } from 'svelte/transition';
	import { Send, ChevronDown, Sparkles } from '@lucide/svelte';

	let {
		variant = 'primary',
		size = 'default',
		type = 'button',
		cursor = 'pointer',
		classNames = '',
		text = undefined,
		href = undefined,
		rel = undefined,
		buttonElement = $bindable(),
		testId = undefined,
		disabled = false,
		loading = false,
		enableFlight = false,
		flightDirection = 'default',
		flightState = $bindable('ready'),
		animationType = 'flight',
		icon = 'send',
		user = null,
		onclick,
		onmouseover,
		onmouseenter,
		onmouseleave,
		onfocus,
		onblur,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'magical' | 'verified' | 'community' | 'danger';
		size?: 'sm' | 'default' | 'lg';
		type?: 'button' | 'submit';
		cursor?: 'default' | 'help' | 'alias' | 'pointer';
		classNames?: string;
		text?: string | undefined;
		href?: string | undefined;
		rel?: string | undefined;
		buttonElement?: HTMLButtonElement | undefined;
		testId?: string | undefined;
		disabled?: boolean;
		loading?: boolean;
		enableFlight?: boolean;
		flightDirection?: 'default' | 'down-right' | 'up-right';
		flightState?: 'ready' | 'taking-off' | 'flying' | 'sent' | 'departing' | 'returning';
		animationType?: 'flight' | 'bounce';
		icon?: 'send' | 'chevron-down' | 'sparkles';
		user?: { id: string; name: string | null } | null;
		onclick?: (__event: MouseEvent) => void;
		onmouseover?: (__event: MouseEvent) => void;
		onmouseenter?: (__event: MouseEvent) => void;
		onmouseleave?: (__event: MouseEvent) => void;
		onfocus?: (__event: FocusEvent) => void;
		onblur?: (__event: FocusEvent) => void;
		children?: import('svelte').Snippet;
	} = $props();

	let hovered = $state(false);
	let clicked = $state(false);
	
	// Select icon component based on prop
	const iconComponents = {
		'send': Send,
		'chevron-down': ChevronDown,
		'sparkles': Sparkles
	};
	const IconComponent = iconComponents[icon];

	// Elegant spring animations for smooth interactions
	let buttonScale = spring(1, { stiffness: 0.4, damping: 0.8 });
	let shadowIntensity = spring(0, { stiffness: 0.3, damping: 0.9 });
	let glowIntensity = spring(0, { stiffness: 0.4, damping: 0.8 }); // For magical variant glow

	// Dynamic paper plane flight animation with realistic physics
	// All animations use springs for natural paper plane movement
	let planeX = spring(0, { stiffness: 0.3, damping: 0.7 });
	let planeY = spring(0, { stiffness: 0.25, damping: 0.6 });
	let planeOpacity = spring(1, { stiffness: 0.4, damping: 0.8 });
	let planeRotation = spring(0, { stiffness: 0.35, damping: 0.6 });
	let planeScale = spring(1, { stiffness: 0.3, damping: 0.7 });
	let planeBlur = spring(0, { stiffness: 0.4, damping: 0.8 });
	
	// Bounce animation for scroll indicators
	let bounceY = spring(0, { stiffness: 0.5, damping: 0.4 });
	let bounceScale = spring(1, { stiffness: 0.6, damping: 0.5 });

	// Second plane for diverging animation (Hero button only)
	let _plane2X = $state(0);
	let _plane2Y = $state(0);
	let _plane2Opacity = spring(0, { stiffness: 0.4, damping: 0.8 });
	let _plane2Rotation = spring(0, { stiffness: 0.35, damping: 0.6 });
	let _plane2Scale = spring(0, { stiffness: 0.3, damping: 0.7 });
	let _showSecondPlane = $state(false);

	// Target calculation for sublime flight paths
	function calculateTargetPositions() {
		if (typeof window === 'undefined') return { certified: null, direct: null };

		// Find the channel cards by looking for their identifying content
		const channelCards = document.querySelectorAll('[role="button"]');
		let certifiedCard: HTMLElement | null = null;
		let directCard: HTMLElement | null = null;

		channelCards.forEach((card) => {
			const text = card.textContent || '';
			if (text.includes('Verified Delivery')) {
				certifiedCard = card as HTMLElement;
			} else if (text.includes('Community Outreach')) {
				directCard = card as HTMLElement;
			}
		});

		const buttonRect = buttonElement?.getBoundingClientRect();
		if (!buttonRect) return { certified: null, direct: null };

		let certified = null;
		if (certifiedCard !== null) {
			const card = certifiedCard as HTMLElement;
			const rect = card.getBoundingClientRect();
			certified = {
				element: rect,
				target: {
					x: rect.left + rect.width * 0.25,
					y: rect.top + rect.height * 0.3
				}
			};
		}

		let direct = null;
		if (directCard !== null) {
			const card = directCard as HTMLElement;
			const rect = card.getBoundingClientRect();
			direct = {
				element: rect,
				target: {
					x: rect.left + rect.width * 0.25,
					y: rect.top + rect.height * 0.3
				}
			};
		}

		return { certified, direct, buttonRect };
	}

	// Calculate parabolic trajectory for sublime flight paths
	function _calculateFlightPath(
		target: { x: number; y: number },
		buttonRect: DOMRect,
		progress: number
	) {
		const startX = buttonRect.right - 20; // Start from icon position
		const startY = buttonRect.top + buttonRect.height / 2;

		// Calculate relative position from button
		const deltaX = target.x - startX;
		const deltaY = target.y - startY;

		// Create a true parabolic arc that goes up then down
		const arcHeight = Math.max(Math.abs(deltaY), 100) + 60; // Ensure sufficient upward arc
		const peakProgress = 0.35; // Peak slightly earlier for more natural descent

		let x, y;

		if (progress <= peakProgress) {
			// Rising arc - elegant upward motion
			const t = progress / peakProgress;
			x = deltaX * t * 0.25; // Even slower horizontal start
			y = deltaY * t * 0.1 - arcHeight * (t - t * t * 0.5); // Strong upward emphasis
		} else {
			// Descending arc - graceful dive toward target
			const t = (progress - peakProgress) / (1 - peakProgress);
			x = deltaX * (0.25 + 0.75 * t); // Accelerated horizontal movement
			y = deltaY * (0.1 + 0.9 * t) - arcHeight * (1 - t) * (1 - t); // True parabolic descent
		}

		// Calculate rotation for natural banking during arc
		let rotation;
		if (progress <= peakProgress) {
			// During ascent - gentle banking
			rotation = -5 + (progress / peakProgress) * 15;
		} else {
			// During descent - diving angle
			const t = (progress - peakProgress) / (1 - peakProgress);
			const diveAngle = (Math.atan2(deltaY * 0.9, deltaX * 0.75) * 180) / Math.PI;
			rotation = 10 + diveAngle * t;
		}

		return { x, y, rotation };
	}

	$effect(() => {
		if (hovered && !disabled) {
			buttonScale.set(1.02);
			shadowIntensity.set(1);
			if (variant === 'magical') {
				glowIntensity.set(1);
			}
			// Animation based on type
			if (animationType === 'bounce') {
				// Gentle bounce for scroll indicators
				bounceY.set(-3);
				bounceScale.set(1.1);
			} else if (animationType === 'flight') {
				// Subtle plane movement on hover - breathes life into the button
				// Works even when flight is disabled for hover effect
				if (!enableFlight || flightState === 'ready') {
					planeX.set(3);
					planeY.set(-2);
					planeRotation.set(-5);
					planeScale.set(1.05);
				}
			}
		} else {
			buttonScale.set(1);
			shadowIntensity.set(0);
			glowIntensity.set(0);
			// Reset animations
			bounceY.set(0);
			bounceScale.set(1);
			// Reset plane position when not hovering
			if (animationType === 'flight' && (!enableFlight || flightState === 'ready')) {
				planeX.set(0);
				planeY.set(0);
				planeRotation.set(0);
				planeScale.set(1);
			}
		}
	});

	// Engaging paper plane flight animation with realistic physics and visual flair
	$effect(() => {
		if (enableFlight) {
			if (flightDirection === 'down-right') {
				// Special animation for Hero "Start Writing" button with dynamic targeting
				const _targets = calculateTargetPositions();

				switch (flightState) {
					case 'taking-off':
						// Elegant launch - natural paper plane physics
						planeX.set(45);
						planeY.set(-12);
						planeRotation.set(-8); // Gentle banking for natural launch
						planeScale.set(1.1);
						planeOpacity.set(0.95);
						planeBlur.set(0.3);
						break;
					case 'flying':
						// Continue elegant arc with natural deceleration
						planeX.set(80);
						planeY.set(-25);
						planeRotation.set(5); // Leveling out
						planeScale.set(1.2);
						planeOpacity.set(0.85);
						planeBlur.set(0.6);
						break;
					case 'sent':
						// Natural banking turn with realistic physics
						planeX.set(140);
						planeY.set(-40);
						planeRotation.set(25); // Natural banking
						planeScale.set(1.1);
						planeOpacity.set(0.75);
						planeBlur.set(1.0);
						break;
					case 'departing':
						// Gravity and air resistance taking effect
						planeX.set(220);
						planeY.set(-55);
						planeRotation.set(30); // Continuing bank
						planeScale.set(0.7);
						planeOpacity.set(0);
						planeBlur.set(1.8);
						break;
					case 'returning':
						// Instant reset - plane shoots in from bottom-left like caught mid-flight
						// Position far bottom-left, as if caught and thrown back
						planeX.set(-25, { hard: true });
						planeY.set(20, { hard: true });
						planeRotation.set(35, { hard: true }); // Angled as if thrown
						planeScale.set(0.6, { hard: true });
						planeOpacity.set(0.4, { hard: true });
						planeBlur.set(0.8, { hard: true });
						// Immediately shoot towards position with spring physics
						setTimeout(() => {
							// Overshoot slightly past center for realistic catch-and-release effect
							planeX.set(2);
							planeY.set(-1);
							planeRotation.set(-3);
							planeScale.set(1.05);
							planeOpacity.set(1);
							planeBlur.set(0);
						}, 20);
						// Then settle into final position
						setTimeout(() => {
							planeX.set(0);
							planeY.set(0);
							planeRotation.set(0);
							planeScale.set(1);
						}, 150);
						break;
					default: // 'ready'
						// Maintain final position
						planeX.set(0);
						planeY.set(0);
						planeRotation.set(0);
						planeScale.set(1);
						planeOpacity.set(1);
						planeBlur.set(0);
						// Hide second plane (no longer used)
						_showSecondPlane = false;
				}
			} else {
				// Default animation for send buttons - dramatic and powerful
				switch (flightState) {
					case 'taking-off':
						// Powerful launch with natural physics variation
						planeX.set(45);
						planeY.set(-8);
						planeRotation.set(-12); // Banking left for the turn
						planeScale.set(1.1);
						planeOpacity.set(0.95);
						planeBlur.set(0.5);
						break;
					case 'flying':
						// Dramatic arc with realistic paper plane movement
						planeX.set(120);
						planeY.set(-35); // Higher arc
						planeRotation.set(25); // Banking right into the dive
						planeScale.set(1.3); // Growing larger as it "flies toward us"
						planeOpacity.set(0.7);
						planeBlur.set(1.2); // Motion blur effect
						break;
					case 'sent':
						// Peak trajectory with natural deceleration
						planeX.set(140);
						planeY.set(-40);
						planeRotation.set(30);
						planeScale.set(1.2);
						planeOpacity.set(0.8);
						planeBlur.set(1);
						break;
					case 'departing':
						// Natural descent with air resistance
						planeX.set(250); // Far off right
						planeY.set(-60); // Continuing upward
						planeRotation.set(35); // Still banking
						planeScale.set(0.6); // Getting smaller
						planeOpacity.set(0); // Completely faded out
						planeBlur.set(2); // Heavy blur
						break;
					case 'returning':
						// Instant reset - plane shoots in from bottom-left like caught mid-flight
						// Position far bottom-left, as if caught and thrown back
						planeX.set(-25, { hard: true });
						planeY.set(20, { hard: true });
						planeRotation.set(35, { hard: true }); // Angled as if thrown
						planeScale.set(0.6, { hard: true });
						planeOpacity.set(0.4, { hard: true });
						planeBlur.set(0.8, { hard: true });
						// Immediately shoot towards position with spring physics
						setTimeout(() => {
							// Overshoot slightly past center for realistic catch-and-release effect
							planeX.set(2);
							planeY.set(-1);
							planeRotation.set(-3);
							planeScale.set(1.05);
							planeOpacity.set(1);
							planeBlur.set(0);
						}, 20);
						// Then settle into final position
						setTimeout(() => {
							planeX.set(0);
							planeY.set(0);
							planeRotation.set(0);
							planeScale.set(1);
						}, 150);
						break;
					default: // 'ready'
						// Maintain final position
						planeX.set(0);
						planeY.set(0);
						planeRotation.set(0);
						planeScale.set(1);
						planeOpacity.set(1);
						planeBlur.set(0);
				}
			}
		}
	});

	function handleClick(__event: MouseEvent) {
		if (!disabled && !loading) {
			clicked = true;

			if (animationType === 'bounce') {
				// Bounce animation for scroll action
				buttonScale.set(0.95);
				bounceY.set(5);
				bounceScale.set(0.9);
				
				setTimeout(() => {
					bounceY.set(-8);
					bounceScale.set(1.15);
					buttonScale.set(1.05);
				}, 150);
				
				setTimeout(() => {
					bounceY.set(0);
					bounceScale.set(1);
					buttonScale.set(1);
					clicked = false;
				}, 400);
			} else if (enableFlight && flightState === 'ready') {
				// Start flight sequence with anticipation
				flightState = 'taking-off';
				buttonScale.set(0.96); // Stronger press feedback

				// Clear clicked state quickly for flight buttons
				setTimeout(() => {
					clicked = false;
				}, 150);

				// Takeoff phase - longer to show the banking turn
				setTimeout(() => {
					if (flightState === 'taking-off') {
						flightState = 'flying';
					}
				}, 400);

				// Flight phase - dramatic arc with scale and blur
				setTimeout(() => {
					if (flightState === 'flying') {
						flightState = 'sent';
						buttonScale.set(1.03); // Slight success bounce
					}
				}, 800);

				// Continue off screen
				setTimeout(() => {
					if (flightState === 'sent') {
						flightState = 'departing';
					}
				}, 1200);

				// Button settle
				setTimeout(() => {
					buttonScale.set(1);
				}, 1100);

				// Transition to returning state for pop-in effect
				setTimeout(() => {
					if (flightState === 'departing') {
						flightState = 'returning';
					}
				}, 1900);
				
				// Complete the return to ready state after spring settles
				setTimeout(() => {
					if (flightState === 'returning') {
						flightState = 'ready';
					}
				}, 2300);
			} else {
				// Standard click animation
				buttonScale.set(0.98);

				setTimeout(() => {
					buttonScale.set(1.02);
				}, 120);

				setTimeout(() => {
					buttonScale.set(1);
					clicked = false;
				}, 200);
			}

			// Call the onclick handler - delay for signed-in users to coordinate with animation
			const isSignedIn = user && user.id;
			const delay = isSignedIn ? 500 : 0;

			if (delay > 0) {
				setTimeout(() => {
					onclick?.(__event);
				}, delay);
			} else {
				onclick?.(__event);
			}
		}
	}

	function handleMouseEnter(__event: MouseEvent) {
		if (!disabled) {
			hovered = true;
			onmouseenter?.(__event);
		}
	}

	function handleMouseLeave(__event: MouseEvent) {
		if (!disabled) {
			hovered = false;
			onmouseleave?.(__event);
		}
	}

	// Size classes - cleaner with monospace vibes
	const sizeClasses = {
		sm: 'px-3 py-1.5 text-xs gap-1.5',
		default: 'px-4 py-2 text-sm gap-2',
		lg: 'px-6 py-3 text-base gap-2.5'
	};

	// Variant classes - governance-neutral participation aesthetic
	const variantClasses = {
		primary: `
			bg-participation-primary-500 hover:bg-participation-primary-600
			text-white
			border border-participation-primary-600
			shadow-sm hover:shadow-md
			transition-all duration-200
		`,
		secondary: `
			bg-participation-primary-50 hover:bg-participation-primary-100
			text-participation-primary-700 hover:text-participation-primary-800
			border border-participation-primary-200 hover:border-participation-primary-300
			shadow-sm
		`,
		magical: `
			bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600
			hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700
			text-white font-semibold
			border border-indigo-400/40
			shadow-xl shadow-purple-900/20
			relative overflow-hidden
		`,
		verified: `
			bg-verified-500 hover:bg-verified-600
			text-white
			border border-verified-600
			shadow-sm hover:shadow-md
		`,
		community: `
			bg-community-50 hover:bg-community-100
			text-community-700 hover:text-community-800
			border border-community-200
			shadow-sm
		`,
		danger: `
			bg-red-500 hover:bg-red-600
			text-white
			border border-red-600
			shadow-sm hover:shadow-md
		`
	};
</script>

<div class="relative inline-block">
	<!-- Glow effect for magical variant -->
	{#if variant === 'magical'}
		<div
			class="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-r from-indigo-400 via-blue-400 to-purple-400 opacity-50 blur-xl"
			style="transform: scale({1 + $glowIntensity * 0.2}); opacity: {0.2 + $glowIntensity * 0.3}"
		></div>
	{/if}

	<!-- Icon element - rendered based on animation type -->
	{#if animationType === 'bounce'}
		<!-- Bounce icon for scroll actions -->
		<span
			class="pointer-events-none absolute z-50"
			style="
				top: 50%;
				right: {size === 'lg' ? '24px' : size === 'sm' ? '12px' : '16px'};
				transform: translate(0, calc(-50% + {$bounceY}px)) scale({$bounceScale});
				transform-origin: center;
				color: {variant === 'magical' ? 'white' : 'currentColor'};
			"
		>
			<IconComponent class="h-4 w-4" />
		</span>
	{:else}
		<!-- Flight icon - always shown but only animates when enableFlight is true -->
		<span
			class="pointer-events-none absolute z-50 {enableFlight && flightState !== 'ready' && flightState !== 'returning'
				? 'transition-all duration-500 ease-out'
				: ''}"
			style="
				top: 50%;
				right: {size === 'lg' ? '24px' : size === 'sm' ? '12px' : '16px'};
				transform: translate({$planeX}px, calc(-50% + {$planeY}px)) rotate({$planeRotation}deg) scale({$planeScale});
				opacity: {enableFlight ? $planeOpacity : 1};
				filter: blur({enableFlight ? $planeBlur : 0}px) drop-shadow(0 4px 10px rgba(0, 0, 0, {enableFlight && flightState !== 'ready'
				? 0.6
				: 0}));
				transform-origin: center;
				color: {variant === 'magical'
				? enableFlight && (flightState === 'ready' || flightState === 'returning')
					? 'white'
					: enableFlight && flightState === 'taking-off'
						? 'rgb(100, 116, 139)'
						: enableFlight && flightState
							? 'rgb(51, 65, 85)'
							: 'white'
				: enableFlight && (flightState === 'ready' || flightState === 'returning')
					? 'currentColor'
					: enableFlight && flightState === 'taking-off'
						? 'rgb(100, 116, 139)'
						: enableFlight && flightState
							? 'rgb(51, 65, 85)'
							: 'currentColor'};
			"
		>
			<IconComponent class="h-4 w-4" />
		</span>
	{/if}

	{#if href}
		<a
			{href}
			{rel}
			target={href.startsWith('mailto:') ? undefined : '_blank'}
			data-testid={testId}
			class="
				inline-flex transform-gpu items-center justify-center rounded-md
				font-medium transition-all duration-200 ease-out
				focus:outline-none focus:ring-2 focus:ring-offset-2
				disabled:cursor-not-allowed disabled:opacity-50
				cursor-{cursor}
				select-none no-underline
				{sizeClasses[size]}
				{variantClasses[variant]}
				{classNames}
			"
			class:opacity-50={disabled}
			class:cursor-not-allowed={disabled}
			style="
				transform: scale({$buttonScale});
				transform-origin: center;
				box-shadow: 
					0 4px 6px -1px rgba(0, 0, 0, 0.1), 
					0 2px 4px -1px rgba(0, 0, 0, 0.06),
					0 0 {12 * $shadowIntensity}px rgba(71, 85, 105, {0.2 * $shadowIntensity});
			"
			aria-label={text}
			onclick={handleClick}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
			{onmouseover}
			{onfocus}
			{onblur}
		>
			<!-- Content -->
			<span class="relative flex items-center gap-2">
				{#if loading}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{:else}
					<!-- Static text content - never changes -->
					{@render children?.()}
					{#if !children && text}{text}{/if}

					<!-- Icon placeholder - actual icon always at root level -->
					<span class="relative inline-block h-4 w-4">
						<!-- Empty space - icon rendered at root for continuity -->
					</span>
				{/if}
			</span>

			<!-- Clean click feedback -->
			{#if clicked && !enableFlight}
				<div
					class="pointer-events-none absolute inset-0 rounded-md bg-white/10"
					style="animation: fadeOut 0.3s ease-out forwards"
				></div>
			{/if}
		</a>
	{:else}
		<button
			bind:this={buttonElement}
			{type}
			{disabled}
			data-testid={testId}
			class="
				inline-flex transform-gpu items-center justify-center rounded-md
				font-medium transition-all duration-200 ease-out
				focus:outline-none focus:ring-2 focus:ring-offset-2
				disabled:cursor-not-allowed disabled:opacity-50
				{sizeClasses[size]}
				{variantClasses[variant]}
				{classNames}
			"
			class:opacity-50={disabled}
			class:cursor-not-allowed={disabled}
			class:cursor-pointer={!disabled}
			style="
				transform: scale({$buttonScale});
				transform-origin: center;
				box-shadow: 
					0 4px 6px -1px rgba(0, 0, 0, 0.1), 
					0 2px 4px -1px rgba(0, 0, 0, 0.06),
					0 0 {12 * $shadowIntensity}px rgba(71, 85, 105, {0.2 * $shadowIntensity});
			"
			aria-label={text}
			onclick={handleClick}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
			{onmouseover}
			{onfocus}
			{onblur}
		>
			<!-- Content -->
			<span class="relative flex items-center gap-2">
				{#if loading}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					></div>
				{:else}
					<!-- Static text content - never changes -->
					{@render children?.()}
					{#if !children && text}{text}{/if}

					<!-- Icon placeholder - actual icon always at root level -->
					<span class="relative inline-block h-4 w-4">
						<!-- Empty space - icon rendered at root for continuity -->
					</span>
				{/if}
			</span>

			<!-- Clean click feedback -->
			{#if clicked && !enableFlight}
				<div
					class="pointer-events-none absolute inset-0 rounded-md bg-white/10"
					style="animation: fadeOut 0.3s ease-out forwards"
				></div>
			{/if}
		</button>
	{/if}
</div>

<style>
	@keyframes fadeOut {
		from {
			opacity: 0.2;
		}
		to {
			opacity: 0;
		}
	}
</style>
