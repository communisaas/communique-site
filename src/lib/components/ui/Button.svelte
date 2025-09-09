<script lang="ts">
	import { spring } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { Send } from '@lucide/svelte';

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
		onclick,
		onmouseover,
		onmouseenter,
		onmouseleave,
		onfocus,
		onblur,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'magical' | 'certified' | 'direct';
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
		flightState?: 'ready' | 'taking-off' | 'flying' | 'sent' | 'departing';
		onclick?: (event: MouseEvent) => void;
		onmouseover?: (event: MouseEvent) => void;
		onmouseenter?: (event: MouseEvent) => void;
		onmouseleave?: (event: MouseEvent) => void;
		onfocus?: (event: FocusEvent) => void;
		onblur?: (event: FocusEvent) => void;
		children?: import('svelte').Snippet;
	} = $props();

	let hovered = $state(false);
	let clicked = $state(false);
	
	// Elegant spring animations for smooth interactions
	let buttonScale = spring(1, { stiffness: 0.4, damping: 0.8 });
	let shadowIntensity = spring(0, { stiffness: 0.3, damping: 0.9 });
	let glowIntensity = spring(0, { stiffness: 0.4, damping: 0.8 }); // For magical variant glow
	
	// Dynamic paper plane flight animation with realistic physics
	// Position uses state for instant reset, effects use springs for smooth animation
	let planeX = $state(0);
	let planeY = $state(0);
	let planeOpacity = spring(1, { stiffness: 0.4, damping: 0.8 });
	let planeRotation = spring(0, { stiffness: 0.35, damping: 0.6 });
	let planeScale = spring(1, { stiffness: 0.3, damping: 0.7 });
	let planeBlur = spring(0, { stiffness: 0.4, damping: 0.8 });
	
	// Second plane for diverging animation (Hero button only)
	let plane2X = $state(0);
	let plane2Y = $state(0);
	let plane2Opacity = spring(0, { stiffness: 0.4, damping: 0.8 });
	let plane2Rotation = spring(0, { stiffness: 0.35, damping: 0.6 });
	let plane2Scale = spring(0, { stiffness: 0.3, damping: 0.7 });
	let showSecondPlane = $state(false);
	
	// Target calculation for sublime flight paths
	function calculateTargetPositions() {
		if (typeof window === 'undefined') return { certified: null, direct: null };
		
		// Find the channel cards by looking for their identifying content
		const channelCards = document.querySelectorAll('[role="button"]');
		let certifiedCard = null;
		let directCard = null;
		
		channelCards.forEach(card => {
			const text = card.textContent || '';
			if (text.includes('Certified Delivery')) {
				certifiedCard = card;
			} else if (text.includes('Direct Outreach')) {
				directCard = card;
			}
		});
		
		const buttonRect = buttonElement?.getBoundingClientRect();
		if (!buttonRect) return { certified: null, direct: null };
		
		const certified = certifiedCard ? {
			element: certifiedCard.getBoundingClientRect(),
			target: {
				x: certifiedCard.getBoundingClientRect().left + certifiedCard.getBoundingClientRect().width * 0.25,
				y: certifiedCard.getBoundingClientRect().top + certifiedCard.getBoundingClientRect().height * 0.3
			}
		} : null;
		
		const direct = directCard ? {
			element: directCard.getBoundingClientRect(),
			target: {
				x: directCard.getBoundingClientRect().left + directCard.getBoundingClientRect().width * 0.25,
				y: directCard.getBoundingClientRect().top + directCard.getBoundingClientRect().height * 0.3
			}
		} : null;
		
		return { certified, direct, buttonRect };
	}
	
	// Calculate parabolic trajectory for sublime flight paths
	function calculateFlightPath(target: {x: number, y: number}, buttonRect: DOMRect, progress: number) {
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
			const diveAngle = Math.atan2(deltaY * 0.9, deltaX * 0.75) * 180 / Math.PI;
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
		} else {
			buttonScale.set(1);
			shadowIntensity.set(0);
			glowIntensity.set(0);
		}
	});
	
	// Engaging paper plane flight animation with realistic physics and visual flair
	$effect(() => {
		if (enableFlight) {
			if (flightDirection === 'down-right') {
				// Special animation for Hero "Start Writing" button with dynamic targeting
				const targets = calculateTargetPositions();
				
				switch (flightState) {
					case 'taking-off':
						// Elegant launch like send button - upward arc with banking
						planeX = 45;
						planeY = -12;
						planeRotation.set(-8); // Gentle banking for natural launch
						planeScale.set(1.1);
						planeOpacity.set(0.95);
						planeBlur.set(0.3);
						break;
					case 'flying':
						// Continue elegant arc - main flight phase
						planeX = 80;
						planeY = -25;
						planeRotation.set(5); // Leveling out
						planeScale.set(1.2);
						planeOpacity.set(0.85);
						planeBlur.set(0.6);
						break;
					case 'sent':
						// Natural banking turn - like send button physics
						planeX = 140;
						planeY = -40;
						planeRotation.set(25); // Natural banking
						planeScale.set(1.1);
						planeOpacity.set(0.75);
						planeBlur.set(1.0);
						break;
					case 'departing':
						// Continue graceful flight off screen
						planeX = 220;
						planeY = -55;
						planeRotation.set(30); // Continuing bank
						planeScale.set(0.7);
						planeOpacity.set(0);
						planeBlur.set(1.8);
						break;
					default: // 'ready'
						// Smooth reset - clean re-materialization
						planeX = 0;
						planeY = 0;
						planeRotation.set(0);
						planeScale.set(1);
						planeOpacity.set(1);
						planeBlur.set(0);
						// Hide second plane (no longer used)
						showSecondPlane = false;
				}
			} else {
				// Default animation for send buttons - dramatic and powerful
				switch (flightState) {
					case 'taking-off':
						// Initial launch - slight upward arc with anticipation
						planeX = 45;
						planeY = -8;
						planeRotation.set(-12); // Banking left for the turn
						planeScale.set(1.1); // Slight grow as it "approaches"
						planeOpacity.set(0.95);
						planeBlur.set(0.5);
						break;
					case 'flying':
						// Main flight - dramatic curved trajectory like a real paper plane
						planeX = 120;
						planeY = -35; // Higher arc
						planeRotation.set(25); // Banking right into the dive
						planeScale.set(1.3); // Growing larger as it "flies toward us"
						planeOpacity.set(0.7);
						planeBlur.set(1.2); // Motion blur effect
						break;
					case 'sent':
						// Success state - plane at peak trajectory
						planeX = 140;
						planeY = -40;
						planeRotation.set(30);
						planeScale.set(1.2);
						planeOpacity.set(0.8);
						planeBlur.set(1);
						break;
					case 'departing':
						// Continue flying off screen to the right and fade away
						planeX = 250; // Far off right
						planeY = -60; // Continuing upward
						planeRotation.set(35); // Still banking
						planeScale.set(0.6); // Getting smaller
						planeOpacity.set(0); // Completely faded out
						planeBlur.set(2); // Heavy blur
						break;
					default: // 'ready'
						// Resting state - new plane ready to go (instant reset)
						planeX = 0;
						planeY = 0;
						planeRotation.set(0);
						planeScale.set(1);
						// Instant reset - new plane just appears
						planeOpacity.set(1);
						planeBlur.set(0);
				}
			}
		}
	});

	function handleClick(event: MouseEvent) {
		if (!disabled && !loading) {
			clicked = true;
			
			
			if (enableFlight && flightState === 'ready') {
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
				
				// Reset to ready - timed to minimize gap after plane fades
				setTimeout(() => {
					if (flightState === 'departing') {
						flightState = 'ready';
					}
				}, 1900);
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
			
			// Call the onclick handler AFTER setting up the flight animation
			onclick?.(event);
		}
	}

	function handleMouseEnter(event: MouseEvent) {
		if (!disabled) {
			hovered = true;
			onmouseenter?.(event);
		}
	}

	function handleMouseLeave(event: MouseEvent) {
		if (!disabled) {
			hovered = false;
			onmouseleave?.(event);
		}
	}

	// Size classes - cleaner with monospace vibes
	const sizeClasses = {
		sm: 'px-3 py-1.5 text-xs gap-1.5',
		default: 'px-4 py-2 text-sm gap-2',
		lg: 'px-6 py-3 text-base gap-2.5'
	};

	// Variant classes - matching monospace aesthetic with purple accent
	const variantClasses = {
		primary: `
			bg-blue-500 hover:bg-blue-600
			text-white
			border border-blue-600
			shadow-sm hover:shadow-md
			transition-all duration-200
		`,
		secondary: `
			bg-blue-50 hover:bg-blue-100
			text-blue-700 hover:text-blue-800
			border border-blue-200 hover:border-blue-300
			shadow-sm
		`,
		magical: `
			bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600
			hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700
			text-white font-semibold
			border border-indigo-400/40
			shadow-xl shadow-indigo-900/20
			relative overflow-hidden
		`,
		certified: `
			bg-emerald-500 hover:bg-emerald-600
			text-white
			border border-emerald-600
			shadow-sm hover:shadow-md
		`,
		direct: `
			bg-blue-50 hover:bg-blue-100
			text-blue-700 hover:text-blue-800
			border border-blue-200
			shadow-sm
		`
	};

</script>

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

<div class="relative inline-block" style="transform: scale({$buttonScale}); transform-origin: center;">
	<!-- Glow effect for magical variant -->
	{#if variant === 'magical'}
		<div 
			class="absolute inset-0 rounded-md blur-xl opacity-50 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 pointer-events-none"
			style="transform: scale({1 + $glowIntensity * 0.2}); opacity: {0.2 + $glowIntensity * 0.3}"
		></div>
	{/if}
	
	<!-- Single plane element - always rendered for perfect continuity -->
	{#if enableFlight}
		<span 
			class="absolute z-50 pointer-events-none {flightState !== 'ready' ? 'transition-all duration-500 ease-out' : ''}"
			style="
				top: 50%;
				right: {size === 'lg' ? '24px' : size === 'sm' ? '12px' : '16px'};
				transform: translate({planeX}px, calc(-50% + {planeY}px)) rotate({$planeRotation}deg) scale({$planeScale});
				opacity: {$planeOpacity};
				filter: blur({$planeBlur}px) drop-shadow(0 4px 10px rgba(0, 0, 0, {flightState === 'ready' ? 0 : 0.6}));
				transform-origin: center;
				color: {variant === 'magical' ? (flightState === 'ready' ? 'white' : flightState === 'taking-off' ? 'rgb(100, 116, 139)' : 'rgb(51, 65, 85)') : (flightState === 'ready' ? 'currentColor' : flightState === 'taking-off' ? 'rgb(100, 116, 139)' : 'rgb(51, 65, 85)')};
			"
		>
			<Send class="h-4 w-4" />
		</span>
	{/if}

	{#if href}
		<a
			{href}
			{rel}
			target={href.startsWith('mailto:') ? undefined : '_blank'}
			data-testid={testId}
			class="
				relative inline-flex items-center justify-center
				font-mono rounded-md
				transition-all duration-200 ease-out
				transform-gpu cursor-{cursor}
				select-none no-underline
				{sizeClasses[size]}
				{variantClasses[variant]}
				{classNames}
			"
			class:opacity-50={disabled}
			class:cursor-not-allowed={disabled}
			style="
				transform: scale({1 / $buttonScale});
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
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
				{:else}
					<!-- Static text content - never changes -->
					{@render children?.()}
					{#if !children && text}{text}{/if}
					
					<!-- Paper plane placeholder - actual plane always at root level -->
					{#if enableFlight}
						<span class="relative inline-block w-4 h-4">
							<!-- Empty space - plane rendered at root for continuity -->
						</span>
					{/if}
				{/if}
			</span>
			
			<!-- Clean click feedback -->
			{#if clicked && !enableFlight}
				<div 
					class="absolute inset-0 rounded-md bg-white/10 pointer-events-none"
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
				relative inline-flex items-center justify-center
				font-mono rounded-md
				transition-all duration-200 ease-out
				transform-gpu
				{sizeClasses[size]}
				{variantClasses[variant]}
				{classNames}
			"
			class:opacity-50={disabled}
			class:cursor-not-allowed={disabled}
			class:cursor-pointer={!disabled}
			style="
				transform: scale({1 / $buttonScale});
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
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
				{:else}
					<!-- Static text content - never changes -->
					{@render children?.()}
					{#if !children && text}{text}{/if}
					
					<!-- Paper plane placeholder - actual plane always at root level -->
					{#if enableFlight}
						<span class="relative inline-block w-4 h-4">
							<!-- Empty space - plane rendered at root for continuity -->
						</span>
					{/if}
				{/if}
			</span>
			
			<!-- Clean click feedback -->
			{#if clicked && !enableFlight}
				<div 
					class="absolute inset-0 rounded-md bg-white/10 pointer-events-none"
					style="animation: fadeOut 0.3s ease-out forwards"
				></div>
			{/if}
		</button>
	{/if}
</div>
