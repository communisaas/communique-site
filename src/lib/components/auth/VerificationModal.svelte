<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { 
		X, 
		Shield,
		CheckCircle2,
		Smartphone,
		Monitor,
		QrCode,
		Link as LinkIcon
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';
	import SelfQRcodeWrapper, { SelfAppBuilder } from '@selfxyz/qrcode';
	import { v4 as uuidv4 } from 'uuid';

	let {
		user
	}: {
		user: {
			id: string;
			name: string;
			email: string;
			is_verified?: boolean;
		};
	} = $props();

	const dispatch = createEventDispatcher<{ 
		close: void; 
		verified: { method: string; data: any };
	}>();
	
	// Component ID for timer coordination
	const componentId = 'verification-modal-' + Math.random().toString(36).substring(2, 15);

	type Step = 'intro' | 'method' | 'selfxyz-setup' | 'selfxyz-verify' | 'complete';
	let currentStep: Step = $state('intro');
	let isTransitioning = $state(false);
	let verificationMethod = $state<'self_xyz' | 'skip'>('self_xyz');

	// Self.xyz integration state
	let selfApp = $state<any>(null);
	let verificationStatus = $state<'pending' | 'success' | 'error'>('pending');
	let verificationResult = $state<any>(null);
	let qrCodeUserId = $state<string | null>(null);

	// Prevent background scrolling when modal is open
	onMount(() => {
		if (browser) {
			document.body.style.overflow = 'hidden';
		}
	});

	onDestroy(() => {
		if (browser) {
			document.body.style.overflow = '';
		}
		useTimerCleanup(componentId)();
	});

	function handleClose() {
		dispatch('close');
	}

	function nextStep(step: Step) {
		if (isTransitioning) return;
		isTransitioning = true;
		coordinated.setTimeout(() => {
			currentStep = step;
			isTransitioning = false;
		}, 150, 'transition', componentId);
	}

	function previousStep() {
		if (currentStep === 'intro') return;
		if (currentStep === 'method') nextStep('intro');
		if (currentStep === 'selfxyz-setup') nextStep('method');
		if (currentStep === 'selfxyz-verify') nextStep('selfxyz-setup');
	}

	// Initialize Self.xyz verification
	async function initializeSelfXyzVerification() {
		try {
			// Generate unique user ID for this verification session
			qrCodeUserId = uuidv4();
			
			// Create Self.xyz app configuration
			selfApp = new SelfAppBuilder({
				appName: "Communiqué",
				scope: "communique-sybil-resistance",
				endpoint: `${window.location.origin}/api/user/verify-identity`,
				endpointType: "https", // Off-chain verification via HTTPS API
				userId: qrCodeUserId,
				userIdType: "uuid",
				version: 2,
				devMode: true, // Set to false in production
				userDefinedData: "0x" + Buffer.from("communique_verification").toString('hex').padEnd(128, '0'), // Required 64-byte hex string
				disclosures: {
					minimumAge: 18,
					nationality: true,
					name: true,
					ofac: true, // OFAC compliance checking
					excludedCountries: [] // No excluded countries for now
				}
			}).build();
			
			verificationStatus = 'pending';

		} catch (error) {
			console.error('Self.xyz verification failed:', error);
			verificationStatus = 'error';
		}
	}

	// Handle successful Self.xyz verification
	function handleSelfXyzSuccess() {
		verificationStatus = 'success';
		verificationResult = {
			method: 'self_xyz',
			userId: qrCodeUserId,
			verified: true,
			timestamp: new Date().toISOString()
		};
		nextStep('complete');
	}

	// Handle Self.xyz verification error
	function handleSelfXyzError() {
		verificationStatus = 'error';
	}

	function handleSkipVerification() {
		// User chooses to skip verification for now
		dispatch('verified', { 
			method: 'skipped', 
			data: { skipped: true, timestamp: new Date().toISOString() }
		});
	}

	function handleVerificationComplete() {
		dispatch('verified', { 
			method: 'self_xyz', 
			data: verificationResult 
		});
	}
</script>

<!-- Modal Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
	onclick={handleClose}
	onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}
	role="dialog"
	aria-modal="true"
	aria-label="Identity verification modal"
	tabindex="0"
	in:fade={{ duration: 300, easing: quintOut }}
	out:fade={{ duration: 200 }}
