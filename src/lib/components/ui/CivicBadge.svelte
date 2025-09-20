<script lang="ts">
	import { Check, Clock, AlertTriangle, Info, Shield, Mail, Trophy, Star, Award } from '@lucide/svelte';

	interface Props {
		variant?: 'verified' | 'community' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'expert' | 'novice';
		size?: 'sm' | 'md';
		pulse?: boolean;
		icon?: boolean;
		children?: import('svelte').Snippet;
		// New props from consolidated User schema
		trustScore?: number;
		reputationTier?: 'expert' | 'verified' | 'novice';
		civicScore?: number;
		discourseScore?: number;
		challengeScore?: number;
		showScore?: boolean;
	}

	let { 
		variant = 'neutral', 
		size = 'sm', 
		pulse = false, 
		icon = true, 
		children,
		trustScore,
		reputationTier,
		civicScore,
		discourseScore,
		challengeScore,
		showScore = false
	}: Props = $props();

	// Enhanced variant that can use reputation tier
	const effectiveVariant = $derived(() => {
		if (reputationTier && !children) {
			return reputationTier;
		}
		return variant;
	});

	// Score display logic
	const displayScore = $derived(() => {
		if (!showScore) return null;
		if (civicScore !== undefined) return civicScore;
		if (trustScore !== undefined) return trustScore;
		if (discourseScore !== undefined) return discourseScore;
		if (challengeScore !== undefined) return challengeScore;
		return null;
	});

	// Enhanced icon mapping with reputation tiers
	const iconMap = {
		verified: Shield,
		community: Mail,
		success: Check,
		warning: Clock,
		error: AlertTriangle,
		info: Info,
		neutral: Info,
		expert: Trophy,
		novice: Star
	};

	const IconComponent = iconMap[effectiveVariant()];

	// Build CSS classes using design system
	let badgeClasses = $derived.by(() => {
		const baseClasses = 'participation-badge';
		const sizeClass = `participation-badge-${size}`;
		const variantClass = `participation-badge-${effectiveVariant}`;
		const pulseClass = pulse ? 'participation-pulse' : '';

		return `${baseClasses} ${sizeClass} ${variantClass} ${pulseClass}`.trim();
	});

	// Accessibility label
	const ariaLabel = $derived(() => {
		if (reputationTier) {
			const score = displayScore;
			return `${reputationTier} participant${score ? ` with ${score} score` : ''}`;
		}
		return effectiveVariant();
	});
</script>

<!--
ParticipationBadge Component

Consistent status communication for global participation infrastructure.
Uses design system tokens for reliable, accessible status indication.

Usage:
- Verified/Community channel identification
- Status communication (success, warning, error)
- Process indicators (with pulse animation)

Accessibility:
- Proper color contrast ratios
- Icon + text for colorblind users
- Semantic color meanings
-->

<span class={badgeClasses} role="status" aria-label={ariaLabel()}>
	{#if icon && IconComponent}
		<IconComponent class="h-3 w-3 flex-shrink-0" aria-hidden="true" />
	{/if}

	{#if children}
		{@render children()}
	{:else if reputationTier}
		<span class="capitalize">{reputationTier}</span>
	{/if}
	
	{#if displayScore !== null}
		<span class="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-normal">
			{displayScore}
		</span>
	{/if}
</span>

<!--
Design System Notes:

This component demonstrates proper usage of:
- CSS custom properties for colors (via .participation-badge-* classes)
- Semantic variant names (verified, community, status types)
- Accessibility considerations (role="status", proper contrast)
- Consistent sizing and spacing
- Progressive enhancement (works without icons)

The component replaces the existing Badge.svelte with design system principles:
- Clear semantic meaning over generic styling
- Built-in accessibility features
- Governance-neutral participation context
- International scaling capability
-->
