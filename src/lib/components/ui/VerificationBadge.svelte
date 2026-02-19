<script lang="ts">
	import { Shield, Clock, AlertTriangle } from '@lucide/svelte';

	interface Props {
		size?: 'xs' | 'sm' | 'md';
		showText?: boolean;
		variant?: 'default' | 'compact';
		verificationStatus?: 'verified' | 'pending' | 'failed' | 'unverified';
		verificationMethod?: string;
		verifiedAt?: Date;
		trustScore?: number;
		reputationTier?: 'expert' | 'verified' | 'novice';
	}

	let {
		size = 'sm',
		showText = true,
		variant: _variant = 'default',
		verificationStatus = 'verified',
		verificationMethod,
		verifiedAt,
		trustScore,
		reputationTier
	}: Props = $props();

	const sizeClasses = {
		xs: 'px-1.5 py-0.5 text-xs',
		sm: 'px-2 py-1 text-xs',
		md: 'px-3 py-1.5 text-sm'
	};

	const iconSizes = {
		xs: 'h-2.5 w-2.5',
		sm: 'h-3 w-3',
		md: 'h-4 w-4'
	};

	// Status-based styling using consolidated User model fields
	const statusConfig = {
		verified: {
			icon: Shield,
			bgClass: 'bg-verified-100',
			textClass: 'text-verified-700',
			borderClass: 'border-verified-200',
			label: 'Verified'
		},
		pending: {
			icon: Clock,
			bgClass: 'bg-amber-100',
			textClass: 'text-amber-700',
			borderClass: 'border-amber-200',
			label: 'Pending'
		},
		failed: {
			icon: AlertTriangle,
			bgClass: 'bg-red-100',
			textClass: 'text-red-700',
			borderClass: 'border-red-200',
			label: 'Failed'
		},
		unverified: {
			icon: Shield,
			bgClass: 'bg-gray-100',
			textClass: 'text-gray-700',
			borderClass: 'border-gray-200',
			label: 'Unverified'
		}
	};

	const config = $derived(statusConfig[verificationStatus]);
	const IconComponent = $derived(config.icon);

	// Enhanced tooltip for detailed verification info
	const tooltipText = $derived(
		verificationStatus === 'verified' && verifiedAt
			? `Verified ${verificationMethod ? `via ${verificationMethod}` : ''} on ${verifiedAt.toLocaleDateString()}${trustScore ? ` • Trust Score: ${trustScore}` : ''}`
			: config.label
	);
</script>

<div
	class="inline-flex items-center gap-1 rounded-full border font-medium {config.bgClass} {config.textClass} {config.borderClass} {sizeClasses[
		size
	]}"
	title={tooltipText}
	role="status"
	aria-label={tooltipText}
>
	<IconComponent class={iconSizes[size]} aria-hidden="true" />
	{#if showText}
		<span>{config.label}</span>
	{/if}

	{#if reputationTier && verificationStatus === 'verified'}
		<span class="ml-1 rounded-full bg-white/50 px-1.5 py-0.5 text-xs font-normal opacity-75">
			{reputationTier}
		</span>
	{/if}
</div>
