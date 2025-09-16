<script lang="ts">
	import { Check, Clock, AlertTriangle, Info, Shield, Mail } from '@lucide/svelte';

	interface Props {
		variant?: 'verified' | 'community' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
		size?: 'sm' | 'md';
		pulse?: boolean;
		icon?: boolean;
		children?: import('svelte').Snippet;
	}

	let { variant = 'neutral', size = 'sm', pulse = false, icon = true, children }: Props = $props();

	// Icon mapping based on variant
	const iconMap = {
		verified: Shield,
		community: Mail,
		success: Check,
		warning: Clock,
		error: AlertTriangle,
		info: Info,
		neutral: Info
	};

	const IconComponent = iconMap[variant];

	// Build CSS classes using design system
	let badgeClasses = $derived(() => {
		const baseClasses = 'participation-badge';
		const sizeClass = `participation-badge-${size}`;
		const variantClass = `participation-badge-${variant}`;
		const pulseClass = pulse ? 'participation-pulse' : '';

		return `${baseClasses} ${sizeClass} ${variantClass} ${pulseClass}`.trim();
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

<span class={badgeClasses} role="status">
	{#if icon && IconComponent}
		<IconComponent class="h-3 w-3 flex-shrink-0" />
	{/if}

	{#if children}
		{@render children()}
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
