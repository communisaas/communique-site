<script lang="ts">
	/**
	 * InlineAddressResolver: Contextual address collection within breadcrumb
	 *
	 * PERCEPTUAL ENGINEERING:
	 * - Appears inline at breadcrumb terminal position
	 * - Pre-fills known context (city, state) to minimize input
	 * - Adapts fields based on country requirements
	 * - Maintains causality with consistent timing
	 *
	 * SECURITY:
	 * - Same security measures as AddressConfirmationModal
	 * - Honeypot, timing, behavioral analysis
	 */

	import { onMount, untrack } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { TIMING, type DistrictConfig } from '$lib/core/location/district-config';

	interface Props {
		config: DistrictConfig;
		locality?: string | null; // Pre-fill city
		stateCode?: string | null; // Pre-fill state
		isResolving: boolean;
		error: string | null;
		onsubmit?: (data: {
			street?: string;
			city?: string;
			state?: string;
			postalCode: string;
		}) => void;
		oncancel?: () => void;
	}

	let { config, locality, stateCode, isResolving, error, onsubmit, oncancel }: Props = $props();

	// Form state — snapshot props at init time (one-shot values from parent)
	// untrack() prevents Svelte from warning about stale reactive captures.
	const _locality = untrack(() => locality);
	const _stateCode = untrack(() => stateCode);
	let street = $state('');
	let city = $state(_locality || '');
	let postalCode = $state('');

	// Security: behavioral analysis
	let formStartTime = $state(0);
	let interactionCount = $state(0);

	// Input refs for autofocus
	let streetInputRef: HTMLInputElement | null = $state(null);
	let cityInputRef: HTMLInputElement | null = $state(null);
	let postalInputRef: HTMLInputElement | null = $state(null);

	onMount(() => {
		formStartTime = Date.now();

		// Autofocus the first visible input after mount
		setTimeout(() => {
			if (config.requiresStreetAddress && streetInputRef) {
				streetInputRef.focus();
			} else if (!_locality && cityInputRef) {
				cityInputRef.focus();
			} else if (postalInputRef) {
				postalInputRef.focus();
			}
		}, TIMING.EXPAND);
	});

	// Track interactions for behavioral analysis
	function trackInteraction() {
		interactionCount++;
	}

	// Validate postal code against country pattern
	const isPostalValid = $derived.by(() => {
		if (!postalCode.trim()) return false;
		if (!config.postalPattern) return true;
		return config.postalPattern.test(postalCode.trim());
	});

	// Form validity check
	const isFormValid = $derived.by(() => {
		// Street required only if config says so
		if (config.requiresStreetAddress && !street.trim()) return false;

		// City required if not pre-filled
		if (!_locality && !city.trim()) return false;

		// Postal code always required and must match pattern
		return isPostalValid;
	});

	function handleSubmit(e: Event) {
		e.preventDefault();

		// Security: timing check (humans take >1 second)
		const fillTime = Date.now() - formStartTime;
		if (fillTime < 1000) {
			console.warn('[Security] Form filled too quickly:', fillTime, 'ms');
			return;
		}

		// Security: interaction check
		if (interactionCount < 2) {
			console.warn('[Security] Insufficient interactions:', interactionCount);
			return;
		}

		if (!isFormValid) return;

		onsubmit?.({
			street: config.requiresStreetAddress ? street.trim() : undefined,
			city: _locality || city.trim(),
			state: _stateCode || selectedState || undefined,
			postalCode: postalCode.trim()
		});
	}

	function handleCancel() {
		oncancel?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			handleCancel();
		}
	}

	// US States for dropdown (when state not pre-filled)
	const US_STATES = [
		{ code: 'AL', name: 'Alabama' },
		{ code: 'AK', name: 'Alaska' },
		{ code: 'AZ', name: 'Arizona' },
		{ code: 'AR', name: 'Arkansas' },
		{ code: 'CA', name: 'California' },
		{ code: 'CO', name: 'Colorado' },
		{ code: 'CT', name: 'Connecticut' },
		{ code: 'DE', name: 'Delaware' },
		{ code: 'DC', name: 'Washington DC' },
		{ code: 'FL', name: 'Florida' },
		{ code: 'GA', name: 'Georgia' },
		{ code: 'HI', name: 'Hawaii' },
		{ code: 'ID', name: 'Idaho' },
		{ code: 'IL', name: 'Illinois' },
		{ code: 'IN', name: 'Indiana' },
		{ code: 'IA', name: 'Iowa' },
		{ code: 'KS', name: 'Kansas' },
		{ code: 'KY', name: 'Kentucky' },
		{ code: 'LA', name: 'Louisiana' },
		{ code: 'ME', name: 'Maine' },
		{ code: 'MD', name: 'Maryland' },
		{ code: 'MA', name: 'Massachusetts' },
		{ code: 'MI', name: 'Michigan' },
		{ code: 'MN', name: 'Minnesota' },
		{ code: 'MS', name: 'Mississippi' },
		{ code: 'MO', name: 'Missouri' },
		{ code: 'MT', name: 'Montana' },
		{ code: 'NE', name: 'Nebraska' },
		{ code: 'NV', name: 'Nevada' },
		{ code: 'NH', name: 'New Hampshire' },
		{ code: 'NJ', name: 'New Jersey' },
		{ code: 'NM', name: 'New Mexico' },
		{ code: 'NY', name: 'New York' },
		{ code: 'NC', name: 'North Carolina' },
		{ code: 'ND', name: 'North Dakota' },
		{ code: 'OH', name: 'Ohio' },
		{ code: 'OK', name: 'Oklahoma' },
		{ code: 'OR', name: 'Oregon' },
		{ code: 'PA', name: 'Pennsylvania' },
		{ code: 'RI', name: 'Rhode Island' },
		{ code: 'SC', name: 'South Carolina' },
		{ code: 'SD', name: 'South Dakota' },
		{ code: 'TN', name: 'Tennessee' },
		{ code: 'TX', name: 'Texas' },
		{ code: 'UT', name: 'Utah' },
		{ code: 'VT', name: 'Vermont' },
		{ code: 'VA', name: 'Virginia' },
		{ code: 'WA', name: 'Washington' },
		{ code: 'WV', name: 'West Virginia' },
		{ code: 'WI', name: 'Wisconsin' },
		{ code: 'WY', name: 'Wyoming' }
	];

	let selectedState = $state(_stateCode || 'CA');
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
	class="inline-resolver"
	onsubmit={handleSubmit}
	onkeydown={handleKeydown}
	transition:slide={{ duration: TIMING.EXPAND }}
