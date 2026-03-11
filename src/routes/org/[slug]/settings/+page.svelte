<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const isOwner = $derived(data.membership.role === 'owner');
	const planName = $derived(data.subscription?.plan ?? 'free');
	const billingSuccess = $derived($page.url.searchParams.get('billing') === 'success');
	const billingCanceled = $derived($page.url.searchParams.get('billing') === 'canceled');

	let checkoutLoading = $state('');
	let portalLoading = $state(false);

	const actionsPercent = $derived(
		data.usage.maxVerifiedActions > 0
			? Math.min(100, (data.usage.verifiedActions / data.usage.maxVerifiedActions) * 100)
			: 0
	);
	const emailsPercent = $derived(
		data.usage.maxEmails > 0
			? Math.min(100, (data.usage.emailsSent / data.usage.maxEmails) * 100)
			: 0
	);

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'active':
				return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
			case 'trialing':
				return 'bg-teal-500/15 text-teal-400 border-teal-500/20';
			case 'past_due':
				return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
			case 'canceled':
				return 'bg-red-500/15 text-red-400 border-red-500/20';
			default:
				return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
		}
	}

	function usageBarClass(percent: number): string {
		if (percent >= 90) return 'bg-red-500';
		if (percent >= 70) return 'bg-amber-500';
		return 'bg-teal-500';
	}

	const plans = [
		{ slug: 'free', name: 'Free', price: '$0', features: ['100 verified actions/mo', '1,000 emails/mo', '2 seats'] },
		{ slug: 'starter', name: 'Starter', price: '$10', features: ['1,000 verified actions/mo', '20,000 emails/mo', '5 seats', 'A/B testing'] },
		{ slug: 'organization', name: 'Organization', price: '$75', features: ['5,000 verified actions/mo', '100,000 emails/mo', '10 seats', 'Custom domain', 'SQL mirror'] },
		{ slug: 'coalition', name: 'Coalition', price: '$200', features: ['10,000 verified actions/mo', '250,000 emails/mo', '25 seats', 'White-label', 'Child orgs'] }
	];

	async function startCheckout(plan: string) {
		checkoutLoading = plan;
		try {
			const res = await fetch('/api/billing/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgSlug: data.org.slug, plan })
			});
			const result = await res.json();
			if (res.ok && result.url) {
				window.location.href = result.url;
			} else {
				alert(result.message ?? 'Failed to start checkout');
				checkoutLoading = '';
			}
		} catch {
			alert('Network error. Please try again.');
			checkoutLoading = '';
		}
	}

	async function openPortal() {
		portalLoading = true;
		try {
			const res = await fetch('/api/billing/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgSlug: data.org.slug })
			});
			const result = await res.json();
			if (res.ok && result.url) {
				window.location.href = result.url;
			} else {
				alert(result.message ?? 'Failed to open billing portal');
			}
		} catch {
			alert('Network error. Please try again.');
		} finally {
			portalLoading = false;
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-8">
	<!-- Header -->
	<div>
		<h1 class="text-xl font-semibold text-zinc-100">Settings</h1>
		<p class="text-sm text-zinc-500 mt-1">Manage your organization's billing and team.</p>
	</div>

	<!-- Billing status banner -->
	{#if billingSuccess}
		<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
			Subscription activated successfully. Your plan limits are now in effect.
		</div>
	{/if}
	{#if billingCanceled}
		<div class="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-400">
			Checkout was canceled. Your plan has not changed.
		</div>
	{/if}

	<!-- Current Plan + Usage -->
	<section class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6 space-y-5">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-sm font-medium text-zinc-300 uppercase tracking-wider">Current Plan</h2>
				<div class="flex items-center gap-3 mt-2">
					<span class="text-2xl font-semibold text-zinc-100 capitalize">{planName}</span>
					{#if data.subscription}
						<span class="inline-flex items-center px-2 py-0.5 rounded text-xs border {statusBadgeClass(data.subscription.status)}">
							{data.subscription.status}
						</span>
					{/if}
				</div>
				{#if data.subscription?.currentPeriodEnd}
					<p class="text-xs text-zinc-500 mt-1">
						{data.subscription.status === 'canceled' ? 'Access until' : 'Renews'} {formatDate(data.subscription.currentPeriodEnd)}
					</p>
				{/if}
			</div>
			{#if isOwner && data.subscription && data.subscription.status !== 'canceled'}
				<button
					onclick={openPortal}
					disabled={portalLoading}
					class="px-4 py-2 text-sm border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
				>
					{portalLoading ? 'Opening...' : 'Manage Billing'}
				</button>
			{/if}
		</div>

		<!-- Usage meters -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
			<div class="space-y-2">
				<div class="flex justify-between text-xs">
					<span class="text-zinc-400">Verified Actions</span>
					<span class="text-zinc-300 tabular-nums">
						{data.usage.verifiedActions.toLocaleString()} / {data.usage.maxVerifiedActions.toLocaleString()}
					</span>
				</div>
				<div class="h-2 rounded-full bg-zinc-800 overflow-hidden">
					<div
						class="h-full rounded-full transition-all {usageBarClass(actionsPercent)}"
						style="width: {actionsPercent}%"
					></div>
				</div>
			</div>
			<div class="space-y-2">
				<div class="flex justify-between text-xs">
					<span class="text-zinc-400">Emails Sent</span>
					<span class="text-zinc-300 tabular-nums">
						{data.usage.emailsSent.toLocaleString()} / {data.usage.maxEmails.toLocaleString()}
					</span>
				</div>
				<div class="h-2 rounded-full bg-zinc-800 overflow-hidden">
					<div
						class="h-full rounded-full transition-all {usageBarClass(emailsPercent)}"
						style="width: {emailsPercent}%"
					></div>
				</div>
			</div>
		</div>
	</section>

	<!-- Plan Selection -->
	{#if isOwner}
		<section class="space-y-4">
			<h2 class="text-sm font-medium text-zinc-300 uppercase tracking-wider">Plans</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each plans as plan}
					{@const isCurrent = planName === plan.slug}
					{@const isUpgrade = !isCurrent && plan.slug !== 'free'}
					<div
						class="rounded-xl border p-5 space-y-4 {isCurrent
							? 'border-teal-500/40 bg-teal-500/5'
							: 'border-zinc-800/60 bg-zinc-900/50'}"
					>
						<div>
							<h3 class="text-base font-semibold text-zinc-100">{plan.name}</h3>
							<p class="text-xl font-bold text-zinc-100 mt-1">
								{plan.price}<span class="text-xs font-normal text-zinc-500">/mo</span>
							</p>
						</div>
						<ul class="space-y-1.5">
							{#each plan.features as feature}
								<li class="text-xs text-zinc-400 flex items-start gap-1.5">
									<svg class="w-3.5 h-3.5 text-teal-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
									{feature}
								</li>
							{/each}
						</ul>
						{#if isCurrent}
							<div class="text-xs text-teal-400 font-medium pt-1">Current plan</div>
						{:else if isUpgrade}
							<button
								onclick={() => startCheckout(plan.slug)}
								disabled={!!checkoutLoading}
								class="w-full px-3 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
							>
								{checkoutLoading === plan.slug ? 'Redirecting...' : 'Upgrade'}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Team Members -->
	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-medium text-zinc-300 uppercase tracking-wider">Team</h2>
			<span class="text-xs text-zinc-500">{data.members.length} member{data.members.length !== 1 ? 's' : ''}</span>
		</div>
		<div class="rounded-xl border border-zinc-800/60 bg-zinc-900/50 divide-y divide-zinc-800/40">
			{#each data.members as member}
				<div class="flex items-center gap-3 px-5 py-3">
					{#if member.avatar}
						<img src={member.avatar} alt="" class="w-8 h-8 rounded-full" />
					{:else}
						<div class="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-medium">
							{(member.name ?? member.email).charAt(0).toUpperCase()}
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-sm text-zinc-200 truncate">{member.name ?? member.email}</p>
						{#if member.name}
							<p class="text-xs text-zinc-500 truncate">{member.email}</p>
						{/if}
					</div>
					<span class="text-xs px-2 py-0.5 rounded border bg-zinc-800/50 border-zinc-700/50 text-zinc-400 capitalize">
						{member.role}
					</span>
				</div>
			{/each}
		</div>

		<!-- Pending Invites -->
		{#if data.invites.length > 0}
			<div class="space-y-2">
				<h3 class="text-xs text-zinc-500 font-medium">Pending Invites</h3>
				<div class="rounded-lg border border-zinc-800/40 bg-zinc-900/30 divide-y divide-zinc-800/30">
					{#each data.invites as invite}
						<div class="flex items-center justify-between px-4 py-2.5 text-sm">
							<span class="text-zinc-400">{invite.email}</span>
							<span class="text-xs text-zinc-600">expires {formatDate(invite.expiresAt)}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>
</div>
