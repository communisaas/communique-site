<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Send, CheckCircle2, AlertCircle, Users, Sparkles, Trophy, Flame } from '@lucide/svelte';
	import { spring } from 'svelte/motion';

	let {
		submissionId,
		template,
		onComplete
	}: {
		submissionId: string;
		template: any;
		onComplete?: () => void;
	} = $props();

	// Enhanced progress state
	let progress = $state({
		stage: 'identifying', // identifying, generating, senate, house, completed
		senateProgress: 0, // 0-200 (2 senators)
		houseProgress: 0, // 0-100 (1 representative)
		overallProgress: 0, // 0-100
		senateOffices: [] as Array<{name: string, state: string, status: 'pending' | 'submitting' | 'success' | 'failed'}>,
		houseOffice: null as {name: string, district: string, status: 'pending' | 'submitting' | 'success' | 'failed'} | null,
		errors: [] as string[],
		startTime: Date.now()
	});

	// Animation states
	let celebrationPulse = spring(1, { stiffness: 0.3, damping: 0.6 });
	let milestoneGlow = $state(false);
	let showMilestoneMessage = $state(false);
	let milestoneMessage = $state('');

	let pollInterval: ReturnType<typeof setInterval> | null = null;

	// Milestone messages for micro-rewards
	const milestoneMessages = {
		firstSenator: "🎯 First senator contacted!",
		secondSenator: "⚖️ Both senators reached!",
		houseRep: "🏛️ Your representative contacted!",
		allComplete: "🎉 All voices heard!"
	};

	onMount(() => {
		startPolling();
		// Initial celebration pulse
		celebrationPulse.set(1.05).then(() => celebrationPulse.set(1));
	});

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	function startPolling() {
		if (pollInterval) return;

		pollInterval = setInterval(async () => {
			try {
				const response = await fetch(`/api/cwc/jobs/${submissionId}`);
				const data = await response.json();

				if (data.results && Array.isArray(data.results)) {
					updateProgress(data);
				}

				// Check if complete
				if (data.status === 'completed' || data.status === 'partially_completed') {
					progress.stage = 'completed';
					progress.overallProgress = 100;
					
					// Final celebration
					triggerMilestone(milestoneMessages.allComplete);
					
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}

					// Call completion callback
					if (onComplete) {
						setTimeout(onComplete, 1500); // Delay for final animation
					}
				}
			} catch (error) {
				console.error('[CWC Progress] Polling error:', error);
			}
		}, 1500); // Poll every 1.5 seconds for smoother updates
	}

	function updateProgress(data: any) {
		const results = data.results;
		const totalOffices = results.length;
		
		// Categorize by chamber
		const senateResults = results.filter((r: any) => r.chamber === 'senate');
		const houseResults = results.filter((r: any) => r.chamber === 'house');

		// Update Senate progress
		if (senateResults.length > 0) {
			progress.senateOffices = senateResults.map((r: any) => ({
				name: r.office,
				state: r.state || 'Unknown',
				status: r.success ? 'success' : 'failed'
			}));
			
			const senateSuccessCount = senateResults.filter((r: any) => r.success).length;
			progress.senateProgress = (senateSuccessCount / Math.max(senateResults.length, 1)) * 100;
			
			// Milestone: First senator
			if (senateSuccessCount === 1 && progress.senateOffices[0]?.status === 'success') {
				triggerMilestone(milestoneMessages.firstSenator);
			}
			// Milestone: Both senators
			if (senateSuccessCount === 2 && senateResults.length === 2) {
				triggerMilestone(milestoneMessages.secondSenator);
			}
		}

		// Update House progress
		if (houseResults.length > 0) {
			const houseResult = houseResults[0];
			progress.houseOffice = {
				name: houseResult.office,
				district: houseResult.district || 'Unknown',
				status: houseResult.success ? 'success' : 'failed'
			};
			
			progress.houseProgress = houseResult.success ? 100 : 0;
			
			// Milestone: House representative
			if (houseResult.success) {
				triggerMilestone(milestoneMessages.houseRep);
			}
		}

		// Update overall progress
		const totalSuccessCount = results.filter((r: any) => r.success).length;
		progress.overallProgress = (totalSuccessCount / Math.max(totalOffices, 1)) * 100;

		// Update stage based on progress
		if (progress.overallProgress === 0 && progress.stage === 'identifying') {
			progress.stage = 'generating';
		} else if (progress.senateProgress > 0 && progress.stage === 'generating') {
			progress.stage = 'senate';
		} else if (progress.houseProgress > 0 && progress.stage === 'senate') {
			progress.stage = 'house';
		}

		// Track errors
		const failedResults = results.filter((r: any) => !r.success && r.error);
		progress.errors = failedResults.map((r: any) => r.error);
	}

	function triggerMilestone(message: string) {
		milestoneMessage = message;
		showMilestoneMessage = true;
		milestoneGlow = true;
		
		celebrationPulse.set(1.1).then(() => celebrationPulse.set(1));
		
		setTimeout(() => {
			showMilestoneMessage = false;
			milestoneGlow = false;
		}, 2500);
	}

	function getProgressColor(progress: number, hasError: boolean = false) {
		if (hasError) return 'bg-red-500';
		if (progress === 100) return 'bg-green-500';
		if (progress > 50) return 'bg-blue-500';
		return 'bg-blue-400';
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'success': return CheckCircle2;
			case 'failed': return AlertCircle;
			case 'submitting': return Send;
			default: return Send;
		}
	}

	// Calculate elapsed time
	let elapsedTime = $derived(() => {
		const elapsed = Date.now() - progress.startTime;
		const seconds = Math.floor(elapsed / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		return `${minutes}m ${seconds % 60}s`;
	});
</script>

<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
	<!-- Header with Impact Counter -->
	<div class="mb-6 text-center">
		<div class="mb-4">
			<div class="text-2xl font-bold text-slate-900">
				You + {(template.metrics?.sent ?? 0).toLocaleString()} others
			</div>
			<p class="text-sm text-slate-600">Real voices creating real change</p>
		</div>
		
		<!-- Overall Progress Bar -->
		<div class="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
			<div 
				class="h-full rounded-full transition-all duration-500 {getProgressColor(progress.overallProgress, progress.errors.length > 0)}"
				style="width: {progress.overallProgress}%"
			></div>
		</div>
		<p class="text-xs text-slate-500">{Math.round(progress.overallProgress)}% complete • {elapsedTime()}</p>
	</div>

	<!-- Milestone Messages -->
	{#if showMilestoneMessage}
		<div 
			class="mb-4 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 p-3 text-center transition-all"
			class:animate-pulse={milestoneGlow}
		>
			<div class="flex items-center justify-center gap-2">
				<Sparkles class="h-4 w-4 text-blue-600" />
				<span class="text-sm font-medium text-slate-900">{milestoneMessage}</span>
				<Sparkles class="h-4 w-4 text-blue-600" />
			</div>
		</div>
	{/if}

	<!-- Senate Progress -->
	<div class="mb-4">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Users class="h-4 w-4 text-slate-600" />
				<span class="font-medium text-slate-900">Senate</span>
				<span class="text-xs text-slate-500">{progress.senateOffices.length}/2 contacted</span>
			</div>
			<div class="text-xs text-slate-500">{Math.round(progress.senateProgress)}%</div>
		</div>
		
		<div class="space-y-2">
			{#each progress.senateOffices as office}
				{@const IconComponent = getStatusIcon(office.status)}
				<div class="flex items-center gap-3 rounded-lg border border-slate-100 p-2">
					<IconComponent
						class="h-4 w-4 {office.status === 'success' ? 'text-green-600' : 'text-slate-400'}"
					/>
					<div class="flex-1">
						<p class="text-sm font-medium text-slate-900">{office.name}</p>
						<p class="text-xs text-slate-600">{office.state}</p>
					</div>
					{#if office.status === 'success'}
						<span class="text-xs text-green-600">✓ Delivered</span>
					{/if}
				</div>
			{/each}
			
			{#if progress.senateOffices.length === 0}
				<div class="flex items-center gap-3 rounded-lg border border-slate-100 p-2 opacity-50">
					<Send class="h-4 w-4 text-slate-400 animate-pulse" />
					<div class="flex-1">
						<p class="text-sm text-slate-600">Finding your senators...</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- House Progress -->
	<div class="mb-4">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Trophy class="h-4 w-4 text-slate-600" />
				<span class="font-medium text-slate-900">House of Representatives</span>
			</div>
			<div class="text-xs text-slate-500">{Math.round(progress.houseProgress)}%</div>
		</div>
		
		<div class="space-y-2">
			{#if progress.houseOffice}
				{@const IconComponent = getStatusIcon(progress.houseOffice.status)}
				<div class="flex items-center gap-3 rounded-lg border border-slate-100 p-2">
					<IconComponent
						class="h-4 w-4 {progress.houseOffice.status === 'success' ? 'text-green-600' : 'text-slate-400'}"
					/>
					<div class="flex-1">
						<p class="text-sm font-medium text-slate-900">{progress.houseOffice.name}</p>
						<p class="text-xs text-slate-600">District {progress.houseOffice.district}</p>
					</div>
					{#if progress.houseOffice.status === 'success'}
						<span class="text-xs text-green-600">✓ Delivered</span>
					{/if}
				</div>
			{:else}
				<div class="flex items-center gap-3 rounded-lg border border-slate-100 p-2 opacity-50">
					<Send class="h-4 w-4 text-slate-400 animate-pulse" />
					<div class="flex-1">
						<p class="text-sm text-slate-600">Finding your representative...</p>
					</div>
				</div>
			{/if}
		</div>
		
		<!-- Demo Mode Notice -->
		<div class="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
			<div class="flex items-center gap-2">
				<Sparkles class="h-3 w-3 text-amber-600" />
				<p class="text-xs text-amber-800">
					🚀 <strong>Demo Mode:</strong> Currently connecting to Senate only. House integration coming soon!
				</p>
			</div>
		</div>
	</div>

	<!-- Completion Reward -->
	{#if progress.stage === 'completed'}
		<div 
			class="rounded-lg bg-gradient-to-br from-green-50 to-blue-50 p-4 text-center"
			style="transform: scale({$celebrationPulse})"
		>
			<div class="mb-2 flex items-center justify-center gap-2">
				<Flame class="h-5 w-5 text-orange-500" />
				<span class="font-bold text-slate-900">Mission Accomplished!</span>
				<Flame class="h-5 w-5 text-orange-500" />
			</div>
			<p class="text-sm text-slate-700">
				Your voice has been delivered to Congress. 
				{#if progress.errors.length === 0}
					✨ Perfect delivery to all offices!
				{:else}
					🎯 {progress.errors.length === 0 ? 'All' : 'Most'} offices reached successfully.
				{/if}
			</p>
		</div>
	{/if}

	<!-- Errors (if any) -->
	{#if progress.errors.length > 0}
		<div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
			<div class="flex items-start gap-2">
				<AlertCircle class="h-4 w-4 mt-0.5 text-red-600" />
				<div>
					<p class="text-sm font-medium text-red-900">Delivery issues</p>
					{#each progress.errors as error}
						<p class="text-xs text-red-700">• {error}</p>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>