/**
 * Database-First Analytics System
 * 
 * Custom analytics implementation using our existing Supabase/Prisma infrastructure.
 * Replaces third-party analytics with privacy-first, civic engagement focused tracking.
 */

import { browser } from '$app/environment';
import type { FunnelEvent } from '$lib/analytics/funnel';

// Analytics event types
export type AnalyticsEventType = 'funnel' | 'interaction' | 'navigation' | 'performance' | 'error';

export interface AnalyticsEvent {
	session_id: string;
	user_id?: string;
	template_id?: string;
	event_type: AnalyticsEventType;
	event_name: string;
	event_properties?: Record<string, any>;
	page_url?: string;
	referrer?: string;
	timestamp?: Date;
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
				event_type: 'navigation',
				event_name: 'session_start',
				page_url: window.location.href,
				event_properties: {
					timestamp: Date.now(),
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight
					}
				}
			});

		} catch (error) {
			console.error('Failed to initialize analytics session:', error);
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
			session_id: this.sessionId,
			page_url: event.page_url || window.location.href,
			referrer: event.referrer || document.referrer || undefined,
			timestamp: event.timestamp || new Date()
		};

		// Add to queue for batching
		this.eventQueue.push(fullEvent);

		// If queue is getting large, flush immediately
		if (this.eventQueue.length >= 10) {
			await this.flushEvents();
		}
	}

	async flushEvents(sync = false): Promise<void> {
		if (!this.eventQueue.length || !browser) {
			return;
		}

		const events = [...this.eventQueue];
		this.eventQueue = [];

		try {
			// Handle circular references in event properties
			const safeEvents = events.map(event => ({
				...event,
				event_properties: event.event_properties ? this.safeStringify(event.event_properties) : undefined
			}));

			const response = await fetch('/api/analytics/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					session_data: this.sessionData,
					events: safeEvents
				}),
				...(sync && { keepalive: true })
			});

			if (!response.ok) {
				// Put events back in queue for retry
				this.eventQueue.unshift(...events);
				console.warn('Failed to flush analytics events:', response.status);
			}

		} catch (error) {
			// Put events back in queue for retry
			this.eventQueue.unshift(...events);
			console.error('Failed to flush analytics events:', error);
		}
	}

	async identifyUser(userId: string, userProperties: Record<string, any> = {}): Promise<void> {
		this.sessionData.user_id = userId;

		await this.trackEvent({
			session_id: this.sessionId,
			user_id: userId,
			event_type: 'funnel',
			event_name: 'user_identified',
			event_properties: {
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
			template_id: event.template_id,
			event_type: 'funnel',
			event_name: event.event,
			event_properties: {
				source: event.source,
				platform: event.platform,
				...event.properties
			}
		});
	}

	async trackTemplateView(templateId: string, source: 'social-link' | 'direct-link' | 'share' = 'direct-link'): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			template_id: templateId,
			event_type: 'funnel',
			event_name: 'template_viewed',
			event_properties: {
				source,
				step: 'landing'
			}
		});
	}

	async trackOnboardingStarted(templateId: string, source: 'social-link' | 'direct-link' | 'share'): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			template_id: templateId,
			event_type: 'funnel',
			event_name: 'onboarding_started',
			event_properties: {
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
			template_id: templateId,
			event_type: 'funnel',
			event_name: 'auth_completed',
			event_properties: {
				provider,
				step: 'auth_success'
			}
		});
	}

	async trackTemplateUsed(templateId: string, deliveryMethod: string, userId?: string): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			user_id: userId,
			template_id: templateId,
			event_type: 'funnel',
			event_name: 'template_used',
			event_properties: {
				delivery_method: deliveryMethod,
				step: 'conversion'
			}
		});
	}

	async trackSocialShare(templateId: string, platform: string, userId?: string): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			user_id: userId,
			template_id: templateId,
			event_type: 'interaction',
			event_name: 'template_shared',
			event_properties: {
				platform
			}
		});
	}

	async trackPageView(url?: string): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			event_type: 'navigation',
			event_name: 'page_view',
			page_url: url || window.location.href,
			event_properties: {
				timestamp: Date.now()
			}
		});
	}

	async trackInteraction(element: string, action: string, properties: Record<string, any> = {}): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			event_type: 'interaction',
			event_name: `${element}_${action}`,
			event_properties: {
				element,
				action,
				...properties
			}
		});
	}

	async trackError(error: Error, context: Record<string, any> = {}): Promise<void> {
		await this.trackEvent({
			session_id: this.sessionId,
			event_type: 'error',
			event_name: 'javascript_error',
			event_properties: {
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

	/**
	 * Safe JSON stringify that handles circular references
	 */
	private safeStringify(obj: any): any {
		try {
			return JSON.parse(JSON.stringify(obj));
		} catch (error) {
			// Handle circular references
			const seen = new WeakSet();
			return JSON.parse(JSON.stringify(obj, (key, value) => {
				if (typeof value === 'object' && value !== null) {
					if (seen.has(value)) {
						return '[Circular Reference]';
					}
					seen.add(value);
				}
				return value;
			}));
		}
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