<script lang="ts">
	import { page } from '$app/stores';
	import { User as _User, Settings, FileText, Shield, Edit3, Home, LogOut as _LogOut } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let {
		children,
		data
	}: {
		children: Snippet;
		data: LayoutData;
	} = $props();

	type TabType = 'overview' | 'profile' | 'templates' | 'settings';

	// Get active tab from URL search params or default to overview
	const activeTab = $derived(($page.url.searchParams.get('tab') as TabType) || 'overview');

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: User },
		{ id: 'profile', label: 'Profile', icon: Edit3 },
		{ id: 'templates', label: 'Templates', icon: FileText },
		{ id: 'settings', label: 'Settings', icon: Settings }
	] as const;

	const user = $derived(data.user);

	// Calculate profile completion
	function getCompletionStatus() {
		const required = [user.name, user.email];
		const optional = [user.street, user.city, user.state, user.zip];

		const completedRequired = required.filter(Boolean).length;
		const completedOptional = optional.filter(Boolean).length;

		return {
			required: completedRequired,
			total: required.length,
			optional: completedOptional,
			optionalTotal: optional.length,
			percentage: Math.round(
				((completedRequired + completedOptional) / (required.length + optional.length)) * 100
			)
		};
	}

	const completion = $derived(getCompletionStatus());
</script>

<div class="min-h-screen bg-slate-50">
	<!-- Integrated Header with Navigation - matching AppHeader styles -->
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto max-w-7xl px-4 sm:px-6">
			<div class="flex items-center justify-between py-3">
				<!-- Left: Home navigation -->
				<div class="flex items-center gap-4">
					<a
						href="/"
						class="group flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
					>
						<Home class="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
						<span class="text-sm font-medium">Home</span>
					</a>
				</div>

				<!-- Right: User actions - matching AppHeader -->
				<div class="flex items-center gap-3">
					<div class="flex items-center gap-4 text-sm">
						<!-- Greeting -->
						<span class="text-slate-600">Hi {user.name?.split(' ')[0] || 'User'}!</span>

						<!-- Sign out - matching AppHeader button style -->
						<a
							href="/auth/logout"
							class="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700"
							title="Sign out"
						>
							<LogOut class="h-4 w-4" />
							<span class="hidden sm:inline">Sign out</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Profile Section - separated from navigation -->
	<div class="border-b border-slate-200 bg-white">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<!-- Profile Section -->
			<div class="py-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-4">
						{#if user.avatar}
							<img src={user.avatar} alt={user.name} class="h-16 w-16 rounded-full" />
						{:else}
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full bg-participation-primary-600"
							>
								<User class="h-8 w-8 text-white" />
							</div>
						{/if}
						<div>
							<h1 class="text-2xl font-bold text-slate-900">{user.name || 'Your Profile'}</h1>
							<p class="text-slate-600">{user.email}</p>
						</div>
					</div>
					<div class="flex items-center space-x-3">
						<div class="text-right">
							<div class="text-sm text-slate-500">Profile completion</div>
							<div class="flex items-center space-x-2">
								<div class="h-2 w-20 rounded-full bg-slate-200">
									<div
										class="h-2 rounded-full bg-participation-primary-600 transition-all duration-300"
										style="width: {completion.percentage}%"
									></div>
								</div>
								<span class="text-sm font-medium text-slate-700">{completion.percentage}%</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Tabs Navigation -->
	<div class="border-b border-slate-200 bg-white">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex space-x-8">
				{#each tabs as tab}
					<a
						href="/profile?tab={tab.id}"
						class="flex items-center space-x-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors {activeTab ===
						tab.id
							? 'border-participation-primary-500 text-participation-primary-600'
							: 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}"
					>
						<tab.icon class="h-4 w-4" />
						<span>{tab.label}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		{@render children()}
	</div>
</div>
