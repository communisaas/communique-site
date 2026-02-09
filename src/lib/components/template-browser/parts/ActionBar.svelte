<script lang="ts">
	import type { Template } from '$lib/types/template';
	import Button from '$lib/components/ui/Button.svelte';
	import { browser } from '$app/environment';
	// import { coordinated } from '$lib/utils/timerCoordinator';
	import { type Spring } from 'svelte/motion';

	let {
		template,
		user,
		personalConnectionValue,
		onSendMessage,
		localShowEmailModal = $bindable(),
		actionProgress = $bindable(),
		onEmailModalClose: _onEmailModalClose,
		componentId: _componentId
	}: {
		template: Template;
		user: { id: string; name: string | null } | null;
		personalConnectionValue: string;
		onSendMessage: (() => void) | null;
		localShowEmailModal: boolean;
		actionProgress: Spring<number>;
		onEmailModalClose: () => void;
		componentId: string;
	} = $props();

	let flightState = $state<
		'sent' | 'ready' | 'taking-off' | 'flying' | 'departing' | 'returning' | undefined
	>('ready');
	let moderationError = $state<string | null>(null);
	let isModerating = $state(false);

	// Circuit breaker for moderation service (CI-004 hardening)
	// Fail-closed: block sends when moderation is unavailable, unless circuit trips open
	// after CIRCUIT_BREAKER_THRESHOLD consecutive failures within CIRCUIT_BREAKER_WINDOW_MS
	const CIRCUIT_BREAKER_THRESHOLD = 3;
	const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
	let moderationFailures: number[] = [];
	let circuitOpen = false;

	function recordModerationFailure(): void {
		const now = Date.now();
		moderationFailures = moderationFailures.filter((t) => now - t < CIRCUIT_BREAKER_WINDOW_MS);
		moderationFailures.push(now);
		if (moderationFailures.length >= CIRCUIT_BREAKER_THRESHOLD && !circuitOpen) {
			circuitOpen = true;
			console.warn(
				`[ActionBar] Circuit breaker OPEN: ${CIRCUIT_BREAKER_THRESHOLD} moderation failures in ${CIRCUIT_BREAKER_WINDOW_MS / 1000}s — allowing sends with audit log`
			);
		} else if (moderationFailures.length < CIRCUIT_BREAKER_THRESHOLD && circuitOpen) {
			// Half-open → closed: failures aged out of window, restore fail-closed behavior
			circuitOpen = false;
		}
	}

	async function handleSendClick() {
		moderationError = null;

		// Moderate personalization text before applying (CI-004)
		const pc = personalConnectionValue?.trim();
		if (pc && pc.length > 0) {
			isModerating = true;
			try {
				const res = await fetch('/api/moderation/personalization', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: pc })
				});
				const result = await res.json();
				if (!result.approved) {
					moderationError = result.summary || 'Personalization text was not approved. Please edit and try again.';
					isModerating = false;
					return;
				}
			} catch {
				// Fail-closed: block the send when moderation is unavailable
				recordModerationFailure();
				if (!circuitOpen) {
					moderationError =
						'Content moderation is temporarily unavailable. Please try again in a moment.';
					isModerating = false;
					return;
				}
				// Circuit is open (repeated failures) — degrade gracefully with audit trail
				console.warn('[ActionBar] Circuit breaker open — sending without moderation (audited)');
			}
			isModerating = false;

			// Apply Personal Connection into the template body
			if (typeof template?.message_body === 'string') {
				template.message_body = template.message_body.replace(/\[Personal Connection\]/g, pc);
			}
		}

		// Save personalization for all users
		if (browser && personalConnectionValue) {
			sessionStorage.setItem(
				`template_${template.id}_personalization`,
				JSON.stringify({
					personalConnection: personalConnectionValue,
					timestamp: Date.now()
				})
			);
		}

		// For unauthenticated users, set pending send flag
		if (!user && browser) {
			sessionStorage.setItem(`template_${template.id}_pending_send`, 'true');
		}

		// Let parent handle the entire flow (auth, address, or email modal)
		if (onSendMessage) {
			onSendMessage();
		}
	}
</script>

{#if onSendMessage}
	{#if moderationError}
		<div class="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
			{moderationError}
		</div>
	{/if}
	<div class="mt-4 flex justify-center">
		{#if template.deliveryMethod === 'cwc'}
			<Button
				variant="verified"
				size="lg"
				testId="contact-congress-button"
				classNames="w-full pr-5"
				enableFlight={!!user}
				icon="send"
				bind:flightState
				{user}
				onclick={handleSendClick}
				disabled={isModerating}
				text={isModerating ? 'Checking...' : user ? 'Send to Congress' : 'Send to Congress'}
			/>
		{:else}
			<Button
				variant="primary"
				size="lg"
				testId="send-email-button"
				classNames="w-full pr-5"
				enableFlight={!!user}
				icon="send"
				bind:flightState
				{user}
				onclick={handleSendClick}
				disabled={isModerating}
				text={isModerating ? 'Checking...' : user ? 'Send to Decision-Makers' : 'Send to Decision-Makers'}
			/>
			<p class="mt-1 text-center text-xs text-gray-400">
				Sent via email without cryptographic verification
			</p>
		{/if}
	</div>
{/if}
