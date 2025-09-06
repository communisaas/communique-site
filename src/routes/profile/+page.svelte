<script lang="ts">
	import { page } from '$app/stores';
	import { User, Settings, FileText, Shield, MapPin, Calendar, ExternalLink, Edit3 } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ProfileEditModal from '$lib/components/profile/ProfileEditModal.svelte';
	import SkeletonCard from '$lib/components/ui/SkeletonCard.svelte';
	import SkeletonStat from '$lib/components/ui/SkeletonStat.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type EditSection = 'basic' | 'profile' | 'address';
	let showEditModal = $state(false);
	let editingSection = $state<EditSection>('basic');
	
	// Get active tab from URL
	// Tab is managed by the layout
	const activeTab = $derived(($page.url.searchParams.get('tab') as 'overview' | 'profile' | 'templates' | 'settings') || 'overview');

	// User data is immediately available
	const user = $derived(data.user);
	
	// Streamed data - these are promises
	const userDetailsPromise = $derived(data.streamed?.userDetails);
	const templatesDataPromise = $derived(data.streamed?.templatesData);
	const representativesPromise = $derived(data.streamed?.representatives);

	function formatDate(date: string | Date) {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
	

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

<div>
		{#if activeTab === 'overview'}
			<!-- Overview Tab -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
				<!-- Profile Summary -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Account Status -->
					{#await userDetailsPromise}
						<SkeletonCard lines={4} />
					{:then userDetails}
						{#if userDetails}
							<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
								<h3 class="text-lg font-semibold text-slate-900 mb-4">Account Status</h3>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<dt class="text-sm font-medium text-slate-500">Member since</dt>
										<dd class="text-sm text-slate-900">{formatDate(userDetails.timestamps.created_at)}</dd>
									</div>
									<div>
										<dt class="text-sm font-medium text-slate-500">Last updated</dt>
										<dd class="text-sm text-slate-900">{formatDate(userDetails.timestamps.updated_at)}</dd>
									</div>
									<div>
										<dt class="text-sm font-medium text-slate-500">Congressional District</dt>
										<dd class="text-sm text-slate-900">{userDetails.address?.congressional_district || 'Not determined'}</dd>
									</div>
									<div>
										<dt class="text-sm font-medium text-slate-500">Profile Visibility</dt>
										<dd class="text-sm text-slate-900 capitalize">{userDetails.profile?.visibility || 'Private'}</dd>
									</div>
								</div>
							</div>
						{:else}
							<!-- Fallback with basic user data -->
							<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
								<h3 class="text-lg font-semibold text-slate-900 mb-4">Account Status</h3>
								<div class="text-sm text-slate-600">Loading account details...</div>
							</div>
						{/if}
					{/await}

					<!-- Template Activity -->
					{#await templatesDataPromise}
						<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
							<h3 class="text-lg font-semibold text-slate-900 mb-4">Template Activity</h3>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
								<SkeletonStat />
								<SkeletonStat />
								<SkeletonStat />
								<SkeletonStat />
							</div>
						</div>
					{:then templatesData}
						{#if templatesData}
							<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
								<h3 class="text-lg font-semibold text-slate-900 mb-4">Template Activity</h3>
								<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
									<div class="text-center">
										<div class="text-2xl font-bold text-blue-600">{templatesData.templateStats.total}</div>
										<div class="text-xs text-slate-600">Templates</div>
									</div>
									<div class="text-center">
										<div class="text-2xl font-bold text-green-600">{templatesData.templateStats.published}</div>
										<div class="text-xs text-slate-600">Published</div>
									</div>
									<div class="text-center">
										<div class="text-2xl font-bold text-purple-600">{templatesData.templateStats.totalUses}</div>
										<div class="text-xs text-slate-600">Total Uses</div>
									</div>
									<div class="text-center">
										<div class="text-2xl font-bold text-emerald-600">{templatesData.templateStats.totalSent}</div>
										<div class="text-xs text-slate-600">Messages Sent</div>
									</div>
								</div>
							</div>
						{/if}
					{/await}

					<!-- Recent Templates -->
					{#await templatesDataPromise}
						<SkeletonCard lines={3} showActions={true} />
					{:then templatesData}
						{#if templatesData && templatesData.templates.length > 0}
							<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
								<div class="flex items-center justify-between mb-4">
									<h3 class="text-lg font-semibold text-slate-900">Recent Templates</h3>
									<Button variant="secondary" size="sm" href="/profile?tab=templates">
										View All
									</Button>
								</div>
								<div class="space-y-3">
									{#each templatesData.templates.slice(0, 3) as template}
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
											<a href="/s/{template.slug}" target="_blank">
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
					{/await}
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">
					<!-- Address Info -->
					{#await userDetailsPromise}
						<SkeletonCard lines={2} />
					{:then userDetails}
						<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
							<div class="flex items-center justify-between mb-4">
								<h3 class="text-lg font-semibold text-slate-900">Address</h3>
								<Button variant="secondary" size="sm" onclick={() => openEditModal('address')}>
									<Edit3 class="w-4 h-4" />
								</Button>
							</div>
							{#if userDetails?.address?.street}
								<div class="text-sm text-slate-900">
									<div>{userDetails.address.street}</div>
									<div>{userDetails.address.city}, {userDetails.address.state} {userDetails.address.zip}</div>
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
					{/await}

					<!-- Representatives -->
					{#await representativesPromise}
						<SkeletonCard lines={3} />
					{:then representatives}
						{#if representatives && representatives.length > 0}
							<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
								<h3 class="text-lg font-semibold text-slate-900 mb-4">Your Representatives</h3>
								<div class="space-y-3">
									{#each representatives as rep}
										<div class="p-3 bg-slate-50 rounded-lg">
											<div class="font-medium text-slate-900">{rep.name}</div>
											<div class="text-sm text-slate-600">{rep.party} - {rep.chamber}</div>
											<div class="text-xs text-slate-500">{rep.state}-{rep.district}</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/await}

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
			{#await userDetailsPromise}
				<div class="max-w-3xl">
					<SkeletonCard lines={10} />
				</div>
			{:then userDetails}
				<div class="max-w-3xl">
					<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
						<h3 class="text-lg font-semibold text-slate-900 mb-6">Profile Information</h3>
						<div class="space-y-6">
							<!-- Basic Information -->
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-slate-700">Name</label>
									<div class="mt-1 text-sm text-slate-900">{userDetails?.name || user.name || 'Not provided'}</div>
								</div>
								<div>
									<label class="block text-sm font-medium text-slate-700">Email</label>
									<div class="mt-1 text-sm text-slate-900">{userDetails?.email || user.email}</div>
								</div>
							</div>

							<!-- Profile Details -->
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-slate-700">Role</label>
									<div class="mt-1 text-sm text-slate-900">{userDetails?.profile?.role || 'Not provided'}</div>
								</div>
								<div>
									<label class="block text-sm font-medium text-slate-700">Organization</label>
									<div class="mt-1 text-sm text-slate-900">{userDetails?.profile?.organization || 'Not provided'}</div>
								</div>
							</div>

							<div>
								<label class="block text-sm font-medium text-slate-700">Connection to Issues</label>
								<div class="mt-1 text-sm text-slate-900">{userDetails?.profile?.connection || 'Not provided'}</div>
								{#if userDetails?.profile?.connection_details}
									<div class="mt-2 text-sm text-slate-600">{userDetails.profile.connection_details}</div>
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
			{/await}

		{:else if activeTab === 'templates'}
			<!-- Templates Tab -->
			{#await templatesDataPromise}
				<div>
					<div class="flex items-center justify-between mb-6">
						<h3 class="text-lg font-semibold text-slate-900">Your Templates</h3>
					</div>
					<div class="space-y-4">
						<SkeletonCard lines={3} />
						<SkeletonCard lines={3} />
						<SkeletonCard lines={3} />
					</div>
				</div>
			{:then templatesData}
				<div>
					<div class="flex items-center justify-between mb-6">
						<h3 class="text-lg font-semibold text-slate-900">Your Templates</h3>
						{#if templatesData && templatesData.templates.length > 0}
							<a href="/?create=true">
								<Button variant="primary">
									<FileText class="w-4 h-4 mr-2" />
									Create Template
								</Button>
							</a>
						{/if}
					</div>

					{#if templatesData && templatesData.templates.length > 0}
						<div class="bg-white rounded-lg shadow-sm border border-slate-200">
							{#each templatesData.templates as template, i}
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
											<a href="/" class="inline-flex">
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
			{/await}

		{:else}
			<!-- Settings Tab -->
			{#await userDetailsPromise}
				<div class="max-w-3xl space-y-6">
					<SkeletonCard lines={6} />
					<SkeletonCard lines={4} />
				</div>
			{:then userDetails}
				<div class="max-w-3xl space-y-6">
					<!-- Privacy Settings -->
					<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
						<h3 class="text-lg font-semibold text-slate-900 mb-4">Privacy Settings</h3>
						<div class="space-y-4">
							<div>
								<label class="block text-sm font-medium text-slate-700 mb-2">Profile Visibility</label>
								<select class="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
									<option value="private" selected={userDetails?.profile?.visibility === 'private'}>Private</option>
									<option value="limited" selected={userDetails?.profile?.visibility === 'limited'}>Limited</option>
									<option value="public" selected={userDetails?.profile?.visibility === 'public'}>Public</option>
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
			{/await}
		{/if}
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