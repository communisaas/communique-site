<script lang="ts">
	/**
	 * ModalRegistry - Central registry for all application modals
	 *
	 * All modals are declared here once and controlled via modalActions API.
	 * Routes call modalActions.openModal(id, type, data) to trigger modals.
	 */
	import UnifiedModal from '$lib/components/ui/UnifiedModal.svelte';
	import { OnboardingContent, SignInContent } from '$lib/components/auth/parts';
	import AddressRequirementModal from '$lib/components/auth/AddressRequirementModal.svelte';
	import TemplateModal from '$lib/components/template/TemplateModal.svelte';
	import { ProgressiveFormContent } from '$lib/components/template/parts';
	import AddressCollectionForm from '$lib/components/onboarding/AddressCollectionForm.svelte';
	// import UnifiedAddressCollectionWrapper from '$lib/components/modals/UnifiedAddressCollectionWrapper.svelte';
	import { modalActions } from '$lib/stores/modalSystem.svelte';
</script>

<!-- Onboarding Modal -->
<UnifiedModal
	id="onboarding-modal"
	type="onboarding"
	size="md"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<OnboardingContent
				template={data.template as any}
				source={(data.source || 'direct-link') as any}
				onauth={(provider) => (window.location.href = `/auth/${provider}`)}
				onclose={() => modalActions.closeModal('onboarding-modal')}
			/>
		{/if}
	{/snippet}
</UnifiedModal>

<!-- Sign In Modal (Generic) -->
<UnifiedModal
	id="sign-in-modal"
	type="sign-in"
	size="md"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		<SignInContent onauth={(provider: string) => (window.location.href = `/auth/${provider}`)} onclose={() => modalActions.closeModal('sign-in-modal')} />
	{/snippet}
</UnifiedModal>

<!-- Address Modal (for Congressional templates) -->
<UnifiedModal
	id="address-modal"
	type="address"
	size="sm"
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{@const _ = console.log('[ModalRegistry] Snippet rendered with data:', data)}
		<div class="overflow-hidden rounded-xl bg-white">
			<AddressCollectionForm
				_template={(data?.template as any) || {}}
				oncomplete={(detail) => {
					console.log('[ModalRegistry] AddressCollectionForm completed with:', detail);
					// Handle address collection completion
					if (data?.onComplete) {
						console.log('[ModalRegistry] Calling data.onComplete...');
						(data.onComplete as any)(detail);
					} else {
						console.warn('[ModalRegistry] No data.onComplete handler registered!');
					}
					modalActions.closeModal('address-modal');
				}}
			/>
		</div>
	{/snippet}
</UnifiedModal>

<!-- Template Modal -->
<UnifiedModal
	id="template-modal"
	type="template_modal"
	size="lg"
	showCloseButton={false}
	closeOnBackdrop={false}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<TemplateModal
				template={data.template as any}
				user={(data.user as any) || null}
				on:close={() => modalActions.closeModal('template-modal')}
				on:used={() => {
					// Template used - keep modal open for post-send flow
				}}
			/>
		{/if}
	{/snippet}
</UnifiedModal>

<!-- Progressive Form Modal (for email templates with auth) -->
<UnifiedModal
	id="progressive-form-modal"
	type="template_modal"
	size="md"
	showCloseButton={true}
	closeOnBackdrop={true}
	closeOnEscape={true}
>
	{#snippet children(data)}
		{#if data?.template}
			<ProgressiveFormContent
				template={data.template as any}
				user={(data.user as any) || null}
				_onclose={() => modalActions.closeModal('progressive-form-modal')}
				onsend={(sendData) => {
					if (data.onSend) {
						(data.onSend as any)(sendData);
					}
					modalActions.closeModal('progressive-form-modal');
				}}
			/>
		{/if}
	{/snippet}
</UnifiedModal>
