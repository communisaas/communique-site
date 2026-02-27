<script lang="ts">
	import { Check, ChevronRight, ExternalLink, Phone } from '@lucide/svelte';
	import type { LandscapeMember } from '$lib/utils/landscapeMerge';

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
	<!-- Header: name + delivery badge -->
	<div class="mb-1">
		<div class="flex items-center gap-2">
			<h4 class="text-base font-semibold text-slate-900">{member.name}</h4>
			{#if member.deliveryRoute === 'cwc'}
				<span
					class="inline-flex items-center rounded-full bg-channel-verified-50 px-2 py-0.5 text-xs font-medium text-channel-verified-700"
				>
					Congressional Delivery
				</span>
			{/if}
		</div>
		<p class="text-sm text-slate-600">
			{member.title}{member.organization ? ` · ${member.organization}` : ''}
		</p>
	</div>

	<!-- Contact info for non-CWC officials -->
	{#if member.deliveryRoute === 'phone_only' && member.phone}
		<div class="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
			<Phone class="h-3.5 w-3.5" />
			<a href="tel:{member.phone}" class="hover:text-slate-700">{member.phone}</a>
		</div>
	{/if}

	<!-- Action affordance -->
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
		{:else if member.deliveryRoute === 'cwc'}
			<span class="flex items-center gap-0.5 text-sm font-medium text-participation-primary-600">
				Send via Congress
				<ChevronRight class="h-4 w-4" />
			</span>
		{:else if member.deliveryRoute === 'email'}
			<span class="flex items-center gap-0.5 text-sm font-medium text-participation-primary-600">
				Write to them
				<ChevronRight class="h-4 w-4" />
			</span>
		{:else if member.deliveryRoute === 'form' && member.contactFormUrl}
			<a
				href={member.contactFormUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-0.5 text-sm font-medium text-participation-primary-600 hover:text-participation-primary-700"
				onclick={(e) => e.stopPropagation()}
			>
				Contact form
				<ExternalLink class="h-3.5 w-3.5" />
			</a>
		{/if}
	</div>
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
