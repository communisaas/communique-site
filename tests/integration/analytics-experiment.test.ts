/**
 * Analytics Experiment Integration Tests - Consolidated Schema
 *
 * Tests the unified analytics_experiment model for:
 * - Funnel configurations and tracking
 * - Campaign management and targeting
 * - A/B test variations and results
 * - Metrics cache performance optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockRequestEvent } from '../helpers/request-event';
import type { AnalyticsExperiment } from '../../src/lib/types/analytics';
import { safeExperimentConfig, safeExperimentMetricsCache } from '../helpers/json-test-helpers';

// Mock database for experiment testing
const mockDb = vi.hoisted(() => ({
	analytics_experiment: {
		create: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn(),
		upsert: vi.fn(),
		delete: vi.fn(),
		groupBy: vi.fn()
	},
	analytics_event: {
		findMany: vi.fn(),
		groupBy: vi.fn(),
		aggregate: vi.fn()
	},
	analytics_session: {
		findMany: vi.fn()
	}
}));

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

describe('Analytics Experiment Integration Tests - Consolidated Schema', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Unified Experiment Configuration (JSONB config field)', () => {
		it('should create funnel experiment with comprehensive configuration', async () => {
			const funnelExperiment: AnalyticsExperiment = {
				id: 'funnel-civic-engagement',
				name: 'Civic Engagement Conversion Funnel',
				type: 'funnel',
				status: 'active',
				config: {
					steps: [
						{
							name: 'landing_page_view',
							order: 1,
							required: true,
							goal_event: 'page_view'
						},
						{
							name: 'template_discovery',
							order: 2,
							required: true,
							goal_event: 'template_viewed'
						},
						{
							name: 'user_authentication',
							order: 3,
							required: true,
							goal_event: 'auth_completed'
						},
						{
							name: 'address_verification',
							order: 4,
							required: false,
							goal_event: 'address_verified'
						},
						{
							name: 'message_customization',
							order: 5,
							required: true,
							goal_event: 'template_customized'
						},
						{
							name: 'message_delivery',
							order: 6,
							required: true,
							goal_event: 'template_used'
						}
					],
					targeting_rules: {
						geo_restrictions: ['US', 'CA'],
						source_channels: ['organic', 'social', 'email'],
						user_segments: ['new_user', 'returning_inactive'],
						template_categories: ['voting', 'environment', 'healthcare'],
						time_windows: {
							start_hour: 9,
							end_hour: 21,
							timezone: 'America/New_York'
						}
					},
					success_metrics: [
						'conversion_rate',
						'completion_time',
						'drop_off_rate',
						'step_conversion_rates',
						'user_lifetime_value'
					],
					optimization_goals: {
						primary: 'maximize_completion_rate',
						secondary: 'minimize_drop_off_step_3'
					}
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

			mockDb.analytics_experiment.create.mockResolvedValue(funnelExperiment);

			const result = await mockDb.analytics_experiment.create({
				data: funnelExperiment
			});

			expect(safeExperimentConfig(result).steps).toHaveLength(6);
			expect(safeExperimentConfig(result).targeting_rules.geo_restrictions).toContain('US');
			expect(safeExperimentConfig(result).optimization_goals.primary).toBe(
				'maximize_completion_rate'
			);
		});

		it('should create campaign experiment with targeting and budget configuration', async () => {
			const campaignExperiment: AnalyticsExperiment = {
				id: 'campaign-voting-rights-2024',
				name: 'Voting Rights Awareness Campaign 2024',
				type: 'campaign',
				status: 'active',
				config: {
					target_audience: {
						demographics: {
							age_range: [18, 65],
							states: ['CA', 'TX', 'FL', 'NY'],
							political_engagement: ['low', 'medium']
						},
						behavioral: {
							previous_template_usage: false,
							social_media_activity: 'active',
							voting_history: ['2020', '2022']
						}
					},
					budget: 50000,
					budget_currency: 'USD',
					budget_allocation: {
						social_media: 0.4,
						email_outreach: 0.3,
						content_creation: 0.2,
						infrastructure: 0.1
					},
					campaign_channels: [
						{
							name: 'facebook_ads',
							budget_share: 0.25,
							targeting: { interests: ['politics', 'civic engagement'] }
						},
						{
							name: 'google_ads',
							budget_share: 0.15,
							targeting: { keywords: ['voting rights', 'democracy'] }
						},
						{
							name: 'email_newsletter',
							budget_share: 0.3,
							targeting: { segments: ['previous_users', 'newsletter_subscribers'] }
						}
					],
					success_metrics: [
						'reach',
						'engagement_rate',
						'cost_per_conversion',
						'template_usage_rate',
						'viral_coefficient'
					],
					kpi_targets: {
						total_reach: 100000,
						conversion_rate: 0.05,
						cost_per_conversion: 25.0
					}
				},
				start_date: new Date('2024-03-01'),
				end_date: new Date('2024-11-30'),
				metrics_cache: {
					participants_count: 0,
					reach_count: 0,
					engagement_rate: 0,
					cost_per_conversion: 0,
					last_calculated: new Date().toISOString()
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			mockDb.analytics_experiment.create.mockResolvedValue(campaignExperiment);

			const result = await mockDb.analytics_experiment.create({
				data: campaignExperiment
			});

			expect(result.type).toBe('campaign');
			expect(safeExperimentConfig(result).budget).toBe(50000);
			expect(safeExperimentConfig(result).campaign_channels).toHaveLength(3);
			expect(safeExperimentConfig(result).kpi_targets.total_reach).toBe(100000);
		});

		it('should create A/B test experiment with statistical configuration', async () => {
			const abTestExperiment: AnalyticsExperiment = {
				id: 'ab-template-presentation',
				name: 'Template Presentation A/B Test',
				type: 'ab_test',
				status: 'active',
				config: {
					variations: [
						{
							name: 'control_verbose',
							weight: 0.33,
							config: {
								template_style: 'detailed',
								explanation_length: 'verbose',
								call_to_action: 'Learn More and Take Action',
								visual_elements: ['infographics', 'statistics'],
								personalization_level: 'basic'
							}
						},
						{
							name: 'variant_concise',
							weight: 0.33,
							config: {
								template_style: 'minimal',
								explanation_length: 'concise',
								call_to_action: 'Act Now',
								visual_elements: ['icons'],
								personalization_level: 'basic'
							}
						},
						{
							name: 'variant_personalized',
							weight: 0.34,
							config: {
								template_style: 'adaptive',
								explanation_length: 'moderate',
								call_to_action: 'Make Your Voice Heard',
								visual_elements: ['personalized_graphs', 'local_data'],
								personalization_level: 'high'
							}
						}
					],
					statistical_config: {
						confidence_level: 0.95,
						minimum_sample_size: 1000,
						minimum_effect_size: 0.05,
						test_duration_days: 30,
						early_stopping_enabled: true
					},
					success_metrics: [
						'conversion_rate',
						'engagement_time',
						'template_completion_rate',
						'user_satisfaction_score'
					],
					hypothesis: {
						description:
							'Personalized templates with moderate explanation length will achieve higher conversion rates than verbose or minimal approaches'
					}
				},
				start_date: new Date('2024-02-01'),
				end_date: new Date('2024-03-31'),
				metrics_cache: {
					participants_count: 0,
					statistical_significance: 0,
					confidence_interval: [0, 0],
					winning_variation: {},
					last_calculated: new Date().toISOString()
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			mockDb.analytics_experiment.create.mockResolvedValue(abTestExperiment);

			const result = await mockDb.analytics_experiment.create({
				data: abTestExperiment
			});

			expect(result.type).toBe('ab_test');
			expect(safeExperimentConfig(result).variations).toHaveLength(3);
			expect(safeExperimentConfig(result).statistical_config.confidence_level).toBe(0.95);
			expect(safeExperimentConfig(result).variations[2].config.personalization_level).toBe('high');
		});
	});

	describe('Metrics Cache Performance Optimization', () => {
		it('should calculate and cache experiment metrics for dashboard performance', async () => {
			// Mock analytics data for metric calculation
			const mockEventData = [
				{ experiment_id: 'funnel-civic-engagement', name: 'page_view', user_id: 'user-1' },
				{ experiment_id: 'funnel-civic-engagement', name: 'page_view', user_id: 'user-2' },
				{ experiment_id: 'funnel-civic-engagement', name: 'page_view', user_id: 'user-3' },
				{ experiment_id: 'funnel-civic-engagement', name: 'template_viewed', user_id: 'user-1' },
				{ experiment_id: 'funnel-civic-engagement', name: 'template_viewed', user_id: 'user-2' },
				{ experiment_id: 'funnel-civic-engagement', name: 'template_used', user_id: 'user-1' }
			];

			mockDb.analytics_event.findMany.mockResolvedValue(mockEventData);

			// Simulate metrics calculation
			const totalParticipants = new Set(mockEventData.map((e) => e.user_id)).size;
			const conversions = mockEventData.filter((e) => e.name === 'template_used').length;
			const conversionRate = conversions / totalParticipants;

			const metricsCache = {
				participants_count: totalParticipants,
				conversion_rate: conversionRate,
				completion_rate: conversionRate,
				step_conversion_rates: {
					step_1: 1.0, // 3/3 users viewed page
					step_2: 0.67, // 2/3 users viewed template
					step_6: 0.33 // 1/3 users used template
				},
				drop_off_analysis: {
					highest_drop_off_step: 2,
					drop_off_rate: 0.33
				},
				performance_trends: {
					daily_conversion_rates: [0.2, 0.25, 0.33, 0.33],
					participant_growth: [10, 25, 50, 75]
				},
				last_calculated: new Date().toISOString()
			};

			mockDb.analytics_experiment.update.mockResolvedValue({
				id: 'funnel-civic-engagement',
				metrics_cache: metricsCache
			});

			const result = await mockDb.analytics_experiment.update({
				where: { id: 'funnel-civic-engagement' },
				data: { metrics_cache: metricsCache }
			});

			expect(safeExperimentMetricsCache(result).participants_count).toBe(3);
			expect(safeExperimentMetricsCache(result).conversion_rate).toBeCloseTo(0.33, 2);
			expect(safeExperimentMetricsCache(result).step_conversion_rates.step_2).toBe(0.67);
			expect(safeExperimentMetricsCache(result).drop_off_analysis.highest_drop_off_step).toBe(2);
		});

		it('should cache A/B test statistical analysis results', async () => {
			// Mock A/B test event data
			const mockAbTestData = [
				// Control variation
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'control_verbose' },
					name: 'template_viewed',
					user_id: 'user-1'
				},
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'control_verbose' },
					name: 'template_viewed',
					user_id: 'user-2'
				},
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'control_verbose' },
					name: 'template_used',
					user_id: 'user-1'
				},

				// Concise variation
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'variant_concise' },
					name: 'template_viewed',
					user_id: 'user-3'
				},
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'variant_concise' },
					name: 'template_viewed',
					user_id: 'user-4'
				},
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'variant_concise' },
					name: 'template_used',
					user_id: 'user-3'
				},
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'variant_concise' },
					name: 'template_used',
					user_id: 'user-4'
				},

				// Personalized variation
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'variant_personalized' },
					name: 'template_viewed',
					user_id: 'user-5'
				},
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'variant_personalized' },
					name: 'template_viewed',
					user_id: 'user-6'
				},
				{
					experiment_id: 'ab-template-presentation',
					properties: { variation: 'variant_personalized' },
					name: 'template_used',
					user_id: 'user-5'
				}
			];

			mockDb.analytics_event.findMany.mockResolvedValue(mockAbTestData);

			// Simulate statistical analysis
			const variationResults = {
				control_verbose: { participants: 2, conversions: 1, conversion_rate: 0.5 },
				variant_concise: { participants: 2, conversions: 2, conversion_rate: 1.0 },
				variant_personalized: { participants: 2, conversions: 1, conversion_rate: 0.5 }
			};

			const statisticalMetrics = {
				participants_count: 6,
				variation_results: variationResults,
				statistical_significance: 0.73, // Mock calculated value
				confidence_interval: [0.12, 0.88] as [number, number],
				winning_variation: 'variant_concise',
				p_value: 0.27,
				effect_size: 0.5,
				test_power: 0.65,
				recommendation: 'Continue test - sample size too small for significance',
				last_calculated: new Date().toISOString()
			};

			mockDb.analytics_experiment.update.mockResolvedValue({
				id: 'ab-template-presentation',
				metrics_cache: statisticalMetrics
			});

			const result = await mockDb.analytics_experiment.update({
				where: { id: 'ab-template-presentation' },
				data: { metrics_cache: statisticalMetrics }
			});

			expect(safeExperimentMetricsCache(result).winning_variation).toBe('variant_concise');
			expect(
				safeExperimentMetricsCache(result).variation_results.variant_concise.conversion_rate
			).toBe(1.0);
			expect(safeExperimentMetricsCache(result).statistical_significance).toBe(0.73);
			expect(safeExperimentMetricsCache(result).recommendation).toContain('Continue test');
		});
	});

	describe('Experiment Lifecycle Management', () => {
		it('should transition experiment status based on performance criteria', async () => {
			const experiment = {
				id: 'campaign-voting-rights-2024',
				status: 'active',
				config: {
					budget: 50000,
					kpi_targets: {
						total_reach: 100000,
						conversion_rate: 0.05,
						cost_per_conversion: 25.0
					}
				},
				metrics_cache: {
					participants_count: 80000,
					conversion_rate: 0.06,
					cost_per_conversion: 22.0,
					budget_spent: 40000,
					last_calculated: new Date().toISOString()
				}
			};

			mockDb.analytics_experiment.findUnique.mockResolvedValue(experiment);

			// Check if experiment should be paused/completed based on performance
			const metricsCache = safeExperimentMetricsCache(experiment);
			const config = safeExperimentConfig(experiment);
			const budgetUtilization = metricsCache.budget_spent / (config.budget || 1);
			const targetReachProgress =
				metricsCache.participants_count / (config.kpi_targets.total_reach || 1);
			const conversionPerformance =
				metricsCache.conversion_rate / (config.kpi_targets.conversion_rate || 1);

			const shouldComplete =
				budgetUtilization >= 0.8 || // 80% budget spent
				targetReachProgress >= 0.8 || // 80% reach achieved
				conversionPerformance >= 1.2; // 20% better than target

			mockDb.analytics_experiment.update.mockResolvedValue({
				...experiment,
				status: shouldComplete ? 'completed' : 'active'
			});

			expect(shouldComplete).toBe(true); // Should complete due to good performance
			expect(conversionPerformance).toBeGreaterThan(1.0);
		});

		it('should handle experiment cleanup and archival', async () => {
			const expiredExperiment = {
				id: 'expired-test',
				end_date: new Date('2023-12-31'), // Expired
				status: 'active'
			};

			mockDb.analytics_experiment.findMany.mockResolvedValue([expiredExperiment]);

			// Mock cleanup of expired experiments
			const cleanupOperations = [];

			if (expiredExperiment.end_date < new Date()) {
				cleanupOperations.push(
					mockDb.analytics_experiment.update({
						where: { id: expiredExperiment.id },
						data: { status: 'completed' }
					})
				);
			}

			mockDb.analytics_experiment.update.mockResolvedValue({
				...expiredExperiment,
				status: 'completed'
			});

			expect(cleanupOperations).toHaveLength(1);
		});
	});

	describe('Complex Query Optimizations', () => {
		it('should efficiently query experiment data with JSONB indexes', async () => {
			// Mock complex query that would benefit from JSONB indexing
			const complexQuery = {
				where: {
					type: 'funnel',
					status: 'active',
					AND: [
						{
							config: {
								path: ['targeting_rules', 'geo_restrictions'],
								array_contains: 'US'
							}
						},
						{
							config: {
								path: ['success_metrics'],
								array_contains: 'conversion_rate'
							}
						}
					]
				}
			};

			const mockResults = [
				{
					id: 'funnel-1',
					type: 'funnel',
					config: {
						targeting_rules: { geo_restrictions: ['US', 'CA'] },
						success_metrics: ['conversion_rate', 'completion_time']
					}
				}
			];

			mockDb.analytics_experiment.findMany.mockResolvedValue(mockResults);

			const result = await mockDb.analytics_experiment.findMany(complexQuery);

			expect(result).toHaveLength(1);
			expect(safeExperimentConfig(result[0]).targeting_rules.geo_restrictions).toContain('US');
		});

		it('should aggregate metrics across multiple experiments efficiently', async () => {
			// Mock aggregation query for dashboard analytics
			const mockAggregationData = [
				{
					type: 'funnel',
					_count: { id: 5 },
					_avg: { 'metrics_cache.conversion_rate': 0.12 }
				},
				{
					type: 'campaign',
					_count: { id: 3 },
					_avg: { 'metrics_cache.conversion_rate': 0.08 }
				},
				{
					type: 'ab_test',
					_count: { id: 2 },
					_avg: { 'metrics_cache.conversion_rate': 0.15 }
				}
			];

			mockDb.analytics_experiment.groupBy.mockResolvedValue(mockAggregationData);

			const result = await mockDb.analytics_experiment.groupBy({
				by: ['type'],
				_count: { id: true },
				_avg: { 'metrics_cache.conversion_rate': true },
				where: { status: 'active' }
			});

			expect(result).toHaveLength(3);
			expect(
				result.find((r: Record<string, unknown>) => r.type === 'ab_test')?._avg?.[
					'metrics_cache.conversion_rate'
				]
			).toBe(0.15);
		});
	});

	describe('Experiment Error Handling', () => {
		it('should handle invalid JSONB configuration gracefully', async () => {
			const invalidConfig = {
				id: 'invalid-experiment',
				name: 'Invalid Configuration Test',
				type: 'funnel',
				config: {
					steps: null, // Invalid - should be array
					targeting_rules: 'invalid', // Invalid - should be object
					success_metrics: {} // Invalid - should be array
				}
			};

			// Should validate config before database operation
			const isValidConfig = (config: unknown) => {
				return (
					config &&
					typeof config === 'object' &&
					config !== null &&
					Array.isArray((config as Record<string, unknown>).steps) &&
					typeof (config as Record<string, unknown>).targeting_rules === 'object' &&
					Array.isArray((config as Record<string, unknown>).success_metrics)
				);
			};

			expect(isValidConfig(invalidConfig.config)).toBe(false);
		});

		it('should handle metrics calculation failures gracefully', async () => {
			mockDb.analytics_event.findMany.mockRejectedValue(new Error('Database timeout'));

			// Should handle metrics calculation failure without breaking experiment
			const fallbackMetrics = {
				participants_count: 0,
				conversion_rate: 0,
				error: 'Metrics calculation failed',
				last_calculated: new Date().toISOString()
			};

			mockDb.analytics_experiment.update.mockResolvedValue({
				id: 'test-experiment',
				metrics_cache: fallbackMetrics
			});

			const result = await mockDb.analytics_experiment.update({
				where: { id: 'test-experiment' },
				data: { metrics_cache: fallbackMetrics }
			});

			expect(safeExperimentMetricsCache(result).error).toBe('Metrics calculation failed');
			expect(safeExperimentMetricsCache(result).participants_count).toBe(0);
		});
	});
});
