<script lang="ts">
	import { spring } from 'svelte/motion';
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
		flightState?: 'ready' | 'taking-off' | 'flying' | 'sent';
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
	
	// Dynamic paper plane flight animation with realistic physics
	let planeX = spring(0, { stiffness: 0.3, damping: 0.7 });
	let planeY = spring(0, { stiffness: 0.25, damping: 0.6 });
	let planeOpacity = spring(1, { stiffness: 0.4, damping: 0.8 });
	let planeRotation = spring(0, { stiffness: 0.35, damping: 0.6 });
	let planeScale = spring(1, { stiffness: 0.3, damping: 0.7 });
	let planeBlur = spring(0, { stiffness: 0.4, damping: 0.8 });
	
	$effect(() => {
		if (hovered && !disabled) {
			buttonScale.set(1.02);
			shadowIntensity.set(1);
		} else {
			buttonScale.set(1);
			shadowIntensity.set(0);
		}
	});
	
	// Engaging paper plane flight animation with realistic physics and visual flair
	$effect(() => {
		if (enableFlight) {
			switch (flightState) {
				case 'taking-off':
					// Initial launch - slight upward arc with anticipation
					planeX.set(45);
					planeY.set(-8);
					planeRotation.set(-12); // Banking left for the turn
					planeScale.set(1.1); // Slight grow as it "approaches"
					planeOpacity.set(0.95);
					planeBlur.set(0.5);
					break;
				case 'flying':
					// Main flight - dramatic curved trajectory like a real paper plane
					planeX.set(120);
					planeY.set(-35); // Higher arc
					planeRotation.set(25); // Banking right into the dive
					planeScale.set(1.3); // Growing larger as it "flies toward us"
					planeOpacity.set(0.7);
					planeBlur.set(1.2); // Motion blur effect
					break;
				case 'sent':
					// Landing/completion - gentle settle back to start
					planeX.set(0);
					planeY.set(0);
					planeRotation.set(0);
					planeScale.set(1);
					planeOpacity.set(1);
					planeBlur.set(0);
					break;
				default: // 'ready'
					// Resting state - clean and visible
					planeX.set(0);
					planeY.set(0);
					planeRotation.set(0);
					planeScale.set(1);
					planeOpacity.set(1);
					planeBlur.set(0);
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
				
				// Button settle
				setTimeout(() => {
					buttonScale.set(1);
					clicked = false;
				}, 1100);
				
				// Auto-reset after showing success - longer to appreciate the effect
				setTimeout(() => {
					if (flightState === 'sent') {
							flightState = 'ready';
					}
				}, 2500);
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
			bg-gradient-to-r from-blue-500 to-blue-600
			hover:from-blue-600 hover:to-blue-700
			text-white
			border border-blue-400/50
			shadow-lg shadow-blue-500/25
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

<div class="relative inline-block">

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
				transform: scale({$buttonScale});
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
			<!-- Shine effect for magical variant -->
			{#if variant === 'magical'}
				<div 
					class="absolute inset-0 -top-1/2 -left-full h-[200%] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-12 animate-[shine_3s_ease-in-out_infinite]"
					style="animation-delay: 0.5s"
				></div>
			{/if}
			
			<!-- Content -->
			<span class="relative flex items-center gap-2">
				{#if loading}
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
				{:else}
					<!-- Static text content - never changes -->
					{@render children?.()}
					{#if !children && text}{text}{/if}
					
					<!-- Paper plane - dynamic flight with realistic physics -->
					{#if enableFlight}
						<span 
							class="relative transition-all duration-500 ease-out"
							style="
								transform: translate({$planeX}px, {$planeY}px) rotate({$planeRotation}deg) scale({$planeScale});
								opacity: {$planeOpacity};
								filter: blur({$planeBlur}px);
								transform-origin: center;
							"
						>
							<Send class="h-4 w-4" />
						</span>
					{/if}
				{/if}
			</span>
			
			<!-- Clean click feedback -->
			{#if clicked}
				<div 
					class="absolute inset-0 rounded-md bg-white/20 animate-pulse"
					style="animation-duration: 0.2s"
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
				transform: scale({$buttonScale});
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
			<!-- Shine effect for magical variant -->
			{#if variant === 'magical'}
				<div 
					class="absolute inset-0 -top-1/2 -left-full h-[200%] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-12 animate-[shine_3s_ease-in-out_infinite]"
					style="animation-delay: 0.5s"
				></div>
			{/if}
			
			<!-- Content -->
			<span class="relative flex items-center gap-2">
				{#if loading}
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
				{:else}
					<!-- Static text content - never changes -->
					{@render children?.()}
					{#if !children && text}{text}{/if}
					
					<!-- Paper plane - dynamic flight with realistic physics -->
					{#if enableFlight}
						<span 
							class="relative transition-all duration-500 ease-out"
							style="
								transform: translate({$planeX}px, {$planeY}px) rotate({$planeRotation}deg) scale({$planeScale});
								opacity: {$planeOpacity};
								filter: blur({$planeBlur}px);
								transform-origin: center;
							"
						>
							<Send class="h-4 w-4" />
						</span>
					{/if}
				{/if}
			</span>
			
			<!-- Clean click feedback -->
			{#if clicked}
				<div 
					class="absolute inset-0 rounded-md bg-white/20 animate-pulse"
					style="animation-duration: 0.2s"
				></div>
			{/if}
		</button>
	{/if}
</div>
