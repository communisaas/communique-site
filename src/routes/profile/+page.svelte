<script lang="ts">
	import { page } from '$app/stores';
	import { User, Settings, FileText, MapPin, ExternalLink, Edit3 } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ProfileEditModal from '$lib/components/profile/ProfileEditModal.svelte';
	import SkeletonCard from '$lib/components/ui/SkeletonCard.svelte';
	import SkeletonStat from '$lib/components/ui/SkeletonStat.svelte';
	import PasskeyUpgrade from '$lib/components/auth/PasskeyUpgrade.svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	interface ProfileRepresentative {
		name: string;
		party: string;
		chamber: string;
		state: string;
		district: string;
	}

	let { data }: { data: PageData } = $props();

	function handlePasskeyRegistered() {
		// Reload page data to refresh user trust_tier
		invalidateAll();
	}

	type EditSection = 'basic' | 'profile';
	let showEditModal = $state(false);
	let editingSection = $state<EditSection>('basic');

	// Get active tab from URL
	// Tab is managed by the layout
	const activeTab = $derived(
		($page.url.searchParams.get('tab') as 'overview' | 'profile' | 'templates' | 'settings') ||
			'overview'
	);

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

	function handleProfileSave(_data: import('$lib/types/any-replacements.js').ProfileUpdateData) {
		// Optimistic update — modal already persisted via API
		showEditModal = false;
	}
</script>

<svelte:head>
	<title>Profile - Communiqué</title>
	<meta name="description" content="Manage your profile and advocacy settings" />
</svelte:head>

