<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { X, Shield, AtSign, ArrowRight } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { Template } from '$lib/types/template';
	import { createModalStore } from '$lib/stores/modalSystem.svelte';
	import { funnelAnalytics } from '$lib/core/analytics/funnel';

	const modal = createModalStore('auth-modal', 'auth');

	const modalData = $derived(
		modal.data as { template: Template; source?: 'social-link' | 'direct-link' | 'share' } | null
	);
	const template = $derived(modalData?.template);
	const source = $derived(modalData?.source || 'direct-link');

	const authConfig = $derived.by(() => {
		if (!template) return null;
		const isCongressional = template.deliveryMethod === 'cwc';
		return isCongressional
			? {
					icon: Shield,
					iconColor: 'text-green-600',
					bgColor: 'bg-green-50',
					buttonColor: 'bg-green-600 hover:bg-green-700',
					headline: 'Contact your representatives',
					subtext: "Your message will be delivered directly to your representative's office",
					nextStep: 'Next: Find your representatives'
				}
			: {
					icon: AtSign,
					iconColor: 'text-blue-600',
					bgColor: 'bg-blue-50',
					buttonColor: 'bg-blue-600 hover:bg-blue-700',
					headline: 'Send your message',
					subtext: 'Your message will be sent directly to decision-makers',
					nextStep: 'Next: Send message'
				};
	});

	async function handleAuth(provider: string) {
		if (!template) return;
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(
				'pending_template_action',
				JSON.stringify({ slug: template.slug, action: 'use_template', timestamp: Date.now() })
			);
		}
		try {
			await fetch('/auth/prepare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ returnTo: `/${template.slug}` })
			});
		} catch {}
		funnelAnalytics.trackOnboardingStarted(template.id, source);
		window.location.href = `/auth/${provider}`;
	}

	function handleClose() {
		modal.close();
	}
</script>

{#if modal.isOpen && template && authConfig}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		onclick={handleClose}
		in:fade={{ duration: 200 }}
		out:fade={{ duration: 200 }}
		role="button"
		tabindex="-1"
	>
		<div
			class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			in:scale={{ duration: 300, start: 0.9, easing: quintOut }}
			out:scale={{ duration: 200, start: 1, easing: quintOut }}
			role="button"
			tabindex="-1"
		>
			<div class="flex items-center justify-between p-6 pb-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full {authConfig?.bgColor}">
						{#if authConfig?.icon}
							{@const IconComponent = authConfig.icon}
							<IconComponent class="h-5 w-5 {authConfig?.iconColor}" />
						{/if}
					</div>
					<div>
						<h2 class="text-lg font-semibold text-slate-900">{authConfig?.headline}</h2>
					</div>
				</div>
				<button onclick={handleClose} class="text-slate-400 transition-colors hover:text-slate-600">
					<X class="h-5 w-5" />
				</button>
			</div>
			<div class="px-6 pb-6">
				<p class="mb-6 text-slate-600">{authConfig?.subtext}</p>
				<div class="space-y-3">
					<Button
						onclick={() => handleAuth('google')}
						classNames="w-full {authConfig?.buttonColor} text-white"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="currentColor"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="currentColor"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="currentColor"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						Continue with Google
					</Button>
					<Button
						onclick={() => handleAuth('facebook')}
						classNames="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
					>
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<path
								d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
							/>
						</svg>
						Continue with Facebook
					</Button>
				</div>
				<div class="mt-4 rounded-lg bg-slate-50 p-3">
					<div class="flex items-center gap-2 text-sm text-slate-600">
						<ArrowRight class="h-3 w-3" />
						<span>{authConfig?.nextStep}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
