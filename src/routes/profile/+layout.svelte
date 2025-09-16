<script lang="ts">
	import { page } from '$app/stores';
	import { User, Settings, FileText, Shield, Edit3, Home, LogOut } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	
	let { children, data } = $props();
	
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
		const optional = [
			user.street, 
			user.city, 
			user.state,
			user.zip
		];
		
		const completedRequired = required.filter(Boolean).length;
		const completedOptional = optional.filter(Boolean).length;
		
		return {
			required: completedRequired,
			total: required.length,
			optional: completedOptional,
			optionalTotal: optional.length,
			percentage: Math.round(((completedRequired + completedOptional) / (required.length + optional.length)) * 100)
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
						class="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors group"
					>
						<Home class="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
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
							class="flex items-center gap-1.5 px-2 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-all"
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
	<div class="bg-white border-b border-slate-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			
			<!-- Profile Section -->
			<div class="py-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-4">
						{#if user.avatar}
							<img src={user.avatar} alt={user.name} class="h-16 w-16 rounded-full" />
						{:else}
							<div class="h-16 w-16 rounded-full bg-participation-primary-600 flex items-center justify-center">
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
								<div class="w-20 h-2 bg-slate-200 rounded-full">
									<div 
										class="h-2 bg-participation-primary-600 rounded-full transition-all duration-300" 
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
	<div class="bg-white border-b border-slate-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex space-x-8">
				{#each tabs as tab}
					<a
						href="/profile?tab={tab.id}"
						class="flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors {
							activeTab === tab.id
								? 'border-participation-primary-500 text-participation-primary-600'
								: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
						}"
					>
						<tab.icon class="w-4 h-4" />
						<span>{tab.label}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{@render children()}
	</div>
</div>