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
				variant="primary"
				testId="contact-congress-button"
				classNames="bg-green-600 hover:bg-green-700 focus:ring-green-600/50 w-full"
				onclick={handleSendClick}
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 2.676-.732 5.162-2.217 7.162-4.416.43-.462.753-.96.938-1.49z"
					/>
				</svg>
				{user ? 'Contact Your Representatives' : 'Sign in to Contact Congress'}
			</Button>
		{:else}
			<Button
				variant="primary"
				testId="send-email-button"
				classNames="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600/50 w-full"
				onclick={handleSendClick}
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
					/>
				</svg>
				{user ? 'Send This Message' : 'Sign in to Send'}
			</Button>
		{/if}
	</div>
{/if}