// Funnel Analytics Tracking System
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
		this.sessionId = this.generateSessionId();
		
		// Restore any pending events from localStorage
		if (typeof window !== 'undefined') {
			this.restoreEvents();
		}
	}

	private generateSessionId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
	}

	private restoreEvents() {
		const stored = localStorage.getItem('communique_funnel_events');
		if (stored) {
			try {
				const events = JSON.parse(stored);
				this.events = events.filter((e: FunnelEvent) => 
					Date.now() - e.timestamp < 24 * 60 * 60 * 1000 // Keep events for 24 hours
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

		// Send to analytics service (implement your preferred service)
		this.sendToAnalytics(funnelEvent);

	}

	private async sendToAnalytics(event: FunnelEvent) {
		const { analyticsApi } = await import('$lib/utils/apiClient');
		const result = await analyticsApi.track('funnel_event', event);
		
		if (!result.success) {
			// Store failed events for retry
			if (typeof window !== 'undefined') {
				const failed = JSON.parse(localStorage.getItem('communique_failed_events') || '[]');
				failed.push(event);
				localStorage.setItem('communique_failed_events', JSON.stringify(failed));
			}
		}
	}

	// Track funnel progression
	trackTemplateView(templateId: string, source: string = 'direct-link') {
		this.track('template_viewed', {
			template_id: templateId,
			source,
			step: 'landing'
		});
	}

	trackOnboardingStarted(templateId: string, source: string) {
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

	// Get funnel metrics for debugging/optimization
	getFunnelMetrics() {
		const metrics = {
			total_events: this.events.length,
			unique_templates: new Set(this.events.map(e => e.template_id).filter(Boolean)).size,
			conversion_rate: 0,
			funnel_steps: {
				template_viewed: this.events.filter(e => e.event === 'template_viewed').length,
				onboarding_started: this.events.filter(e => e.event === 'onboarding_started').length,
				auth_completed: this.events.filter(e => e.event === 'auth_completed').length,
				template_used: this.events.filter(e => e.event === 'template_used').length
			}
		};

		if (metrics.funnel_steps.template_viewed > 0) {
			metrics.conversion_rate = metrics.funnel_steps.template_used / metrics.funnel_steps.template_viewed;
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