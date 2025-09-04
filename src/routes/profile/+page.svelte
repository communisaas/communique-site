<script lang="ts">
	import { page } from '$app/stores';
	import { User, Settings, FileText, Shield, MapPin, Calendar, ExternalLink, Edit3 } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ProfileEditModal from '$lib/components/profile/ProfileEditModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type TabType = 'overview' | 'profile' | 'templates' | 'settings';
	type EditSection = 'basic' | 'profile' | 'address';
	let activeTab: TabType = $state('overview');
	let showEditModal = $state(false);
	let editingSection = $state<EditSection>('basic');

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: User },
		{ id: 'profile', label: 'Profile', icon: Edit3 },
		{ id: 'templates', label: 'Templates', icon: FileText },
		{ id: 'settings', label: 'Settings', icon: Settings }
	] as const;

	const user = $derived(data.user);
	const templates = $derived(data.templates);
	const stats = $derived(data.templateStats);

	function formatDate(date: string | Date) {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getCompletionStatus() {
		const required = [user.name, user.email];
		const optional = [
			user.address?.street, 
			user.address?.city, 
			user.profile?.role, 
			user.profile?.connection
		];
		
		const completedRequired = required.filter(Boolean).length;
		const completedOptional = optional.filter(Boolean).length;
		
		return {
			required: completedRequired,
			total: required.length,
			optional: completedOptional,
			percentage: Math.round(((completedRequired + completedOptional) / (required.length + optional.length)) * 100)
		};
	}

	const completion = $derived(getCompletionStatus());

	function openEditModal(section: EditSection) {
		editingSection = section;
		showEditModal = true;
	}

	function handleProfileSave(event: CustomEvent) {
		const { section, data } = event.detail;
		
		// Update the local user data (in a real app, you might want to reload from server)
		// For now, this is a simple optimistic update
		
		showEditModal = false;
		
		// Optionally reload the page data or update reactive state
		// window.location.reload(); // Simple approach
	}
</script>

<svelte:head>
	<title>Profile - Communiqué</title>
	<meta name="description" content="Manage your profile and advocacy settings" />
</svelte:head>

<div class="min-h-screen bg-slate-50">
	<!-- Header -->
	<div class="bg-white border-b border-slate-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="py-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-4">
						{#if user.avatar}
							<img src={user.avatar} alt={user.name} class="h-16 w-16 rounded-full" />
						{:else}
							<div class="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center">
								<User class="h-8 w-8 text-white" />
							</div>
						{/if}
						<div>
							<h1 class="text-2xl font-bold text-slate-900">{user.name || 'Your Profile'}</h1>
							<p class="text-slate-600">{user.email}</p>
							{#if user.profile?.role}
								<p class="text-sm text-slate-500">{user.profile.role}{user.profile.organization ? ` at ${user.profile.organization}` : ''}</p>
							{/if}
						</div>
					</div>
					<div class="flex items-center space-x-3">
						<div class="text-right">
							<div class="text-sm text-slate-500">Profile completion</div>
							<div class="flex items-center space-x-2">
								<div class="w-20 h-2 bg-slate-200 rounded-full">
									<div 
										class="h-2 bg-blue-600 rounded-full transition-all duration-300" 
										style="width: {completion.percentage}%"
									></div>
								</div>
								<span class="text-sm font-medium text-slate-700">{completion.percentage}%</span>
							</div>
						</div>
						{#if user.verification?.is_verified}
							<Badge color="green">
								<Shield class="w-3 h-3 mr-1" />
								Verified
							</Badge>
						{/if}
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
					<button
						onclick={() => activeTab = tab.id}
						class="flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors {
							activeTab === tab.id
								? 'border-blue-500 text-blue-600'
								: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
						}"
					>
						<tab.icon class="w-4 h-4" />
						<span>{tab.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if activeTab === 'overview'}
			<!-- Overview Tab -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
				<!-- Profile Summary -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Account Status -->
					<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
						<h3 class="text-lg font-semibold text-slate-900 mb-4">Account Status</h3>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<dt class="text-sm font-medium text-slate-500">Member since</dt>
								<dd class="text-sm text-slate-900">{formatDate(user.timestamps.created_at)}</dd>
							</div>
							<div>
								<dt class="text-sm font-medium text-slate-500">Last updated</dt>
								<dd class="text-sm text-slate-900">{formatDate(user.timestamps.updated_at)}</dd>
							</div>
							<div>
								<dt class="text-sm font-medium text-slate-500">Congressional District</dt>
								<dd class="text-sm text-slate-900">{user.address?.congressional_district || 'Not determined'}</dd>
							</div>
							<div>
								<dt class="text-sm font-medium text-slate-500">Profile Visibility</dt>
								<dd class="text-sm text-slate-900 capitalize">{user.profile?.visibility || 'Private'}</dd>
							</div>
						</div>
					</div>

					<!-- Template Activity -->
					<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
						<h3 class="text-lg font-semibold text-slate-900 mb-4">Template Activity</h3>
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
							<div class="text-center">
								<div class="text-2xl font-bold text-blue-600">{stats.total}</div>
								<div class="text-xs text-slate-600">Templates</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-green-600">{stats.published}</div>
								<div class="text-xs text-slate-600">Published</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-purple-600">{stats.totalUses}</div>
								<div class="text-xs text-slate-600">Total Uses</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-emerald-600">{stats.totalSent}</div>
								<div class="text-xs text-slate-600">Messages Sent</div>
							</div>
						</div>
					</div>

					<!-- Recent Templates -->
					{#if templates.length > 0}
						<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
							<div class="flex items-center justify-between mb-4">
								<h3 class="text-lg font-semibold text-slate-900">Recent Templates</h3>
								<Button variant="secondary" size="sm" onclick={() => activeTab = 'templates'}>
									View All
								</Button>
							</div>
							<div class="space-y-3">
								{#each templates.slice(0, 3) as template}
									<div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
										<div class="flex-1">
											<h4 class="font-medium text-slate-900">{template.title}</h4>
											<div class="flex items-center space-x-2 mt-1">
												<Badge color={template.status === 'published' ? 'green' : 'yellow'} size="sm">
													{template.status}
												</Badge>
												<span class="text-xs text-slate-500">
													{formatDate(template.createdAt)}
												</span>
											</div>
										</div>
										<a href="/{template.slug}" target="_blank">
											<Button variant="secondary" size="sm">
												<ExternalLink class="w-4 h-4 mr-1" />
												View
											</Button>
										</a>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Address Info -->
					<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-lg font-semibold text-slate-900">Address</h3>
							<Button variant="secondary" size="sm" onclick={() => openEditModal('address')}>
								<Edit3 class="w-4 h-4" />
							</Button>
						</div>
						{#if user.address?.street}
							<div class="text-sm text-slate-900">
								<div>{user.address.street}</div>
								<div>{user.address.city}, {user.address.state} {user.address.zip}</div>
							</div>
						{:else}
							<div class="text-sm text-slate-500">
								<MapPin class="w-4 h-4 inline mr-1" />
								No address provided
							</div>
							<Button variant="primary" size="sm" classNames="mt-3 w-full" onclick={() => openEditModal('address')}>
								Add Address
							</Button>
						{/if}
					</div>

					<!-- Representatives -->
					{#if user.representatives.length > 0}
						<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
							<h3 class="text-lg font-semibold text-slate-900 mb-4">Your Representatives</h3>
							<div class="space-y-3">
								{#each user.representatives as rep}
									<div class="p-3 bg-slate-50 rounded-lg">
										<div class="font-medium text-slate-900">{rep.name}</div>
										<div class="text-sm text-slate-600">{rep.party} - {rep.chamber}</div>
										<div class="text-xs text-slate-500">{rep.state}-{rep.district}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Quick Actions -->
					<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
						<h3 class="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
						<div class="space-y-2">
							<a href="/?create=true" class="inline-block w-full">
								<Button variant="secondary" size="sm" classNames="w-full justify-start">
									<FileText class="w-4 h-4 mr-2" />
									Create Template
								</Button>
							</a>
							<Button variant="secondary" size="sm" classNames="w-full justify-start" onclick={() => openEditModal('profile')}>
								<User class="w-4 h-4 mr-2" />
								Edit Profile
							</Button>
							<Button variant="secondary" size="sm" classNames="w-full justify-start">
								<Settings class="w-4 h-4 mr-2" />
								Privacy Settings
							</Button>
						</div>
					</div>
				</div>
			</div>

		{:else if activeTab === 'profile'}
			<!-- Profile Tab -->
			<div class="max-w-3xl">
				<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
					<h3 class="text-lg font-semibold text-slate-900 mb-6">Profile Information</h3>
					<div class="space-y-6">
						<!-- Basic Information -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-slate-700">Name</label>
								<div class="mt-1 text-sm text-slate-900">{user.name || 'Not provided'}</div>
							</div>
							<div>
								<label class="block text-sm font-medium text-slate-700">Email</label>
								<div class="mt-1 text-sm text-slate-900">{user.email}</div>
							</div>
						</div>

						<!-- Profile Details -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-slate-700">Role</label>
								<div class="mt-1 text-sm text-slate-900">{user.profile?.role || 'Not provided'}</div>
							</div>
							<div>
								<label class="block text-sm font-medium text-slate-700">Organization</label>
								<div class="mt-1 text-sm text-slate-900">{user.profile?.organization || 'Not provided'}</div>
							</div>
						</div>

						<div>
							<label class="block text-sm font-medium text-slate-700">Connection to Issues</label>
							<div class="mt-1 text-sm text-slate-900">{user.profile?.connection || 'Not provided'}</div>
							{#if user.profile?.connection_details}
								<div class="mt-2 text-sm text-slate-600">{user.profile.connection_details}</div>
							{/if}
						</div>

						<div class="flex justify-end">
							<Button variant="primary" onclick={() => openEditModal('profile')}>
								<Edit3 class="w-4 h-4 mr-2" />
								Edit Profile
							</Button>
						</div>
					</div>
				</div>
			</div>

		{:else if activeTab === 'templates'}
			<!-- Templates Tab -->
			<div>
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-lg font-semibold text-slate-900">Your Templates</h3>
					<a href="/?create=true">
						<Button variant="primary">
							<FileText class="w-4 h-4 mr-2" />
							Create Template
						</Button>
					</a>
				</div>

				{#if templates.length > 0}
					<div class="bg-white rounded-lg shadow-sm border border-slate-200">
						{#each templates as template, i}
							<div class="p-6 {i > 0 ? 'border-t border-slate-200' : ''}">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="flex items-center space-x-2 mb-2">
											<h4 class="font-semibold text-slate-900">{template.title}</h4>
											<Badge color={template.status === 'published' ? 'green' : 'yellow'} size="sm">
												{template.status}
											</Badge>
											{#if template.is_public}
												<Badge color="blue" size="sm">Public</Badge>
											{/if}
										</div>
										<p class="text-sm text-slate-600 mb-2">{template.description}</p>
										<div class="flex items-center space-x-4 text-xs text-slate-500">
											<span>Category: {template.category}</span>
											<span>Created: {formatDate(template.createdAt)}</span>
											<span>Uses: {template.template_campaign?.length || 0}</span>
										</div>
									</div>
									<div class="flex items-center space-x-2 ml-4">
										<a href="/dashboard/templates" class="inline-flex">
											<Button variant="secondary" size="sm">
												<Edit3 class="w-4 h-4 mr-1" />
												Manage
											</Button>
										</a>
										<a href="/{template.slug}" target="_blank" class="inline-flex">
											<Button variant="secondary" size="sm">
												<ExternalLink class="w-4 h-4 mr-1" />
												View
											</Button>
										</a>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center py-12">
						<FileText class="w-12 h-12 text-slate-400 mx-auto mb-4" />
						<h3 class="text-lg font-semibold text-slate-900 mb-2">No templates yet</h3>
						<p class="text-slate-600 mb-4">Create your first template to start building advocacy campaigns.</p>
						<a href="/?create=true">
							<Button variant="primary">
								<FileText class="w-4 h-4 mr-2" />
								Create Your First Template
							</Button>
						</a>
					</div>
				{/if}
			</div>

		{:else}
			<!-- Settings Tab -->
			<div class="max-w-3xl space-y-6">
				<!-- Privacy Settings -->
				<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
					<h3 class="text-lg font-semibold text-slate-900 mb-4">Privacy Settings</h3>
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-slate-700 mb-2">Profile Visibility</label>
							<select class="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
								<option value="private" selected={user.profile?.visibility === 'private'}>Private</option>
								<option value="limited" selected={user.profile?.visibility === 'limited'}>Limited</option>
								<option value="public" selected={user.profile?.visibility === 'public'}>Public</option>
							</select>
							<p class="mt-1 text-xs text-slate-500">Control who can see your profile information</p>
						</div>
					</div>
				</div>

				<!-- Account Management -->
				<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
					<h3 class="text-lg font-semibold text-slate-900 mb-4">Account Management</h3>
					<div class="space-y-4">
						<Button variant="secondary" classNames="w-full justify-start">
							Export My Data
						</Button>
						<Button variant="secondary" classNames="w-full justify-start">
							Download Profile
						</Button>
						<Button variant="danger" classNames="w-full justify-start">
							Delete Account
						</Button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Edit Profile Modal -->
{#if showEditModal}
	<ProfileEditModal
		user={user}
		section={editingSection}
		onclose={() => showEditModal = false}
		on:save={handleProfileSave}
	/>
{/if}