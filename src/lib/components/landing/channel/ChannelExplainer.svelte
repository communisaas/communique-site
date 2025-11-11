<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import {
		Shield,
		AtSign,
		ArrowRight,
		Network,
		Route,
		CheckCircle2,
		Building2,
		Landmark,
		UsersRound
	} from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import { spring } from 'svelte/motion';
	import IdentityBadge from '$lib/components/verification/IdentityBadge.svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';

	const dispatch = createEventDispatcher<{
		createTemplate: TemplateCreationContext;
		channelSelect: string;
	}>();

	let selectedChannel = $state<string | null>(null);
	let hoveredChannel = $state<string | null>(null);
	let attentionMode = $state(false);

	// Create spring stores for animation
	const certifiedScale = spring(1, { stiffness: 0.3, damping: 0.4 });
	const directScale = spring(1, { stiffness: 0.3, damping: 0.4 });
	const certifiedGlow = spring(0, { stiffness: 0.4, damping: 0.6 });
	const directGlow = spring(0, { stiffness: 0.4, damping: 0.6 });

	function handleChannelHover(channelId: string, isHovering: boolean) {
		hoveredChannel = isHovering ? channelId : null;
	}

	function triggerAttentionAnimation() {
		attentionMode = true;

		// Staggered pulse animation for certified channel
		certifiedScale.set(1.04);
		certifiedGlow.set(1);

		coordinated.setTimeout(
			() => {
				certifiedScale.set(1);
				certifiedGlow.set(0.5);

				// Then animate direct channel
				directScale.set(1.04);
				directGlow.set(1);
			},
			300,
			'attention-stagger',
			'channel-explainer'
		);

		coordinated.setTimeout(
			() => {
				directScale.set(1);
				directGlow.set(0.5);
			},
			600,
			'attention-settle',
			'channel-explainer'
		);

		// Gentle ongoing pulse
		coordinated.setTimeout(
			() => {
				certifiedGlow.set(0);
				directGlow.set(0);
				attentionMode = false;
			},
			1500,
			'attention-end',
			'channel-explainer'
		);
	}

	onMount(() => {
		// Listen for attention trigger from Hero button
		const handleDrawAttention = () => triggerAttentionAnimation();
		window.addEventListener('drawAttentionToChannels', handleDrawAttention);

		return () => {
			window.removeEventListener('drawAttentionToChannels', handleDrawAttention);
		};
	});

	onDestroy(() => {
		// Clean up timers
		useTimerCleanup('channel-explainer')();
	});

	const channels = [
		{
			id: 'certified',
			title: 'US Congress',
			icon: Shield,
			description:
				'Pressure both chambers. Every verified message from your district gets counted.',
			features: [
				{
					icon: Landmark,
					text: 'Verified to Congress'
				},
				{
					icon: CheckCircle2,
					text: 'Delivery tracked & verified'
				},
				{
					icon: UsersRound,
					text: 'Build your civic reputation'
				}
			],
			color: 'emerald'
		},
		{
			id: 'direct',
			title: 'Everyone Else',
			icon: AtSign,
			description: 'Local gov, corporations, HOAs, universities. Reach any decision-maker.',
			features: [
				{
					icon: Building2,
					text: 'Any decision-maker'
				},
				{
					icon: Route,
					text: 'Direct email delivery'
				},
				{
					icon: Network,
					text: 'Coming soon: Verified tracking'
				}
			],
			color: 'blue'
		}
	];

	function handleCreateTemplate(channel: (typeof channels)[0]) {
		dispatch('createTemplate', {
			channelId: channel.id as 'certified' | 'direct',
			channelTitle: channel.title,
			features: channel.features
		});
	}
</script>

