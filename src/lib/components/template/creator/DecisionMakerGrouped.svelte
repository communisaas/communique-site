<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Building2, Mail, ExternalLink, Copy, Check, ChevronDown, X } from '@lucide/svelte';
	import type { ProcessedDecisionMaker } from '$lib/types/template';

	interface Props {
		decisionMakers: ProcessedDecisionMaker[];
		onremove?: (index: number) => void;
	}

	let { decisionMakers, onremove }: Props = $props();

	// Group decision-makers by organization
	const groupedByOrg = $derived(() => {
		const groups = new Map<string, { org: string; members: Array<ProcessedDecisionMaker & { originalIndex: number }> }>();

		decisionMakers.forEach((dm, index) => {
			const orgKey = dm.organization.toLowerCase().trim();
			if (!groups.has(orgKey)) {
				groups.set(orgKey, { org: dm.organization, members: [] });
			}
			groups.get(orgKey)!.members.push({ ...dm, originalIndex: index });
		});

		// Sort by member count (largest orgs first = most relevant power centers)
		return Array.from(groups.values()).sort((a, b) => b.members.length - a.members.length);
	});

	// Track which orgs are expanded (all expanded by default)
	let expandedOrgs = $state<Set<string>>(new Set());

	// Initialize all as expanded
	$effect(() => {
		const allOrgs = new Set(groupedByOrg().map(g => g.org));
		expandedOrgs = allOrgs;
	});

	// Track copy state per email
	let copiedEmail = $state<string | null>(null);
	let copyTimeout: number | null = null;

	async function copyEmail(email: string) {
		await navigator.clipboard.writeText(email);
		copiedEmail = email;

		// Clear existing timeout
		if (copyTimeout !== null) {
			clearTimeout(copyTimeout);
		}

		copyTimeout = setTimeout(() => {
			if (copiedEmail === email) copiedEmail = null;
			copyTimeout = null;
		}, 2000);
	}

	onDestroy(() => {
		if (copyTimeout !== null) {
			clearTimeout(copyTimeout);
		}
	});

	function toggleOrg(org: string) {
		const newSet = new Set(expandedOrgs);
		if (newSet.has(org)) {
			newSet.delete(org);
		} else {
			newSet.add(org);
		}
		expandedOrgs = newSet;
	}
</script>

<div class="space-y-3">
	{#each groupedByOrg() as group (group.org)}
		<div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
			<!-- Organization Header -->
			<button
				type="button"
				onclick={() => toggleOrg(group.org)}
				class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
			>
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
					<Building2 class="h-5 w-5 text-slate-600" />
				</div>
				<div class="flex-1 min-w-0">
					<h4 class="font-semibold text-slate-900 truncate">{group.org}</h4>
					<p class="text-sm text-slate-500">
						{group.members.length} decision-maker{group.members.length === 1 ? '' : 's'}
					</p>
				</div>
				<span
					class="transition-transform duration-200"
					class:rotate-180={expandedOrgs.has(group.org)}
				>
					<ChevronDown class="h-5 w-5 text-slate-400" />
				</span>
			</button>

			<!-- Members List -->
			{#if expandedOrgs.has(group.org)}
				<div class="border-t border-slate-100">
					{#each group.members as member, i (member.originalIndex)}
						<div
							class="group relative px-4 py-3 transition-colors hover:bg-slate-50"
							class:border-t={i > 0}
							class:border-slate-100={i > 0}
						>
							<!-- Person Row -->
							<div class="flex items-start gap-3">
								<!-- Indicator dot -->
								<div class="mt-1.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-100"></div>

								<!-- Person Info -->
								<div class="flex-1 min-w-0">
									<div class="flex items-baseline gap-2">
										<span class="font-medium text-slate-900">{member.name}</span>
										<span class="text-sm text-slate-500">{member.title}</span>
									</div>

									<!-- Why this person matters -->
									<p class="mt-1 text-sm text-slate-600">{member.reasoning}</p>

									<!-- Contact & Source Row -->
									<div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
										{#if member.email}
											<button
												type="button"
												onclick={() => copyEmail(member.email!)}
												class="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors"
											>
												{#if copiedEmail === member.email}
													<Check class="h-3.5 w-3.5 text-green-600" />
													<span class="text-green-600">Copied</span>
												{:else}
													<Mail class="h-3.5 w-3.5" />
													<span class="font-mono text-xs">{member.email}</span>
													<Copy class="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
												{/if}
											</button>
										{/if}

										{#if member.source}
											<a
												href={member.source}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-participation-primary-600 hover:text-participation-primary-700 transition-colors"
											>
												<ExternalLink class="h-3.5 w-3.5" />
												<span>Source</span>
											</a>
										{/if}
									</div>
								</div>

								<!-- Remove Button -->
								{#if onremove}
									<button
										type="button"
										onclick={() => onremove?.(member.originalIndex)}
										class="p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all"
										title="Remove"
									>
										<X class="h-4 w-4" />
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
