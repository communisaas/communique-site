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

	function handleSendClick() {
		// Apply Personal Connection into the template body in JS-land
		const pc = personalConnectionValue?.trim();
		if (pc && pc.length > 0 && typeof template?.message_body === 'string') {
			template.message_body = template.message_body.replace(/\[Personal Connection\]/g, pc);
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
				text={user ? 'Send to Congress' : 'Send to Congress'}
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
				text={user ? 'Send to Decision-Makers' : 'Send to Decision-Makers'}
			/>
		{/if}
	</div>
{/if}