>
	<!-- Street address (if required by country) -->
	{#if config.requiresStreetAddress}
		<input
			bind:this={streetInputRef}
			type="text"
			bind:value={street}
			oninput={trackInteraction}
			placeholder={config.streetPlaceholder || 'Street address'}
			class="resolver-input street"
			disabled={isResolving}
			autocomplete="street-address"
		/>
	{/if}

	<!-- City (if not pre-filled from context) -->
	{#if !locality}
		<input
			bind:this={cityInputRef}
			type="text"
			bind:value={city}
			oninput={trackInteraction}
			placeholder="City"
			class="resolver-input city"
			disabled={isResolving}
			autocomplete="address-level2"
		/>
	{/if}

	<!-- State selector (US only, if not pre-filled) -->
	{#if config.resolver === 'census-bureau' && !stateCode}
		<select
			bind:value={selectedState}
			onchange={trackInteraction}
			class="resolver-input state"
			disabled={isResolving}
		>
			{#each US_STATES as usState}
				<option value={usState.code}>{usState.code}</option>
			{/each}
		</select>
	{/if}

	<!-- Postal code (always required) -->
	<input
		bind:this={postalInputRef}
		type="text"
		bind:value={postalCode}
		oninput={trackInteraction}
		placeholder={config.postalPlaceholder || 'Postal code'}
		class="resolver-input postal"
		class:invalid={postalCode.trim() && !isPostalValid}
		disabled={isResolving}
		autocomplete="postal-code"
		inputmode={config.resolver === 'census-bureau' ? 'numeric' : 'text'}
	/>

	<!-- Action buttons -->
	<div class="resolver-actions">
		<button
			type="button"
			class="action-btn cancel"
			onclick={handleCancel}
			disabled={isResolving}
			aria-label="Cancel"
		>
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
		<button
			type="submit"
			class="action-btn submit"
			disabled={isResolving || !isFormValid}
			aria-label="Find district"
		>
			{#if isResolving}
				<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					></path>
				</svg>
			{:else}
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			{/if}
		</button>
	</div>

	<!-- Error message -->
	{#if error}
		<p class="resolver-error" transition:fade={{ duration: 150 }}>{error}</p>
	{/if}

	<!-- Privacy hint -->
	<div class="privacy-hint">
		<svg
			class="h-2.5 w-2.5 flex-shrink-0"
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				fill-rule="evenodd"
				d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
				clip-rule="evenodd"
			/>
		</svg>
		<span>Stays in browser</span>
	</div>
</form>

<style>
	.inline-resolver {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		background: var(--color-bg-subtle, #f8fafc);
		border-radius: 8px;
		border: 1px solid var(--color-border-muted, #e2e8f0);
		position: relative;
	}

	.resolver-input {
		padding: 6px 10px;
		border: 1px solid var(--color-border-muted, #e2e8f0);
		border-radius: 6px;
		font-size: 0.8125rem;
		background: white;
		color: var(--color-text-primary, #1e293b);
		transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
	}

	.resolver-input:focus {
		outline: none;
		border-color: var(--color-primary, #3b82f6);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
	}

	.resolver-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.resolver-input.invalid {
		border-color: var(--color-error, #ef4444);
	}

	.resolver-input::placeholder {
		color: var(--color-text-quaternary, #94a3b8);
	}

	/* Field widths optimized for typical content */
	.resolver-input.street {
		width: 180px;
		min-width: 140px;
	}

	.resolver-input.city {
		width: 110px;
		min-width: 90px;
	}

	.resolver-input.state {
		width: 60px;
		padding-right: 4px;
	}

	.resolver-input.postal {
		width: 100px;
		min-width: 80px;
	}

	.resolver-actions {
		display: flex;
		gap: 4px;
		margin-left: 2px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		transition: all 150ms ease-out;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn.cancel {
		background: transparent;
		color: var(--color-text-tertiary, #64748b);
	}

	.action-btn.cancel:hover:not(:disabled) {
		background: var(--color-bg-hover, #f1f5f9);
		color: var(--color-text-secondary, #475569);
	}

	.action-btn.submit {
		background: var(--color-primary, #3b82f6);
		color: white;
	}

	.action-btn.submit:hover:not(:disabled) {
		background: var(--color-primary-hover, #2563eb);
	}

	.action-btn.submit:active:not(:disabled) {
		transform: scale(0.95);
	}

	.resolver-error {
		position: absolute;
		top: 100%;
		left: 8px;
		right: 8px;
		margin-top: 4px;
		padding: 4px 8px;
		font-size: 0.6875rem;
		color: var(--color-error, #ef4444);
		background: var(--color-error-bg, #fef2f2);
		border-radius: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.privacy-hint {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 0.625rem;
		color: var(--color-text-quaternary, #94a3b8);
		margin-left: auto;
		padding-left: 8px;
	}

	/* Responsive: Stack on narrow screens */
	@media (max-width: 640px) {
		.inline-resolver {
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
		}

		.resolver-input {
			width: 100% !important;
		}

		.resolver-actions {
			justify-content: flex-end;
			margin-left: 0;
		}

		.privacy-hint {
			margin-left: 0;
			padding-left: 0;
			justify-content: center;
		}
	}
</style>