>
	<!-- Modal Content -->
	<div
		class="fixed inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2 transform overflow-hidden rounded-2xl bg-white shadow-2xl"
		onclick={(e) => { e.stopPropagation(); }}
		in:fly={{ y: 20, duration: 400, delay: 300, easing: quintOut }}
		out:fly={{ y: -10, duration: 200 }}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
					<Shield class="h-5 w-5 text-green-600" />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-slate-900">Identity Verification</h2>
					<p class="text-sm text-slate-600">Become a verified advocate</p>
				</div>
			</div>
			<button
				onclick={handleClose}
				class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Progress Indicator -->
		<div class="px-6 pt-4">
			<div class="flex gap-2">
				{#each ['intro', 'method', 'selfxyz-setup', 'selfxyz-verify', 'complete'] as step, i}
					<div 
						class="h-2 rounded-full transition-all duration-500 ease-out {
							currentStep === step 
								? 'bg-green-500 flex-1' 
								: ['intro', 'method', 'selfxyz-setup', 'selfxyz-verify', 'complete'].indexOf(currentStep) > i
									? 'bg-green-200 flex-1'
									: 'bg-slate-200 flex-1'
						}"
					></div>
				{/each}
			</div>
		</div>

		<!-- Content Area -->
		<div class="relative overflow-hidden min-h-[400px]">
			{#key currentStep}
				<div 
					class="absolute inset-0 p-6 pt-4"
					in:fly={{ x: 20, duration: 400, delay: 300, easing: quintOut }}
					out:fly={{ x: -20, duration: 200 }}
					onkeydown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
					role="region"
					aria-label="Verification step content"
				>
					{#if currentStep === 'intro'}
						<!-- Introduction Step -->
						<div class="text-center space-y-4">
							<div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
								<CheckCircle2 class="h-8 w-8 text-green-600" />
							</div>
							<h3 class="text-xl font-bold text-slate-900">
								Boost Your Advocacy Impact
							</h3>
							<p class="text-slate-600 leading-relaxed">
								Verify your identity to join our trusted advocate tier. Verified users help prevent spam and increase the credibility of citizen advocacy.
							</p>
							
							<div class="bg-green-50 rounded-lg p-4 text-left">
								<h4 class="font-semibold text-green-900 mb-2">Benefits of Verification:</h4>
								<ul class="text-sm text-green-800 space-y-1">
									<li class="flex items-center gap-2">
										<CheckCircle2 class="h-4 w-4 text-green-600" />
										Verified badge on your advocacy messages
									</li>
									<li class="flex items-center gap-2">
										<CheckCircle2 class="h-4 w-4 text-green-600" />
										Higher priority in representative systems
									</li>
									<li class="flex items-center gap-2">
										<CheckCircle2 class="h-4 w-4 text-green-600" />
										Help prevent spam and fake campaigns
									</li>
									<li class="flex items-center gap-2">
										<CheckCircle2 class="h-4 w-4 text-green-600" />
										Support authentic grassroots democracy
									</li>
								</ul>
							</div>

							<div class="flex gap-3 mt-6">
								<Button 
									variant="primary" 
									onclick={() => nextStep('method')}
									classNames="flex-1"
								>
									Get Verified
								</Button>
								<Button 
									variant="secondary" 
									onclick={handleClose}
									classNames="flex-1"
								>
									Maybe Later
								</Button>
							</div>
						</div>

					{:else if currentStep === 'method'}
						<!-- Method Selection Step -->
						<div class="space-y-6">
							<div class="text-center">
								<h3 class="text-xl font-bold text-slate-900 mb-2">
									Choose Verification Method
								</h3>
								<p class="text-slate-600">
									Select how you'd like to verify your identity
								</p>
							</div>

							<div class="space-y-3">
								<!-- Self.xyz Option -->
								<label class="block">
									<input 
										type="radio" 
										bind:group={verificationMethod} 
										value="self_xyz" 
										class="sr-only"
									>
									<div class="p-4 border-2 rounded-lg cursor-pointer transition-all {
										verificationMethod === 'self_xyz' 
											? 'border-green-500 bg-green-50' 
											: 'border-slate-200 hover:border-slate-300'
									}">
										<div class="flex items-start gap-3">
											<div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mt-1">
												<Shield class="w-5 h-5 text-purple-600" />
											</div>
											<div class="flex-1">
												<h4 class="font-semibold text-slate-900">Self.xyz Verification</h4>
												<p class="text-sm text-slate-600 mt-1">
													Zero-knowledge proof using your passport. Private and secure.
												</p>
												<div class="mt-2 flex items-center gap-2 text-xs text-green-600">
													<CheckCircle2 class="h-3 w-3" />
													<span>Recommended - Strongest anti-Sybil protection</span>
												</div>
											</div>
											{#if verificationMethod === 'self_xyz'}
												<CheckCircle2 class="w-5 h-5 text-green-600 mt-1" />
											{/if}
										</div>
									</div>
								</label>

								<!-- Skip Option -->
								<label class="block">
									<input 
										type="radio" 
										bind:group={verificationMethod} 
										value="skip" 
										class="sr-only"
									>
									<div class="p-4 border-2 rounded-lg cursor-pointer transition-all {
										verificationMethod === 'skip' 
											? 'border-slate-400 bg-slate-50' 
											: 'border-slate-200 hover:border-slate-300'
									}">
										<div class="flex items-start gap-3">
											<div class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mt-1">
												<X class="w-5 h-5 text-slate-600" />
											</div>
											<div class="flex-1">
												<h4 class="font-semibold text-slate-900">Skip for Now</h4>
												<p class="text-sm text-slate-600 mt-1">
													Continue as unverified user. You can verify later in settings.
												</p>
											</div>
											{#if verificationMethod === 'skip'}
												<CheckCircle2 class="w-5 h-5 text-slate-600 mt-1" />
											{/if}
										</div>
									</div>
								</label>
							</div>

							<div class="flex gap-3">
								<Button 
									variant="secondary" 
									onclick={previousStep}
									classNames="flex-1"
								>
									Back
								</Button>
								<Button 
									variant="primary" 
									onclick={() => {
										if (verificationMethod === 'self_xyz') {
											nextStep('selfxyz-setup');
										} else {
											handleSkipVerification();
										}
									}}
									classNames="flex-1"
								>
									Continue
								</Button>
							</div>
						</div>

					{:else if currentStep === 'selfxyz-setup'}
						<!-- Self.xyz Setup Step -->
						<div class="space-y-6">
							<div class="text-center">
								<h3 class="text-xl font-bold text-slate-900 mb-2">
									Prepare for Verification
								</h3>
								<p class="text-slate-600">
									You'll need the Self app and your passport
								</p>
							</div>

							<div class="space-y-4">
								<div class="bg-blue-50 rounded-lg p-4">
									<h4 class="font-semibold text-blue-900 mb-3">Requirements:</h4>
									<div class="space-y-2 text-sm text-blue-800">
										<div class="flex items-center gap-2">
											<Smartphone class="h-4 w-4" />
											<span>Self app installed on your phone</span>
										</div>
										<div class="flex items-center gap-2">
											<Shield class="h-4 w-4" />
											<span>Valid passport with NFC capability</span>
										</div>
										<div class="flex items-center gap-2">
											<CheckCircle2 class="h-4 w-4" />
											<span>Must be 18+ years old</span>
										</div>
									</div>
								</div>

								<div class="border border-slate-200 rounded-lg p-4">
									<h4 class="font-semibold text-slate-900 mb-2">How it works:</h4>
									<ol class="text-sm text-slate-600 space-y-1 list-decimal list-inside">
										<li>Scan QR code with Self app</li>
										<li>Scan your passport with phone's NFC</li>
										<li>Generate zero-knowledge proof</li>
										<li>Verification complete!</li>
									</ol>
								</div>
							</div>

							<div class="flex gap-3">
								<Button 
									variant="secondary" 
									onclick={previousStep}
									classNames="flex-1"
								>
									Back
								</Button>
								<Button 
									variant="primary" 
									onclick={() => {
										initializeSelfXyzVerification();
										nextStep('selfxyz-verify');
									}}
									classNames="flex-1"
								>
									Start Verification
								</Button>
							</div>
						</div>

					{:else if currentStep === 'selfxyz-verify'}
						<!-- Self.xyz Verification Step -->
						<div class="space-y-6 text-center">
							<div>
								<h3 class="text-xl font-bold text-slate-900 mb-2">
									Scan with Self App
								</h3>
								<p class="text-slate-600">
									Open the Self app and scan this QR code
								</p>
							</div>

							<!-- QR Code Display -->
							<div class="flex justify-center">
								{#if selfApp}
									<div class="bg-white p-4 rounded-lg border-2 border-slate-200 inline-block">
										<SelfQRcodeWrapper
											{selfApp}
											onSuccess={handleSelfXyzSuccess}
											onError={handleSelfXyzError}
											size={200}
										/>
									</div>
								{:else}
									<div class="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center">
										<div class="text-center">
											<div class="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
											<p class="text-sm text-slate-600">Generating QR code...</p>
										</div>
									</div>
								{/if}
							</div>

							<!-- Status -->
							<div class="bg-blue-50 rounded-lg p-4">
								{#if verificationStatus === 'pending'}
									<div class="flex items-center gap-2 justify-center text-blue-800">
										<div class="animate-pulse w-2 h-2 bg-blue-600 rounded-full"></div>
										<span class="text-sm">Waiting for verification...</span>
									</div>
								{:else if verificationStatus === 'success'}
									<div class="flex items-center gap-2 justify-center text-green-800">
										<CheckCircle2 class="w-4 h-4 text-green-600" />
										<span class="text-sm">Verification successful!</span>
									</div>
								{:else if verificationStatus === 'error'}
									<div class="flex items-center gap-2 justify-center text-red-800">
										<X class="w-4 h-4 text-red-600" />
										<span class="text-sm">Verification failed. Please try again.</span>
									</div>
								{/if}
							</div>

							<!-- Alternative for mobile -->
							<div class="border-t border-slate-200 pt-4">
								<p class="text-sm text-slate-600 mb-3">Don't have the Self app? Download it first:</p>
								<div class="flex gap-2">
									<Button 
										variant="secondary" 
										onclick={() => window.open('https://apps.apple.com/app/self-xyz/id1234567890', '_blank')}
										classNames="flex-1"
									>
										iOS App
									</Button>
									<Button 
										variant="secondary" 
										onclick={() => window.open('https://play.google.com/store/apps/details?id=xyz.self.app', '_blank')}
										classNames="flex-1"
									>
										Android App
									</Button>
								</div>
							</div>

							<div class="flex gap-3">
								<Button 
									variant="secondary" 
									onclick={previousStep}
									classNames="flex-1"
								>
									Back
								</Button>
								{#if verificationStatus === 'error'}
									<Button 
										variant="primary" 
										onclick={() => {
											verificationStatus = 'pending';
											initializeSelfXyzVerification();
										}}
										classNames="flex-1"
									>
										Try Again
									</Button>
								{/if}
							</div>
						</div>

					{:else if currentStep === 'complete'}
						<!-- Completion Step -->
						<div class="text-center space-y-6">
							<div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
								<CheckCircle2 class="h-8 w-8 text-green-600" />
							</div>
							<div>
								<h3 class="text-xl font-bold text-slate-900 mb-2">
									Verification Complete!
								</h3>
								<p class="text-slate-600">
									You're now a verified advocate. Your messages will carry the verified badge.
								</p>
							</div>

							<div class="bg-green-50 rounded-lg p-4">
								<div class="flex items-center justify-center gap-2 text-green-800">
									<Shield class="w-5 h-5" />
									<span class="font-semibold">Verified Advocate</span>
								</div>
								<p class="text-sm text-green-700 mt-2">
									Your advocacy messages now have enhanced credibility and anti-Sybil protection.
								</p>
							</div>

							<Button 
								variant="primary" 
								onclick={handleVerificationComplete}
								classNames="w-full"
							>
								Continue to Templates
							</Button>
						</div>
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>