<!--
	CredentialExpiryNudge.svelte

	Surfaces credential expiry as temporal awareness, not alarm.

	Perceptual engineering: a gentle tide coming in, not a siren going off.
	The user should feel time passing in their verification state — the urgency
	gradient maps to oklch hue/chroma, shifting from cool muted tones toward
	warm saturated tones as expiry approaches.

	Urgency mapping (oklch):
	  7+ days  — cool blue-gray  (hue 250, chroma 0.03, lightness 0.55)
	  3-6 days — warm amber       (hue 80,  chroma 0.12, lightness 0.55)
	  1-2 days — orange           (hue 50,  chroma 0.18, lightness 0.50)
	  0 days   — red, gate blocks (hue 20,  chroma 0.20, lightness 0.48)

	NEVER shows for identity secrets — only for district_residency, tree state,
	and action-gated credentials.

	Renders as a fixed banner below the 48px header. Dismissible per browser
	session (sessionStorage). Re-appears on next session or when urgency changes.

	Design system: oklch colors, Satoshi headings, Berkeley Mono data, Lucide icons.
-->

<script lang="ts">
	import { Clock, X, ArrowRight, ShieldAlert } from '@lucide/svelte';
	import {
		type CredentialAction,
		ACTION_DESCRIPTIONS,
		CREDENTIAL_TTL_DISPLAY,
		getDaysUntilExpiry,
		getNextExpiringAction,
		shouldPromptReverification,
		type SessionCredentialForPolicy
	} from '$lib/core/identity/credential-policy';

	// ── Props ─────────────────────────────────────────────────────────────────

	interface Props {
		/** Session credential for expiry checks. Null = no nudge shown. */
		credential: SessionCredentialForPolicy | null;
		/** Callback to start reverification flow. */
		onReverify?: () => void;
	}

	let {
		credential,
		onReverify
	}: Props = $props();

	// ── Urgency derivation ───────────────────────────────────────────────────

	interface UrgencyLevel {
		key: 'low' | 'medium' | 'high' | 'critical';
		hue: number;
		chroma: number;
		lightness: number;
		borderChroma: number;
	}

	const URGENCY_LEVELS: Record<string, UrgencyLevel> = {
		low:      { key: 'low',      hue: 250, chroma: 0.03, lightness: 0.55, borderChroma: 0.04 },
		medium:   { key: 'medium',   hue: 80,  chroma: 0.12, lightness: 0.55, borderChroma: 0.14 },
		high:     { key: 'high',     hue: 50,  chroma: 0.18, lightness: 0.50, borderChroma: 0.20 },
		critical: { key: 'critical', hue: 20,  chroma: 0.20, lightness: 0.48, borderChroma: 0.22 }
	};

	function deriveUrgency(days: number): UrgencyLevel {
		if (days <= 0) return URGENCY_LEVELS.critical;
		if (days <= 2) return URGENCY_LEVELS.high;
		if (days <= 6) return URGENCY_LEVELS.medium;
		return URGENCY_LEVELS.low;
	}

	// ── Dismiss state (per session) ──────────────────────────────────────────

	const DISMISS_KEY = 'tti-expiry-nudge-dismissed';

	let dismissed: boolean = $state(false);

	// Hydrate from sessionStorage on mount
	$effect(() => {
		if (typeof sessionStorage !== 'undefined') {
			const stored = sessionStorage.getItem(DISMISS_KEY);
			if (stored) {
				// Re-show if urgency has escalated since dismissal
				const dismissedAtDays = parseInt(stored, 10);
				if (!isNaN(dismissedAtDays) && daysLeft !== null && daysLeft < dismissedAtDays) {
					dismissed = false;
					sessionStorage.removeItem(DISMISS_KEY);
				} else {
					dismissed = true;
				}
			}
		}
	});

	function dismiss() {
		dismissed = true;
		if (typeof sessionStorage !== 'undefined' && daysLeft !== null) {
			sessionStorage.setItem(DISMISS_KEY, String(daysLeft));
		}
	}

	// ── Derived display state ────────────────────────────────────────────────
	// NOTE: nextAction must be computed first — shouldShow depends on it
	// to pass the specific action to shouldPromptReverification().
	// Without this, the general 30-day threshold fires simultaneously
	// with official_petition's 30-day TTL (zero advance warning).

	const nextAction = $derived(
		credential ? getNextExpiringAction(credential) : null
	);

	const shouldShow = $derived(
		credential !== null && nextAction !== null &&
		shouldPromptReverification(credential, nextAction)
	);

	const daysLeft = $derived(
		credential && nextAction ? getDaysUntilExpiry(credential, nextAction) : null
	);

	const urgency = $derived(
		daysLeft !== null ? deriveUrgency(daysLeft) : URGENCY_LEVELS.low
	);

	const actionLabel = $derived(
		nextAction ? ACTION_DESCRIPTIONS[nextAction] : null
	);

	const ttlLabel = $derived(
		nextAction ? CREDENTIAL_TTL_DISPLAY[nextAction] : null
	);

	// CSS custom properties for urgency-driven coloring
	const accentColor = $derived(
		`oklch(${urgency.lightness} ${urgency.chroma} ${urgency.hue})`
	);
	const bgColor = $derived(
		`oklch(${urgency.lightness + 0.42} ${urgency.chroma * 0.3} ${urgency.hue} / 0.85)`
	);
	const borderColor = $derived(
		`oklch(${urgency.lightness + 0.25} ${urgency.borderChroma} ${urgency.hue} / 0.5)`
	);
	const textColor = $derived(
		`oklch(${urgency.lightness - 0.08} ${urgency.chroma * 0.9} ${urgency.hue})`
	);

	const isGateBlocked = $derived(daysLeft !== null && daysLeft <= 0);

	const messageText = $derived.by(() => {
		if (!actionLabel) return '';
		if (isGateBlocked) {
			return `Your credential for ${actionLabel} has expired. Reverify to continue.`;
		}
		if (daysLeft === 1) {
			return `Your ability to access ${actionLabel} expires tomorrow.`;
		}
		return `Your ability to access ${actionLabel} expires in ${daysLeft} days.`;
	});
