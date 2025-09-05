<script lang="ts">
	import type { Template } from '$lib/types/template';
	import Button from '$lib/components/ui/Button.svelte';
	import { browser } from '$app/environment';
	import { coordinated } from '$lib/utils/timerCoordinator';
	import { spring } from 'svelte/motion';
	
	let {
		template,
		user,
		personalConnectionValue,
		onSendMessage,
		localShowEmailModal = $bindable(),
		actionProgress = $bindable(),
		onEmailModalClose,
		componentId
	}: {
		template: Template;
		user: { id: string; name: string | null } | null;
		personalConnectionValue: string;
		onSendMessage: (() => void) | null;
		localShowEmailModal: boolean;
		actionProgress: typeof spring;
		onEmailModalClose: () => void;
		componentId: string;
	} = $props();
	
	let flightState = $state('ready');
	
	function handleSendClick() {
		// Apply Personal Connection into the template body in JS-land
		const pc = personalConnectionValue?.trim();
		if (pc && pc.length > 0 && typeof template?.message_body === 'string') {
			template.message_body = template.message_body.replace(
				/\[Personal Connection\]/g,
				pc
			);
		}
		
		// Only show email modal if user is authenticated
		if (user) {
			localShowEmailModal = true;
			actionProgress.set(1);
			coordinated.transition(
				() => {
					onSendMessage?.();
					coordinated.autoClose(
						() => {
							localShowEmailModal = false;
							onEmailModalClose();
							actionProgress.set(0);
						},
						1500,
						componentId
					);
				},
				100,
				componentId
			);
		} else {
			// Save personalization and set pending flag before auth
			if (browser) {
				// Ensure personalization is saved
				if (personalConnectionValue) {
					sessionStorage.setItem(`template_${template.id}_personalization`, JSON.stringify({
						personalConnection: personalConnectionValue,
						timestamp: Date.now()
					}));
				}
				// Set pending send flag
				sessionStorage.setItem(`template_${template.id}_pending_send`, 'true');
			}
			// Let parent handle auth flow
			if (onSendMessage) {
				onSendMessage();
			}
		}
	}
</script>

{#if onSendMessage}
	<div class="mt-4 flex justify-center">
		{#if template.deliveryMethod === 'both'}
			<Button
				variant="certified"
				size="lg"
				testId="contact-congress-button"
				classNames="w-full"
				enableFlight={true}
				bind:flightState
				onclick={handleSendClick}
				text={user ? 'Contact Your Representatives' : 'Sign in to Contact Congress'}
			/>
		{:else}
			<Button
				variant="direct"
				size="lg"
				testId="send-email-button"
				classNames="w-full"
				enableFlight={true}
				bind:flightState
				onclick={handleSendClick}
				text={user ? 'Send This Message' : 'Sign in to Send'}
			/>
		{/if}
	</div>
{/if}