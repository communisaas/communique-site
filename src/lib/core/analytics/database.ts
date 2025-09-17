/**
 * Database-First Analytics System
 *
 * Custom analytics implementation using our existing Supabase/Prisma infrastructure.
 * Replaces third-party analytics with privacy-first, civic engagement focused tracking.
 */

import { browser } from '$app/environment';
import type { FunnelEvent } from './funnel';

// Analytics event types
export type AnalyticsEventType = 'funnel' | 'interaction' | 'navigation' | 'performance' | 'error';

export interface AnalyticsEvent {
	session_id: string;
	user_id?: string;
	name: string;
	funnel_id?: string;
	campaign_id?: string;
	variation_id?: string;
	properties?: Record<string, unknown>;
}

export interface SessionData {
	session_id: string;
	user_id?: string;
	fingerprint?: string;
	ip_address?: string;
	user_agent?: string;
	referrer?: string;
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	landing_page?: string;
}

class DatabaseAnalytics {
	private sessionId: string;
	private sessionData: SessionData;
	private eventQueue: AnalyticsEvent[] = [];
	private flushInterval: number | null = null;
	private initialized = false;

	constructor() {
		this.sessionId = this.generateSessionId();
		this.sessionData = { session_id: this.sessionId };

		if (browser) {
			this.initializeSession();
		}
	}

	private generateSessionId(): string {
		return `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
	}

	private async initializeSession() {
		if (!browser || this.initialized) return;

		try {
			// Gather session data
			this.sessionData = {
				session_id: this.sessionId,
				user_agent: navigator.userAgent,
				referrer: document.referrer || undefined,
				landing_page: window.location.href,
				...this.parseUTMParams()
			};

			// Start periodic event flushing
			this.startEventFlushing();
			this.initialized = true;

			// Track initial session start
			await this.trackEvent({
				session_id: this.sessionId,
				name: 'session_start',
				properties: {
					timestamp: Date.now(),
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight
					}
				}
			});
		} catch (_error) {
			console.error('Failed to initialize analytics session:', _error);
		}
	}

	private parseUTMParams() {
		const params = new URLSearchParams(window.location.search);
		return {
			utm_source: params.get('utm_source') || undefined,
			utm_medium: params.get('utm_medium') || undefined,
			utm_campaign: params.get('utm_campaign') || undefined
		};
	}

	private startEventFlushing() {
		// Flush events every 10 seconds
		this.flushInterval = setInterval(() => {
			this.flushEvents();
		}, 10000) as unknown as number;

		// Flush on page unload
		window.addEventListener('beforeunload', () => {
			this.flushEvents(true);
		});

		// Flush when tab becomes hidden
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') {
				this.flushEvents();
			}
		});
	}

	async trackEvent(event: AnalyticsEvent): Promise<void> {
		if (!browser || !this.initialized) {
			return;
		}

		const fullEvent: AnalyticsEvent = {
			...event,
			session_id: this.sessionId
		};

		// Add to queue for batching
		this.eventQueue.push(fullEvent);

		// If queue is getting large, flush immediately
		if (this.eventQueue.length >= 10) {
			await this.flushEvents();
		}
	}

	private safeStringify(obj: unknown): string {
		const seen = new WeakSet();
		return JSON.stringify(obj, (key, value) => {
			// Skip DOM elements
			if (value instanceof HTMLElement) {
				return '[HTMLElement]';
			}
			// Skip Window/Document objects
			if (value === window || value === document) {
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

	async flushEvents(sync = false): Promise<void> {
		if (!this.eventQueue.length || !browser) {
			return;
		}

		const events = [...this.eventQueue];
		this.eventQueue = [];

		try {
			const response = await fetch('/api/analytics/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: this.safeStringify({
					session_data: this.sessionData,
					events: events
				}),
				...(sync && { keepalive: true })
			});

			if (!response.ok) {
				// Put events back in queue for retry
				this.eventQueue.unshift(...events);
				console.warn('Failed to flush analytics events:', response.status);
			}
		} catch (_error) {
			// Put events back in queue for retry
			this.eventQueue.unshift(...events);
			console.error('Failed to flush analytics events:', _error);
		}
	}

	async identifyUser(userId: string, userProperties: Record<string, unknown> = {}): Promise<void> {
		this.sessionData.user_id = userId;

		await this.trackEvent({
			session_id: this.sessionId,
			user_id: userId,
			name: 'user_identified',
			properties: {
				...userProperties,
				identification_time: Date.now()
			}
		});
	}

	// Funnel tracking methods (compatible with existing system)
	async trackFunnelEvent(event: FunnelEvent): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			user_id: event.user_id,
			name: event.event,
			properties: {
				source: event.source,
				platform: event.platform,
				...event.properties
			}
		});
	}

	async trackTemplateView(
		templateId: string,
		source: 'social-link' | 'direct-link' | 'share' = 'direct-link'
	): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			name: 'template_viewed',
			properties: {
				template_id: templateId,
				source,
				step: 'landing'
			}
		});
	}

	async trackOnboardingStarted(
		templateId: string,
		source: 'social-link' | 'direct-link' | 'share'
	): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			name: 'onboarding_started',
			properties: {
				template_id: templateId,
				source,
				step: 'auth_modal'
			}
		});
	}

	async trackAuthCompleted(templateId: string, provider: string, userId: string): Promise<void> {
		await this.identifyUser(userId, { auth_provider: provider });

		await this.trackEvent({
			session_id: this.sessionId,
			user_id: userId,
			name: 'auth_completed',
			properties: {
				template_id: templateId,
				provider,
				step: 'auth_success'
			}
		});
	}

	async trackTemplateUsed(
		templateId: string,
		deliveryMethod: string,
		userId?: string
	): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			user_id: userId,
			name: 'template_used',
			properties: {
				template_id: templateId,
				delivery_method: deliveryMethod,
				step: 'conversion'
			}
		});
	}

	async trackSocialShare(templateId: string, platform: string, userId?: string): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			user_id: userId,
			name: 'template_shared',
			properties: {
				template_id: templateId,
				platform
			}
		});
	}

	async trackPageView(url?: string): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			name: 'page_view',
			properties: {
				url: url || window.location.href,
				timestamp: Date.now()
			}
		});
	}

	async trackInteraction(
		element: string,
		action: string,
		properties: Record<string, unknown> = {}
	): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			name: `${element}_${action}`,
			properties: {
				element,
				action,
				...properties
			}
		});
	}

	async trackError(error: Error, context: Record<string, unknown> = {}): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			name: 'javascript_error',
			properties: {
				error_message: error.message,
				error_stack: error.stack,
				error_name: error.name,
				...context
			}
		});
	}

	destroy(): void {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}

		// Final flush
		this.flushEvents(true);
	}

	get isReady(): boolean {
		return browser && this.initialized;
	}

	get currentSessionId(): string {
		return this.sessionId;
	}
}

// Export singleton instance
export const analytics = new DatabaseAnalytics();

// Auto-cleanup on page unload
if (browser) {
	window.addEventListener('beforeunload', () => {
		analytics.destroy();
	});
}
