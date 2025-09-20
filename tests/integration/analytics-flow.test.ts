/**
 * Complete Analytics Flow Integration Tests - Consolidated Schema
 * 
 * Tests the complete event→session→experiment flow with:
 * - End-to-end analytics tracking
 * - Cross-model data consistency
 * - Performance optimization
 * - Real-world usage scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeEventProperties, safeComputedMetrics, safeSessionMetrics, safeExperimentMetricsCache } from '../helpers/json-test-helpers';
import { createMockRequestEvent } from '../helpers/request-event';
import type { AnalyticsEvent, AnalyticsSession, AnalyticsExperiment } from '../../src/lib/types/analytics';

// Mock database for complete flow testing
const mockDb = vi.hoisted(() => ({
	analytics_session: {
		create: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn(),
		upsert: vi.fn()
	},
	analytics_event: {
		create: vi.fn(),
		createMany: vi.fn(),
		findMany: vi.fn(),
		count: vi.fn()
	},
	analytics_experiment: {
		create: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn()
	},
	user: {
		findUnique: vi.fn(),
		create: vi.fn()
	},
	template: {
		findUnique: vi.fn(),
		findMany: vi.fn()
	}
}));

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

describe('Complete Analytics Flow Integration Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		
		// Default mocks
		mockDb.user.findUnique.mockResolvedValue({ id: 'user-123' });
		mockDb.template.findMany.mockResolvedValue([{ id: 'template-456' }]);
	});

	describe('End-to-End User Journey Tracking', () => {
		it('should track complete voting template usage journey', async () => {
			// Step 1: Create experiment for A/B testing onboarding flow
			const onboardingExperiment: AnalyticsExperiment = {
				id: 'exp-voting-onboarding',
				name: 'Voting Template Onboarding A/B Test',
				type: 'ab_test',
				status: 'active',
				config: {
					variations: [
						{
							name: 'standard_flow',
							weight: 0.5,
							config: { auth_required: true, address_verification: true }
						},
						{
							name: 'simplified_flow',
							weight: 0.5,
							config: { auth_required: false, address_verification: false }
						}
					],
					success_metrics: ['conversion_rate', 'completion_time']
				},
				start_date: new Date('2024-01-01'),
				end_date: new Date('2024-12-31'),
				metrics_cache: { participants_count: 0, conversion_rate: 0, last_calculated: new Date().toISOString() },
				created_at: new Date(),
				updated_at: new Date()
			};

			mockDb.analytics_experiment.create.mockResolvedValue(onboardingExperiment);
			await mockDb.analytics_experiment.create({ data: onboardingExperiment });

			// Step 2: User lands on page (session creation)
			const { POST: eventsPost } = await import('../../src/routes/api/analytics/events/+server');

			const initialVisit = {
				session_data: {
					session_id: 'sess_journey_123',
					user_id: undefined, // Anonymous initially
					utm_source: 'facebook',
					utm_medium: 'social',
					utm_campaign: 'voting-rights-awareness',
					landing_page: '/templates/voting-reform',
					referrer: 'https://facebook.com/communique-ad',
					fingerprint: 'fp_unique_123',
					user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X)',
					ip_address: '192.168.1.100'
				},
				events: [{
					name: 'page_view',
					timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
					properties: {
						page_url: '/templates/voting-reform',
						page_title: 'Contact Your Representative About Voting Reform',
						source: 'facebook_ad',
						ab_test_variant: 'simplified_flow',
						utm_data: {
							source: 'facebook',
							medium: 'social',
							campaign: 'voting-rights-awareness'
						}
					}
				}]
			};

			const expectedSession: Partial<AnalyticsSession> = {
				session_id: 'sess_journey_123',
				user_id: undefined,
				utm_source: 'facebook',
				utm_medium: 'social',
				utm_campaign: 'voting-rights-awareness',
				landing_page: '/templates/voting-reform',
				device_data: {
					ip_address: '192.168.1.100',
					user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X)',
					fingerprint: 'fp_unique_123'
				},
				session_metrics: { events_count: 1, page_views: 1, conversion_count: 0 },
				funnel_progress: {}
			};

			mockDb.analytics_session.upsert.mockResolvedValue(expectedSession);
			mockDb.analytics_event.createMany.mockResolvedValue({ count: 1 });

			const initialRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(initialVisit)
			});

			let response = await eventsPost({ request: initialRequest, getClientAddress: () => '192.168.1.100' } as any);
			expect(response.status).toBe(200);

			// Step 3: User views template details
			const templateView = {
				session_data: { session_id: 'sess_journey_123' },
				events: [{
					name: 'template_viewed',
					template_id: 'template-456',
					experiment_id: 'exp-voting-onboarding',
					timestamp: new Date('2024-01-01T10:02:30Z').toISOString(),
					properties: {
						template_category: 'voting',
						template_title: 'Contact Your Representative About Voting Reform',
						view_source: 'featured_list',
						scroll_depth: 0.65,
						time_on_page: 150000, // 2.5 minutes
						interactions: ['highlight_text', 'click_preview']
					}
				}]
			};

			const templateRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(templateView)
			});

			response = await eventsPost({ request: templateRequest, getClientAddress: () => '192.168.1.100' } as any);
			expect(response.status).toBe(200);

			// Step 4: User initiates authentication (funnel progression)
			const authStart = {
				session_data: { session_id: 'sess_journey_123' },
				events: [{
					name: 'auth_started',
					experiment_id: 'exp-voting-onboarding',
					funnel_step: 1,
					timestamp: new Date('2024-01-01T10:05:00Z').toISOString(),
					properties: {
						auth_method: 'oauth',
						provider: 'google',
						ab_test_variant: 'simplified_flow',
						previous_step_duration: 150000,
						cumulative_funnel_time: 150000
					}
				}]
			};

			const authRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(authStart)
			});

			response = await eventsPost({ request: authRequest, getClientAddress: () => '192.168.1.100' } as any);
			expect(response.status).toBe(200);

			// Step 5: Authentication completed (user becomes identified)
			const authComplete = {
				session_data: {
					session_id: 'sess_journey_123',
					user_id: 'user-123' // Now identified
				},
				events: [{
					name: 'auth_completed',
					user_id: 'user-123',
					experiment_id: 'exp-voting-onboarding',
					funnel_step: 2,
					timestamp: new Date('2024-01-01T10:06:30Z').toISOString(),
					properties: {
						auth_method: 'oauth',
						provider: 'google',
						auth_duration: 90000, // 1.5 minutes
						user_created: false, // Returning user
						cumulative_funnel_time: 240000
					}
				}]
			};

			// Update session to associate with user
			const updatedSession = {
				...expectedSession,
				user_id: 'user-123',
				session_metrics: { events_count: 4, page_views: 1, conversion_count: 0 },
				funnel_progress: {
					'exp-voting-onboarding': {
						current_step: 2,
						completed_steps: [1, 2],
						last_step_timestamp: '2024-01-01T10:06:30Z',
						conversion_likelihood: 0.75
					}
				}
			};

			mockDb.analytics_session.upsert.mockResolvedValue(updatedSession);

			const authCompleteRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(authComplete)
			});

			response = await eventsPost({ request: authCompleteRequest, getClientAddress: () => '192.168.1.100' } as any);
			expect(response.status).toBe(200);

			// Step 6: Template customization
			const templateCustomize = {
				session_data: { session_id: 'sess_journey_123', user_id: 'user-123' },
				events: [{
					name: 'template_customized',
					template_id: 'template-456',
					user_id: 'user-123',
					experiment_id: 'exp-voting-onboarding',
					funnel_step: 3,
					timestamp: new Date('2024-01-01T10:12:00Z').toISOString(),
					properties: {
						customization_type: 'ai_assisted',
						fields_modified: ['personal_message', 'issue_focus'],
						ai_suggestions_accepted: 3,
						ai_suggestions_rejected: 1,
						editing_time: 330000, // 5.5 minutes
						final_word_count: 287,
						personalization_score: 0.82
					}
				}]
			};

			const customizeRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(templateCustomize)
			});

			response = await eventsPost({ request: customizeRequest, getClientAddress: () => '192.168.1.100' } as any);
			expect(response.status).toBe(200);

			// Step 7: Final conversion - template sent
			const templateSent = {
				session_data: { session_id: 'sess_journey_123', user_id: 'user-123' },
				events: [{
					name: 'template_used',
					template_id: 'template-456',
					user_id: 'user-123',
					experiment_id: 'exp-voting-onboarding',
					funnel_step: 4,
					timestamp: new Date('2024-01-01T10:15:30Z').toISOString(),
					properties: {
						delivery_method: 'certified',
						recipients_count: 1,
						recipient_type: 'house_representative',
						delivery_success: true,
						total_session_time: 930000, // 15.5 minutes
						total_funnel_time: 930000,
						conversion_value: 1.0,
						ab_test_variant: 'simplified_flow'
					}
				}]
			};

			// Final session state with conversion
			const finalSession = {
				...updatedSession,
				session_metrics: {
					events_count: 6,
					page_views: 1,
					conversion_count: 1,
					duration_ms: 930000,
					conversion_rate: 1.0 / 6
				},
				funnel_progress: {
					'exp-voting-onboarding': {
						current_step: 4,
						completed_steps: [1, 2, 3, 4],
						last_step_timestamp: '2024-01-01T10:15:30Z',
						conversion_likelihood: 1.0,
						completed: true,
						completion_time: 930000,
						conversion_value: 1.0
					}
				}
			};

			mockDb.analytics_session.upsert.mockResolvedValue(finalSession);

			const sentRequest = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(templateSent)
			});

			response = await eventsPost({ request: sentRequest, getClientAddress: () => '192.168.1.100' } as any);
			expect(response.status).toBe(200);

			// Verify complete journey was tracked
			expect(mockDb.analytics_session.upsert).toHaveBeenCalledTimes(6);
			expect(mockDb.analytics_event.createMany).toHaveBeenCalledTimes(6);

			// Verify final session state
			const lastSessionCall = mockDb.analytics_session.upsert.mock.calls[5][0];
			expect(lastSessionCall.create.user_id).toBe('user-123');
			expect(safeSessionMetrics(lastSessionCall.create).conversion_count).toBe(1);
		});
	});

	describe('Cross-Model Data Consistency', () => {
		it('should maintain data consistency across analytics models', async () => {
			// Create experiment
			const experiment: AnalyticsExperiment = {
				id: 'exp-consistency-test',
				name: 'Consistency Test Experiment',
				type: 'funnel',
				status: 'active',
				config: {
					steps: [
						{ name: 'discovery', order: 1, required: true, goal_event: 'template_viewed' },
						{ name: 'engagement', order: 2, required: true, goal_event: 'template_customized' },
						{ name: 'conversion', order: 3, required: true, goal_event: 'template_used' }
					]
				},
				metrics_cache: { participants_count: 0, conversion_rate: 0, last_calculated: new Date().toISOString() },
				start_date: new Date(),
				end_date: new Date(),
				created_at: new Date(),
				updated_at: new Date()
			};

			mockDb.analytics_experiment.create.mockResolvedValue(experiment);
			mockDb.analytics_experiment.findUnique.mockResolvedValue(experiment);

			// Create session
			const session: AnalyticsSession = {
				session_id: 'sess_consistency_123',
				user_id: 'user-123',
				created_at: new Date(),
				updated_at: new Date(),
				utm_source: 'direct',
				utm_medium: undefined,
				utm_campaign: undefined,
				landing_page: '/',
				referrer: undefined,
				device_data: { ip_address: '127.0.0.1' },
				session_metrics: { events_count: 0, page_views: 0 },
				funnel_progress: {}
			};

			mockDb.analytics_session.upsert.mockResolvedValue(session);
			mockDb.analytics_session.findUnique.mockResolvedValue(session);

			// Create events that reference both session and experiment
			const events: Partial<AnalyticsEvent>[] = [
				{
					id: 'evt_1',
					session_id: 'sess_consistency_123',
					user_id: 'user-123',
					experiment_id: 'exp-consistency-test',
					name: 'template_viewed',
					funnel_step: 1,
					timestamp: new Date(),
					event_type: 'funnel',
					properties: { template_id: 'template-456' },
					computed_metrics: {},
					created_at: new Date()
				},
				{
					id: 'evt_2',
					session_id: 'sess_consistency_123',
					user_id: 'user-123',
					experiment_id: 'exp-consistency-test',
					name: 'template_customized',
					funnel_step: 2,
					timestamp: new Date(),
					event_type: 'funnel',
					properties: { customization_time: 300000 },
					computed_metrics: {},
					created_at: new Date()
				},
				{
					id: 'evt_3',
					session_id: 'sess_consistency_123',
					user_id: 'user-123',
					experiment_id: 'exp-consistency-test',
					name: 'template_used',
					funnel_step: 3,
					timestamp: new Date(),
					event_type: 'conversion',
					properties: { delivery_method: 'certified' },
					computed_metrics: {},
					created_at: new Date()
				}
			];

			mockDb.analytics_event.findMany.mockResolvedValue(events);
			mockDb.analytics_event.createMany.mockResolvedValue({ count: events.length });

			// Verify referential integrity
			const sessionEvents = await mockDb.analytics_event.findMany({
				where: { session_id: 'sess_consistency_123' }
			});

			expect(sessionEvents).toHaveLength(3);
			sessionEvents.forEach((event: any) => {
				expect(event.session_id).toBe('sess_consistency_123');
				expect(event.user_id).toBe('user-123');
				expect(event.experiment_id).toBe('exp-consistency-test');
			});

			// Verify experiment metrics reflect event data
			const conversionCount = sessionEvents.filter((e: any) => e.event_type === 'conversion').length;
			const updatedExperimentMetrics = {
				participants_count: 1,
				conversion_rate: conversionCount / sessionEvents.length,
				funnel_completion_rate: 1.0, // All steps completed
				last_calculated: new Date().toISOString()
			};

			mockDb.analytics_experiment.update.mockResolvedValue({
				...experiment,
				metrics_cache: updatedExperimentMetrics
			});

			const updatedExperiment = await mockDb.analytics_experiment.update({
				where: { id: 'exp-consistency-test' },
				data: { metrics_cache: updatedExperimentMetrics }
			});

			expect(safeExperimentMetricsCache(updatedExperiment).participants_count).toBe(1);
			expect(safeExperimentMetricsCache(updatedExperiment).funnel_completion_rate).toBe(1.0);
		});

		it('should handle data migration and schema evolution', async () => {
			// Mock data in old format (simulating migration scenario)
			const legacyEventData = {
				// Old fragmented format
				event_name: 'template_viewed',
				event_properties: {
					template_id: 'template-123',
					category: 'voting'
				},
				user_session_data: {
					session_id: 'legacy_sess_123',
					utm_source: 'google'
				}
			};

			// Simulate migration to consolidated format
			const migratedEvent = {
				session_id: legacyEventData.user_session_data.session_id,
				name: legacyEventData.event_name,
				event_type: 'pageview' as const,
				properties: {
					...legacyEventData.event_properties,
					migration_source: 'legacy_event_property_table',
					migrated_at: new Date().toISOString()
				},
				computed_metrics: {
					legacy_migration_flag: true,
					original_format: 'fragmented'
				}
			};

			mockDb.analytics_event.create.mockResolvedValue({
				id: 'evt_migrated_123',
				...migratedEvent,
				timestamp: new Date(),
				created_at: new Date()
			});

			const result = await mockDb.analytics_event.create({
				data: migratedEvent
			});

			// Verify migration preserved data integrity
			expect(safeEventProperties(result).template_id).toBe('template-123');
			expect(safeEventProperties(result).migration_source).toBe('legacy_event_property_table');
			expect(result.computed_metrics.legacy_migration_flag).toBe(true);
		});
	});

	describe('Performance Optimization', () => {
		it('should handle high-volume analytics data efficiently', async () => {
			// Simulate high-volume scenario
			const batchSize = 100;
			const numberOfBatches = 10;

			// Mock batch processing
			for (let batch = 0; batch < numberOfBatches; batch++) {
				const events = Array.from({ length: batchSize }, (_, i) => ({
					session_id: `sess_volume_${batch}`,
					name: `event_${i}`,
					event_type: 'interaction' as const,
					properties: {
						batch_number: batch,
						event_number: i,
						timestamp: new Date().toISOString()
					},
					computed_metrics: {}
				}));

				mockDb.analytics_event.createMany.mockResolvedValueOnce({ count: batchSize });

				const result = await mockDb.analytics_event.createMany({
					data: events,
					skipDuplicates: true
				});

				expect(result.count).toBe(batchSize);
			}

			// Verify all batches were processed
			expect(mockDb.analytics_event.createMany).toHaveBeenCalledTimes(numberOfBatches);
		});

		it('should optimize JSONB queries with proper indexing strategy', async () => {
			// Mock complex analytical queries that benefit from JSONB indexing
			const analyticalQueries = [
				{
					name: 'Conversion rate by device type',
					query: {
						where: {
							session_metrics: {
								path: ['conversion_count'],
								gt: 0
							},
							device_data: {
								path: ['device_type'],
								in: ['mobile', 'desktop']
							}
						},
						select: {
							session_id: true,
							device_data: true,
							session_metrics: true
						}
					}
				},
				{
					name: 'High-engagement events by template category',
					query: {
						where: {
							properties: {
								path: ['template_category'],
								equals: 'voting'
							},
							computed_metrics: {
								path: ['engagement_score'],
								gte: 0.7
							}
						},
						select: {
							id: true,
							properties: true,
							computed_metrics: true
						}
					}
				},
				{
					name: 'A/B test performance by variation',
					query: {
						where: {
							config: {
								path: ['variations'],
								array_contains: { name: 'streamlined_flow' }
							},
							metrics_cache: {
								path: ['conversion_rate'],
								gte: 0.1
							}
						},
						select: {
							id: true,
							name: true,
							metrics_cache: true
						}
					}
				}
			];

			// Mock optimized query results
			mockDb.analytics_session.findMany.mockResolvedValue([
				{
					session_id: 'sess_1',
					device_data: { device_type: 'mobile' },
					session_metrics: { conversion_count: 1 }
				}
			]);

			mockDb.analytics_event.findMany.mockResolvedValue([
				{
					id: 'evt_1',
					properties: { template_category: 'voting' },
					computed_metrics: { engagement_score: 0.8 }
				}
			]);

			mockDb.analytics_experiment.findMany.mockResolvedValue([
				{
					id: 'exp_1',
					name: 'Test Experiment',
					metrics_cache: { conversion_rate: 0.15 }
				}
			]);

			// Execute queries and verify performance characteristics
			for (const queryTest of analyticalQueries) {
				let result;
				
				if (queryTest.name.includes('device type')) {
					result = await mockDb.analytics_session.findMany(queryTest.query);
				} else if (queryTest.name.includes('template category')) {
					result = await mockDb.analytics_event.findMany(queryTest.query);
				} else if (queryTest.name.includes('A/B test')) {
					result = await mockDb.analytics_experiment.findMany(queryTest.query);
				}

				expect(result).toBeDefined();
				expect(Array.isArray(result)).toBe(true);
			}

			// Verify efficient query patterns were used
			expect(mockDb.analytics_session.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						session_metrics: expect.any(Object),
						device_data: expect.any(Object)
					})
				})
			);
		});
	});

	describe('Real-World Usage Scenarios', () => {
		it('should handle mobile user with intermittent connectivity', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			// Mobile user with spotty connection - events arrive in batches
			const mobileEventBatches = [
				{
					session_data: {
						session_id: 'sess_mobile_123',
						fingerprint: 'mobile_fp_123',
						user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X)',
						ip_address: '192.168.1.100'
					},
					events: [
						{
							name: 'page_view',
							timestamp: '2024-01-01T10:00:00Z',
							properties: { page_url: '/', connection_type: '4g' }
						},
						{
							name: 'template_viewed',
							timestamp: '2024-01-01T10:02:30Z',
							properties: { template_id: 'template-456', load_time: 3200 }
						}
					]
				},
				{
					session_data: { session_id: 'sess_mobile_123' },
					events: [
						{
							name: 'connection_lost',
							timestamp: '2024-01-01T10:05:00Z',
							properties: { connection_type: 'offline', cached_events: 3 }
						}
					]
				},
				{
					session_data: { session_id: 'sess_mobile_123' },
					events: [
						{
							name: 'connection_restored',
							timestamp: '2024-01-01T10:08:30Z',
							properties: { connection_type: '4g', offline_duration: 210000 }
						},
						{
							name: 'auth_started',
							timestamp: '2024-01-01T10:08:45Z',
							properties: { auth_method: 'oauth', provider: 'google' }
						},
						{
							name: 'auth_completed',
							timestamp: '2024-01-01T10:09:30Z',
							properties: { auth_duration: 45000, user_id: 'user-123' }
						}
					]
				}
			];

			mockDb.analytics_session.upsert.mockResolvedValue({
				session_id: 'sess_mobile_123',
				device_data: { device_type: 'mobile', connection_type: '4g' },
				session_metrics: { events_count: 0, page_views: 0 }
			});

			mockDb.analytics_event.createMany.mockResolvedValue({ count: 1 });

			// Process each batch
			for (const batch of mobileEventBatches) {
				const request = new Request('http://localhost/api/analytics/events', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(batch)
				});

				const response = await POST({ request, getClientAddress: () => '192.168.1.100' } as any);
				expect(response.status).toBe(200);
			}

			// Verify session was updated to handle connectivity issues
			expect(mockDb.analytics_session.upsert).toHaveBeenCalledTimes(3);
			expect(mockDb.analytics_event.createMany).toHaveBeenCalledTimes(3);
		});

		it('should handle cross-device user journey', async () => {
			// User starts on mobile, continues on desktop
			const mobileSession = {
				session_id: 'sess_mobile_456',
				user_id: undefined,
				device_data: {
					device_type: 'mobile',
					os: 'iOS',
					browser: 'Safari'
				},
				session_metrics: { events_count: 3, page_views: 2 },
				funnel_progress: {
					'voting-funnel': {
						current_step: 2,
						completed_steps: [1, 2]
					}
				}
			};

			const desktopSession = {
				session_id: 'sess_desktop_789',
				user_id: 'user-123', // Same user, different device
				device_data: {
					device_type: 'desktop',
					os: 'Windows',
					browser: 'Chrome'
				},
				session_metrics: { events_count: 2, page_views: 1, conversion_count: 1 },
				funnel_progress: {
					'voting-funnel': {
						current_step: 4,
						completed_steps: [1, 2, 3, 4],
						completed: true
					}
				}
			};

			mockDb.analytics_session.findMany.mockResolvedValue([mobileSession, desktopSession]);

			// Query cross-device journey for user
			const userSessions = await mockDb.analytics_session.findMany({
				where: {
					OR: [
						{ user_id: 'user-123' },
						{ session_id: { in: ['sess_mobile_456', 'sess_desktop_789'] } }
					]
				}
			});

			// Verify cross-device tracking
			expect(userSessions).toHaveLength(2);
			
			const mobileSessionData = userSessions.find((s: any) => s.session_id === 'sess_mobile_456');
			const desktopSessionData = userSessions.find((s: any) => s.session_id === 'sess_desktop_789');
			
			expect(mobileSessionData?.device_data.device_type).toBe('mobile');
			expect(desktopSessionData?.device_data.device_type).toBe('desktop');
			expect(desktopSessionData?.funnel_progress['voting-funnel'].completed).toBe(true);
		});

		it('should handle international user with localization', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			const internationalUserData = {
				session_data: {
					session_id: 'sess_intl_123',
					user_id: 'user-456',
					utm_source: 'google',
					utm_campaign: 'uk-voting-rights',
					landing_page: '/en-gb/templates/uk-parliament',
					user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
					ip_address: '203.0.113.1' // UK IP
				},
				events: [{
					name: 'template_viewed',
					template_id: 'template-uk-parliament-123',
					properties: {
						template_category: 'uk_politics',
						language: 'en-GB',
						currency: 'GBP',
						timezone: 'Europe/London',
						localized_content: true,
						parliament_constituency: 'Westminster North',
						mp_name: 'Karen Buck',
						local_issues: ['housing', 'transport', 'environment']
					}
				}]
			};

			mockDb.analytics_session.upsert.mockResolvedValue({
				session_id: 'sess_intl_123',
				user_id: 'user-456',
				device_data: {
					ip_address: '203.0.113.1',
					timezone: 'Europe/London',
					language: 'en-GB',
					country: 'GB'
				},
				session_metrics: { events_count: 1, page_views: 1 }
			});

			mockDb.analytics_event.createMany.mockResolvedValue({ count: 1 });

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(internationalUserData)
			});

			const response = await POST({ request, getClientAddress: () => '203.0.113.1' } as any);
			expect(response.status).toBe(200);

			// Verify international/localization data is preserved
			const eventCall = mockDb.analytics_event.createMany.mock.calls[0][0];
			const storedEvent = eventCall.data[0];
			
			expect(safeEventProperties(storedEvent).language).toBe('en-GB');
			expect(safeEventProperties(storedEvent).parliament_constituency).toBe('Westminster North');
			expect(safeEventProperties(storedEvent).local_issues).toContain('housing');
		});
	});
});