/**
 * Analytics API Integration Tests - Consolidated Schema (8→3 Models)
 * 
 * Tests the consolidated analytics system with:
 * - analytics_event (unified with JSONB properties)
 * - analytics_session (enhanced with UTM tracking)
 * - analytics_experiment (campaigns/funnels/experiments)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeEventProperties, safeComputedMetrics } from '../helpers/json-test-helpers';
import { POST, GET } from '../../src/routes/api/analytics/events/+server';
import { createMockRequestEvent } from '../helpers/request-event';
import type { AnalyticsEvent, AnalyticsSession, AnalyticsExperiment } from '../../src/lib/types/analytics';

// Mock database for consolidated analytics schema
const mockDb = vi.hoisted(() => ({
	analytics_session: {
		upsert: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		update: vi.fn()
	},
	analytics_event: {
		createMany: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn(),
		findUnique: vi.fn()
	},
	analytics_experiment: {
		create: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn()
	},
	user: {
		findUnique: vi.fn()
	},
	template: {
		findMany: vi.fn(),
		findUnique: vi.fn()
	}
}));

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

describe('Analytics API Integration Tests - Consolidated Schema', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		
		// Default successful mocks
		mockDb.user.findUnique.mockResolvedValue({ id: 'user-123' });
		mockDb.template.findMany.mockResolvedValue([{ id: 'template-456' }]);
		mockDb.analytics_session.upsert.mockResolvedValue({
			session_id: 'sess_123_abc',
			user_id: 'user-123',
			created_at: new Date(),
			updated_at: new Date(),
			utm_source: 'google',
			utm_medium: 'cpc',
			utm_campaign: 'voting-2024',
			device_data: { ip_address: '192.168.1.1', user_agent: 'test-agent' },
			session_metrics: { events_count: 0, page_views: 0, conversion_count: 0 },
			funnel_progress: {}
		});
		mockDb.analytics_event.createMany.mockResolvedValue({ count: 1 });
	});

	describe('POST /api/analytics/events - Unified Event Storage', () => {
		it('should store events in consolidated analytics_event table with JSONB properties', async () => {
			const eventBatch = {
				session_data: {
					session_id: 'sess_123_abc',
					user_id: 'user-123',
					utm_source: 'google',
					utm_medium: 'cpc',
					utm_campaign: 'voting-2024',
					landing_page: '/',
					referrer: 'https://google.com',
					fingerprint: 'fp_abc123',
					user_agent: 'Mozilla/5.0...',
					ip_address: '192.168.1.1'
				},
				events: [
					{
						session_id: 'sess_123_abc',
						name: 'page_view',
						user_id: 'user-123',
						template_id: 'template-456',
						timestamp: new Date().toISOString(),
						properties: {
							page_url: '/templates/voting-reform',
							page_title: 'Voting Reform Template',
							category: 'voting',
							source: 'homepage'
						}
					},
					{
						session_id: 'sess_123_abc',
						name: 'template_viewed',
						user_id: 'user-123',
						template_id: 'template-456',
						properties: {
							template_title: 'Contact Your Rep About Voting Reform',
							view_duration: 45000,
							scroll_depth: 0.8,
							interaction_count: 3
						}
					}
				]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			const response = await POST({ request, getClientAddress: () => '192.168.1.1' } as any);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toEqual({
				success: true,
				events_processed: 2,
				session_id: 'sess_123_abc'
			});

			// Verify session upsert with enhanced data
			expect(mockDb.analytics_session.upsert).toHaveBeenCalledWith({
				where: { session_id: 'sess_123_abc' },
				create: expect.objectContaining({
					session_id: 'sess_123_abc',
					user_id: 'user-123',
					utm_source: 'google',
					utm_medium: 'cpc',
					utm_campaign: 'voting-2024',
					landing_page: '/',
					referrer: 'https://google.com',
					device_data: {
						ip_address: '192.168.1.1',
						user_agent: 'Mozilla/5.0...',
						fingerprint: 'fp_abc123'
					},
					session_metrics: {
						events_count: 2,
						page_views: 1,
						conversion_count: 0
					},
					funnel_progress: {}
				}),
				update: expect.any(Object)
			});

			// Verify events stored with JSONB properties
			expect(mockDb.analytics_event.createMany).toHaveBeenCalledWith({
				data: [
					{
						session_id: 'sess_123_abc',
						user_id: 'user-123',
						timestamp: expect.any(Date),
						name: 'page_view',
						event_type: 'pageview',
						template_id: 'template-456',
						funnel_step: null,
						experiment_id: null,
						properties: {
							page_url: '/templates/voting-reform',
							page_title: 'Voting Reform Template',
							category: 'voting',
							source: 'homepage'
						},
						computed_metrics: {}
					},
					{
						session_id: 'sess_123_abc',
						user_id: 'user-123',
						timestamp: expect.any(Date),
						name: 'template_viewed',
						event_type: 'pageview',
						template_id: 'template-456',
						funnel_step: null,
						experiment_id: null,
						properties: {
							template_title: 'Contact Your Rep About Voting Reform',
							view_duration: 45000,
							scroll_depth: 0.8,
							interaction_count: 3
						},
						computed_metrics: {}
					}
				],
				skipDuplicates: true
			});
		});

		it('should properly categorize event types for consolidated schema', async () => {
			const eventBatch = {
				session_data: { session_id: 'sess_123_abc' },
				events: [
					{ name: 'page_view', properties: {} },
					{ name: 'template_viewed', properties: {} },
					{ name: 'button_click', properties: {} },
					{ name: 'template_used', properties: {} },
					{ name: 'auth_completed', properties: {} },
					{ name: 'conversion', properties: {} },
					{ name: 'custom_event', funnel_id: 'funnel-123', properties: {} },
					{ name: 'campaign_event', campaign_id: 'camp-456', properties: {} }
				]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			await POST({ request, getClientAddress: () => '192.168.1.1' } as any);

			const createdEvents = mockDb.analytics_event.createMany.mock.calls[0][0].data;
			
			expect(createdEvents[0].event_type).toBe('pageview');     // page_view
			expect(createdEvents[1].event_type).toBe('pageview');     // template_viewed
			expect(createdEvents[2].event_type).toBe('interaction');  // button_click
			expect(createdEvents[3].event_type).toBe('conversion');   // template_used
			expect(createdEvents[4].event_type).toBe('conversion');   // auth_completed
			expect(createdEvents[5].event_type).toBe('conversion');   // conversion
			expect(createdEvents[6].event_type).toBe('funnel');       // has funnel_id
			expect(createdEvents[7].event_type).toBe('campaign');     // has campaign_id
		});

		it('should handle complex JSONB properties without data loss', async () => {
			const complexProperties = {
				nested_object: {
					user_preferences: {
						theme: 'dark',
						notifications: true,
						categories: ['voting', 'environment']
					},
					interaction_data: {
						mouse_movements: [{ x: 100, y: 200, timestamp: 1640995200000 }],
						scroll_events: [{ position: 0.5, timestamp: 1640995201000 }]
					}
				},
				array_data: ['item1', 'item2', { complex: true }],
				metrics: {
					performance: { loadTime: 1.2, renderTime: 0.8 },
					engagement: { timeOnPage: 45000, bounced: false }
				},
				unicode_text: 'Testing émojis 🚀 and special chars åæø',
				null_value: null,
				undefined_value: undefined
			};

			const eventBatch = {
				session_data: { session_id: 'sess_123_abc' },
				events: [{
					name: 'complex_interaction',
					properties: complexProperties
				}]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			const response = await POST({ request, getClientAddress: () => '192.168.1.1' } as any);
			expect(response.status).toBe(200);

			const storedEvent = mockDb.analytics_event.createMany.mock.calls[0][0].data[0];
			
			// Verify complex JSONB properties are preserved
			expect(safeEventProperties(storedEvent).nested_object.user_preferences.categories).toEqual(['voting', 'environment']);
			expect(safeEventProperties(storedEvent).array_data).toEqual(['item1', 'item2', { complex: true }]);
			expect(safeEventProperties(storedEvent).metrics.performance.loadTime).toBe(1.2);
			expect(safeEventProperties(storedEvent).unicode_text).toBe('Testing émojis 🚀 and special chars åæø');
			expect(safeEventProperties(storedEvent).null_value).toBeNull();
			expect(storedEvent.properties).not.toHaveProperty('undefined_value');
		});

		it('should validate user and template IDs before storing', async () => {
			// Mock invalid user and template
			mockDb.user.findUnique.mockResolvedValue(null);
			mockDb.template.findMany.mockResolvedValue([]);

			const eventBatch = {
				session_data: {
					session_id: 'sess_123_abc',
					user_id: 'invalid-user'
				},
				events: [{
					name: 'test_event',
					user_id: 'invalid-user',
					template_id: 'invalid-template',
					properties: {}
				}]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			await POST({ request, getClientAddress: () => '192.168.1.1' } as any);

			const storedEvent = mockDb.analytics_event.createMany.mock.calls[0][0].data[0];
			
			// Should null invalid IDs
			expect(storedEvent.user_id).toBeNull();
			expect(storedEvent.template_id).toBeNull();
		});

		it('should handle circular references and problematic objects safely', async () => {
			// Create objects that would cause JSON.stringify to fail
			const circularObj: any = { name: 'circular' };
			circularObj.self = circularObj;

			const eventBatch = {
				session_data: { session_id: 'sess_123_abc' },
				events: [{
					name: 'problematic_event',
					properties: {
						circular: circularObj,
						func: () => 'function',
						htmlElement: typeof HTMLElement !== 'undefined' ? {} : '[HTMLElement]',
						bigint: BigInt(123),
						symbol: Symbol('test')
					}
				}]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			const response = await POST({ request, getClientAddress: () => '192.168.1.1' } as any);
			expect(response.status).toBe(200);

			const storedEvent = mockDb.analytics_event.createMany.mock.calls[0][0].data[0];
			
			// Should handle problematic values gracefully
			expect(safeEventProperties(storedEvent).circular).toBe('[Circular]');
			expect(safeEventProperties(storedEvent).func).toBe('[Function]');
			expect(safeEventProperties(storedEvent).htmlElement).toBe('[HTMLElement]');
		});
	});

	describe('GET /api/analytics/events - Session Data Retrieval', () => {
		it('should retrieve session with analytics events from consolidated schema', async () => {
			const mockSession: AnalyticsSession = {
				session_id: 'sess_123_abc',
				user_id: 'user-123',
				created_at: new Date(),
				updated_at: new Date(),
				utm_source: 'google',
				utm_medium: 'cpc',
				utm_campaign: 'voting-2024',
				landing_page: '/',
				referrer: 'https://google.com',
				device_data: {
					ip_address: '192.168.1.1',
					user_agent: 'Mozilla/5.0',
					fingerprint: 'fp_abc123'
				},
				session_metrics: {
					events_count: 5,
					page_views: 3,
					conversion_count: 1
				},
				funnel_progress: {
					'voting-funnel': {
						current_step: 2,
						completed_steps: [1, 2],
						last_step_timestamp: new Date().toISOString()
					}
				}
			};

			const mockEvents: AnalyticsEvent[] = [
				{
					id: 'evt_1',
					session_id: 'sess_123_abc',
					user_id: 'user-123',
					timestamp: new Date(),
					name: 'page_view',
					event_type: 'pageview',
					template_id: 'template-456',
					funnel_step: undefined,
					experiment_id: undefined,
					properties: { page_url: '/', page_title: 'Home' },
					computed_metrics: { engagement_score: 0.8 },
					created_at: new Date()
				}
			];

			mockDb.analytics_session.findUnique.mockResolvedValue(mockSession);
			mockDb.analytics_event.findMany.mockResolvedValue(mockEvents);

			const request = new Request('http://localhost/api/analytics/events?session_id=sess_123_abc', {
				method: 'GET'
			});

			const response = await GET({ request, url: new URL('http://localhost/api/analytics/events?session_id=sess_123_abc') } as any);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toEqual({
				success: true,
				session: {
					...mockSession,
					device_data: mockSession.device_data,
					session_metrics: mockSession.session_metrics,
					funnel_progress: mockSession.funnel_progress
				},
				analytics_events: [{
					...mockEvents[0],
					properties: mockEvents[0].properties,
					computed_metrics: mockEvents[0].computed_metrics
				}],
				events_count: 1
			});
		});

		it('should return 404 for non-existent sessions', async () => {
			mockDb.analytics_session.findUnique.mockResolvedValue(null);

			const request = new Request('http://localhost/api/analytics/events?session_id=nonexistent', {
				method: 'GET'
			});

			const response = await GET({ request, url: new URL('http://localhost/api/analytics/events?session_id=nonexistent') } as any);
			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toEqual({
				success: false,
				error: 'Session not found'
			});
		});
	});

	describe('Error Handling', () => {
		it('should handle database errors gracefully', async () => {
			mockDb.analytics_session.upsert.mockRejectedValue(new Error('Database connection failed'));

			const eventBatch = {
				session_data: { session_id: 'sess_123_abc' },
				events: [{ name: 'test_event', properties: {} }]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			const response = await POST({ request, getClientAddress: () => '192.168.1.1' } as any);
			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data).toEqual({
				success: false,
				error: 'Failed to process analytics events'
			});
		});

		it('should validate request format', async () => {
			const invalidRequests = [
				{}, // Missing session_data and events
				{ session_data: {} }, // Missing events
				{ events: [] }, // Missing session_data
				{ session_data: { session_id: 'test' }, events: 'not-array' } // Events not array
			];

			for (const invalidRequest of invalidRequests) {
				const { request } = createMockRequestEvent({
					method: 'POST',
					url: '/api/analytics/events',
					body: invalidRequest
				});

				const response = await POST({ request, getClientAddress: () => '192.168.1.1' } as any);
				expect(response.status).toBe(400);

				const data = await response.json();
				expect(data.success).toBe(false);
				expect(data.error).toBe('Invalid request format');
			}
		});
	});
});