</script>

{#if shouldShow && !dismissed && nextAction && daysLeft !== null}
	<div
		class="cen"
		class:cen--critical={isGateBlocked}
		style="--cen-accent: {accentColor}; --cen-bg: {bgColor}; --cen-border: {borderColor}; --cen-text: {textColor};"
		role={isGateBlocked ? 'alert' : 'status'}
		aria-live={isGateBlocked ? 'assertive' : 'polite'}
		aria-label={messageText}
	>
		<div class="cen__inner">
			<!-- Icon -->
			<div class="cen__icon-wrap">
				{#if isGateBlocked}
					<ShieldAlert class="cen__icon" />
				{:else}
					<Clock class="cen__icon" />
				{/if}
			</div>

			<!-- Message -->
			<div class="cen__content">
				<p class="cen__message">{messageText}</p>
				{#if ttlLabel && !isGateBlocked}
					<p class="cen__detail">
						Requires verification within {ttlLabel}.
					</p>
				{/if}
			</div>

			<!-- CTA -->
			{#if onReverify}
				<button
					type="button"
					class="cen__cta"
					onclick={() => { dismiss(); onReverify?.(); }}
					aria-label={actionLabel ? `Reverify your ${actionLabel} credential` : 'Reverify your credential'}
				>
					Reverify
					<ArrowRight class="cen__cta-arrow" />
				</button>
			{/if}

			<!-- Dismiss (only when not gate-blocked — blocked state is persistent) -->
			{#if !isGateBlocked}
				<button
					type="button"
					class="cen__dismiss"
					onclick={dismiss}
					aria-label="Dismiss notification"
				>
					<X class="cen__dismiss-icon" />
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* ── Banner container ───────────────────────────────────────────────────── */

	.cen {
		position: fixed;
		top: 48px;
		left: 0;
		right: 0;
		z-index: 80;
		background: var(--cen-bg);
		border-bottom: 1px solid var(--cen-border);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: cen-slide-in 250ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.cen--critical {
		background: oklch(0.95 0.04 20 / 0.92);
		border-bottom-color: oklch(0.75 0.18 20 / 0.5);
	}

	@keyframes cen-slide-in {
		from {
			opacity: 0;
			transform: translateY(-100%);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ── Inner layout ──────────────────────────────────────────────────────── */

	.cen__inner {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 80rem;
		margin: 0 auto;
		padding: 8px 16px;
	}

	@media (min-width: 640px) {
		.cen__inner {
			padding: 8px 24px;
		}
	}

	/* ── Icon ───────────────────────────────────────────────────────────────── */

	.cen__icon-wrap {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.cen__icon) {
		width: 16px;
		height: 16px;
		color: var(--cen-accent);
	}

	/* ── Content ────────────────────────────────────────────────────────────── */

	.cen__content {
		flex: 1;
		min-width: 0;
	}

	.cen__message {
		margin: 0;
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--cen-text);
		line-height: 1.4;
	}

	.cen__detail {
		margin: 0;
		font-family: 'Berkeley Mono', 'Cascadia Code', ui-monospace, monospace;
		font-size: 0.6875rem;
		color: oklch(0.55 0.02 250);
		letter-spacing: 0.02em;
		line-height: 1.4;
	}

	/* ── CTA button ─────────────────────────────────────────────────────────── */

	.cen__cta {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 10px 16px;
		min-height: 44px;
		border-radius: 8px;
		border: 1px solid var(--cen-border);
		background: oklch(1 0 0 / 0.7);
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--cen-accent);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 120ms ease-out,
			border-color 120ms ease-out,
			box-shadow 120ms ease-out;
	}

	.cen__cta:hover {
		background: oklch(1 0 0 / 0.95);
		border-color: var(--cen-accent);
		box-shadow: 0 2px 8px oklch(0 0 0 / 0.08);
	}

	.cen__cta:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px oklch(0.6 0.15 270 / 0.5);
	}

	.cen__cta:active {
		transform: scale(0.98);
	}

	:global(.cen__cta-arrow) {
		width: 12px;
		height: 12px;
	}

	/* ── Dismiss button ─────────────────────────────────────────────────────── */

	.cen__dismiss {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		margin: -10px -10px -10px 0;
		border-radius: 6px;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: background 100ms ease-out;
	}

	.cen__dismiss:hover {
		background: oklch(0 0 0 / 0.06);
	}

	.cen__dismiss:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px oklch(0.6 0.15 270 / 0.5);
	}

	:global(.cen__dismiss-icon) {
		width: 14px;
		height: 14px;
		color: oklch(0.5 0.02 250);
	}

	/* ── Reduced motion ─────────────────────────────────────────────────────── */

	@media (prefers-reduced-motion: reduce) {
		.cen {
			animation: none;
		}

		.cen__cta,
		.cen__dismiss {
			transition: none;
		}
	}
</style>
