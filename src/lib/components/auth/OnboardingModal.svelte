<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';
	import { X, Users, Sparkles, HelpCircle, Mail, CheckCircle2 } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		template,
		source = 'direct-link',
		onclose
	}: {
		template: {
			title: string;
			description: string;
			slug: string;
			deliveryMethod?: string;
			metrics: { sent: number; views?: number };
		};
		source?: 'social-link' | 'direct-link' | 'share';
		onclose?: () => void;
	} = $props();

	const dispatch = createEventDispatcher<{ close: void }>();

	let showDetails = $state(false);

	// Check if user has seen onboarding before
	const hasSeenOnboarding = $derived.by(() => {
		if (typeof window === 'undefined') return false;
		return localStorage.getItem('communique_has_seen_onboarding') === 'true';
	});

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
	});

	// Template delivery method checks
	const isCongressional = $derived(template.deliveryMethod === 'certified');
	const isDirectOutreach = $derived(template.deliveryMethod === 'email');

	// Dynamic messaging based on source and template type
	const sourceMessages = $derived(getSourceMessages(isCongressional, isDirectOutreach));

	function getSourceMessages(congressional: boolean, directOutreach: boolean) {
		if (congressional) {
			return {
				'social-link': {
					headline: 'Your voice can drive change',
					subtext: 'Someone shared this because they know your voice matters to Congress.',
					cta: 'Add your voice'
				},
				'direct-link': {
					headline: 'Representatives need to hear from you',
					subtext: 'Congressional offices count every message from constituents.',
					cta: 'Speak up'
				},
				share: {
					headline: 'Join the pressure campaign',
					subtext: 'Your voice adds to the growing momentum on this issue.',
					cta: 'Join them'
				}
			};
		} else if (directOutreach) {
			return {
				'social-link': {
					headline: 'Make decision-makers listen',
					subtext: 'Someone shared this because they believe your voice can create change.',
					cta: 'Add your voice'
				},
				'direct-link': {
					headline: 'Decision-makers need to hear from you',
					subtext: 'Your voice carries weight when you speak as a stakeholder.',
					cta: 'Make your voice heard'
				},
				share: {
					headline: 'Join the advocacy push',
					subtext: 'Add your voice to the growing pressure on decision-makers.',
					cta: 'Join them'
				}
			};
		} else {
			return {
				'social-link': {
					headline: 'Your voice can drive change',
					subtext: 'Someone shared this because they believe in change.',
					cta: 'Add your voice'
				},
				'direct-link': {
					headline: 'Make your voice heard',
					subtext: 'This campaign needs supporters like you.',
					cta: 'Get started'
				},
				share: {
					headline: 'Shared with you',
					subtext: 'Someone wants you to join this important cause.',
					cta: 'Join them'
				}
			};
		}
	}

	function getProcessSteps(congressional: boolean, directOutreach: boolean) {
		if (congressional) {
			return [
				{
					icon: Mail,
					title: 'Direct delivery to congressional office',
					desc: "Your message goes straight to your representative's staff"
				},
				{
					icon: Users,
					title: 'Counted as constituent feedback',
					desc: 'Congressional offices track messages by issue and district'
				},
				{
					icon: CheckCircle2,
					title: 'Influences their position',
					desc: 'Representatives consider constituent input when voting'
				}
			];
		} else if (directOutreach) {
			return [
				{
					icon: Mail,
					title: 'Direct delivery to decision-makers',
					desc: 'Your message reaches executives, officials, or stakeholders'
				},
				{
					icon: Users,
					title: 'Strengthened by your credentials',
					desc: "Your role and connection amplify your message's impact"
				},
				{
					icon: CheckCircle2,
					title: 'Creates pressure for change',
					desc: 'Decision-makers respond when stakeholders speak up'
				}
			];
		} else {
			return [
				{
					icon: Mail,
					title: 'Direct message delivery',
					desc: 'Your message is sent to the right people'
				},
				{ icon: Users, title: 'Tracked for impact', desc: 'We monitor campaign effectiveness' },
				{ icon: CheckCircle2, title: 'Drives change', desc: 'Collective voices create real impact' }
			];
		}
	}

	// Detect template type for customized messaging - already defined above

	const message = $derived(sourceMessages[source]);
	async function prepareReturn() {
		try {
			await fetch('/auth/prepare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ returnTo: `/${template.slug}` })
			});
		} catch {}
	}

	function handleAuth(provider: string) {
		// Mark user as having seen onboarding
		if (typeof window !== 'undefined') {
			localStorage.setItem('communique_has_seen_onboarding', 'true');
		}

		// Store the template context before redirecting
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(
				'pending_template_action',
				JSON.stringify({
					slug: template.slug,
					action: 'use_template',
					timestamp: Date.now()
				})
			);
		}

		prepareReturn().finally(() => {
			window.location.href = `/auth/${provider}`;
		});
	}

	function handleClose() {
		onclose?.();
		dispatch('close');
	}

	function toggleDetails() {
		showDetails = !showDetails;
	}
</script>

