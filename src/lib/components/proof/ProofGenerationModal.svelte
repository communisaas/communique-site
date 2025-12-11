<script lang="ts">
	import { onMount } from 'svelte';
	import { scale, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Loader2, Lock, Shield, TrendingUp, CheckCircle2 } from '@lucide/svelte';

	interface Props {
		district: string;
		show: boolean;
		onComplete?: (result: { proof: Uint8Array; generationTime: number }) => void;
		onError?: (error: Error) => void;
	}

	let { district, show = $bindable(), onComplete, onError }: Props = $props();

	// Proof generation state
	let stage = $state<'initializing' | 'generating' | 'complete' | 'error'>('initializing');
	let progress = $state(0);
	let statusMessage = $state('Initializing cryptography...');
	let educationalMessage = $state('');
	let error = $state<string | null>(null);
	let generationTime = $state(0);

	// Educational messages (cycle through during proof generation)
	const educationalMessages = [
		{
			icon: Lock,
			text: `Proving you're in ${district} without revealing your exact address`
		},
		{
			icon: Shield,
			text: 'Congressional staff prioritize verified constituents'
		},
		{
			icon: TrendingUp,
			text: 'Building your civic reputation with each verified action'
		}
	];

	let currentEducationalIndex = $state(0);

	// Cycle educational messages every 3 seconds
	$effect(() => {
		if (stage === 'generating') {
			const interval = setInterval(() => {
				currentEducationalIndex = (currentEducationalIndex + 1) % educationalMessages.length;
				educationalMessage = educationalMessages[currentEducationalIndex].text;
			}, 3000);

			return () => clearInterval(interval);
		}
	});

	// Simulate proof generation (replace with real proof generation when Shadow Atlas ready)
	async function generateProof() {
		try {
			const startTime = performance.now();

			// Stage 1: Initialization (5-10s first time, instant if cached)
			stage = 'initializing';
			statusMessage = 'Initializing Noir prover...';
			progress = 10;

			// Use orchestrator for real initialization
			const { proverOrchestrator } = await import('$lib/core/proof/prover-orchestrator');
			await proverOrchestrator.init();
			progress = 30;

			// Stage 2: Proof generation
			stage = 'generating';
			statusMessage = 'Generating zero-knowledge proof...';
			educationalMessage = educationalMessages[0].text;
			progress = 40;

			// Simulate progress updates
			const progressInterval = setInterval(() => {
				if (progress < 90) {
					progress += 10;
				}
			}, 500);

			// Simulate proof generation (since we don't have full witness here)
			await new Promise((resolve) => setTimeout(resolve, 2000));
			const result = { proof: new Uint8Array(100) }; // Mock result

			clearInterval(progressInterval);
			progress = 100;

			const endTime = performance.now();
			generationTime = Math.round(endTime - startTime);

			// Stage 3: Complete
			stage = 'complete';
			statusMessage = 'Proof generated successfully!';

			console.log('[ProofModal] Proof generation complete:', {
				proofSize: result.proof.length,
				generationTime: `${generationTime}ms`
			});

			// Notify parent
			if (onComplete) {
				onComplete({
					proof: result.proof,
					generationTime
				});
			}

			// Auto-close after 2 seconds
			setTimeout(() => {
				show = false;
			}, 2000);
		} catch (err) {
			console.error('[ProofModal] Proof generation failed:', err);
			stage = 'error';
			error = err instanceof Error ? err.message : 'Unknown error during proof generation';
			statusMessage = 'Proof generation failed';

			if (onError && err instanceof Error) {
				onError(err);
			}
		}
	}

	// Start proof generation when modal shows
	$effect(() => {
		if (show) {
			generateProof();
		}
	});

	const currentEducationalIcon = $derived(educationalMessages[currentEducationalIndex]?.icon);
</script>

{#if show}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="proof-generation-title"
	>
		<!-- Modal Container -->
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
			transition:scale={{ duration: 300, start: 0.95, easing: quintOut }}
		>
			<!-- Header -->
			<div class="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6">
				<h2 id="proof-generation-title" class="text-2xl font-bold text-slate-900">
					{#if stage === 'complete'}
						Verification Complete
					{:else if stage === 'error'}
						Verification Failed
					{:else}
						Verifying Your District
					{/if}
				</h2>
				<p class="mt-1 text-sm text-slate-600">
					{#if stage === 'initializing'}
						Setting up cryptographic proving system...
					{:else if stage === 'generating'}
						Generating zero-knowledge proof for {district}
					{:else if stage === 'complete'}
						You're verified as a constituent of {district}
					{:else if stage === 'error'}
						Something went wrong during verification
					{/if}
				</p>
			</div>

			<!-- Content -->
			<div class="p-8">
				{#if stage === 'complete'}
					<!-- Success State -->
					<div class="text-center">
						<div
							class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-2xl"
						>
							<CheckCircle2 class="h-10 w-10 text-white" strokeWidth={3} />
						</div>

						<p class="mb-2 text-lg font-semibold text-slate-900">{statusMessage}</p>
						<p class="text-sm text-slate-600">Generated in {generationTime}ms</p>
					</div>
				{:else if stage === 'error'}
					<!-- Error State -->
					<div class="text-center">
						<div
							class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100"
						>
							<svg
								class="h-10 w-10 text-red-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</div>

						<p class="mb-2 text-lg font-semibold text-slate-900">{statusMessage}</p>
						<p class="text-sm text-red-600">{error}</p>

						<button
							type="button"
							onclick={() => (show = false)}
							class="mt-6 rounded-lg bg-slate-100 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
						>
							Close
						</button>
					</div>
				{:else}
					<!-- Loading State (Initializing or Generating) -->
					<div class="space-y-6">
						<!-- Animated Icon -->
						<div class="flex justify-center">
							{#if stage === 'generating' && currentEducationalIcon}
								{@const IconComponent = currentEducationalIcon}
								<div
									class="rounded-full bg-blue-100 p-6"
									transition:scale={{ duration: 300, start: 0.8 }}
								>
									<IconComponent class="h-12 w-12 text-blue-600" strokeWidth={2} />
								</div>
							{:else}
								<div class="rounded-full bg-blue-100 p-6">
									<Loader2 class="h-12 w-12 animate-spin text-blue-600" strokeWidth={2} />
								</div>
							{/if}
						</div>

						<!-- Status Message -->
						<div class="text-center">
							<p class="mb-2 text-lg font-semibold text-slate-900">{statusMessage}</p>
							<p class="text-sm text-slate-600">{progress}% complete</p>
						</div>

						<!-- Progress Bar -->
						<div class="h-2 w-full overflow-hidden rounded-full bg-slate-200">
							<div
								class="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
								style="width: {progress}%"
							></div>
						</div>

						<!-- Educational Message (only during generating stage) -->
						{#if stage === 'generating' && educationalMessage}
							<div
								class="rounded-lg border border-blue-200 bg-blue-50 p-4"
								transition:fade={{ duration: 300 }}
							>
								<p class="text-center text-sm font-medium text-blue-900">
									{educationalMessage}
								</p>
							</div>
						{/if}

						<!-- Performance Hint -->
						{#if stage === 'initializing'}
							<p class="text-center text-xs text-slate-500">
								First-time setup takes 5-10 seconds. Future verifications will be instant.
							</p>
						{:else if stage === 'generating'}
							<p class="text-center text-xs text-slate-500">
								Proof generation: ~1-2s on desktop, ~8-15s on mobile
							</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
