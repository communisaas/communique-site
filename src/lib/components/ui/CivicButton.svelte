<script lang="ts">
	import { spring } from 'svelte/motion';
	import { Loader2, Send } from '@lucide/svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'verified' | 'community';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit';
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		onclick?: (_event: MouseEvent) => void;
		children?: import('svelte').Snippet;
		text?: string;
		icon?: import('svelte').Component;
		iconPosition?: 'left' | 'right';
		'aria-describedby'?: string;
		'data-testid'?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		fullWidth = false,
		onclick,
		children,
		text,
		icon,
		iconPosition = 'left',
		'aria-describedby': ariaDescribedby,
		'data-testid': testId
	}: Props = $props();

	// Enhanced micro-interactions with spring physics
	let pressed = $state(false);
	let hovered = $state(false);

	// Smooth scale animation for civic interactions
	let scale = spring(1, { stiffness: 0.4, damping: 0.8 });
	let shadowIntensity = spring(0, { stiffness: 0.3, damping: 0.9 });

	// React to interaction states
	$effect(() => {
		if (pressed && !disabled) {
			scale.set(0.98);
		} else if (hovered && !disabled) {
			scale.set(1.02);
			shadowIntensity.set(1);
		} else {
			scale.set(1);
			shadowIntensity.set(0);
		}
	});

	// Build CSS classes using design system
	let buttonClasses = $derived.by(() => {
		const baseClasses = 'participation-btn';
		const variantClass = `participation-btn-${variant}`;
		const sizeClass = `participation-btn-${size}`;
		const widthClass = fullWidth ? 'w-full' : '';

		return `${baseClasses} ${variantClass} ${sizeClass} ${widthClass}`.trim();
	});

	// Handle click with proper civic feedback
	function handleClick(__event: MouseEvent) {
		if (!disabled && !loading) {
			pressed = true;

			// Provide haptic feedback on supported devices
			if ('vibrate' in navigator && variant === 'primary') {
				navigator.vibrate(10); // Subtle feedback for primary actions
			}

			// Reset pressed state after animation
			setTimeout(() => {
				pressed = false;
			}, 150);

			onclick?.(__event);
		}
	}

	function handleMouseEnter() {
		if (!disabled) {
			hovered = true;
		}
	}

	function handleMouseLeave() {
		hovered = false;
	}

	// Determine if we should show an icon
	const showIcon = icon || (variant === 'primary' && !loading);
	const IconComponent = icon || Send;

	// Screen reader text for loading state
	let loadingText = $derived.by(() => {
		if (loading) {
			if (variant === 'verified') return 'Sending verified delivery, please wait';
			if (variant === 'community') return 'Sending community outreach, please wait';
			return 'Sending message, please wait';
		}
		return '';
	});
</script>

<!--
ParticipationButton Component

Participation action button with proper accessibility and engagement feedback.
Designed for serious global participation with institutional trust signals.

Features:
- Channel-appropriate styling (verified vs community)
- Smooth spring-physics interactions
- Loading states with proper screen reader support
- Touch-friendly sizing (44px minimum height)
- Haptic feedback for primary actions on supported devices

Accessibility:
- Proper focus indicators
- Loading state announcements
- Keyboard navigation support
- ARIA attributes for screen readers
-->

{#if href}
	<a
		{href}
		class={buttonClasses}
		class:opacity-50={disabled}
		class:cursor-not-allowed={disabled}
		style="
			transform: scale({$scale});
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
						0 2px 4px -2px rgba(0, 0, 0, 0.1),
						0 0 {12 * $shadowIntensity}px rgba(30, 58, 95, {0.15 * $shadowIntensity});
		"
		aria-describedby={ariaDescribedby}
		data-testid={testId}
		role="button"
		tabindex={disabled ? -1 : 0}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	>
		<span class="flex items-center justify-center gap-2">
			{#if loading}
				<Loader2 class="h-4 w-4 animate-spin" />
				<span class="sr-only">{loadingText}</span>
			{:else}
				{#if showIcon && iconPosition === 'left'}
					<IconComponent class="h-4 w-4 flex-shrink-0" />
				{/if}

				{#if children}
					{@render children()}
				{:else if text}
					{text}
				{/if}

				{#if showIcon && iconPosition === 'right'}
					<IconComponent class="h-4 w-4 flex-shrink-0" />
				{/if}
			{/if}
		</span>
	</a>
{:else}
	<button
		{type}
		{disabled}
		class={buttonClasses}
		style="
			transform: scale({$scale});
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
						0 2px 4px -2px rgba(0, 0, 0, 0.1),
						0 0 {12 * $shadowIntensity}px rgba(30, 58, 95, {0.15 * $shadowIntensity});
		"
		aria-describedby={ariaDescribedby}
		data-testid={testId}
		onclick={handleClick}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	>
		<span class="flex items-center justify-center gap-2">
			{#if loading}
				<Loader2 class="h-4 w-4 animate-spin" />
				<span class="sr-only">{loadingText}</span>
			{:else}
				{#if showIcon && iconPosition === 'left'}
					<IconComponent class="h-4 w-4 flex-shrink-0" />
				{/if}

				{#if children}
					{@render children()}
				{:else if text}
					{text}
				{/if}

				{#if showIcon && iconPosition === 'right'}
					<IconComponent class="h-4 w-4 flex-shrink-0" />
				{/if}
			{/if}
		</span>
	</button>
{/if}

<!--
Design System Integration Notes:

This component demonstrates:
- Semantic variant naming (verified, community, not just colors)
- Proper accessibility with ARIA attributes and screen reader text
- Spring-physics interactions that feel natural
- Touch-friendly sizing with 44px minimum heights
- Channel-appropriate visual feedback
- Loading states that communicate participation action progress
- Progressive enhancement (works without JavaScript)

Usage Examples:

<ParticipationButton variant="verified" size="lg">
	Send Verified Delivery
</ParticipationButton>

<ParticipationButton variant="community" loading={sending}>
	Community Outreach
</ParticipationButton>

<ParticipationButton variant="secondary" icon={SaveIcon}>
	Save Draft
</ParticipationButton>
-->

<style>
	/* Respect reduced motion preferences for participation accessibility */
	@media (prefers-reduced-motion: reduce) {
		button,
		a {
			transition: none !important;
		}
	}

	/* Enhanced focus indicators for keyboard navigation */
	button:focus-visible,
	a:focus-visible {
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		button,
		a {
			border-width: 2px;
		}
	}
</style>
