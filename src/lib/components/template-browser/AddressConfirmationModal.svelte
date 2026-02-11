<script lang="ts">
	/**
	 * AddressConfirmationModal: Get user's address for accurate district lookup
	 *
	 * UX PHILOSOPHY:
	 * - Like Airbnb/DoorDash: just ask for the address upfront
	 * - Privacy-first: address never stored, only used for district lookup
	 * - Fast and frictionless: 4 fields, clear validation, instant results
	 *
	 * SECURITY:
	 * - ThumbmarkJS device fingerprinting (rate limiting)
	 * - Cloudflare Turnstile CAPTCHA (bot protection)
	 * - Honeypot field (catches auto-fill bots)
	 * - Behavioral analysis (timing, mouse movement)
	 */

	import { createEventDispatcher, onMount } from 'svelte';
	// Note: Turnstile CAPTCHA uses native Cloudflare script, not React
	// Dynamic import for browser-only library (avoid SSR issues)
	// import { getThumbmark } from '@thumbmarkjs/thumbmarkjs';

	interface AddressConfirmationProps {
		isOpen?: boolean;
	}

	let { isOpen = false }: AddressConfirmationProps = $props();

	interface VerifiedAddress {
		street: string;
		city: string;
		state: string;
		zipCode: string;
		congressional_district: string;
		county_name?: string;
	}

	const dispatch = createEventDispatcher<{
		close: void;
		confirm: VerifiedAddress;
	}>();

	// Form state
	let street = $state('');
	let city = $state('');
	let stateCode = $state('CA'); // Default to California
	let zipCode = $state('');
	let isSubmitting = $state(false);
	let error: string | null = $state(null);

	// Security: Device fingerprinting
	let deviceFingerprint: string | null = $state(null);

	// Security: CAPTCHA
	let turnstileToken: string | null = $state(null);
	let showCaptcha = $state(false); // Only show if needed

	// Security: Honeypot (invisible field that bots auto-fill)
	let honeypot = $state('');

	// Security: Behavioral analysis
	let formStartTime = $state(0);
	let mouseMovements: { x: number; y: number; timestamp: number }[] = $state([]);

	// Generate device fingerprint on mount
	onMount(async () => {
		try {
			// Dynamic import to avoid SSR issues with browser-only library
			const { getThumbmark } = await import('@thumbmarkjs/thumbmarkjs');
			const fingerprint = await getThumbmark();
			// getThumbmark() returns an object, convert to string
			deviceFingerprint =
				typeof fingerprint === 'string' ? fingerprint : JSON.stringify(fingerprint);
		} catch (err) {
			console.error('[Security] Failed to generate fingerprint:', err);
		}

		// Track form start time (behavioral analysis)
		formStartTime = Date.now();
	});

	// Track mouse movements (behavioral analysis)
	function handleMouseMove(e: MouseEvent) {
		if (mouseMovements.length < 20) {
			// Limit to 20 samples
			mouseMovements = [
				...mouseMovements,
				{
					x: e.clientX,
					y: e.clientY,
					timestamp: Date.now()
				}
			];
		}
	}

	// US States for dropdown
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

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = null;

		// ========================================================================
		// Security: Multi-layer validation
		// ========================================================================

		// 1. Honeypot check (bots auto-fill invisible fields)
		if (honeypot.trim() !== '') {
			console.warn('[Security] Honeypot triggered - bot detected');
			error = 'Invalid request. Please try again.';
			return;
		}

		// 2. Timing check (humans take >2 seconds to fill form)
		const formFillTime = Date.now() - formStartTime;
		if (formFillTime < 2000) {
			console.warn('[Security] Form filled too quickly:', formFillTime, 'ms');
			error = 'Please slow down and try again.';
			return;
		}

		// 3. Mouse movement check (bots don't move mouse naturally)
		if (mouseMovements.length < 3) {
			console.warn('[Security] Insufficient mouse movement data');
			// Don't block, just show CAPTCHA
			showCaptcha = true;
		}

		// 4. CAPTCHA check (if shown due to suspicious behavior)
		if (showCaptcha && !turnstileToken) {
			error = 'Please complete the verification';
			return;
		}

		// Client-side validation
		if (!street.trim() || !city.trim() || !stateCode || !zipCode.trim()) {
			error = 'Please fill in all fields';
			return;
		}

		if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
			error = 'Please enter a valid ZIP code (e.g., 94102)';
			return;
		}

		isSubmitting = true;

		try {
			// Call Census geocoding API (server-side to avoid CORS)
			// Include security metadata for rate limiting
			const response = await fetch('/api/location/geocode', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Form-Start': formStartTime.toString(),
					'X-Mouse-Movements': mouseMovements.length.toString()
				},
				body: JSON.stringify({
					street,
					city,
					state: stateCode,
					zipCode,
					// Security metadata
					fingerprint: deviceFingerprint,
					turnstile_token: turnstileToken,
					mouse_movements: mouseMovements.length, // Count only, not full data
					form_fill_time: formFillTime
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to verify address');
			}

			const verified = (await response.json()) as VerifiedAddress;

			// Dispatch success event
			dispatch('confirm', verified);

			// Reset form
			street = '';
			city = '';
			stateCode = 'CA';
			zipCode = '';
			honeypot = '';
			mouseMovements = [];
			turnstileToken = null;
			showCaptcha = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to verify address';
		} finally {
			isSubmitting = false;
		}
	}

	function handleClose() {
		dispatch('close');
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="button"
		tabindex="0"
	>
		<div
			class="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			onmousemove={handleMouseMove}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="mb-4 flex items-start justify-between">
				<div>
					<h2 class="text-lg font-semibold tracking-tight text-slate-900">Enter your address</h2>
					<p class="mt-1 text-sm text-slate-600">Unlock local coordination opportunities</p>
				</div>
				<button
					onclick={handleClose}
					class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
					aria-label="Close"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Privacy Note (moved here - first thing users see) -->
			<div class="mb-5 flex items-start gap-2 rounded-lg bg-blue-50 px-3.5 py-2.5">
				<svg
					class="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						fill-rule="evenodd"
						d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="text-xs leading-relaxed text-blue-900">
					<span class="font-semibold">Stored in browser</span>, not on our servers.<br />
					Census Bureau finds your congressional district.
				</p>
			</div>

			<!-- Form -->
			<form onsubmit={handleSubmit} class="space-y-4">
				<!-- Honeypot (invisible field to catch bots) -->
				<input
					type="text"
					name="website"
					bind:value={honeypot}
					class="pointer-events-none absolute opacity-0"
					tabindex="-1"
					autocomplete="off"
					aria-hidden="true"
				/>

				<!-- Street Address -->
				<div>
					<label for="street" class="mb-1.5 block text-sm font-medium text-slate-700">
						Street address
					</label>
					<input
						id="street"
						type="text"
						bind:value={street}
						placeholder="1600 Pennsylvania Avenue NW"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
						disabled={isSubmitting}
					/>
				</div>

				<!-- City -->
				<div>
					<label for="city" class="mb-1.5 block text-sm font-medium text-slate-700"> City </label>
					<input
						id="city"
						type="text"
						bind:value={city}
						placeholder="Washington"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
						disabled={isSubmitting}
					/>
				</div>

				<!-- State & ZIP (2-column grid) -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="state" class="mb-1.5 block text-sm font-medium text-slate-700">
							State
						</label>
						<select
							id="state"
							bind:value={stateCode}
							class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							disabled={isSubmitting}
						>
							{#each US_STATES as usState}
								<option value={usState.code}>{usState.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="zipCode" class="mb-1.5 block text-sm font-medium text-slate-700">
							ZIP code
						</label>
						<input
							id="zipCode"
							type="text"
							bind:value={zipCode}
							placeholder="20500"
							maxlength="10"
							class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							disabled={isSubmitting}
						/>
					</div>
				</div>

				<!-- Error Message -->
				{#if error}
					<div class="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
						{error}
					</div>
				{/if}

				<!-- Cloudflare Turnstile CAPTCHA (shown if suspicious behavior detected) -->
				{#if showCaptcha}
					<div class="rounded-lg border border-slate-200 p-4">
						<p class="mb-3 text-xs text-slate-600">Please verify you're human:</p>
						<!-- TODO: Replace with native Cloudflare Turnstile script integration -->
						<div
							class="cf-turnstile"
							data-sitekey={import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
							data-callback="onTurnstileCallback"
							data-theme="light"
						></div>
						<p class="mt-2 text-xs text-slate-500">
							CAPTCHA verification pending native integration
						</p>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={handleClose}
						class="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100"
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<span class="inline-flex items-center gap-2">
								<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								Finding district...
							</span>
						{:else}
							Find my district
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
