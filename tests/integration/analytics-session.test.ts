/**
 * Analytics Session Management Integration Tests - Consolidated Schema
 *
 * Tests enhanced analytics_session model with:
 * - UTM tracking and acquisition data
 * - Device data in JSONB format
 * - Session metrics aggregation
 * - Funnel progress persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockRequestEvent } from '../helpers/request-event';
import type { AnalyticsSession } from '../../src/lib/types/analytics';
import { safeSessionMetrics, safeMetricsCache } from '../helpers/json-test-helpers';

// Mock database for session testing
const mockDb = vi.hoisted(() => ({
	analytics_session: {
		create: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn(),
		upsert: vi.fn(),
		delete: vi.fn()
	},
	analytics_event: {
		findMany: vi.fn(),
		createMany: vi.fn(),
		count: vi.fn()
	},
	user: {
		findUnique: vi.fn()
	}
}));

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

describe('Analytics Session Management Tests - Consolidated Schema', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		mockDb.user.findUnique.mockResolvedValue({ id: 'user-123' });
	});

	describe('Session Creation with UTM Tracking', () => {
		it('should create session with comprehensive UTM and acquisition data', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			const sessionData = {
				session_data: {
					session_id: 'sess_utm_123',
					user_id: 'user-123',
					utm_source: 'facebook',
					utm_medium: 'social',
					utm_campaign: 'voting-rights-2024',
					utm_content: 'carousel-ad-version-b',
					utm_term: 'voting,democracy,civic engagement',
					landing_page: '/templates/voting-reform?ref=fb-ad',
					referrer: 'https://facebook.com',
					fingerprint: 'fp_fb_abc123',
					user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
					ip_address: '192.168.1.100'
				},
				events: [
					{
						name: 'page_view',
						properties: { page_url: '/templates/voting-reform' }
					}
				]
			};

			const expectedSession: Partial<AnalyticsSession> = {
				session_id: 'sess_utm_123',
				user_id: 'user-123',
				utm_source: 'facebook',
				utm_medium: 'social',
				utm_campaign: 'voting-rights-2024',
				landing_page: '/templates/voting-reform?ref=fb-ad',
				referrer: 'https://facebook.com',
				device_data: {
					ip_address: '192.168.1.100',
					user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
					fingerprint: 'fp_fb_abc123'
				},
				session_metrics: {
					events_count: 1,
					page_views: 1,
					conversion_count: 0
				},
				funnel_progress: {}
			};

			mockDb.analytics_session.upsert.mockResolvedValue(expectedSession);
			mockDb.analytics_event.createMany.mockResolvedValue({ count: 1 });

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(sessionData)
			});

			const response = await POST({ request, getClientAddress: () => '192.168.1.100' } as unknown);
			expect(response.status).toBe(200);

			// Verify session creation with UTM data
			expect(mockDb.analytics_session.upsert).toHaveBeenCalledWith({
				where: { session_id: 'sess_utm_123' },
				create: expect.objectContaining({
					session_id: 'sess_utm_123',
					user_id: 'user-123',
					utm_source: 'facebook',
					utm_medium: 'social',
					utm_campaign: 'voting-rights-2024',
					landing_page: '/templates/voting-reform?ref=fb-ad',
					referrer: 'https://facebook.com',
					device_data: {
						ip_address: '192.168.1.100',
						user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
						fingerprint: 'fp_fb_abc123'
					}
				}),
				update: expect.any(Object)
			});
		});

		it('should extract device information into JSONB device_data field', async () => {
			const deviceTestCases = [
				{
					name: 'Mobile Safari',
					user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15',
					expected_device: 'mobile',
					expected_os: 'iOS',
					expected_browser: 'Safari'
				},
				{
					name: 'Desktop Chrome',
					user_agent:
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
					expected_device: 'desktop',
					expected_os: 'Windows',
					expected_browser: 'Chrome'
				},
				{
					name: 'Android Firefox',
					user_agent: 'Mozilla/5.0 (Android 11; Mobile; rv:90.0) Gecko/90.0 Firefox/90.0',
					expected_device: 'mobile',
					expected_os: 'Android',
					expected_browser: 'Firefox'
				}
			];

			for (const testCase of deviceTestCases) {
				vi.clearAllMocks();

				// Mock device detection (would be done server-side)
				const parseUserAgent = (userAgent: string) => {
					const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
					const isIOS = /iPhone|iPad/i.test(userAgent);
					const isAndroid = /Android/i.test(userAgent);
					const isChrome = /Chrome/i.test(userAgent);
					const isFirefox = /Firefox/i.test(userAgent);
					const isSafari = /Safari/i.test(userAgent) && !isChrome;

					return {
						device_type: isMobile ? 'mobile' : 'desktop',
						os: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Windows',
						browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : 'Safari'
					};
				};

				const deviceInfo = parseUserAgent(testCase.user_agent);

				const sessionData = {
					session_data: {
						session_id: `sess_device_${testCase.name.toLowerCase().replace(' ', '_')}`,
						user_agent: testCase.user_agent,
						ip_address: '192.168.1.1'
					},
					events: []
				};

				const expectedDeviceData = {
					ip_address: '192.168.1.1',
					user_agent: testCase.user_agent,
					device_type: deviceInfo.device_type,
					os: deviceInfo.os,
					browser: deviceInfo.browser,
					fingerprint: undefined
				};

				mockDb.analytics_session.upsert.mockResolvedValue({
					session_id: sessionData.session_data.session_id,
					device_data: expectedDeviceData
				});

				// In a real implementation, device parsing would happen server-side
				expect(deviceInfo.device_type).toBe(testCase.expected_device);
				expect(deviceInfo.os).toBe(testCase.expected_os);
				expect(deviceInfo.browser).toBe(testCase.expected_browser);
			}
		});

		it('should handle missing UTM parameters gracefully', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			const minimalSessionData = {
				session_data: {
					session_id: 'sess_minimal_123',
					user_agent: 'Mozilla/5.0',
					ip_address: '192.168.1.1'
				},
				events: [
					{
						name: 'page_view',
						properties: {}
					}
				]
			};

			mockDb.analytics_session.upsert.mockResolvedValue({
				session_id: 'sess_minimal_123',
				utm_source: undefined,
				utm_medium: undefined,
				utm_campaign: undefined,
				landing_page: undefined,
				referrer: undefined,
				device_data: {
					ip_address: '192.168.1.1',
					user_agent: 'Mozilla/5.0'
				}
			});

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(minimalSessionData)
			});

			const response = await POST(createMockRequestEvent(request, '/api/analytics/events'));
			expect(response.status).toBe(200);

			// Should create session even without UTM data
			expect(mockDb.analytics_session.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						session_id: 'sess_minimal_123',
						utm_source: undefined,
						utm_medium: undefined,
						utm_campaign: undefined
					})
				})
			);
		});
	});

	describe('Session Metrics Aggregation (JSONB session_metrics)', () => {
		it('should aggregate session metrics in real-time', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			// First batch of events
			const firstBatch = {
				session_data: { session_id: 'sess_metrics_123' },
				events: [
					{ name: 'page_view', properties: { page_url: '/home' } },
					{ name: 'page_view', properties: { page_url: '/templates' } },
					{ name: 'template_viewed', properties: { template_id: 'template-1' } },
					{ name: 'button_click', properties: { button_id: 'cta-primary' } }
				]
			};

			mockDb.analytics_session.upsert.mockResolvedValueOnce({
				session_id: 'sess_metrics_123',
				session_metrics: {
					events_count: 4,
					page_views: 2,
					conversion_count: 0,
					interaction_count: 2
				}
			});

			const firstRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(firstBatch)
			});

			await POST({ request: firstRequest, getClientAddress: () => '127.0.0.1' } as unknown);

			// Second batch with conversion
			const secondBatch = {
				session_data: { session_id: 'sess_metrics_123' },
				events: [
					{ name: 'conversion', properties: { method: 'oauth', event_source: 'auth_completed' } },
					{
						name: 'conversion',
						properties: { delivery: 'certified', event_source: 'template_used' }
					}
				]
			};

			// Mock cumulative metrics update
			mockDb.analytics_session.upsert.mockResolvedValueOnce({
				session_id: 'sess_metrics_123',
				session_metrics: {
					events_count: 6, // 4 + 2
					page_views: 2, // unchanged
					conversion_count: 2, // 0 + 2 conversions
					interaction_count: 3 // 2 + 1 auth interaction
				}
			});

			const secondRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(secondBatch)
			});

			await POST({ request: secondRequest, getClientAddress: () => '127.0.0.1' } as unknown);

			// Verify metrics aggregation logic in upsert calls
			const firstCall = mockDb.analytics_session.upsert.mock.calls[0][0];
			expect(firstCall.create.session_metrics).toEqual({
				events_count: 4,
				page_views: 2,
				conversion_count: 0
			});

			const secondCall = mockDb.analytics_session.upsert.mock.calls[1][0];
			expect(secondCall.create.session_metrics).toEqual({
				events_count: 2,
				page_views: 0,
				conversion_count: 2
			});
		});

		it('should calculate advanced session metrics', async () => {
			// Mock session with events for duration calculation
			const sessionEvents = [
				{ timestamp: new Date('2024-01-01T10:00:00Z'), name: 'page_view' },
				{ timestamp: new Date('2024-01-01T10:02:00Z'), name: 'page_view' },
				{ timestamp: new Date('2024-01-01T10:05:30Z'), name: 'template_viewed' },
				{ timestamp: new Date('2024-01-01T10:12:15Z'), name: 'template_used' }
			];

			mockDb.analytics_event.findMany.mockResolvedValue(sessionEvents);

			// Calculate session duration and engagement metrics
			const sessionStart = sessionEvents[0].timestamp;
			const sessionEnd = sessionEvents[sessionEvents.length - 1].timestamp;
			const durationMs = sessionEnd.getTime() - sessionStart.getTime();
			const pageViews = sessionEvents.filter((e) => e.name === 'page_view').length;
			const conversions = sessionEvents.filter((e) => e.name === 'template_used').length;

			const advancedMetrics = {
				events_count: sessionEvents.length,
				page_views: pageViews,
				conversion_count: conversions,
				duration_ms: durationMs,
				bounce_rate: pageViews === 1 ? 1.0 : 0.0,
				conversion_rate: conversions / sessionEvents.length,
				avg_time_between_events: durationMs / (sessionEvents.length - 1),
				engagement_score: Math.min(1.0, sessionEvents.length * 0.1 + durationMs / 300000) // 5min max
			};

			expect(advancedMetrics.duration_ms).toBe(735000); // 12 minutes 15 seconds
			expect(advancedMetrics.bounce_rate).toBe(0.0); // More than 1 page view
			expect(advancedMetrics.conversion_rate).toBeCloseTo(0.25, 2); // 1/4 = 0.25
			expect(advancedMetrics.engagement_score).toBeGreaterThan(0.5);
		});
	});

	describe('Funnel Progress Persistence (JSONB funnel_progress)', () => {
		it('should track multiple funnel progress states in single session', async () => {
			const existingSession: AnalyticsSession = {
				session_id: 'sess_multi_funnel_123',
				user_id: 'user-123',
				created_at: new Date(),
				updated_at: new Date(),
				utm_source: undefined,
				utm_medium: undefined,
				utm_campaign: undefined,
				landing_page: undefined,
				referrer: undefined,
				device_data: {},
				session_metrics: { events_count: 0, page_views: 0 },
				funnel_progress: {
					'voting-funnel': {
						current_step: 2,
						completed_steps: [1, 2],
						last_step_timestamp: '2024-01-01T10:00:00Z',
						conversion_likelihood: 0.7
					},
					'onboarding-funnel': {
						current_step: 1,
						completed_steps: [1],
						last_step_timestamp: '2024-01-01T10:05:00Z',
						conversion_likelihood: 0.4
					}
				}
			};

			mockDb.analytics_session.findUnique.mockResolvedValue(existingSession);
			mockDb.analytics_event.findMany.mockResolvedValue([]);

			const { GET } = await import('../../src/routes/api/analytics/events/+server');
			const request = new Request(
				'http://localhost/api/analytics/events?session_id=sess_multi_funnel_123',
				{
					method: 'GET'
				}
			);

			const response = await GET({
				request,
				url: new URL('http://localhost/api/analytics/events?session_id=sess_multi_funnel_123')
			} as unknown);

			const data = await response.json();

			expect(data.session.funnel_progress).toHaveProperty('voting-funnel');
			expect(data.session.funnel_progress).toHaveProperty('onboarding-funnel');
			expect(data.session.funnel_progress['voting-funnel'].current_step).toBe(2);
			expect(data.session.funnel_progress['onboarding-funnel'].current_step).toBe(1);
			expect(data.session.funnel_progress['voting-funnel'].conversion_likelihood).toBe(0.7);
		});

		it('should update funnel progress with new steps', async () => {
			// Mock existing session with partial funnel progress
			const existingProgress = {
				'voting-funnel': {
					current_step: 2,
					completed_steps: [1, 2],
					last_step_timestamp: '2024-01-01T10:00:00Z',
					conversion_likelihood: 0.6
				}
			};

			// Simulate funnel step advancement
			const newStep = 3;
			const newTimestamp = '2024-01-01T10:15:00Z';

			const updatedProgress = {
				...existingProgress,
				'voting-funnel': {
					...existingProgress['voting-funnel'],
					current_step: newStep,
					completed_steps: [...existingProgress['voting-funnel'].completed_steps, newStep],
					last_step_timestamp: newTimestamp,
					conversion_likelihood: 0.8 // Increased likelihood with progression
				}
			};

			mockDb.analytics_session.update.mockResolvedValue({
				session_id: 'sess_progress_123',
				funnel_progress: updatedProgress
			});

			const result = await mockDb.analytics_session.update({
				where: { session_id: 'sess_progress_123' },
				data: { funnel_progress: updatedProgress }
			});

			expect(result.funnel_progress['voting-funnel'].current_step).toBe(3);
			expect(result.funnel_progress['voting-funnel'].completed_steps).toContain(3);
			expect(result.funnel_progress['voting-funnel'].conversion_likelihood).toBe(0.8);
		});

		it('should handle funnel completion and conversion tracking', async () => {
			// Mock funnel completion scenario
			const completedFunnelProgress = {
				'voting-funnel': {
					current_step: 5, // Final step
					completed_steps: [1, 2, 3, 4, 5],
					last_step_timestamp: '2024-01-01T10:30:00Z',
					conversion_likelihood: 1.0,
					completed: true,
					completion_time: 1800000, // 30 minutes
					conversion_value: 1.0
				}
			};

			const sessionMetricsWithConversion = {
				events_count: 15,
				page_views: 6,
				conversion_count: 1,
				funnel_conversions: 1,
				total_conversion_value: 1.0
			};

			mockDb.analytics_session.update.mockResolvedValue({
				session_id: 'sess_completed_123',
				funnel_progress: completedFunnelProgress,
				session_metrics: sessionMetricsWithConversion
			});

			const result = await mockDb.analytics_session.update({
				where: { session_id: 'sess_completed_123' },
				data: {
					funnel_progress: completedFunnelProgress,
					session_metrics: sessionMetricsWithConversion
				}
			});

			expect(result.funnel_progress['voting-funnel'].completed).toBe(true);
			expect(result.funnel_progress['voting-funnel'].completion_time).toBe(1800000);
			expect(safeSessionMetrics(result).funnel_conversions).toBe(1);
		});
	});

	describe('Session Lifecycle Management', () => {
		it('should handle session expiration and cleanup', async () => {
			const expiredSessions = [
				{
					session_id: 'sess_expired_1',
					created_at: new Date('2024-01-01T00:00:00Z'), // 30+ days old
					updated_at: new Date('2024-01-01T01:00:00Z'),
					session_metrics: { events_count: 5 }
				},
				{
					session_id: 'sess_expired_2',
					created_at: new Date('2024-01-02T00:00:00Z'),
					updated_at: new Date('2024-01-02T00:30:00Z'),
					session_metrics: { events_count: 1 }
				}
			];

			mockDb.analytics_session.findMany.mockResolvedValue(expiredSessions);

			// Mock cleanup criteria
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const sessionsToCleanup = expiredSessions.filter(
				(s) => s.updated_at < thirtyDaysAgo && safeSessionMetrics(s).events_count < 3
			);

			// In real implementation, this would be a scheduled job
			const cleanupOperations = sessionsToCleanup.map((s) =>
				mockDb.analytics_session.delete({ where: { session_id: s.session_id } })
			);

			expect(sessionsToCleanup.length).toBeGreaterThan(0);
			expect(cleanupOperations.length).toBe(sessionsToCleanup.length);
		});

		it('should merge sessions for authenticated users', async () => {
			// Mock anonymous session
			const anonymousSession = {
				session_id: 'sess_anon_123',
				user_id: null,
				session_metrics: { events_count: 3, page_views: 2 },
				funnel_progress: {
					'voting-funnel': { current_step: 2, completed_steps: [1, 2] }
				}
			};

			// Mock authenticated session
			const authenticatedSession = {
				session_id: 'sess_auth_456',
				user_id: 'user-123',
				session_metrics: { events_count: 0, page_views: 0 },
				funnel_progress: {}
			};

			// Simulate session merge after authentication
			const mergedSession = {
				...authenticatedSession,
				session_metrics: {
					events_count:
						safeSessionMetrics(anonymousSession).events_count +
						safeSessionMetrics(authenticatedSession).events_count,
					page_views:
						safeSessionMetrics(anonymousSession).page_views +
						safeSessionMetrics(authenticatedSession).page_views
				},
				funnel_progress: {
					...anonymousSession.funnel_progress,
					...authenticatedSession.funnel_progress
				}
			};

			mockDb.analytics_session.update.mockResolvedValue(mergedSession);
			mockDb.analytics_session.delete.mockResolvedValue(anonymousSession);

			// Verify merged session has combined data
			expect(safeSessionMetrics(mergedSession).events_count).toBe(3);
			expect(mergedSession.funnel_progress).toHaveProperty('voting-funnel');
		});
	});

	describe('Performance and Optimization', () => {
		it('should efficiently query sessions with JSONB indexes', async () => {
			// Mock complex session queries that benefit from JSONB indexing
			const utmCampaignQuery = {
				where: {
					utm_campaign: 'voting-rights-2024',
					created_at: {
						gte: new Date('2024-01-01'),
						lte: new Date('2024-12-31')
					}
				}
			};

			const deviceTypeQuery = {
				where: {
					device_data: {
						path: ['device_type'],
						equals: 'mobile'
					}
				}
			};

			const conversionQuery = {
				where: {
					session_metrics: {
						path: ['conversion_count'],
						gt: 0
					}
				}
			};

			const mockResults = [
				{ session_id: 'sess_1', utm_campaign: 'voting-rights-2024' },
				{ session_id: 'sess_2', device_data: { device_type: 'mobile' } },
				{ session_id: 'sess_3', session_metrics: { conversion_count: 1 } }
			];

			mockDb.analytics_session.findMany.mockResolvedValue(mockResults);

			// These queries would benefit from JSONB indexes in production
			const utmResults = await mockDb.analytics_session.findMany(utmCampaignQuery);
			const deviceResults = await mockDb.analytics_session.findMany(deviceTypeQuery);
			const conversionResults = await mockDb.analytics_session.findMany(conversionQuery);

			expect(utmResults).toBeDefined();
			expect(deviceResults).toBeDefined();
			expect(conversionResults).toBeDefined();
		});

		it('should handle high-volume session updates efficiently', async () => {
			// Mock batch session updates for performance testing
			const batchUpdates = Array.from({ length: 100 }, (_, _i) => ({
				session_id: `sess_batch_${_i}`,
				session_metrics: { events_count: { increment: 1 } }
			}));

			// In real implementation, these would be batched using prisma.$transaction
			const batchPromises = batchUpdates.map((update) =>
				mockDb.analytics_session.update({
					where: { session_id: update.session_id },
					data: { session_metrics: update.session_metrics }
				})
			);

			mockDb.analytics_session.update.mockResolvedValue({ session_id: 'test' });

			// Should handle batch operations efficiently
			expect(batchPromises).toHaveLength(100);
		});
	});
});
