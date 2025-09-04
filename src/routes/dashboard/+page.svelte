<script lang="ts">
	import { page } from '$app/stores';
	import { Mail, User, MapPin, Settings, LogOut } from '@lucide/svelte';

	const user = $derived($page.data.user);

	async function handleLogout() {
		await fetch('/auth/logout', { method: 'POST' });
		window.location.href = '/';
	}
</script>

<svelte:head>
	<title>Dashboard - Communique</title>
</svelte:head>

{#if user}
	<div class="min-h-screen bg-gray-50">
		<div class="bg-white shadow">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between py-6">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<Mail class="h-8 w-8 text-blue-600" />
						</div>
						<div class="ml-4">
							<h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
						</div>
					</div>
					<div class="flex items-center space-x-4">
						<div class="flex items-center space-x-3">
							{#if user.avatar}
								<img src={user.avatar} alt={user.name} class="h-8 w-8 rounded-full" />
							{:else}
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
									<User class="h-4 w-4 text-white" />
								</div>
							{/if}
							<span class="text-sm font-medium text-gray-700">{user.name}</span>
						</div>
						<button
							onclick={handleLogout}
							class="inline-flex items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium leading-4 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							<LogOut class="mr-2 h-4 w-4" />
							Sign out
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
			<div class="px-4 py-6 sm:px-0">
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					<!-- Account Status -->
					<div class="overflow-hidden rounded-lg bg-white shadow">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<User class="h-6 w-6 text-gray-400" />
								</div>
								<div class="ml-5 w-0 flex-1">
									<dl>
										<dt class="truncate text-sm font-medium text-gray-500">Account Status</dt>
										<dd class="text-lg font-medium text-gray-900">
											{#if user.street && user.city && user.state && user.zip}
												<span class="text-green-600">Complete</span>
											{:else}
												<span class="text-yellow-600">Needs Address</span>
											{/if}
										</dd>
									</dl>
								</div>
							</div>
						</div>
					</div>

					<!-- Address Info -->
					<div class="overflow-hidden rounded-lg bg-white shadow">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<MapPin class="h-6 w-6 text-gray-400" />
								</div>
								<div class="ml-5 w-0 flex-1">
									<dl>
										<dt class="truncate text-sm font-medium text-gray-500">Address</dt>
										<dd class="text-sm text-gray-900">
											{#if user.street && user.city && user.state}
												{user.street}<br />
												{user.city}, {user.state}
												{user.zip}
											{:else}
												<span class="text-gray-500">Not provided</span>
											{/if}
										</dd>
									</dl>
								</div>
							</div>
						</div>
					</div>

					<!-- Congressional District -->
					<div class="overflow-hidden rounded-lg bg-white shadow">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<Settings class="h-6 w-6 text-gray-400" />
								</div>
								<div class="ml-5 w-0 flex-1">
									<dl>
										<dt class="truncate text-sm font-medium text-gray-500">
											Congressional District
										</dt>
										<dd class="text-lg font-medium text-gray-900">
											{user.congressional_district || 'Not determined'}
										</dd>
									</dl>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Next Steps -->
				<div class="mt-8">
					<div class="rounded-lg border border-blue-200 bg-blue-50 p-6">
						<h3 class="mb-4 text-lg font-medium text-blue-900">Next Steps</h3>
						<div class="space-y-3">
							{#if !user.street || !user.city || !user.state || !user.zip}
								<div class="flex items-center">
									<div class="flex-shrink-0">
										<div class="h-2 w-2 rounded-full bg-yellow-400"></div>
									</div>
									<div class="ml-3">
										<p class="text-sm text-blue-800">
											<a href="/profile/address" class="font-medium underline">
												Add your address
											</a>
											to enable congressional message routing
										</p>
									</div>
								</div>
							{/if}
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<div class="h-2 w-2 rounded-full bg-green-400"></div>
								</div>
								<div class="ml-3">
									<p class="text-sm text-blue-800">
										<a href="/dashboard/templates" class="font-medium underline">
											Browse templates
										</a>
										to find causes you care about
									</p>
								</div>
							</div>
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<div class="h-2 w-2 rounded-full bg-blue-400"></div>
								</div>
								<div class="ml-3">
									<p class="text-sm text-blue-800">
										<a href="/" class="font-medium underline"> Create your own template </a>
										to rally support for your cause
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center bg-gray-50">
		<div class="text-center">
			<h2 class="mb-4 text-2xl font-bold text-gray-900">Access Denied</h2>
			<p class="mb-6 text-gray-600">You need to be signed in to access this page.</p>
			<a
				href="/"
				class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
			>
				Go Home
			</a>
		</div>
	</div>
{/if}
