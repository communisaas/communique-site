<script lang="ts">
	import ExecutionTable from '$lib/components/automation/ExecutionTable.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const TRIGGER_LABELS: Record<string, string> = {
		supporter_created: 'New Supporter',
		campaign_action: 'Campaign Action',
		event_rsvp: 'Event RSVP',
		event_checkin: 'Event Check-in',
		donation_completed: 'Donation Completed',
		tag_added: 'Tag Added'
	};

	const STEP_LABELS: Record<string, string> = {
		send_email: 'Send Email',
		add_tag: 'Add Tag',
		remove_tag: 'Remove Tag',
		delay: 'Wait',
		condition: 'Condition'
	};

	let toggling = $state(false);
	let deleting = $state(false);

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(iso));
	}

	function stepSummary(step: { type: string; [key: string]: unknown }): string {
		const label = STEP_LABELS[step.type] ?? step.type;
		if (step.type === 'send_email' && step.subject) return `${label}: "${step.subject}"`;
		if (step.type === 'delay' && step.duration) return `${label}: ${step.duration} ${step.unit ?? 'hours'}`;
		if (step.type === 'condition' && step.field) return `${label}: ${step.field} ${step.operator} ${step.value}`;
		return label;
	}

	async function toggleEnabled() {
		toggling = true;
		try {
			const res = await fetch(`/api/org/${data.org.slug}/workflows/${data.workflow.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !data.workflow.enabled })
			});
			if (res.ok) {
				window.location.reload();
			}
		} catch {
			/* ignore */
		} finally {
			toggling = false;
		}
	}

	async function deleteWorkflow() {
		if (!confirm('Delete this workflow? This cannot be undone.')) return;
		deleting = true;
		try {
			const res = await fetch(`/api/org/${data.org.slug}/workflows/${data.workflow.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				window.location.href = `/org/${data.org.slug}/workflows`;
			}
		} catch {
			/* ignore */
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{data.workflow.name} | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Back link -->
		<a href="/org/{data.org.slug}/workflows" class="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-200">
			&larr; All Workflows
		</a>

		<!-- Header -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="mb-2 flex items-center gap-3">
					<h1 class="text-2xl font-bold text-zinc-100">{data.workflow.name}</h1>
					<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {data.workflow.enabled ? 'bg-green-900/50 text-green-400' : 'bg-zinc-700 text-zinc-300'}">
						{data.workflow.enabled ? 'Enabled' : 'Disabled'}
					</span>
				</div>
				{#if data.workflow.description}
					<p class="text-sm text-zinc-400">{data.workflow.description}</p>
				{/if}
				<p class="mt-1 text-sm text-zinc-500">Created {formatDate(data.workflow.createdAt)}</p>
			</div>

			<!-- Actions -->
			<div class="flex gap-2">
				<button
					onclick={toggleEnabled}
					disabled={toggling}
					class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
				>
					{data.workflow.enabled ? 'Disable' : 'Enable'}
				</button>
				<button
					onclick={deleteWorkflow}
					disabled={deleting}
					class="rounded-lg border border-red-800/60 px-3 py-1.5 text-sm text-red-400 hover:border-red-600 hover:text-red-300 disabled:opacity-50"
				>
					Delete
				</button>
			</div>
		</div>

		<!-- Metrics -->
		<div class="mb-6 grid grid-cols-3 gap-3">
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Trigger</p>
				<p class="mt-1 text-lg font-bold text-zinc-100">{TRIGGER_LABELS[data.workflow.trigger.type] ?? data.workflow.trigger.type}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Steps</p>
				<p class="mt-1 text-lg font-bold text-zinc-100">{data.workflow.steps.length}</p>
			</div>
			<div class="rounded-lg border border-zinc-800/60 p-4">
				<p class="text-xs font-medium text-zinc-500">Executions</p>
				<p class="mt-1 text-lg font-bold text-zinc-100">{data.workflow.totalExecutions}</p>
			</div>
		</div>

		<!-- Steps -->
		<div class="mb-6 rounded-lg border border-zinc-800/60 p-4">
			<h3 class="mb-3 text-sm font-medium text-zinc-400">Steps</h3>
			{#if data.workflow.steps.length === 0}
				<p class="py-4 text-center text-sm text-zinc-500">No steps defined</p>
			{:else}
				<div class="space-y-2">
					{#each data.workflow.steps as step, i (i)}
						<div class="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2">
							<span class="shrink-0 text-xs font-medium text-zinc-500">{i + 1}</span>
							<span class="text-sm text-zinc-200">{stepSummary(step)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Executions -->
		<div>
			<h3 class="mb-3 text-sm font-medium text-zinc-400">Recent Executions ({data.workflow.totalExecutions})</h3>
			<ExecutionTable executions={data.executions} />
		</div>
	</div>
</div>
