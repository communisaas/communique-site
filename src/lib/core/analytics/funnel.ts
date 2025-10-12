// Funnel Analytics Tracking System
import { analytics } from '$lib/core/analytics/database';

export interface FunnelEvent {
	event: string;
	template_id?: string;
	user_id?: string;
	session_id?: string;
	source?: 'social-link' | 'direct-link' | 'share';
	platform?: 'twitter' | 'facebook' | 'linkedin' | 'other';
	timestamp: number;
	properties?: Record<string, unknown>;
}

export class FunnelAnalytics {
	private events: FunnelEvent[] = [];
	private sessionId: string;

	constructor() {
		this.sessionId = analytics.currentSessionId;

		// Restore any pending events from localStorage
		if (typeof window !== 'undefined') {
			this.restoreEvents();
		}
	}

	private restoreEvents() {
		// Check if localStorage is available (not in SSR or private browsing)
		if (typeof localStorage === 'undefined') {
			return;
		}

		try {
			const stored = localStorage.getItem('communique_funnel_events');
			if (stored) {
				const events = JSON.parse(stored);
				this.events = events.filter(
					(e: FunnelEvent) => Date.now() - e.timestamp < 24 * 60 * 60 * 1000 // Keep events for 24 hours
				);
			}
		} catch {
			// Handle corrupted localStorage data gracefully
			try {
				localStorage.removeItem('communique_funnel_events');
			} catch {
				// Even removeItem might fail in some environments
			}
		}
	}

	private safeStringify(obj: unknown): string {
		const seen = new WeakSet();
		return JSON.stringify(obj, (_key, value) => {
			// Skip DOM elements (only available in browser)
			if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
				return '[HTMLElement]';
			}
			// Skip Window/Document objects
			if (typeof window !== 'undefined' && (value === window || value === document)) {
				return '[Window/Document]';
			}
			// Handle circular references
			if (typeof value === 'object' && value !== null) {
				if (seen.has(value)) {
					return '[Circular]';
				}
				seen.add(value);
			}
			// Skip functions
			if (typeof value === 'function') {
				return '[Function]';
			}
			return value;
		});
	}

	private persistEvents() {
		// Check if localStorage is available (not in SSR or private browsing)
		if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem('communique_funnel_events', this.safeStringify(this.events));
			} catch {
				// Handle localStorage write failures (quota exceeded, private browsing, etc.)
			}
		}
	}

	track(_event: string, properties: Record<string, unknown> = {}) {
		const funnelEvent: FunnelEvent = {
			event: _event,
			session_id: this.sessionId,
			timestamp: Date.now(),
			properties,
			...properties // Allow overrides
		};

		this.events.push(funnelEvent);
		this.persistEvents();

		// Send to analytics service
		this.sendToAnalytics(funnelEvent);
	}

	private async sendToAnalytics(_event: FunnelEvent) {
		try {
			await analytics.trackFunnelEvent(_event);
		} catch {
			// Fallback: Store failed events for retry
			if (typeof window !== 'undefined') {
				const failed = JSON.parse(localStorage.getItem('communique_failed__events') || '[]');
				failed.push(_event);
				localStorage.setItem('communique_failed__events', this.safeStringify(failed));
			}
			console.error('Error occurred');
		}
	}

	// Track funnel progression
	trackTemplateView(
		templateId: string,
		source: 'social-link' | 'direct-link' | 'share' = 'direct-link'
	) {
		this.track('template_viewed', {
			template_id: templateId,
			source,
			step: 'landing'
		});
	}

	trackOnboardingStarted(templateId: string, source: 'social-link' | 'direct-link' | 'share') {
		this.track('onboarding_started', {
			template_id: templateId,
			source,
			step: 'auth_modal'
		});
	}

	trackAuthCompleted(templateId: string, provider: string, userId: string) {
		this.track('auth_completed', {
			template_id: templateId,
			user_id: userId,
			provider,
			step: 'authsuccess'
		});
	}

	trackTemplateUsed(templateId: string, deliveryMethod: string, userId?: string) {
		this.track('template_used', {
			template_id: templateId,
			delivery_method: deliveryMethod,
			user_id: userId,
			step: 'conversion'
		});
	}

	trackSocialShare(templateId: string, platform: string, userId?: string) {
		this.track('template_shared', {
			template_id: templateId,
			platform,
			user_id: userId
		});
	}

	// VOTER Protocol certification tracking
	trackCertificationAttempted(templateId: string, actionType: string, userId?: string) {
		this.track('certification_attempted', {
			template_id: templateId,
			action_type: actionType,
			user_id: userId,
			step: 'certification_start'
		});
	}

	trackCertificationSuccess(
		templateId: string,
		rewardAmount: number,
		userId?: string,
		certificationHash?: string
	) {
		this.track('certificationsuccess', {
			template_id: templateId,
			reward_amount: rewardAmount,
			certification_hash: certificationHash,
			user_id: userId,
			step: 'certification_complete'
		});
	}

	trackRewardEarned(amount: number, actionType: string, userId?: string) {
		this.track('reward_earned', {
			reward_amount: amount,
			action_type: actionType,
			user_id: userId,
			step: 'reward_distribution'
		});
	}

	trackCertificationError(templateId: string, error: string, userId?: string) {
		this.track('certificationerror', {
			template_id: templateId,
			error_message: error,
			user_id: userId,
			step: 'certification_failed'
		});
	}

	// Get funnel metrics for debugging/optimization
	getFunnelMetrics() {
		const metrics = {
			total_events: this.events.length,
			unique_templates: new Set(this.events.map((e: FunnelEvent) => e.template_id).filter(Boolean))
				.size,
			conversion_rate: 0,
			funnel_steps: {
				template_viewed: this.events.filter((e) => e.event === 'template_viewed').length,
				onboarding_started: this.events.filter((e) => e.event === 'onboarding_started').length,
				auth_completed: this.events.filter((e) => e.event === 'auth_completed').length,
				template_used: this.events.filter((e) => e.event === 'template_used').length,
				certification_attempted: this.events.filter((e) => e.event === 'certification_attempted')
					.length,
				certificationsuccess: this.events.filter((e) => e.event === 'certificationsuccess').length,
				reward_earned: this.events.filter((e) => e.event === 'reward_earned').length
			}
		};

		if (metrics.funnel_steps.template_viewed > 0) {
			metrics.conversion_rate =
				metrics.funnel_steps.template_used / metrics.funnel_steps.template_viewed;
		}

		return metrics;
	}

	// Clear events (useful for testing)
	clear() {
		this.events = [];
		if (typeof window !== 'undefined') {
			localStorage.removeItem('communique_funnel__events');
		}
	}
}

// Singleton instance
export const funnelAnalytics = new FunnelAnalytics();
