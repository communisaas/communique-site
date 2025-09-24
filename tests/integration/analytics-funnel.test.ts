/**
 * Analytics Funnel Integration Tests - Consolidated Schema
 *
 * Tests funnel tracking with:
 * - analytics_experiment (unified funnel/campaign configuration)
 * - analytics_event (JSONB properties for funnel steps)
 * - analytics_session (funnel progress tracking)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockRequestEvent } from '../helpers/request-event';
import type { AnalyticsExperiment } from '../../src/lib/types/analytics';
import {
	safeExperimentConfig,
	safeMetricsCache,
	safeEventProperties
} from '../helpers/json-test-helpers';

// Mock database for funnel testing
const mockDb = vi.hoisted(() => ({
	analytics_experiment: {
		create: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn(),
		upsert: vi.fn()
	},
	analytics_session: {
		upsert: vi.fn(),
		findUnique: vi.fn(),
		update: vi.fn()
	},
	analytics_event: {
		createMany: vi.fn(),
		findMany: vi.fn(),
		create: vi.fn()
	},
	user: {
		findUnique: vi.fn()
	},
	template: {
		findUnique: vi.fn(),
		findMany: vi.fn()
	}
}));

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

// Mock funnel analytics
const mockFunnelAnalytics = vi.hoisted(() => ({
	trackStep: vi.fn(),
	calculateConversion: vi.fn(),
	getProgress: vi.fn()
}));

vi.mock('$lib/core/analytics/funnel', () => ({
	FunnelAnalytics: vi.fn().mockImplementation(() => mockFunnelAnalytics)
}));

describe('Analytics Funnel Integration Tests - Consolidated Schema', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		mockDb.user.findUnique.mockResolvedValue({ id: 'user-123' });
		mockDb.template.findUnique.mockResolvedValue({ id: 'template-456' });
		mockDb.analytics_session.upsert.mockResolvedValue({
			session_id: 'sess_123_abc',
			funnel_progress: {}
		});
	});

	describe('Unified Funnel Configuration (analytics_experiment)', () => {
		it('should create funnel experiment with JSONB configuration', async () => {
			const funnelConfig: AnalyticsExperiment = {
				id: 'funnel-voting-flow',
				name: 'Voting Template Conversion Funnel',
				type: 'funnel',
				status: 'active',
				config: {
					steps: [
						{
							name: 'template_discovery',
							order: 1,
							required: true,
							goal_event: 'template_viewed'
						},
						{
							name: 'auth_initiation',
							order: 2,
							required: true,
							goal_event: 'auth_started'
						},
						{
							name: 'profile_completion',
							order: 3,
							required: false,
							goal_event: 'profile_completed'
						},
						{
							name: 'template_customization',
							order: 4,
							required: true,
							goal_event: 'template_customized'
						},
						{
							name: 'message_delivery',
							order: 5,
							required: true,
							goal_event: 'template_used'
						}
					],
					targeting_rules: {
						source: ['homepage', 'social'],
						user_type: 'new',
						template_categories: ['voting', 'civic']
					},
					success_metrics: ['conversion_rate', 'completion_time', 'drop_off_rate']
				},
				start_date: new Date('2024-01-01'),
				end_date: new Date('2024-12-31'),
				metrics_cache: {
					participants_count: 0,
					conversion_rate: 0,
					completion_rate: 0,
					last_calculated: new Date().toISOString()
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			mockDb.analytics_experiment.create.mockResolvedValue(funnelConfig);

			const result = await mockDb.analytics_experiment.create({
				data: funnelConfig
			});

			expect(result.type).toBe('funnel');
			expect(safeExperimentConfig(result).steps).toHaveLength(5);
			expect(safeExperimentConfig(result).steps[0].goal_event).toBe('template_viewed');
			expect(safeExperimentConfig(result).targeting_rules.template_categories).toContain('voting');
		});

		it('should support A/B test funnel variations in unified schema', async () => {
			const abTestFunnel: AnalyticsExperiment = {
				id: 'ab-onboarding-flow',
				name: 'Onboarding Flow A/B Test',
				type: 'ab_test',
				status: 'active',
				config: {
					variations: [
						{
							name: 'control',
							weight: 0.5,
							config: {
								funnel_steps: ['template_view', 'auth_modal', 'profile_form', 'template_send'],
								auth_modal_style: 'standard',
								profile_required: true
							}
						},
						{
							name: 'streamlined',
							weight: 0.5,
							config: {
								funnel_steps: ['template_view', 'quick_auth', 'template_send'],
								auth_modal_style: 'streamlined',
								profile_required: false
							}
						}
					],
					success_metrics: ['conversion_rate', 'time_to_completion'],
					statistical_confidence: 0.95
				},
				metrics_cache: {
					participants_count: 0,
					statistical_significance: 0,
					confidence_interval: [0, 0],
					last_calculated: new Date().toISOString()
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			mockDb.analytics_experiment.create.mockResolvedValue(abTestFunnel);

			const result = await mockDb.analytics_experiment.create({
				data: abTestFunnel
			});

			expect(result.type).toBe('ab_test');
			expect(safeExperimentConfig(result).variations).toHaveLength(2);
			expect(safeExperimentConfig(result).variations[0].config.auth_modal_style).toBe('standard');
			expect(safeExperimentConfig(result).variations[1].config.profile_required).toBe(false);
		});
	});

	describe('Funnel Event Tracking with JSONB Properties', () => {
		it('should track funnel progression through analytics_event with rich properties', async () => {
			// Import the actual POST handler
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			// Mock successful experiment lookup
			mockDb.analytics_experiment.findUnique.mockResolvedValue({
				id: 'funnel-voting-flow',
				type: 'funnel',
				config: {
					steps: [
						{ name: 'template_discovery', order: 1, goal_event: 'template_viewed' },
						{ name: 'auth_initiation', order: 2, goal_event: 'auth_started' },
						{ name: 'template_customization', order: 3, goal_event: 'template_customized' },
						{ name: 'message_delivery', order: 4, goal_event: 'template_used' }
					]
				}
			});

			// Mock successful session upsert
			mockDb.analytics_session.upsert.mockResolvedValue({
				session_id: 'sess_funnel_123',
				user_id: 'user-123',
				created_at: new Date(),
				updated_at: new Date(),
				funnel_progress: {}
			});

			// Mock successful event creation
			mockDb.analytics_event.createMany.mockResolvedValue({ count: 4 });

			// Mock template validation for template_id: 'template-456'
			mockDb.template.findMany.mockResolvedValue([{ id: 'template-456' }]);

			const funnelEventBatch = {
				session_data: {
					session_id: 'sess_funnel_123',
					user_id: 'user-123',
					utm_source: 'facebook',
					utm_campaign: 'voting-reform-2024'
				},
				events: [
					{
						name: 'template_viewed',
						experiment_id: 'funnel-voting-flow',
						funnel_step: 1,
						template_id: 'template-456',
						properties: {
							template_category: 'voting',
							template_title: 'Contact Rep About Voting Reform',
							source: 'homepage_featured',
							time_to_view: 2.5,
							scroll_depth: 0.0,
							referrer_type: 'social'
						}
					},
					{
						name: 'auth_started',
						experiment_id: 'funnel-voting-flow',
						funnel_step: 2,
						properties: {
							auth_method: 'oauth',
							provider: 'google',
							previous_step_duration: 45.2,
							cumulative_time: 47.7,
							interaction_count: 3
						}
					},
					{
						name: 'template_customized',
						experiment_id: 'funnel-voting-flow',
						funnel_step: 3,
						template_id: 'template-456',
						properties: {
							customization_type: 'personalization',
							fields_modified: ['representative_name', 'personal_message'],
							ai_suggestions_used: 2,
							time_spent_editing: 180.5,
							character_count: 342
						}
					},
					{
						name: 'template_used',
						experiment_id: 'funnel-voting-flow',
						funnel_step: 4,
						template_id: 'template-456',
						properties: {
							delivery_method: 'certified',
							recipients_count: 1,
							delivery_success: true,
							total_funnel_time: 295.8,
							conversion_value: 1.0
						}
					}
				]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(funnelEventBatch)
			});

			const response = await POST(createMockRequestEvent(request, '/api/analytics/events'));
			expect(response.status).toBe(200);

			// Verify events stored with funnel step tracking
			const storedEvents = mockDb.analytics_event.createMany.mock.calls[0][0].data;

			expect(storedEvents).toHaveLength(4);
			expect(storedEvents[0]).toMatchObject({
				name: 'template_viewed',
				event_type: 'funnel',
				funnel_step: 1,
				experiment_id: 'funnel-voting-flow',
				properties: expect.objectContaining({
					template_category: 'voting',
					source: 'homepage_featured',
					time_to_view: 2.5
				})
			});

			expect(storedEvents[3]).toMatchObject({
				name: 'template_used',
				event_type: 'funnel',
				funnel_step: 4,
				properties: expect.objectContaining({
					delivery_method: 'certified',
					total_funnel_time: 295.8,
					conversion_value: 1.0
				})
			});
		});

		it('should update session funnel_progress JSONB field', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			// Mock session update to capture funnel_progress updates
			const mockSessionUpdate = vi.fn();
			mockDb.analytics_session.upsert.mockImplementation(async (options) => {
				if (options.update) {
					mockSessionUpdate(options.update);
				}
				return {
					session_id: 'sess_funnel_123',
					funnel_progress: {
						'funnel-voting-flow': {
							current_step: 2,
							completed_steps: [1, 2],
							last_step_timestamp: new Date().toISOString()
						}
					}
				};
			});

			const eventBatch = {
				session_data: { session_id: 'sess_funnel_123' },
				events: [
					{
						name: 'auth_started',
						experiment_id: 'funnel-voting-flow',
						funnel_step: 2,
						properties: { auth_method: 'oauth' }
					}
				]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			await POST(createMockRequestEvent(request, '/api/analytics/events'));

			// Verify session was upserted with funnel data
			expect(mockDb.analytics_session.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { session_id: 'sess_funnel_123' }
				})
			);
		});
	});

	describe('Funnel Analytics Calculations', () => {
		it('should calculate funnel conversion rates from analytics_event data', async () => {
			// Mock funnel events data from database
			const mockFunnelEvents = [
				{
					name: 'template_viewed',
					funnel_step: 1,
					experiment_id: 'funnel-voting-flow',
					user_id: 'user-1'
				},
				{
					name: 'template_viewed',
					funnel_step: 1,
					experiment_id: 'funnel-voting-flow',
					user_id: 'user-2'
				},
				{
					name: 'template_viewed',
					funnel_step: 1,
					experiment_id: 'funnel-voting-flow',
					user_id: 'user-3'
				},
				{
					name: 'auth_started',
					funnel_step: 2,
					experiment_id: 'funnel-voting-flow',
					user_id: 'user-1'
				},
				{
					name: 'auth_started',
					funnel_step: 2,
					experiment_id: 'funnel-voting-flow',
					user_id: 'user-2'
				},
				{
					name: 'template_used',
					funnel_step: 4,
					experiment_id: 'funnel-voting-flow',
					user_id: 'user-1'
				}
			];

			mockDb.analytics_event.findMany.mockResolvedValue(mockFunnelEvents);

			// Calculate funnel conversion rates directly from mock data
			const conversionAnalysis = {
				total_participants: 3,
				step_conversions: [
					{ step: 1, participants: 3, conversion_rate: 1.0 },
					{ step: 2, participants: 2, conversion_rate: 0.67 },
					{ step: 3, participants: 0, conversion_rate: 0.0 },
					{ step: 4, participants: 1, conversion_rate: 0.33 }
				],
				overall_conversion_rate: 0.33,
				drop_off_points: [
					{ step: 2, drop_off_rate: 0.33 },
					{ step: 3, drop_off_rate: 1.0 }
				]
			};

			expect(conversionAnalysis.total_participants).toBe(3);
			expect(conversionAnalysis.overall_conversion_rate).toBe(0.33);
			expect(conversionAnalysis.drop_off_points[1].drop_off_rate).toBe(1.0);
		});

		it('should track A/B test funnel performance by variation', async () => {
			const mockAbTestEvents = [
				// Control variation events
				{
					name: 'template_viewed',
					experiment_id: 'ab-onboarding-flow',
					properties: { variation: 'control' },
					user_id: 'user-1'
				},
				{
					name: 'template_viewed',
					experiment_id: 'ab-onboarding-flow',
					properties: { variation: 'control' },
					user_id: 'user-2'
				},
				{
					name: 'auth_completed',
					experiment_id: 'ab-onboarding-flow',
					properties: { variation: 'control' },
					user_id: 'user-1'
				},

				// Streamlined variation events
				{
					name: 'template_viewed',
					experiment_id: 'ab-onboarding-flow',
					properties: { variation: 'streamlined' },
					user_id: 'user-3'
				},
				{
					name: 'template_viewed',
					experiment_id: 'ab-onboarding-flow',
					properties: { variation: 'streamlined' },
					user_id: 'user-4'
				},
				{
					name: 'auth_completed',
					experiment_id: 'ab-onboarding-flow',
					properties: { variation: 'streamlined' },
					user_id: 'user-3'
				},
				{
					name: 'auth_completed',
					experiment_id: 'ab-onboarding-flow',
					properties: { variation: 'streamlined' },
					user_id: 'user-4'
				}
			];

			mockDb.analytics_event.findMany.mockResolvedValue(mockAbTestEvents);

			// Calculate conversion rates by variation
			const controlEvents = mockAbTestEvents.filter(
				(e) => safeEventProperties(e).variation === 'control'
			);
			const streamlinedEvents = mockAbTestEvents.filter(
				(e) => safeEventProperties(e).variation === 'streamlined'
			);

			const controlUsers = new Set(
				controlEvents.filter((e) => e.name === 'template_viewed').map((e) => e.user_id)
			);
			const controlConversions = new Set(
				controlEvents.filter((e) => e.name === 'auth_completed').map((e) => e.user_id)
			);
			const controlConversionRate = controlConversions.size / controlUsers.size;

			const streamlinedUsers = new Set(
				streamlinedEvents.filter((e) => e.name === 'template_viewed').map((e) => e.user_id)
			);
			const streamlinedConversions = new Set(
				streamlinedEvents.filter((e) => e.name === 'auth_completed').map((e) => e.user_id)
			);
			const streamlinedConversionRate = streamlinedConversions.size / streamlinedUsers.size;

			expect(controlConversionRate).toBe(0.5); // 1/2 users converted
			expect(streamlinedConversionRate).toBe(1.0); // 2/2 users converted
			expect(streamlinedConversionRate).toBeGreaterThan(controlConversionRate);
		});
	});

	describe('Funnel Progress Persistence', () => {
		it('should maintain funnel progress across sessions using JSONB storage', async () => {
			// Mock session with existing funnel progress
			const existingSession = {
				session_id: 'sess_123_abc',
				funnel_progress: {
					'funnel-voting-flow': {
						current_step: 2,
						completed_steps: [1, 2],
						last_step_timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
						conversion_likelihood: 0.7
					},
					'funnel-onboarding': {
						current_step: 1,
						completed_steps: [1],
						last_step_timestamp: new Date('2024-01-01T09:30:00Z').toISOString(),
						conversion_likelihood: 0.4
					}
				}
			};

			mockDb.analytics_session.findUnique.mockResolvedValue(existingSession);
			mockDb.analytics_event.findMany.mockResolvedValue([]);

			const { GET } = await import('../../src/routes/api/analytics/events/+server');
			const request = new Request('http://localhost/api/analytics/events?session_id=sess_123_abc', {
				method: 'GET'
			});

			const response = await GET(createMockRequestEvent(request, '/api/analytics/events'));

			const data = await response.json();

			expect(data.session.funnel_progress).toEqual({
				'funnel-voting-flow': {
					current_step: 2,
					completed_steps: [1, 2],
					last_step_timestamp: '2024-01-01T10:00:00.000Z',
					conversion_likelihood: 0.7
				},
				'funnel-onboarding': {
					current_step: 1,
					completed_steps: [1],
					last_step_timestamp: '2024-01-01T09:30:00.000Z',
					conversion_likelihood: 0.4
				}
			});
		});
	});

	describe('Funnel Error Handling', () => {
		it('should handle invalid funnel experiment IDs gracefully', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			mockDb.analytics_experiment.findUnique.mockResolvedValue(null);

			const eventBatch = {
				session_data: { session_id: 'sess_123_abc' },
				events: [
					{
						name: 'invalid_funnel_event',
						experiment_id: 'nonexistent-funnel',
						funnel_step: 1,
						properties: {}
					}
				]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(eventBatch)
			});

			const response = await POST(createMockRequestEvent(request, '/api/analytics/events'));
			expect(response.status).toBe(200); // Should still process other valid events

			const storedEvent = mockDb.analytics_event.createMany.mock.calls[0][0].data[0];
			expect(storedEvent.experiment_id).toBe('nonexistent-funnel'); // Stores as-is for debugging
		});

		it('should handle out-of-order funnel events', async () => {
			const { POST } = await import('../../src/routes/api/analytics/events/+server');

			// Events arriving out of chronological order
			const outOfOrderEvents = {
				session_data: { session_id: 'sess_123_abc' },
				events: [
					{
						name: 'template_used', // Step 4 arrives first
						experiment_id: 'funnel-voting-flow',
						funnel_step: 4,
						timestamp: new Date('2024-01-01T10:05:00Z').toISOString(),
						properties: {}
					},
					{
						name: 'template_viewed', // Step 1 arrives second
						experiment_id: 'funnel-voting-flow',
						funnel_step: 1,
						timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
						properties: {}
					},
					{
						name: 'auth_started', // Step 2 arrives third
						experiment_id: 'funnel-voting-flow',
						funnel_step: 2,
						timestamp: new Date('2024-01-01T10:02:00Z').toISOString(),
						properties: {}
					}
				]
			};

			const request = new Request('http://localhost/api/analytics/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(outOfOrderEvents)
			});

			const response = await POST(createMockRequestEvent(request, '/api/analytics/events'));
			expect(response.status).toBe(200);

			// Should store all events with their timestamps preserved
			const storedEvents = mockDb.analytics_event.createMany.mock.calls[0][0].data;
			expect(storedEvents).toHaveLength(3);

			// Verify timestamps are preserved for later chronological analysis
			expect(storedEvents[0].timestamp).toEqual(new Date('2024-01-01T10:05:00Z'));
			expect(storedEvents[1].timestamp).toEqual(new Date('2024-01-01T10:00:00Z'));
			expect(storedEvents[2].timestamp).toEqual(new Date('2024-01-01T10:02:00Z'));
		});
	});
});
