<script lang="ts">
	import { spring } from 'svelte/motion';
	import { fade, fly, scale } from 'svelte/transition';
	import { backOut, elasticOut } from 'svelte/easing';
	import { Share2, Link2, Copy, CheckCircle, Sparkles, Send, Heart, Zap } from '@lucide/svelte';
	
	let {
		url,
		title = 'Share',
		variant = 'primary',
		size = 'default',
		classNames = ''
	}: {
		url: string;
		title?: string;
		variant?: 'primary' | 'secondary' | 'magical';
		size?: 'sm' | 'default' | 'lg';
		classNames?: string;
	} = $props();
	
	let copied = $state(false);
	let animating = $state(false);
	let showMenu = $state(false);
	let hovered = $state(false);
	let buttonRef: HTMLButtonElement;
	
	// Spring animations for smooth interactions - simplified for reliability
	let buttonScale = spring(1, { stiffness: 0.4, damping: 0.85 });
	let glowIntensity = spring(0, { stiffness: 0.2, damping: 0.9 });
	let particleSpring = spring(0, { stiffness: 0.3, damping: 0.8 });
	let copiedGlow = spring(0, { stiffness: 0.3, damping: 0.9 });
	
	// Reactive particles for magical effect
	let particles = $state<Array<{ id: number; x: number; y: number }>>([]);
	
	$effect(() => {
		// Block all hover effects during the entire animation sequence
		if (animating || copied) {
			// Keep it looking active while animating/showing success
			glowIntensity.set(0.7);
			particles = [];
			return;
		}
		
		if (hovered) {
			buttonScale.set(1.05);
			glowIntensity.set(1);
			
			// Create particles on hover
			if (variant === 'magical') {
				const interval = setInterval(() => {
					if (hovered && particles.length < 8) {
						particles = [...particles, {
							id: Date.now() + Math.random(),
							x: Math.random() * 100 - 50,
							y: Math.random() * 100 - 50
						}];
					}
				}, 200);
				
				return () => clearInterval(interval);
			}
		} else {
			buttonScale.set(1);
			glowIntensity.set(0);
			particles = [];
		}
	});
	
	// Clean up old particles
	$effect(() => {
		if (particles.length > 0) {
			const timeout = setTimeout(() => {
				particles = particles.slice(-5);
			}, 1000);
			return () => clearTimeout(timeout);
		}
	});
	
	async function handleShare() {
		// Copy to clipboard
		await copyToClipboard();
	}
	
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			animating = true; // Start animation lock
			hovered = false; // Hide tooltip immediately
			
			// Trigger copy animation with perfect timing
			buttonScale.set(0.95);
			copiedGlow.set(1);
			setTimeout(() => buttonScale.set(1.08), 100);
			setTimeout(() => buttonScale.set(1), 250);
			
			// Trigger particle burst
			particleSpring.set(1);
			
			setTimeout(() => {
				particleSpring.set(0);
				copiedGlow.set(0);
			}, 400);
			
			setTimeout(() => {
				copied = false;
				// Small delay before re-enabling hover
				setTimeout(() => {
					animating = false; // Animation complete, re-enable hover
				}, 200);
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
	
	// Size classes
	const sizeClasses = {
		sm: 'px-3 py-1.5 text-sm gap-1.5',
		default: 'px-4 py-2 text-base gap-2',
		lg: 'px-6 py-3 text-lg gap-2.5'
	};
	
	const iconSizes = {
		sm: 'h-3.5 w-3.5',
		default: 'h-4 w-4',
		lg: 'h-5 w-5'
	};
	
	// Variant classes - base styles without hover (we control hover via state)
	const variantClasses = {
		primary: `
			bg-gradient-to-r from-participation-primary-500 to-participation-primary-600 
			text-white shadow-lg shadow-participation-primary-500/25
			border border-participation-primary-400/20
		`,
		secondary: `
			bg-white
			text-slate-700
			border border-slate-200
			shadow-md
		`,
		magical: `
			bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600
			text-white shadow-xl
			shadow-purple-500/30
			relative overflow-hidden
			border border-white/20
		`
	};
	
	// Hover variant classes - only applied when not animating
	const hoverClasses = {
		primary: `
			hover:from-participation-primary-600 hover:to-participation-primary-700
		`,
		secondary: `
			hover:bg-slate-50
			hover:text-slate-900
			hover:border-slate-300
			hover:shadow-lg
		`,
		magical: `
			hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700
			hover:shadow-purple-500/40
		`
	};
</script>

<div class="relative inline-block z-20">
	<!-- Glow effect for magical variant -->
	{#if variant === 'magical'}
		<div 
			class="absolute inset-0 rounded-full blur-xl opacity-50 bg-gradient-to-r from-indigo-400 via-blue-400 to-purple-400"
			style="transform: scale({1 + $glowIntensity * 0.3}); opacity: {0.3 + $glowIntensity * 0.4}"
		></div>
	{/if}
	
	<!-- Particles for magical variant -->
	{#if variant === 'magical'}
		{#each particles as particle (particle.id)}
			<div 
				class="absolute pointer-events-none"
				style="
					left: 50%; 
					top: 50%; 
					transform: translate({particle.x}px, {particle.y}px) scale({1 - $particleSpring});
				"
				in:scale={{ duration: 300, easing: backOut }}
				out:fade={{ duration: 800 }}
			>
				{#if Math.random() > 0.5}
					<Sparkles class="h-3 w-3 text-yellow-300 animate-pulse" />
				{:else if Math.random() > 0.5}
					<Heart class="h-3 w-3 text-pink-300 animate-pulse" />
				{:else}
					<Zap class="h-3 w-3 text-blue-300 animate-pulse" />
				{/if}
			</div>
		{/each}
	{/if}
	
	<button
		bind:this={buttonRef}
		onclick={handleShare}
		onmouseenter={() => !animating && !copied && (hovered = true)}
		onmouseleave={() => !animating && !copied && (hovered = false)}
		class="
			relative inline-flex items-center justify-center
			font-medium rounded-full
			transition-all duration-200 ease-out
			transform-gpu cursor-pointer
			{sizeClasses[size]}
			{variantClasses[variant]}
			{!(animating || copied) ? hoverClasses[variant] : ''}
			{classNames}
		"
		style="
			transform: scale({$buttonScale});
			box-shadow: 
				0 4px 6px -1px rgba(0, 0, 0, 0.1), 
				0 2px 4px -1px rgba(0, 0, 0, 0.06),
				0 0 {20 * $glowIntensity}px rgba(79, 70, 229, {0.5 * $glowIntensity}),
				0 0 {30 * $copiedGlow}px rgba(34, 197, 94, {0.3 * $copiedGlow});
			filter: brightness({1 + $copiedGlow * 0.1});
		"
		aria-label={copied ? 'Link copied!' : 'Share this template'}
	>
		<!-- Animated background gradient for primary -->
		{#if variant === 'primary'}
			<div 
				class="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 animate-pulse"
				style="opacity: {$glowIntensity * 0.5}"
			></div>
		{/if}
		
		<!-- Content container with fixed layout -->
		<div class="flex items-center gap-2">
			<!-- Icon container - morphing animation with both icons -->
			<div class="relative inline-flex items-center justify-center" style="width: 18px; height: 18px;">
				<!-- Share icon -->
				<div 
					class="absolute inset-0 flex items-center justify-center"
					style="
						opacity: {copied ? 0 : 1};
						transform: scale({copied ? 0.3 : 1});
						transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
					"
				>
					<Share2 class="{iconSizes[size]} text-current" />
				</div>
				
				<!-- Check icon -->
				<div 
					class="absolute inset-0 flex items-center justify-center"
					style="
						opacity: {copied ? 1 : 0};
						transform: scale({copied ? 1 : 1.5});
						transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
					"
				>
					<CheckCircle class="{iconSizes[size]} text-current" />
				</div>
			</div>
			
			<!-- Text container - completely isolated -->
			<div class="relative inline-flex items-center justify-center" style="min-width: 65px;">
				<span 
					class="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
					style="opacity: {copied ? 0 : 1};"
				>
					Share
				</span>
				<span 
					class="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
					style="opacity: {copied ? 1 : 0};"
				>
					Copied!
				</span>
			</div>
		</div>
		
		<!-- Smooth ripple effect on click -->
		{#if copied}
			<div 
				class="absolute inset-0 rounded-full pointer-events-none"
				in:scale={{ duration: 400, easing: backOut, start: 0.8, opacity: 0.3 }}
				out:fade={{ duration: 600 }}
			>
				<div class="absolute inset-0 rounded-full bg-gradient-to-r from-white/20 to-indigo-200/20"></div>
			</div>
		{/if}
	</button>
	
	<!-- Tooltip on hover -->
	{#if hovered && !copied}
		<div 
			class="absolute -bottom-10 left-1/2 transform -translate-x-1/2 pointer-events-none z-50"
			in:fly={{ y: -5, duration: 200 }}
			out:fade={{ duration: 150 }}
		>
			<div class="bg-slate-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
				Copy link
				<div class="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes float {
		0%, 100% { transform: translateY(0px); }
		50% { transform: translateY(-10px); }
	}
	
	.animate-float {
		animation: float 3s ease-in-out infinite;
	}
</style>