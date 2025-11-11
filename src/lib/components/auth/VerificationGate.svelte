<!--
 * Verification Gate Component
 *
 * Progressive verification interceptor that gates Congressional message submission.
 *
 * Flow:
 * 1. User clicks "Send Message" on Congressional template
 * 2. Check session credential (hasValidSession)
 * 3. If verified: Allow submission
 * 4. If not verified: Show IdentityVerificationFlow modal
 * 5. After verification: Continue with original action
 *
 * This implements the "pull users naturally toward verification" paradigm.
 -->

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { scale, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { X } from '@lucide/svelte';
	import IdentityVerificationFlow from './IdentityVerificationFlow.svelte';
	import ProofGenerationModal from '$lib/components/proof/ProofGenerationModal.svelte';
	import { hasValidSession } from '$lib/core/identity/session-cache';
	import { isFeatureEnabled } from '$lib/features/config';

	interface Props {
		userId: string;
		templateSlug?: string;
		/** If true, shows the verification modal */
		showModal: boolean;
	}

	let { userId, templateSlug, showModal = $bindable() }: Props = $props();

	const dispatch = createEventDispatcher<{
		verified: { userId: string; method: string };
		cancel: void;
	}>();

	// ZK proof generation state (Phase 2)
	let showProofModal = $state(false);
	let zkProofEnabled = $state(false);

	// Check if ZK proof generation is enabled
	$effect(() => {
		zkProofEnabled = isFeatureEnabled('ZK_PROOF_GENERATION');
	});

	/**
	 * Check if user has valid session credential
	 * Called before showing modal - allows instant send if verified
	 */
	export async function checkVerification(): Promise<boolean> {
		try {
			const isVerified = await hasValidSession(userId);
			console.log('[Verification Gate] Session check:', { userId, isVerified });
			return isVerified;
		} catch (error) {
			console.error('[Verification Gate] Session check failed:', error);
			return false;
		}
	}

	function handleVerificationComplete(
		event: CustomEvent<{ verified: boolean; method: string; userId: string; district?: string }>
	) {
		console.log('[Verification Gate] Verification complete:', event.detail);
		showModal = false;

		// If ZK proof generation enabled, show proof generation modal
		if (zkProofEnabled && event.detail.district) {
			console.log('[Verification Gate] Triggering ZK proof generation for:', event.detail.district);
			showProofModal = true;
			return;
		}

		// Otherwise, dispatch verified event immediately (Phase 1 behavior)
		dispatch('verified', {
			userId: event.detail.userId,
			method: event.detail.method
		});
	}

	function handleProofComplete(event: CustomEvent<{ proof: Uint8Array; generationTime: number }>) {
		console.log('[Verification Gate] ZK proof generated:', {
			proofSize: event.detail.proof.length,
			generationTime: event.detail.generationTime
		});

		showProofModal = false;

		// Dispatch verified event with proof
		dispatch('verified', {
			userId,
			method: 'zk-proof'
		});
	}

	function handleProofError(event: CustomEvent<Error>) {
		console.error('[Verification Gate] ZK proof generation failed:', event.detail);
		showProofModal = false;

		// Fallback to Phase 1 (encrypted address)
		console.log('[Verification Gate] Falling back to Phase 1 encrypted address flow');
		dispatch('verified', {
			userId,
			method: 'encrypted-address'
		});
	}

	function handleCancel() {
		showModal = false;
		dispatch('cancel');
	}
</script>

{#if showModal}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="verification-gate-title"
	>
		<!-- Modal Container -->
		<div
			class="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
			transition:scale={{ duration: 300, start: 0.95, easing: quintOut }}
		>
			<!-- Close Button -->
			<button
				onclick={handleCancel}
				class="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
				aria-label="Close verification modal"
			>
				<X class="h-5 w-5" />
			</button>

			<!-- Header -->
			<div class="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6">
				<h2 id="verification-gate-title" class="text-2xl font-bold text-slate-900">
					Verify Your Identity to Send
				</h2>
				<p class="mt-2 text-slate-600">
					Congressional offices prioritize verified constituents. This one-time verification takes
					30 seconds and lets you send instantly in the future.
				</p>
			</div>

			<!-- Verification Flow Content -->
			<div class="max-h-[calc(100vh-12rem)] overflow-y-auto p-8">
				<IdentityVerificationFlow
					{userId}
					{templateSlug}
					skipValueProp={true}
					on:complete={handleVerificationComplete}
					on:cancel={handleCancel}
				/>
			</div>
		</div>
	</div>
{/if}

<!-- ZK Proof Generation Modal (Phase 2) -->
{#if zkProofEnabled}
	<ProofGenerationModal
		bind:show={showProofModal}
		district={'CA-12'}
		onComplete={handleProofComplete}
		onError={handleProofError}
	/>
{/if}
