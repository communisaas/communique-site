<script lang="ts">
	/**
	 * Appeal/governance action banner.
	 *
	 * Shown when the debate is under appeal or awaiting governance.
	 * Provides clear affordances for the available actions without
	 * overwhelming the resolution view.
	 *
	 * Perceptual design: This is a boundary zone — between the resolution
	 * panel above and the potential future action below. It uses a warm
	 * amber tone (echoing the deliberation atmosphere) to signal that
	 * the process isn't complete yet, maintaining productive tension.
	 */
	import Button from '$lib/components/ui/Button.svelte';
	import { ShieldAlert, Gavel, Clock } from '@lucide/svelte';

	interface Props {
		status: 'under_appeal' | 'awaiting_governance';
		appealDeadline?: string;
		hasAppeal: boolean;
		appealBondAmount?: string; // formatted, e.g. "$2.00"
		onAppeal?: () => void;
		onEscalate?: () => void;
	}

	let { status, appealDeadline, hasAppeal, appealBondAmount, onAppeal, onEscalate }: Props = $props();

	let confirmingAppeal = $state(false);

	const appealTimeRemaining = $derived.by(() => {
		if (!appealDeadline) return null;
		const now = Date.now();
		const end = new Date(appealDeadline).getTime();
		const diff = end - now;
		if (diff <= 0) return null;
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		if (days > 0) return `${days}d ${hours}h`;
		return `${hours}h`;
	});
</script>

<div class="px-5 py-4">
	{#if status === 'under_appeal'}
		<div class="flex items-start gap-3">
			<div class="shrink-0 mt-0.5">
				<ShieldAlert class="h-5 w-5 text-amber-600" />
			</div>
			<div class="flex-1">
				{#if hasAppeal}
					<p class="text-sm font-medium text-amber-800">
						This resolution has been appealed.
					</p>
					<p class="text-xs text-amber-700 mt-0.5">
						The appeal will be reviewed after the appeal window closes.
					</p>
				{:else}
					<p class="text-sm font-medium text-slate-800">
						Appeal window open
					</p>
					<p class="text-xs text-slate-600 mt-0.5">
						Stake 2x the proposer bond to contest this resolution.
						{#if appealBondAmount}
							<span class="font-semibold text-slate-700">{appealBondAmount}</span> required.
						{/if}
						{#if appealTimeRemaining}
							<span class="inline-flex items-center gap-1 font-medium text-amber-700">
								<Clock size={10} />
								{appealTimeRemaining} remaining
							</span>
						{/if}
					</p>
					{#if onAppeal}
						<div class="mt-3">
							{#if confirmingAppeal}
								<p class="text-xs text-amber-800 font-medium mb-2">
									This will stake {appealBondAmount ?? '2x bond'} and initiate a governance review. Continue?
								</p>
								<div class="flex gap-2">
									<Button variant="secondary" size="sm" onclick={() => { confirmingAppeal = false; onAppeal?.(); }}>
										Confirm appeal
									</Button>
									<Button variant="secondary" size="sm" onclick={() => (confirmingAppeal = false)}>
										Cancel
									</Button>
								</div>
							{:else}
								<Button variant="secondary" size="sm" onclick={() => (confirmingAppeal = true)}>
									File appeal
								</Button>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{:else}
		<!-- Awaiting governance -->
		<div class="flex items-start gap-3">
			<div class="shrink-0 mt-0.5">
				<Gavel class="h-5 w-5 text-amber-600" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium text-slate-800">
					Awaiting governance resolution
				</p>
				<p class="text-xs text-slate-600 mt-0.5">
					AI model consensus was insufficient. Governance will determine the outcome.
				</p>
				{#if onEscalate}
					<div class="mt-3">
						<Button variant="secondary" size="sm" onclick={onEscalate}>
							View governance dashboard
						</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
