<script lang="ts">
	import { Check, ChevronRight, ExternalLink } from '@lucide/svelte';
	import type { LandscapeMember } from '$lib/utils/landscapeMerge';

	function extractDomain(url: string): string {
		try {
			const host = new URL(url).hostname;
			return host.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	let {
		member,
		contacted = false,
		departing = false,
		onWriteTo
	}: {
		member: LandscapeMember;
		contacted: boolean;
		departing: boolean;
		onWriteTo: (member: LandscapeMember) => void;
	} = $props();

	const canAct = $derived(member.deliveryRoute !== 'recorded' && member.deliveryRoute !== 'phone_only');
	const isActive = $derived(canAct && !contacted && !departing);

	function handleClick() {
		if (isActive) {
			onWriteTo(member);
		}
	}
</script>

{#snippet cardContent()}
	<!-- Header: name + title -->
	<div class="mb-1">
		<h4 class="text-base font-semibold text-slate-900">{member.name}</h4>
		<p class="text-sm text-slate-600">
			{member.title}{member.organization ? `, ${member.organization}` : ''}
		</p>
	</div>

	<!-- Email provenance (grounded source) -->
	{#if member.emailGrounded && member.emailSource}
		<a
			href={member.emailSource}
			target="_blank"
			rel="noopener noreferrer"
			class="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
			onclick={(e) => e.stopPropagation()}
		>
			<ExternalLink class="h-3 w-3" />
			{extractDomain(member.emailSource)}
		</a>
	{/if}

	<!-- Accountability opener (template DMs only) -->
	{#if member.accountabilityOpener}
		<p class="mt-1.5 text-sm text-participation-primary-600 line-clamp-2">
			{member.accountabilityOpener}
		</p>
	{/if}

	<!-- Public actions -->
	{#if member.publicActions.length > 0}
		<ul class="mt-2 space-y-0.5">
			{#each member.publicActions.slice(0, 2) as action}
				<li class="text-xs text-slate-500 leading-snug line-clamp-1">
					{action}
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Action affordance -->
	{#if canAct}
		<div class="mt-3 flex items-center justify-end">
			{#if departing}
				<span class="departing-pulse text-sm font-medium text-slate-400">
					Opening mail&hellip;
				</span>
			{:else if contacted}
				<span class="flex items-center gap-1 text-sm font-medium text-channel-verified-600">
					<Check class="h-4 w-4" />
					Contacted
				</span>
			{:else}
				<span class="flex items-center gap-0.5 text-sm font-medium text-participation-primary-600">
					Write to them
					<ChevronRight class="h-4 w-4" />
				</span>
			{/if}
		</div>
	{/if}
{/snippet}

{#if isActive}
	<button
		type="button"
		class="w-full text-left rounded-xl border border-slate-200 bg-white shadow-sm p-4 transition-colors cursor-pointer hover:border-slate-300 hover:shadow min-h-[44px]"
		onclick={handleClick}
	>
		{@render cardContent()}
	</button>
{:else}
	<div
		class="rounded-xl border shadow-sm p-4 min-h-[44px] transition-all duration-700 ease-out
			{departing ? 'departing-card border-participation-primary-200 bg-white' : 'border-slate-200 bg-white'}"
	>
		{@render cardContent()}
	</div>
{/if}

<style>
	.departing-card {
		position: relative;
		overflow: hidden;
	}
	.departing-card::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(120, 100, 200, 0.03) 40%,
			rgba(120, 100, 200, 0.03) 60%,
			transparent 100%
		);
		animation: sweep 2s ease-in-out infinite;
		pointer-events: none;
	}
	.departing-pulse {
		animation: breathe 1.5s ease-in-out infinite;
	}
	@keyframes sweep {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}
	@keyframes breathe {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 1; }
	}
	@media (prefers-reduced-motion: reduce) {
		.departing-card::after { animation: none; opacity: 0; }
		.departing-pulse { animation: none; opacity: 0.7; }
	}
</style>
