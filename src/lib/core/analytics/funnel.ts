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
	properties?: Record<string, any>;
}

class FunnelAnalytics {
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
		const stored = localStorage.getItem('communique_funnel_events');
		if (stored) {
			try {
				const events = JSON.parse(stored);
				this.events = events.filter(
					(e: FunnelEvent) => Date.now() - e.timestamp < 24 * 60 * 60 * 1000 // Keep events for 24 hours
				);
			} catch {
				localStorage.removeItem('communique_funnel_events');
			}
		}
	}

	private persistEvents() {
		if (typeof window !== 'undefined') {
			localStorage.setItem('communique_funnel_events', JSON.stringify(this.events));
		}
	}

	track(event: string, properties: Record<string, any> = {}) {
		const funnelEvent: FunnelEvent = {
			event,
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

	private async sendToAnalytics(event: FunnelEvent) {
		try {
			await analytics.trackFunnelEvent(event);
		} catch (error) {
			// Fallback: Store failed events for retry
			if (typeof window !== 'undefined') {
				const failed = JSON.parse(localStorage.getItem('communique_failed_events') || '[]');
				failed.push(event);
				localStorage.setItem('communique_failed_events', JSON.stringify(failed));
			}
			console.error('Failed to send analytics event:', error);
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
			step: 'auth_success'
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
		this.track('certification_success', {
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
		this.track('certification_error', {
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
			unique_templates: new Set(this.events.map((e) => e.template_id).filter(Boolean)).size,
			conversion_rate: 0,
			funnel_steps: {
				template_viewed: this.events.filter((e) => e.event === 'template_viewed').length,
				onboarding_started: this.events.filter((e) => e.event === 'onboarding_started').length,
				auth_completed: this.events.filter((e) => e.event === 'auth_completed').length,
				template_used: this.events.filter((e) => e.event === 'template_used').length,
				certification_attempted: this.events.filter((e) => e.event === 'certification_attempted')
					.length,
				certification_success: this.events.filter((e) => e.event === 'certification_success')
					.length,
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
			localStorage.removeItem('communique_funnel_events');
		}
	}
}

// Singleton instance
export const funnelAnalytics = new FunnelAnalytics();