<!-- Modal Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
	onclick={handleClose}
	onkeydown={(e) => {
		if (e.key === 'Escape') handleClose();
	}}
	role="dialog"
	aria-modal="true"
	aria-label="Sign in to send message"
	tabindex="0"
	in:fade={{ duration: 300, easing: quintOut }}
	out:fade={{ duration: 200 }}
>
	<!-- Modal Content -->
	<div
		class="fixed inset-x-4 inset-y-4 mx-auto flex max-w-md items-center justify-center"
		onclick={(e) => {
			e.stopPropagation();
		}}
		onkeydown={(e) => {
			e.stopPropagation();
		}}
		role="document"
	>
		<div
			class="max-h-full w-full overflow-y-auto rounded-2xl bg-white shadow-2xl"
			in:scale={{
				duration: 400,
				easing: backOut,
				start: 0.9,
				opacity: 0.5
			}}
			out:scale={{
				duration: 200,
				easing: quintOut,
				start: 0.95
			}}
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute right-2 top-2 z-10 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
				aria-label="Close"
			>
				<X class="h-4 w-4" />
			</button>

			<div class="p-6">
				<!-- Header -->
				<div class="mb-6 text-center">
					<h2 class="mb-2 text-xl font-bold text-slate-900">
						{message.headline}
					</h2>
					<p class="text-sm text-slate-600">
						{#if isCongressional}
							Your message goes directly to Congress
						{:else if isDirectOutreach}
							Your message reaches decision-makers
						{:else}
							Your message gets delivered with impact
						{/if}
					</p>
				</div>

				<!-- Template Preview Card -->
				<div
					class="mb-6 rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4"
				>
					<h3 class="mb-1 text-sm font-semibold text-slate-900">
						{template.title}
					</h3>
					<p class="mb-3 line-clamp-2 text-xs text-slate-600">
						{template.description}
					</p>

					<!-- Social Proof -->
					<div class="flex items-center gap-3 text-xs text-slate-500">
						<div class="flex items-center gap-1">
							<Users class="h-3 w-3" />
							<span>{(template.metrics?.sent || 0).toLocaleString()} sent</span>
						</div>
						{#if (template.metrics?.sent || 0) > 100}
							<span class="font-medium text-blue-600">📈 Growing momentum</span>
						{:else if (template.metrics?.sent || 0) > 50}
							<span class="font-medium text-green-600">🎯 Building pressure</span>
						{:else}
							<span class="font-medium text-amber-600">🚀 Early adopter</span>
						{/if}
					</div>
				</div>

				<!-- OAuth Buttons -->
				<div class="mb-4 space-y-3">
					<!-- Primary providers -->
					{#each [{ provider: 'google', name: 'Google', icon: 'google-svg' }, { provider: 'facebook', name: 'Facebook', icon: 'f' }] as auth}
						<button
							onclick={() => handleAuth(auth.provider)}
							class="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-50 hover:shadow-md"
						>
							{#if auth.provider === 'google'}
								<svg class="h-5 w-5" viewBox="0 0 24 24">
									<path
										fill="#4285F4"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="#34A853"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="#FBBC05"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="#EA4335"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
							{:else}
								<div
									class="flex h-5 w-5 items-center justify-center rounded bg-[#1877F2] text-sm font-bold text-white"
								>
									f
								</div>
							{/if}
							Continue with {auth.name}
						</button>
					{/each}

					<!-- Secondary providers -->
					<div class="grid grid-cols-3 gap-2">
						{#each [{ provider: 'twitter', name: 'X', icon: '𝕏', color: 'bg-black' }, { provider: 'linkedin', name: 'LinkedIn', color: 'bg-[#0077B5]' }, { provider: 'discord', name: 'Discord', color: 'bg-[#5865F2]' }] as auth}
							<button
								onclick={() => handleAuth(auth.provider)}
								class="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-3 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-50"
							>
								{#if auth.provider === 'linkedin'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="#0077B5">
										<path
											d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
										/>
									</svg>
								{:else if auth.provider === 'discord'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="#5865F2">
										<path
											d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"
										/>
									</svg>
								{:else}
									<div
										class="h-5 w-5 {auth.color} flex items-center justify-center rounded text-sm font-bold text-white"
									>
										{auth.icon}
									</div>
								{/if}
								<span class="text-xs font-medium text-slate-700">{auth.name}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- How it works toggle -->
				<div class="mb-4">
					<button
						onclick={toggleDetails}
						class="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
					>
						<HelpCircle class="h-4 w-4" />
						How does this work?
					</button>

					{#if showDetails}
						<div
							class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
							in:fly={{ y: -10, duration: 200 }}
							out:fly={{ y: -10, duration: 200 }}
						>
							<div class="space-y-3">
								{#each getProcessSteps(isCongressional, isDirectOutreach) as step, i}
									{@const IconComponent = step.icon}
									<div class="flex items-start gap-3">
										<div
											class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100"
										>
											<IconComponent class="h-3 w-3 text-blue-600" />
										</div>
										<div>
											<p class="text-sm font-medium text-slate-900">{step.title}</p>
											<p class="text-xs text-slate-600">{step.desc}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Privacy Notice -->
				<p class="text-center text-xs text-slate-500">
					By signing up, you agree to our terms and privacy policy.
				</p>
			</div>
		</div>
	</div>
</div>
