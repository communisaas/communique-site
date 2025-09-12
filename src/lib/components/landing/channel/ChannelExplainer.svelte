<script lang="ts">
	import { createEventDispatcher } from 'svelte';
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

	const dispatch = createEventDispatcher<{
		createTemplate: TemplateCreationContext;
		channelSelect: string;
	}>();

	let selectedChannel: string | null = null;
	let hoveredChannel: string | null = null;
	
	function handleChannelHover(channelId: string, isHovering: boolean) {
		hoveredChannel = isHovering ? channelId : null;
	}

	const channels = [
		{
			id: 'certified',
			title: 'Certified Delivery',
			icon: Shield,
			description: 'Straight to Congress. Every message from your district gets counted. It\'s how they decide.',
			features: [
				{
					icon: Landmark,
					text: 'Official CWC system delivery'
				},
				{
					icon: CheckCircle2,
					text: 'Verified delivery receipt'
				},
				{
					icon: UsersRound,
					text: 'District-based routing'
				}
			],
			color: 'emerald'
		},
		{
			id: 'direct',
			title: 'Direct Outreach',
			icon: AtSign,
			description: 'CEOs, school boards, HOAs - when inboxes flood with the same message, calendars clear.',
			features: [
				{
					icon: Building2,
					text: 'Message key decision makers'
				},
				{
					icon: Network,
					text: 'Add your verified voice'
				},
				{
					icon: Route,
					text: 'Send via your email client'
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
				Messages That Move Decisions
			</h2>
		</div>
		<div class="flex items-center justify-center">
			<h3 class="text-2xl font-semibold text-gray-900 sm:text-3xl">Choose Your Outreach Channel</h3>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		{#each channels as channel}
			{@const isSelected = selectedChannel === channel.id}
			{@const isHovered = hoveredChannel === channel.id}
			<div
				role="button"
				tabindex="0"
				class="group relative cursor-pointer rounded-md border-2 transition-all duration-300 transform-gpu hover:scale-[1.02] hover:shadow-lg"
				class:border-congressional-500={isSelected && channel.id === 'certified'}
				class:border-direct-500={isSelected && channel.id === 'direct'}
				class:bg-congressional-50={isSelected && channel.id === 'certified'}
				class:bg-direct-50={isSelected && channel.id === 'direct'}
				class:border-slate-200={!isSelected && !isHovered}
				class:border-slate-300={!isSelected && isHovered}
				class:cursor-default={isSelected}
				onmouseenter={() => handleChannelHover(channel.id, true)}
				onmouseleave={() => handleChannelHover(channel.id, false)}
				onclick={(event) => {
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
							{#each Array(32) as _, i}
								<div class="rotate-45 scale-150 transform"></div>
							{/each}
						</div>
					</div>
				</div>

				<div class="relative h-full p-6">
					<div class="mb-4 flex items-start justify-between">
						<div
							class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:text-sm"
							class:bg-congressional-100={isSelected && channel.id === 'certified'}
							class:text-congressional-700={isSelected && channel.id === 'certified'}
							class:bg-direct-100={isSelected && channel.id === 'direct'}
							class:text-direct-700={isSelected && channel.id === 'direct'}
							class:bg-slate-100={!isSelected}
							class:text-slate-600={!isSelected}
						>
							<svelte:component this={channel.icon} class="h-4 w-4" />
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
								<li
									animate:flip={{ duration: 300 }}
									class="grid grid-cols-[20px_1fr] items-start gap-2 text-sm text-gray-600 sm:text-base"
								>
									<svelte:component this={feature.icon} class="mt-1 h-4 w-4 text-slate-400" />
									<span>{feature.text}</span>
								</li>
							{/each}
						</ul>

						{#if isSelected}
							<div transition:fade={{ duration: 200 }} class="space-y-3 pt-4">
								{#if channel.id === 'certified'}
									<div class="space-y-3">
										<div
											class="flex w-full flex-wrap items-center justify-between gap-4 rounded-lg px-4 py-3"
										>
											<span
												class="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-600"
											>
												<span class="relative flex h-2 w-2">
													<span
														class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"
													></span>
													<span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"
													></span>
												</span>
												<span>In Development</span>
											</span>
											<a
												href="https://github.com/communisaas/communique-site"
												class="group/link flex items-center px-2 text-sm text-gray-600 hover:text-gray-900"
											>
												<span class="mr-1.5">Follow Progress</span>
												<ArrowRight
													class="h-4 w-4 transform transition-transform duration-200 group-hover/link:translate-x-1"
												/>
											</a>
										</div>
										<p class="text-center text-sm text-gray-500">
											Congressional delivery integration in progress
										</p>
									</div>
								{:else}
									<div class="flex flex-col gap-3">
										<button
											class="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 text-white shadow-lg shadow-blue-600/20 transition-all duration-200 transform-gpu hover:scale-[1.02]"
											onclick={(e) => { e.stopPropagation(); handleCreateTemplate(channel); }}
										>
											Create New Template
											<ArrowRight class="h-4 w-4" />
										</button>

										<button
											class="flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 hover:border-blue-300 px-4 py-2 text-blue-700 hover:text-blue-800 hover:bg-blue-50 shadow-md hover:shadow-lg transition-all duration-200 transform-gpu hover:scale-[1.02]"
											onclick={(e) => { e.stopPropagation(); 
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
											Browse Existing Templates
											<ArrowRight class="h-4 w-4" />
										</button>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Keep the bottom border indicator -->
						<div
							class="absolute bottom-0 left-0 h-1 w-full transform transition-all duration-300"
							class:bg-emerald-500={channel.id === 'certified'}
							class:bg-blue-500={channel.id === 'direct'}
							class:scale-x-100={isSelected}
							class:bg-slate-200={!isSelected}
							class:scale-x-0={!isSelected}
							class:group-hover:scale-x-100={!isSelected}
						></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