<div>
	{#if activeTab === 'overview'}
		<!-- Overview Tab -->
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<!-- Profile Summary -->
			<div class="space-y-6 lg:col-span-2">
				<!-- Passkey Upgrade Banner (for trust_tier 0 users) -->
				{#if user}
					<PasskeyUpgrade user={user} onregistered={handlePasskeyRegistered} />
				{/if}
				<!-- Account Status -->
				{#await userDetailsPromise}
					<SkeletonCard lines={4} />
				{:then userDetails}
					{#if userDetails}
						<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
							<h3 class="mb-4 text-lg font-semibold text-slate-900">Account Status</h3>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div>
									<dt class="text-sm font-medium text-slate-500">Member since</dt>
									<dd class="text-sm text-slate-900">
										{formatDate(userDetails.timestamps.created_at)}
									</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-slate-500">Last updated</dt>
									<dd class="text-sm text-slate-900">
										{formatDate(userDetails.timestamps.updated_at)}
									</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-slate-500">Congressional District</dt>
									<dd class="text-sm text-slate-900">
										{'Not determined'}
									</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-slate-500">Profile Visibility</dt>
									<dd class="text-sm capitalize text-slate-900">
										{userDetails.profile?.visibility || 'Private'}
									</dd>
								</div>
							</div>
						</div>
					{:else}
						<!-- Fallback with basic user data -->
						<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
							<h3 class="mb-4 text-lg font-semibold text-slate-900">Account Status</h3>
							<div class="text-sm text-slate-600">Loading account details...</div>
						</div>
					{/if}
				{/await}

				<!-- Template Activity -->
				{#await templatesDataPromise}
					<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
						<h3 class="mb-4 text-lg font-semibold text-slate-900">Template Activity</h3>
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<SkeletonStat />
							<SkeletonStat />
							<SkeletonStat />
							<SkeletonStat />
						</div>
					</div>
				{:then templatesData}
					{#if templatesData}
						<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
							<h3 class="mb-4 text-lg font-semibold text-slate-900">Template Activity</h3>
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div class="text-center">
									<div class="text-2xl font-bold text-participation-primary-600">
										{templatesData.templateStats.total}
									</div>
									<div class="text-xs text-slate-600">Templates</div>
								</div>
								<div class="text-center">
									<div class="text-2xl font-bold text-green-600">
										{templatesData.templateStats.published}
									</div>
									<div class="text-xs text-slate-600">Published</div>
								</div>
								<div class="text-center">
									<div class="text-2xl font-bold text-purple-600">
										{templatesData.templateStats.totalUses}
									</div>
									<div class="text-xs text-slate-600">Total Uses</div>
								</div>
								<div class="text-center">
									<div class="text-2xl font-bold text-emerald-600">
										{templatesData.templateStats.totalSent}
									</div>
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
						<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
							<div class="mb-4 flex items-center justify-between">
								<h3 class="text-lg font-semibold text-slate-900">Recent Templates</h3>
								<Button variant="secondary" size="sm" href="/profile?tab=templates">
									View All
								</Button>
							</div>
							<div class="space-y-3">
								{#each templatesData.templates.slice(0, 3) as template}
									<div class="flex items-center justify-between rounded-lg bg-slate-50 p-3">
										<div class="flex-1">
											<h4 class="font-medium text-slate-900">{template.title}</h4>
											<div class="mt-1 flex items-center space-x-2">
												<Badge
													variant={template.status === 'published' ? 'success' : 'warning'}
													size="sm"
												>
													{template.status}
												</Badge>
												<span class="text-xs text-slate-500">
													{formatDate(template.createdAt)}
												</span>
											</div>
										</div>
										<a href="/s/{template.slug}" target="_blank">
											<Button variant="secondary" size="sm">
												<ExternalLink class="mr-1 h-4 w-4" />
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
				<!-- Note: Address section removed per CYPHERPUNK-ARCHITECTURE.md privacy requirements -->
				<!-- Address data is verified via TEE but never stored in plaintext -->

				<!-- Representatives -->
				{#await representativesPromise}
					<SkeletonCard lines={3} />
				{:then representatives}
					{#if representatives && representatives.length > 0}
						<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
							<h3 class="mb-4 text-lg font-semibold text-slate-900">Your Representatives</h3>
							<div class="space-y-3">
								{#each representatives as rep}
									<div class="rounded-lg bg-slate-50 p-3">
										<div class="font-medium text-slate-900">{(rep as unknown as ProfileRepresentative).name}</div>
										<div class="text-sm text-slate-600">{(rep as unknown as ProfileRepresentative).party} - {(rep as unknown as ProfileRepresentative).chamber}</div>
										<div class="text-xs text-slate-500">{(rep as unknown as ProfileRepresentative).state}-{(rep as unknown as ProfileRepresentative).district}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/await}

				<!-- Quick Actions -->
				<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-900">Quick Actions</h3>
					<div class="space-y-2">
						<a href="/?create=true" class="inline-block w-full">
							<Button variant="secondary" size="sm" classNames="w-full justify-start">
								<FileText class="mr-2 h-4 w-4" />
								Create Template
							</Button>
						</a>
						<Button
							variant="secondary"
							size="sm"
							classNames="w-full justify-start"
							onclick={() => openEditModal('profile')}
						>
							<User class="mr-2 h-4 w-4" />
							Edit Profile
						</Button>
						<Button variant="secondary" size="sm" classNames="w-full justify-start">
							<Settings class="mr-2 h-4 w-4" />
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
				<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-6 text-lg font-semibold text-slate-900">Profile Information</h3>
					<div class="space-y-6">
						<!-- Basic Information -->
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<dt class="block text-sm font-medium text-slate-700">Name</dt>
								<dd class="mt-1 text-sm text-slate-900">
									{userDetails?.name || user.name || 'Not provided'}
								</dd>
							</div>
							<div>
								<dt class="block text-sm font-medium text-slate-700">Email</dt>
								<dd class="mt-1 text-sm text-slate-900">{userDetails?.email || user.email}</dd>
							</div>
						</div>

						<!-- Profile Details -->
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<dt class="block text-sm font-medium text-slate-700">Role</dt>
								<dd class="mt-1 text-sm text-slate-900">
									{userDetails?.profile?.role || 'Not provided'}
								</dd>
							</div>
							<div>
								<dt class="block text-sm font-medium text-slate-700">Organization</dt>
								<dd class="mt-1 text-sm text-slate-900">
									{userDetails?.profile?.organization || 'Not provided'}
								</dd>
							</div>
						</div>

						<div>
							<dt class="block text-sm font-medium text-slate-700">Connection to Issues</dt>
							<dd class="mt-1 text-sm text-slate-900">
								{userDetails?.profile?.connection || 'Not provided'}
							</dd>
						</div>

						<div class="flex justify-end">
							<Button variant="primary" onclick={() => openEditModal('profile')}>
								<Edit3 class="mr-2 h-4 w-4" />
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
				<div class="mb-6 flex items-center justify-between">
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
				<div class="mb-6 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-slate-900">Your Templates</h3>
					{#if templatesData && templatesData.templates.length > 0}
						<a href="/?create=true">
							<Button variant="primary">
								<FileText class="mr-2 h-4 w-4" />
								Create Template
							</Button>
						</a>
					{/if}
				</div>

				{#if templatesData && templatesData.templates.length > 0}
					<div class="rounded-lg border border-slate-200 bg-white shadow-sm">
						{#each templatesData.templates as template, _i}
							<div class="p-6 {_i > 0 ? 'border-t border-slate-200' : ''}">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="mb-2 flex items-center space-x-2">
											<h4 class="font-semibold text-slate-900">{template.title}</h4>
											<Badge
												variant={template.status === 'published' ? 'success' : 'warning'}
												size="sm"
											>
												{template.status}
											</Badge>
											{#if template.is_public}
												<Badge variant="neutral" size="sm">Public</Badge>
											{/if}
										</div>
										<p class="mb-2 text-sm text-slate-600">{template.description}</p>
										<div class="flex items-center space-x-4 text-xs text-slate-500">
											<span>Category: {template.category}</span>
											<span>Created: {formatDate(template.createdAt)}</span>
											<span>Uses: {template.template_campaign?.length || 0}</span>
										</div>
									</div>
									<div class="ml-4 flex items-center space-x-2">
										<a href="/" class="inline-flex">
											<Button variant="secondary" size="sm">
												<Edit3 class="mr-1 h-4 w-4" />
												Manage
											</Button>
										</a>
										<a href="/{template.slug}" target="_blank" class="inline-flex">
											<Button variant="secondary" size="sm">
												<ExternalLink class="mr-1 h-4 w-4" />
												View
											</Button>
										</a>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-12 text-center">
						<FileText class="mx-auto mb-4 h-12 w-12 text-slate-400" />
						<h3 class="mb-2 text-lg font-semibold text-slate-900">No templates yet</h3>
						<p class="mb-4 text-slate-600">
							Create your first template to start building advocacy campaigns.
						</p>
						<a href="/?create=true">
							<Button variant="primary">
								<FileText class="mr-2 h-4 w-4" />
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
				<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-900">Privacy Settings</h3>
					<div class="space-y-4">
						<div>
							<label for="profile-visibility" class="mb-2 block text-sm font-medium text-slate-700"
								>Profile Visibility</label
							>
							<select
								id="profile-visibility"
								class="block w-full rounded-md border-slate-300 shadow-sm focus:border-participation-primary-500 focus:ring-participation-primary-500 sm:text-sm"
							>
								<option value="private" selected={userDetails?.profile?.visibility === 'private'}
									>Private</option
								>
								<option value="limited" selected={userDetails?.profile?.visibility === 'limited'}
									>Limited</option
								>
								<option value="public" selected={userDetails?.profile?.visibility === 'public'}
									>Public</option
								>
							</select>
							<p class="mt-1 text-xs text-slate-500">
								Control who can see your profile information
							</p>
						</div>
					</div>
				</div>

				<!-- Account Management -->
				<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-900">Account Management</h3>
					<div class="space-y-4">
						<Button variant="secondary" classNames="w-full justify-start">Export My Data</Button>
						<Button variant="secondary" classNames="w-full justify-start">Download Profile</Button>
						<Button variant="danger" classNames="w-full justify-start">Delete Account</Button>
					</div>
				</div>
			</div>
		{/await}
	{/if}
</div>

<!-- Edit Profile Modal -->
{#if showEditModal}
	<ProfileEditModal
		{user}
		section={editingSection}
		onclose={() => (showEditModal = false)}
		onsave={handleProfileSave}
	/>
{/if}
