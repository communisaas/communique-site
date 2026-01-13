/**
 * Analytics Client
 *
 * Browser-side analytics with:
 * - Single public method: increment()
 * - Batched fire-and-forget sending
 * - Local differential privacy
 *
 * No sessions. No user tracking. No device fingerprinting.
 */

import { browser } from '$app/environment';
import {
	PRIVACY,
	METRICS,
	type Metric,
	type Dimensions,
	type DeliveryMethod,
	type Increment,
	isMetric
} from '$lib/types/analytics';
import { sanitizeDimensions, categorizeError } from './sanitize';
import { applyLocalDP } from './noise';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEBOUNCE_MS = 500;
const ENDPOINT = '/api/analytics/increment';

// =============================================================================
// CONTRIBUTION TRACKER
// =============================================================================

/**
 * Track per-metric daily contributions in localStorage
 * Prevents client from exceeding MAX_DAILY_CONTRIBUTIONS
 */
class ContributionTracker {
	private readonly storageKey = 'analytics_contributions';
	private readonly maxDaily: number;

	constructor(maxDaily: number = PRIVACY.MAX_DAILY_CONTRIBUTIONS) {
		this.maxDaily = maxDaily;
	}

	canContribute(metric: Metric): boolean {
		const today = this.getTodayKey();
		const contributions = this.getContributions();
		const key = `${today}:${metric}`;
		return (contributions[key] ?? 0) < this.maxDaily;
	}

	recordContribution(metric: Metric): void {
		const today = this.getTodayKey();
		const contributions = this.getContributions();
		const key = `${today}:${metric}`;
		contributions[key] = (contributions[key] ?? 0) + 1;
		// Prune old dates while saving
		this.saveContributions(this.pruneOldDates(contributions, today));
	}

	private getTodayKey(): string {
		// Use UTC to match server bucketing
		return new Date().toISOString().split('T')[0];
	}

	private getContributions(): Record<string, number> {
		try {
			const stored = localStorage.getItem(this.storageKey);
			return stored ? JSON.parse(stored) : {};
		} catch {
			return {};
		}
	}

	private saveContributions(contributions: Record<string, number>): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(contributions));
		} catch {
			// localStorage unavailable - fail open
		}
	}

	private pruneOldDates(
		contributions: Record<string, number>,
		today: string
	): Record<string, number> {
		return Object.fromEntries(Object.entries(contributions).filter(([k]) => k.startsWith(today)));
	}
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

class AnalyticsClient {
	private queue: Increment[] = [];
	private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	private readonly ldpEnabled: boolean;
	private readonly contributionTracker: ContributionTracker;

	constructor() {
		// LDP state is IMMUTABLE after construction
		// Only disable via build-time environment variable
		// In production builds, VITE_ANALYTICS_LDP_ENABLED is always 'true' or undefined
		this.ldpEnabled = import.meta.env.VITE_ANALYTICS_LDP_ENABLED !== 'false';

		// Initialize contribution tracker
		this.contributionTracker = new ContributionTracker();

		if (!this.ldpEnabled && import.meta.env.PROD) {
			console.error('[Analytics] CRITICAL: LDP disabled in production build!');
		}

		if (browser) {
			// Flush on page visibility change
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'hidden') {
					this.flush();
				}
			});

			// Flush on page unload
			window.addEventListener('beforeunload', () => {
				this.flush();
			});
		}
	}

	/**
	 * Increment a metric counter
	 *
	 * This is the ONLY public method for recording analytics.
	 */
	increment(metric: Metric, dimensions?: Dimensions): void {
		if (!browser) return;

		// Validate metric
		if (!isMetric(metric)) {
			return; // Silently drop invalid metrics
		}

		// Check contribution limit
		if (!this.contributionTracker.canContribute(metric)) {
			return; // Silently drop - limit exceeded
		}

		// Record contribution
		this.contributionTracker.recordContribution(metric);

		// Sanitize dimensions
		const sanitized = sanitizeDimensions(dimensions);

		// Create increment
		const increment: Increment = {
			metric,
			dimensions: sanitized
		};

		// Apply local differential privacy
		const maybeNoisy = applyLocalDP(increment, this.ldpEnabled);

		// LDP might return null (randomized non-report)
		if (maybeNoisy) {
			this.queue.push(maybeNoisy);
		}

		// Flush if batch size reached
		if (this.queue.length >= PRIVACY.MAX_BATCH_SIZE) {
			this.flush();
			return;
		}

		// Schedule debounced flush
		this.scheduleDebouncedFlush();
	}

	/**
	 * Flush queued increments to server
	 */
	flush(): void {
		if (!browser || this.queue.length === 0) return;

		// Clear debounce
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
			this.debounceTimeout = null;
		}

		// Take current queue
		const batch = [...this.queue];
		this.queue = [];

		// Fire and forget — no retry, no error handling
		this.send(batch);
	}

	private scheduleDebouncedFlush(): void {
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
		}

		this.debounceTimeout = setTimeout(() => {
			this.flush();
		}, DEBOUNCE_MS);
	}

	private send(increments: Increment[]): void {
		// Fire and forget
		fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ increments }),
			keepalive: true // Survive page unload
		}).catch(() => {
			// Silently ignore failures — privacy > completeness
		});
	}
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const analytics = new AnalyticsClient();

// =============================================================================
// CONVENIENCE METHODS
// =============================================================================

/**
 * Track template view
 */
export function trackTemplateView(templateId: string, jurisdiction?: string): void {
	analytics.increment(METRICS.template_view, {
		template_id: templateId,
		jurisdiction
	});
}

/**
 * Track template use (conversion)
 */
export function trackTemplateUse(templateId: string, deliveryMethod: DeliveryMethod): void {
	analytics.increment(METRICS.template_use, {
		template_id: templateId,
		delivery_method: deliveryMethod
	});
}

/**
 * Track template share
 */
export function trackTemplateShare(templateId: string, utmSource?: string): void {
	analytics.increment(METRICS.template_share, {
		template_id: templateId,
		utm_source: utmSource
	});
}

/**
 * Track delivery attempt
 */
export function trackDeliveryAttempt(templateId: string, deliveryMethod: DeliveryMethod): void {
	analytics.increment(METRICS.delivery_attempt, {
		template_id: templateId,
		delivery_method: deliveryMethod
	});
}

/**
 * Track delivery success
 */
export function trackDeliverySuccess(templateId: string, deliveryMethod: DeliveryMethod): void {
	analytics.increment(METRICS.delivery_success, {
		template_id: templateId,
		delivery_method: deliveryMethod
	});
}

/**
 * Track delivery failure
 */
export function trackDeliveryFailure(templateId: string, deliveryMethod: DeliveryMethod): void {
	analytics.increment(METRICS.delivery_fail, {
		template_id: templateId,
		delivery_method: deliveryMethod
	});
}

/**
 * Track error (categorized)
 */
export function trackError(error: string | Error): void {
	const errorType = categorizeError(error);
	analytics.increment(errorType as Metric);
}

/**
 * Track auth start
 */
export function trackAuthStart(): void {
	analytics.increment(METRICS.auth_start);
}

/**
 * Track auth complete
 */
export function trackAuthComplete(): void {
	analytics.increment(METRICS.auth_complete);
}

/**
 * Track funnel step
 */
export function trackFunnelStep(step: 1 | 2 | 3 | 4 | 5, templateId?: string): void {
	const metric = `funnel_${step}` as Metric;
	analytics.increment(metric, { template_id: templateId });
}