<div class="mx-auto w-full max-w-4xl py-6">
	<div class="mb-8 text-center">
		<div class="mb-2 flex items-center justify-center gap-3">
			<Network class="h-5 w-5 text-slate-600" />
			<h2 class="text-xs uppercase tracking-widest text-gray-500 sm:text-sm">
				Send to Decision-Makers
			</h2>
		</div>
		<div class="flex items-center justify-center">
			<h3 class="text-2xl font-semibold text-gray-900 sm:text-3xl">Who Are You Reaching?</h3>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		{#each channels as channel}
			{@const isSelected = selectedChannel === channel.id}
			{@const isHovered = hoveredChannel === channel.id}
			{@const scaleValue = channel.id === 'certified' ? $certifiedScale : $directScale}
			{@const glowValue = channel.id === 'certified' ? $certifiedGlow : $directGlow}
			<div
				role="button"
				tabindex="0"
				class="group relative transform-gpu cursor-pointer rounded-md border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
				class:border-verified-500={isSelected && channel.id === 'certified'}
				class:border-participation-primary-500={isSelected && channel.id === 'direct'}
				class:bg-verified-50={isSelected && channel.id === 'certified'}
				class:bg-participation-primary-50={isSelected && channel.id === 'direct'}
				class:border-slate-200={!isSelected && !isHovered && !attentionMode}
				class:border-slate-300={!isSelected && (isHovered || attentionMode)}
				class:cursor-default={isSelected}
				style="
					transform: scale({scaleValue});
					box-shadow: 
						0 4px 6px -1px rgba(0, 0, 0, 0.1),
						0 2px 4px -1px rgba(0, 0, 0, 0.06),
						0 0 {20 * glowValue}px rgba({channel.id === 'certified' ? '16, 185, 129' : '79, 70, 229'}, {0.2 *
					glowValue}),
						0 0 {40 * glowValue}px rgba({channel.id === 'certified' ? '16, 185, 129' : '79, 70, 229'}, {0.1 *
					glowValue});
				"
				onmouseenter={() => handleChannelHover(channel.id, true)}
				onmouseleave={() => handleChannelHover(channel.id, false)}
				onclick={(__event) => {
					selectedChannel = channel.id;
					const targetElement = event.currentTarget;
					targetElement.scrollIntoView({
						behavior: 'smooth',
						block: 'center'
					});
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						selectedChannel = channel.id;
					}
				}}
			>
				<div class="absolute inset-0 overflow-hidden">
					<div
						class="pointer-events-none absolute inset-0 opacity-5 transition-opacity duration-300"
						class:opacity-10={isSelected}
					>
						<div class="absolute inset-0 grid grid-cols-8 gap-px">
							{#each Array(32) as _, _i}
								<div class="rotate-45 scale-150 transform"></div>
							{/each}
						</div>
					</div>
				</div>

				<div class="relative h-full p-6">
					<div class="mb-4 flex items-start justify-between">
						<div
							class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:text-sm"
							class:bg-verified-100={channel.id === 'certified' && isSelected}
							class:text-verified-700={channel.id === 'certified' && isSelected}
							class:bg-verified-50={channel.id === 'certified' && !isSelected}
							class:text-verified-600={channel.id === 'certified' && !isSelected}
							class:bg-participation-primary-100={channel.id === 'direct' && isSelected}
							class:text-participation-primary-700={channel.id === 'direct' && isSelected}
							class:bg-participation-primary-50={channel.id === 'direct' && !isSelected}
							class:text-participation-primary-600={channel.id === 'direct' && !isSelected}
						>
							{#if channel.icon}
								{@const IconComponent = channel.icon}
								<IconComponent class="h-4 w-4" />
							{/if}
							{channel.title}
						</div>
						{#if channel.id === 'certified'}
							<IdentityBadge />
						{/if}
					</div>

					<div class="space-y-4">
						<p class="text-sm leading-relaxed text-gray-600 sm:text-base">
							{channel.description}
						</p>

						<ul class="space-y-3 border-t border-slate-200 pt-4">
							{#each channel.features as feature (feature.text)}
								{@const IconComponent = feature.icon}
								<li
									animate:flip={{ duration: 300 }}
									class="grid grid-cols-[20px_1fr] items-start gap-2 text-sm text-gray-600 sm:text-base"
								>
									<IconComponent class="mt-1 h-4 w-4 text-slate-400" />
									<span>{feature.text}</span>
								</li>
							{/each}
						</ul>

						{#if isSelected}
							<div transition:fade={{ duration: 200 }} class="space-y-3 pt-4">
								{#if channel.id === 'certified'}
									<div class="flex flex-col gap-3">
										<button
											class="flex w-full transform-gpu items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-white shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-700"
											onclick={(e) => {
												e.stopPropagation();
												handleCreateTemplate(channel);
											}}
										>
											Create Template
											<ArrowRight class="h-4 w-4" />
										</button>

										<button
											class="flex w-full transform-gpu items-center justify-center gap-2 rounded-md border border-emerald-200 px-4 py-2 text-emerald-700 shadow-md transition-all duration-200 hover:scale-[1.02] hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 hover:shadow-lg"
											onclick={(e) => {
												e.stopPropagation();
												document.getElementById('template-section')?.scrollIntoView({
													behavior: 'smooth',
													block: 'center'
												});
												dispatchEvent(
													new CustomEvent('channelSelect', {
														detail: channel.id,
														bubbles: true
													})
												);
											}}
										>
											Browse Templates
											<ArrowRight class="h-4 w-4" />
										</button>
									</div>
								{:else}
									<div class="flex flex-col gap-3">
										<button
											class="flex w-full transform-gpu items-center justify-center gap-2 rounded-md bg-participation-primary-600 px-4 py-2 text-white shadow-lg shadow-participation-primary-600/20 transition-all duration-200 hover:scale-[1.02] hover:bg-participation-primary-700"
											onclick={(e) => {
												e.stopPropagation();
												handleCreateTemplate(channel);
											}}
										>
											Create Template
											<ArrowRight class="h-4 w-4" />
										</button>

										<button
											class="flex w-full transform-gpu items-center justify-center gap-2 rounded-md border border-participation-primary-200 px-4 py-2 text-participation-primary-700 shadow-md transition-all duration-200 hover:scale-[1.02] hover:border-participation-primary-300 hover:bg-participation-primary-50 hover:text-participation-primary-800 hover:shadow-lg"
											onclick={(e) => {
												e.stopPropagation();
												document.getElementById('template-section')?.scrollIntoView({
													behavior: 'smooth',
													block: 'center'
												});
												dispatchEvent(
													new CustomEvent('channelSelect', {
														detail: channel.id,
														bubbles: true
													})
												);
											}}
										>
											Browse Templates
											<ArrowRight class="h-4 w-4" />
										</button>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Keep the bottom border indicator -->
						<div
							class="absolute bottom-0 left-0 h-1 w-full transform transition-all duration-300"
							class:bg-verified-500={channel.id === 'certified' && (isSelected || isHovered)}
							class:bg-participation-primary-500={channel.id === 'direct' &&
								(isSelected || isHovered)}
							class:bg-slate-200={!isSelected && !isHovered}
							class:scale-x-100={isSelected || isHovered}
							class:scale-x-0={!isSelected && !isHovered}
						></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
