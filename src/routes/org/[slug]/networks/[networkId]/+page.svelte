<script lang="ts">
	import CoalitionReport from '$lib/components/networks/CoalitionReport.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let inviteSlug = $state('');
	let inviting = $state(false);
	let removing = $state<string | null>(null);
	let errorMsg = $state('');

	let reportStats = $state<{
		orgCount: number;
		totalVerifiedActions: number;
		uniqueDistricts: number;
		verifiedSupporters: number;
		tierDistribution: { tier: number; count: number }[];
		stateDistribution: { state: string; count: number }[];
	} | null>(null);
	let reportLoading = $state(false);

	const statusColors: Record<string, string> = {
		active: 'bg-emerald-900/50 text-emerald-400',
		suspended: 'bg-red-900/50 text-red-400'
	};

	const roleColors: Record<string, string> = {
		admin: 'bg-teal-900/50 text-teal-400',
		member: 'bg-zinc-700 text-zinc-300'
	};

	const activeMembers = $derived(data.members.filter((m) => m.status === 'active'));
	const pendingMembers = $derived(data.members.filter((m) => m.status === 'pending'));

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(iso));
	}

	async function inviteOrg() {
		const trimmed = inviteSlug.trim();
		if (!trimmed) return;

		inviting = true;
		errorMsg = '';

		try {
			const res = await fetch(`/api/org/${data.org.slug}/networks/${data.network.id}/invite`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgSlug: trimmed })
			});

			if (res.ok) {
				inviteSlug = '';
				window.location.reload();
			} else {
				const body = await res.json().catch(() => null);
				errorMsg = body?.error ?? `Failed to invite (${res.status})`;
			}
		} catch {
			errorMsg = 'Network error';
		} finally {
			inviting = false;
		}
	}

	async function removeMember(memberId: string) {
		removing = memberId;
		errorMsg = '';

		try {
			const res = await fetch(`/api/org/${data.org.slug}/networks/${data.network.id}/members/${memberId}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				window.location.reload();
			} else {
				const body = await res.json().catch(() => null);
				errorMsg = body?.error ?? `Failed to remove (${res.status})`;
			}
		} catch {
			errorMsg = 'Network error';
		} finally {
			removing = null;
		}
	}

	async function generateReport() {
		reportLoading = true;
		errorMsg = '';

		try {
			const res = await fetch(`/api/org/${data.org.slug}/networks/${data.network.id}/report`);

			if (res.ok) {
				reportStats = await res.json();
			} else {
				const body = await res.json().catch(() => null);
				errorMsg = body?.error ?? `Failed to generate report (${res.status})`;
			}
		} catch {
			errorMsg = 'Network error';
		} finally {
			reportLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{data.network.name} | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Back link -->
		<a href="/org/{data.org.slug}/networks" class="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-200">
			&larr; All Networks
		</a>

		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="mb-1 flex items-center gap-3">
					<h1 class="text-2xl font-bold text-zinc-100">{data.network.name}</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[data.network.status] ?? 'bg-zinc-700 text-zinc-300'}">
						{data.network.status}
					</span>
				</div>
				{#if data.network.description}
					<p class="text-sm text-zinc-400">{data.network.description}</p>
				{/if}
				<p class="mt-1 text-xs text-zinc-500">
					Owned by {data.network.ownerOrg.name}
				</p>
			</div>
		</div>

		<!-- Error -->
		{#if errorMsg}
			<div class="mb-6 rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-400">
				{errorMsg}
			</div>
		{/if}

		<!-- Stats Cards -->
		<div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Member Orgs</p>
				<p class="mt-1 text-2xl font-bold text-zinc-100">{data.stats.memberCount}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Total Supporters</p>
				<p class="mt-1 text-2xl font-bold text-zinc-100">{data.stats.totalSupporters.toLocaleString()}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Unique Supporters</p>
				<p class="mt-1 text-2xl font-bold text-teal-400">{data.stats.uniqueSupporters.toLocaleString()}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Verified</p>
				<p class="mt-1 text-2xl font-bold text-green-400">{data.stats.verifiedSupporters.toLocaleString()}</p>
			</div>
		</div>

		<!-- Member Organizations Table -->
		<div class="mb-6">
			<h3 class="mb-3 text-sm font-medium text-zinc-400">Member Organizations ({activeMembers.length})</h3>
			{#if activeMembers.length === 0}
				<p class="py-8 text-center text-sm text-zinc-500">No active members</p>
			{:else}
				<div class="overflow-x-auto rounded-lg border border-zinc-800/60">
					<table class="w-full text-left text-sm">
						<thead>
							<tr class="border-b border-zinc-800/60 text-xs text-zinc-500">
								<th class="px-4 py-3 font-medium">Organization</th>
								<th class="px-4 py-3 font-medium">Role</th>
								<th class="px-4 py-3 font-medium">Supporters</th>
								<th class="px-4 py-3 font-medium">Joined</th>
								{#if data.isAdmin}
									<th class="px-4 py-3 font-medium"></th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each activeMembers as member (member.id)}
								<tr class="border-b border-zinc-800/40 last:border-0">
									<td class="px-4 py-3 text-zinc-200">{member.orgName}</td>
									<td class="px-4 py-3">
										<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {roleColors[member.role] ?? 'bg-zinc-700 text-zinc-300'}">
											{member.role}
										</span>
									</td>
									<td class="px-4 py-3 text-zinc-300">{member.supporterCount.toLocaleString()}</td>
									<td class="px-4 py-3 text-zinc-500">{formatDate(member.joinedAt)}</td>
									{#if data.isAdmin}
										<td class="px-4 py-3 text-right">
											{#if !member.isOwnerOrg}
												<button
													onclick={() => removeMember(member.id)}
													disabled={removing === member.id}
													class="text-xs text-red-500 hover:text-red-400 disabled:opacity-50"
												>
													{removing === member.id ? 'Removing...' : 'Remove'}
												</button>
											{/if}
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Pending Invitations (admin only) -->
		{#if data.isAdmin && pendingMembers.length > 0}
			<div class="mb-6">
				<h3 class="mb-3 text-sm font-medium text-zinc-400">Pending Invitations ({pendingMembers.length})</h3>
				<div class="overflow-x-auto rounded-lg border border-zinc-800/60">
					<table class="w-full text-left text-sm">
						<thead>
							<tr class="border-b border-zinc-800/60 text-xs text-zinc-500">
								<th class="px-4 py-3 font-medium">Organization</th>
								<th class="px-4 py-3 font-medium">Status</th>
								<th class="px-4 py-3 font-medium">Invited</th>
							</tr>
						</thead>
						<tbody>
							{#each pendingMembers as member (member.id)}
								<tr class="border-b border-zinc-800/40 last:border-0">
									<td class="px-4 py-3 text-zinc-200">{member.orgName}</td>
									<td class="px-4 py-3">
										<span class="inline-flex rounded-full bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-400">
											pending
										</span>
									</td>
									<td class="px-4 py-3 text-zinc-500">{formatDate(member.joinedAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Invite Organization (admin only) -->
		{#if data.isAdmin}
			<div class="mb-6 rounded-lg border border-zinc-800/60 p-4">
				<h3 class="mb-3 text-sm font-medium text-zinc-400">Invite Organization</h3>
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={inviteSlug}
						placeholder="Organization slug"
						class="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
					/>
					<button
						onclick={inviteOrg}
						disabled={inviting || !inviteSlug.trim()}
						class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
					>
						{inviting ? 'Inviting...' : 'Invite'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Coalition Report -->
		<div class="rounded-lg border border-zinc-800/60 p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-medium text-zinc-400">Coalition Report</h3>
				<button
					onclick={generateReport}
					disabled={reportLoading}
					class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
				>
					{reportLoading ? 'Generating...' : 'Generate Report'}
				</button>
			</div>
			<CoalitionReport stats={reportStats} loading={reportLoading} />
		</div>
	</div>
</div>
