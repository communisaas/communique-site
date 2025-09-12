<script lang="ts">
	import {
		Shield,
		AtSign,
		ArrowRight,
		Network,
		MapPin,
		ShieldCheck,
		Trophy,
		Target,
		Globe,
		Zap
	} from 'lucide-svelte';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';

	let selectedChannel: string | null = null;

	const channels = [
		{
			id: 'certified',
			title: 'Certified Delivery',
			icon: Shield,
			description: 'Straight to congressional tracking',
			features: [
				{
					icon: MapPin,
					text: 'Automatic rep lookup from any address'
				},
				{
					icon: ShieldCheck,
					text: "Verified through Congress's own system"
				},
				{
					icon: Trophy,
					text: 'Participation tracked and rewarded'
				}
			],
			color: 'emerald'
		},
		{
			id: 'direct',
			title: 'Direct Outreach',
			icon: AtSign,
			description: 'Target any inbox with coordinated campaigns',
			features: [
				{
					icon: Target,
					text: 'Reach any decision-maker instantly'
				},
				{
					icon: Globe,
					text: 'Works for any cause, anywhere'
				},
				{
					icon: Zap,
					text: 'No constituency required'
				}
			],
			color: 'blue'
		}
	];
</script>

<div class="mx-auto w-full max-w-4xl py-6">
	<div class="mb-8 text-center">
		<div class="mb-2 flex items-center justify-center gap-3">
			<Network class="h-5 w-5 text-slate-600" />
			<h2 class="font-mono text-xs uppercase tracking-wide text-slate-600 sm:text-sm">
				How Messages Become Pressure
			</h2>
		</div>
		<div class="flex items-center justify-center">
			<h3 class="text-2xl font-light sm:text-3xl">Pick Your Delivery Path</h3>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		{#each channels as channel}
			{@const isSelected = selectedChannel === channel.id}
			<div
				role="button"
				tabindex="0"
				class="group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-300"
				class:border-emerald-500={isSelected && channel.id === 'certified'}
				class:border-blue-500={isSelected && channel.id === 'direct'}
				class:bg-emerald-50={isSelected && channel.id === 'certified'}
				class:bg-blue-50={isSelected && channel.id === 'direct'}
				class:border-slate-200={!isSelected}
				class:hover:border-slate-300={!isSelected}
				on:click={() => {
					selectedChannel = channel.id;
					document
						.getElementById('channel-continue')
						?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				}}
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						selectedChannel = channel.id;
						document
							.getElementById('channel-continue')
							?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					}
				}}
			>
				<div
					class="pointer-events-none absolute inset-0 opacity-5 transition-opacity duration-300"
					class:opacity-10={isSelected}
				>
					<div class="absolute inset-0 grid grid-cols-8 gap-px">
						{#each Array(32) as _, i}
							<div class=" rotate-45 scale-150 transform"></div>
						{/each}
					</div>
				</div>

				<div class="relative h-full p-4 sm:p-6">
					<div
						class="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 sm:text-sm"
						class:bg-emerald-100={isSelected && channel.id === 'certified'}
						class:text-emerald-700={isSelected && channel.id === 'certified'}
						class:bg-blue-100={isSelected && channel.id === 'direct'}
						class:text-blue-700={isSelected && channel.id === 'direct'}
						class:bg-slate-100={!isSelected}
						class:text-slate-600={!isSelected}
					>
						<svelte:component this={channel.icon} class="h-4 w-4" />
						{channel.title}
					</div>

					<div class="space-y-4">
						<p class="text-sm leading-relaxed text-slate-600 sm:text-base">
							{channel.description}
						</p>

						<ul class="space-y-3 border-t border-slate-200 pt-4">
							{#each channel.features as feature (feature.text)}
								<li
									animate:flip={{ duration: 300 }}
									class="grid grid-cols-[20px_1fr] items-start gap-2 text-sm text-slate-600 sm:text-base"
								>
									<svelte:component this={feature.icon} class="mt-1 h-4 w-4 text-slate-400" />
									<span>{feature.text}</span>
								</li>
							{/each}
						</ul>

						{#if isSelected}
							<div transition:fade={{ duration: 200 }} class="space-y-3 pt-4">
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
											<span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
										</span>
										<span>In Development</span>
									</span>
									<a
										href="https://github.com/communisaas/communique-site"
										class="group/link flex items-center px-2 text-sm text-slate-600 hover:text-slate-900"
									>
										<span class="mr-1.5">Follow Progress</span>
										<ArrowRight
											class="h-4 w-4 transform transition-transform duration-200 group-hover/link:translate-x-1"
										/>
									</a>
								</div>
								<p class="text-center text-xs text-slate-500">
									{channel.id === 'certified'
										? 'Congressional delivery system integration in progress'
										: 'Direct outreach system coming soon'}
								</p>
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
