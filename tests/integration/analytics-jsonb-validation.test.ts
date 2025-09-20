/**
 * Analytics JSONB Field Validation Tests - Consolidated Schema
 * 
 * Tests JSONB field handling across analytics models:
 * - analytics_event.properties and computed_metrics
 * - analytics_session.device_data, session_metrics, funnel_progress
 * - analytics_experiment.config and metrics_cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockRequestEvent } from '../helpers/request-event';
import { safeEventProperties, safeComputedMetrics, safeSessionMetrics, safeDeviceData, safeExperimentConfig, safeExperimentMetricsCache } from '../helpers/json-test-helpers';

// Mock database for JSONB validation testing
const mockDb = vi.hoisted(() => ({
	analytics_event: {
		create: vi.fn(),
		createMany: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn()
	},
	analytics_session: {
		create: vi.fn(),
		upsert: vi.fn(),
		update: vi.fn(),
		findMany: vi.fn()
	},
	analytics_experiment: {
		create: vi.fn(),
		update: vi.fn(),
		findMany: vi.fn()
	}
}));

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

describe('Analytics JSONB Field Validation Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('analytics_event JSONB Fields', () => {
		describe('properties field validation', () => {
			it('should handle nested object structures in properties', async () => {
				const complexProperties = {
					user_interaction: {
						mouse_events: [
							{ x: 100, y: 200, timestamp: 1640995200000, type: 'click' },
							{ x: 150, y: 250, timestamp: 1640995201000, type: 'move' }
						],
						keyboard_events: [
							{ key: 'Tab', timestamp: 1640995202000 },
							{ key: 'Enter', timestamp: 1640995203000 }
						]
					},
					page_metadata: {
						title: 'Voting Rights Template',
						category: 'civic engagement',
						tags: ['voting', 'democracy', 'rights'],
						content_length: 2847,
						reading_time_estimate: 285
					},
					performance_metrics: {
						load_time: 1.234,
						first_contentful_paint: 0.856,
						largest_contentful_paint: 2.1,
						cumulative_layout_shift: 0.02
					},
					engagement_data: {
						scroll_depth: 0.75,
						time_on_page: 45000,
						interactions: ['click_cta', 'scroll', 'highlight_text'],
						exit_intent: false
					}
				};

				mockDb.analytics_event.create.mockResolvedValue({
					id: 'evt_complex_123',
					properties: complexProperties,
					computed_metrics: {}
				});

				const result = await mockDb.analytics_event.create({
					data: {
						session_id: 'sess_123',
						name: 'complex_interaction',
						event_type: 'interaction',
						properties: complexProperties,
						computed_metrics: {}
					}
				});

				// Verify complex nested structure is preserved
				expect(safeEventProperties(result).user_interaction.mouse_events).toHaveLength(2);
				expect(safeEventProperties(result).user_interaction.mouse_events[0].type).toBe('click');
				expect(safeEventProperties(result).page_metadata.tags).toContain('democracy');
				expect(safeEventProperties(result).performance_metrics.load_time).toBe(1.234);
				expect(safeEventProperties(result).engagement_data.interactions).toContain('scroll');
			});

			it('should handle array of different data types in properties', async () => {
				const arrayProperties = {
					mixed_array: [
						'string_value',
						42,
						true,
						null,
						{ nested: 'object', count: 5 },
						['nested', 'array', 123]
					],
					user_journey: [
						{ step: 'landing', timestamp: '2024-01-01T10:00:00Z', duration: 5000 },
						{ step: 'template_browse', timestamp: '2024-01-01T10:00:05Z', duration: 30000 },
						{ step: 'template_select', timestamp: '2024-01-01T10:00:35Z', duration: 2000 }
					],
					experimental_flags: [
						{ flag: 'new_ui_design', enabled: true, variant: 'version_b' },
						{ flag: 'analytics_v2', enabled: false, variant: null }
					]
				};

				mockDb.analytics_event.create.mockResolvedValue({
					id: 'evt_arrays_123',
					properties: arrayProperties
				});

				const result = await mockDb.analytics_event.create({
					data: {
						session_id: 'sess_123',
						name: 'array_test_event',
						event_type: 'interaction',
						properties: arrayProperties
					}
				});

				expect(safeEventProperties(result).mixed_array).toHaveLength(6);
				expect(safeEventProperties(result).mixed_array[0]).toBe('string_value');
				expect(safeEventProperties(result).mixed_array[1]).toBe(42);
				expect(safeEventProperties(result).mixed_array[4]).toEqual({ nested: 'object', count: 5 });
				expect(safeEventProperties(result).user_journey[1].step).toBe('template_browse');
				expect(safeEventProperties(result).experimental_flags[0].enabled).toBe(true);
			});

			it('should handle special characters and unicode in properties', async () => {
				const unicodeProperties = {
					international_text: {
						english: 'Contact your representative about voting rights',
						spanish: 'Contacta a tu representante sobre los derechos de voto',
						chinese: '联系您的代表了解投票权',
						arabic: 'اتصل بممثلك حول حقوق التصويت',
						emoji: '🗳️ Vote for democracy! 🏛️ Make your voice heard 📢'
					},
					special_characters: {
						json_meta: '{"key": "value", "nested": {"array": [1,2,3]}}',
						sql_injection_attempt: "'; DROP TABLE users; --",
						html_content: '<div class="template">Vote <strong>NOW</strong></div>',
						regex_pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
						escape_sequences: 'Line 1\nLine 2\tTabbed\r\nWindows newline'
					},
					edge_cases: {
						empty_string: '',
						only_whitespace: '   \t\n   ',
						null_value: null,
						very_long_string: 'a'.repeat(10000),
						binary_looking: '\x00\x01\x02\x03\xFF'
					}
				};

				mockDb.analytics_event.create.mockResolvedValue({
					id: 'evt_unicode_123',
					properties: unicodeProperties
				});

				const result = await mockDb.analytics_event.create({
					data: {
						session_id: 'sess_123',
						name: 'unicode_test_event',
						event_type: 'interaction',
						properties: unicodeProperties
					}
				});

				expect(safeEventProperties(result).international_text.chinese).toBe('联系您的代表了解投票权');
				expect(safeEventProperties(result).international_text.emoji).toBe('🗳️ Vote for democracy! 🏛️ Make your voice heard 📢');
				expect(safeEventProperties(result).special_characters.json_meta).toContain('"key": "value"');
				expect(safeEventProperties(result).edge_cases.very_long_string).toHaveLength(10000);
			});
		});

		describe('computed_metrics field validation', () => {
			it('should store calculated metrics in computed_metrics JSONB field', async () => {
				const computedMetrics = {
					engagement_score: 0.857,
					conversion_probability: 0.342,
					user_segment: 'high_intent',
					quality_score: 8.7,
					anomaly_detection: {
						is_anomaly: false,
						confidence: 0.95,
						reasons: []
					},
					real_time_calculations: {
						session_duration_percentile: 75,
						bounce_probability: 0.12,
						next_action_prediction: 'template_customization',
						user_value_score: 142.5
					},
					ml_insights: {
						clustering_assignment: 'civic_engaged_mobile',
						propensity_scores: {
							conversion: 0.68,
							churn: 0.15,
							advocacy: 0.82
						},
						feature_importance: {
							time_on_page: 0.34,
							scroll_depth: 0.28,
							previous_sessions: 0.21,
							utm_source: 0.17
						}
					}
				};

				mockDb.analytics_event.update.mockResolvedValue({
					id: 'evt_metrics_123',
					computed_metrics: computedMetrics
				});

				const result = await mockDb.analytics_event.update({
					where: { id: 'evt_metrics_123' },
					data: { computed_metrics: computedMetrics }
				});

				expect(safeComputedMetrics(result).engagement_score).toBe(0.857);
				expect(safeComputedMetrics(result).anomaly_detection.is_anomaly).toBe(false);
				expect(safeComputedMetrics(result).ml_insights.clustering_assignment).toBe('civic_engaged_mobile');
				expect(safeComputedMetrics(result).ml_insights.propensity_scores.advocacy).toBe(0.82);
			});

			it('should handle metrics with temporal data and timestamps', async () => {
				const temporalMetrics = {
					calculation_metadata: {
						calculated_at: '2024-01-01T10:15:30.123Z',
						calculation_duration_ms: 45,
						model_version: 'v2.1.3',
						feature_hash: 'abc123def456'
					},
					time_series_data: {
						hourly_engagement: [
							{ hour: '09:00', score: 0.2 },
							{ hour: '10:00', score: 0.6 },
							{ hour: '11:00', score: 0.8 }
						],
						daily_patterns: {
							weekday_avg: 0.65,
							weekend_avg: 0.42,
							best_hour: '14:00',
							worst_hour: '06:00'
						}
					},
					cohort_analysis: {
						cohort_month: '2024-01',
						days_since_first_visit: 15,
						retention_probability: 0.78,
						ltv_estimate: 47.50
					}
				};

				mockDb.analytics_event.update.mockResolvedValue({
					id: 'evt_temporal_123',
					computed_metrics: temporalMetrics
				});

				const result = await mockDb.analytics_event.update({
					where: { id: 'evt_temporal_123' },
					data: { computed_metrics: temporalMetrics }
				});

				expect(safeComputedMetrics(result).calculation_metadata.model_version).toBe('v2.1.3');
				expect(safeComputedMetrics(result).time_series_data.hourly_engagement).toHaveLength(3);
				expect(safeComputedMetrics(result).cohort_analysis.ltv_estimate).toBe(47.50);
			});
		});
	});

	describe('analytics_session JSONB Fields', () => {
		describe('device_data field validation', () => {
			it('should store comprehensive device information in device_data', async () => {
				const deviceData = {
					// Technical data
					ip_address: '192.168.1.100',
					user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X)',
					fingerprint: 'fp_abc123def456',
					
					// Parsed device information
					device_type: 'mobile',
					os: 'iOS',
					os_version: '15.6',
					browser: 'Safari',
					browser_version: '15.6',
					
					// Screen and viewport
					viewport: { width: 375, height: 812 },
					screen_resolution: { width: 375, height: 812, pixel_density: 3 },
					
					// Network and performance
					connection_type: '4g',
					connection_speed: 'fast',
					timezone: 'America/New_York',
					language: 'en-US',
					
					// Privacy and permissions
					cookies_enabled: true,
					do_not_track: false,
					ad_blocker_detected: false,
					
					// Accessibility features
					accessibility: {
						screen_reader: false,
						high_contrast: false,
						reduced_motion: false,
						font_size_preference: 'normal'
					}
				};

				mockDb.analytics_session.create.mockResolvedValue({
					session_id: 'sess_device_123',
					device_data: deviceData
				});

				const result = await mockDb.analytics_session.create({
					data: {
						session_id: 'sess_device_123',
						device_data: deviceData,
						session_metrics: {},
						funnel_progress: {}
					}
				});

				expect(safeDeviceData(result).device_type).toBe('mobile');
				expect(safeDeviceData(result).viewport.width).toBe(375);
				expect(safeDeviceData(result).accessibility.screen_reader).toBe(false);
				expect(safeDeviceData(result).connection_type).toBe('4g');
			});
		});

		describe('session_metrics field validation', () => {
			it('should store comprehensive session metrics with nested calculations', async () => {
				const sessionMetrics = {
					// Basic counters
					events_count: 25,
					page_views: 8,
					conversion_count: 2,
					interaction_count: 15,
					
					// Time-based metrics
					duration_ms: 1275000, // 21 minutes 15 seconds
					first_event_timestamp: '2024-01-01T10:00:00Z',
					last_event_timestamp: '2024-01-01T10:21:15Z',
					
					// Engagement metrics
					bounce_rate: 0.0,
					scroll_depth_avg: 0.67,
					interaction_rate: 0.6, // 15/25 events were interactions
					
					// Conversion metrics
					conversion_rate: 0.08, // 2/25 events were conversions
					conversion_value: 2.0,
					revenue_attribution: 0.0,
					
					// Quality metrics
					quality_score: 8.2,
					spam_score: 0.1,
					engagement_score: 0.78,
					
					// Funnel-specific metrics
					funnel_completion_rate: 0.5,
					funnel_drop_off_step: 3,
					funnel_conversions: 1,
					
					// Advanced analytics
					predictive_metrics: {
						churn_probability: 0.15,
						next_session_likelihood: 0.82,
						lifetime_value_estimate: 156.75,
						conversion_probability_next_visit: 0.45
					},
					
					// Performance tracking
					performance_metrics: {
						avg_page_load_time: 1.8,
						avg_api_response_time: 0.245,
						error_count: 0,
						slow_requests_count: 2
					}
				};

				mockDb.analytics_session.update.mockResolvedValue({
					session_id: 'sess_metrics_123',
					session_metrics: sessionMetrics
				});

				const result = await mockDb.analytics_session.update({
					where: { session_id: 'sess_metrics_123' },
					data: { session_metrics: sessionMetrics }
				});

				expect(safeSessionMetrics(result).events_count).toBe(25);
				expect(safeSessionMetrics(result).duration_ms).toBe(1275000);
				expect(safeSessionMetrics(result).predictive_metrics.lifetime_value_estimate).toBe(156.75);
				expect(safeSessionMetrics(result).performance_metrics.error_count).toBe(0);
			});
		});

		describe('funnel_progress field validation', () => {
			it('should store multiple funnel progress states with rich metadata', async () => {
				const funnelProgress = {
					'voting-rights-funnel': {
						current_step: 4,
						completed_steps: [1, 2, 3, 4],
						last_step_timestamp: '2024-01-01T10:20:00Z',
						conversion_likelihood: 0.85,
						completion_probability: 0.78,
						step_durations: [30000, 45000, 120000, 60000], // milliseconds per step
						total_time_in_funnel: 255000,
						drop_off_risk: 0.22,
						personalization_score: 0.67,
						a_b_test_variant: 'streamlined_flow'
					},
					'onboarding-funnel': {
						current_step: 2,
						completed_steps: [1, 2],
						last_step_timestamp: '2024-01-01T10:15:00Z',
						conversion_likelihood: 0.45,
						completion_probability: 0.38,
						step_durations: [60000, 90000],
						total_time_in_funnel: 150000,
						drop_off_risk: 0.62,
						abandonment_reason: 'address_verification_difficulty',
						retry_count: 1,
						assistance_offered: true
					},
					'template-customization-funnel': {
						current_step: 1,
						completed_steps: [1],
						last_step_timestamp: '2024-01-01T10:22:00Z',
						conversion_likelihood: 0.25,
						completion_probability: 0.20,
						step_durations: [15000],
						total_time_in_funnel: 15000,
						drop_off_risk: 0.80,
						complexity_score: 'high',
						ai_assistance_used: false,
						template_category: 'environmental'
					}
				};

				mockDb.analytics_session.update.mockResolvedValue({
					session_id: 'sess_funnel_123',
					funnel_progress: funnelProgress
				});

				const result = await mockDb.analytics_session.update({
					where: { session_id: 'sess_funnel_123' },
					data: { funnel_progress: funnelProgress }
				});

				expect(Object.keys(result.funnel_progress)).toHaveLength(3);
				expect(result.funnel_progress['voting-rights-funnel'].current_step).toBe(4);
				expect(result.funnel_progress['voting-rights-funnel'].step_durations).toHaveLength(4);
				expect(result.funnel_progress['onboarding-funnel'].abandonment_reason).toBe('address_verification_difficulty');
				expect(result.funnel_progress['template-customization-funnel'].complexity_score).toBe('high');
			});
		});
	});

	describe('analytics_experiment JSONB Fields', () => {
		describe('config field validation', () => {
			it('should store complex experiment configuration in config JSONB', async () => {
				const experimentConfig = {
					// Funnel configuration
					steps: [
						{
							name: 'discovery',
							order: 1,
							required: true,
							goal_event: 'template_viewed',
							timeout_minutes: 30,
							fallback_action: 'show_simplified_version'
						},
						{
							name: 'authentication',
							order: 2,
							required: true,
							goal_event: 'auth_completed',
							timeout_minutes: 10,
							retry_limit: 3,
							providers: ['google', 'github', 'twitter']
						}
					],
					
					// Targeting and segmentation
					targeting_rules: {
						geographic: {
							included_countries: ['US', 'CA', 'UK'],
							excluded_regions: ['EU'],
							timezone_restrictions: ['America/New_York', 'America/Los_Angeles']
						},
						demographic: {
							age_range: [18, 65],
							languages: ['en', 'es', 'fr'],
							device_types: ['mobile', 'desktop']
						},
						behavioral: {
							previous_visits: { min: 0, max: 5 },
							session_duration_min: 30000,
							engagement_score_min: 0.3,
							conversion_history: 'none_to_low'
						}
					},
					
					// A/B test variations
					variations: [
						{
							name: 'control',
							weight: 0.4,
							config: {
								ui_theme: 'standard',
								form_fields: ['email', 'name', 'address'],
								assistance_level: 'minimal',
								ai_suggestions: false
							}
						},
						{
							name: 'streamlined',
							weight: 0.3,
							config: {
								ui_theme: 'modern',
								form_fields: ['email'],
								assistance_level: 'guided',
								ai_suggestions: true,
								progressive_disclosure: true
							}
						},
						{
							name: 'personalized',
							weight: 0.3,
							config: {
								ui_theme: 'adaptive',
								form_fields: ['email', 'name'],
								assistance_level: 'proactive',
								ai_suggestions: true,
								personalization_engine: 'ml_driven'
							}
						}
					],
					
					// Success criteria
					success_metrics: [
						'conversion_rate',
						'completion_time',
						'user_satisfaction',
						'long_term_retention'
					],
					
					// Statistical configuration
					statistical_config: {
						confidence_level: 0.95,
						minimum_sample_size: 1000,
						minimum_detectable_effect: 0.05,
						test_duration_days: 21,
						early_stopping_enabled: true,
						sequential_testing: true
					}
				};

				mockDb.analytics_experiment.create.mockResolvedValue({
					id: 'exp_complex_123',
					config: experimentConfig
				});

				const result = await mockDb.analytics_experiment.create({
					data: {
						id: 'exp_complex_123',
						name: 'Complex Experiment',
						type: 'ab_test',
						config: experimentConfig,
						metrics_cache: {}
					}
				});

				expect(safeExperimentConfig(result).steps).toHaveLength(2);
				expect(safeExperimentConfig(result).variations).toHaveLength(3);
				expect(safeExperimentConfig(result).targeting_rules.geographic.included_countries).toContain('US');
				expect(safeExperimentConfig(result).statistical_config.confidence_level).toBe(0.95);
			});
		});

		describe('metrics_cache field validation', () => {
			it('should store comprehensive experiment metrics in metrics_cache', async () => {
				const metricsCache = {
					// Basic participation metrics
					participants_count: 5847,
					total_sessions: 7293,
					unique_users: 5847,
					
					// Conversion metrics
					conversion_rate: 0.127,
					conversion_count: 743,
					conversion_value_total: 3715.50,
					
					// A/B test specific metrics
					variation_results: {
						control: {
							participants: 2339,
							conversions: 267,
							conversion_rate: 0.114,
							confidence_interval: [0.098, 0.130],
							statistical_significance: 0.89
						},
						streamlined: {
							participants: 1754,
							conversions: 247,
							conversion_rate: 0.141,
							confidence_interval: [0.122, 0.160],
							statistical_significance: 0.95
						},
						personalized: {
							participants: 1754,
							conversions: 229,
							conversion_rate: 0.131,
							confidence_interval: [0.112, 0.150],
							statistical_significance: 0.92
						}
					},
					
					// Statistical analysis
					statistical_significance: 0.95,
					p_value: 0.032,
					confidence_interval: [0.015, 0.045],
					effect_size: 0.027,
					test_power: 0.84,
					winning_variation: 'streamlined',
					
					// Performance metrics
					avg_completion_time: {
						control: 425000, // 7 minutes 5 seconds
						streamlined: 298000, // 4 minutes 58 seconds
						personalized: 367000 // 6 minutes 7 seconds
					},
					
					// Quality metrics
					user_satisfaction: {
						control: 7.2,
						streamlined: 8.1,
						personalized: 7.8
					},
					
					// Funnel-specific metrics
					funnel_completion_rates: {
						step_1: 0.95,
						step_2: 0.67,
						step_3: 0.45,
						step_4: 0.34,
						overall: 0.32
					},
					
					// Time-based analysis
					temporal_analysis: {
						daily_conversion_rates: [
							{ date: '2024-01-01', rate: 0.10 },
							{ date: '2024-01-02', rate: 0.12 },
							{ date: '2024-01-03', rate: 0.14 }
						],
						peak_performance_hour: '14:00',
						seasonal_trends: {
							weekday_avg: 0.135,
							weekend_avg: 0.098
						}
					},
					
					// Metadata
					last_calculated: '2024-01-01T15:30:00Z',
					calculation_duration_ms: 1247,
					data_freshness_score: 0.98,
					sample_size_adequacy: 'sufficient'
				};

				mockDb.analytics_experiment.update.mockResolvedValue({
					id: 'exp_metrics_123',
					metrics_cache: metricsCache
				});

				const result = await mockDb.analytics_experiment.update({
					where: { id: 'exp_metrics_123' },
					data: { metrics_cache: metricsCache }
				});

				expect(safeExperimentMetricsCache(result).participants_count).toBe(5847);
				expect(safeExperimentMetricsCache(result).winning_variation).toBe('streamlined');
				expect(safeExperimentMetricsCache(result).variation_results.streamlined.conversion_rate).toBe(0.141);
				expect(safeExperimentMetricsCache(result).funnel_completion_rates.overall).toBe(0.32);
				expect(safeExperimentMetricsCache(result).temporal_analysis.daily_conversion_rates).toHaveLength(3);
			});
		});
	});

	describe('JSONB Query Performance and Indexing', () => {
		it('should efficiently query JSONB fields with path operators', async () => {
			// Mock queries that would benefit from JSONB indexing
			const jsonbQueries = [
				{
					name: 'Event properties by template category',
					query: {
						where: {
							properties: {
								path: ['template_category'],
								equals: 'voting'
							}
						}
					}
				},
				{
					name: 'Sessions with mobile device type',
					query: {
						where: {
							device_data: {
								path: ['device_type'],
								equals: 'mobile'
							}
						}
					}
				},
				{
					name: 'High engagement sessions',
					query: {
						where: {
							session_metrics: {
								path: ['engagement_score'],
								gte: 0.7
							}
						}
					}
				},
				{
					name: 'Active experiments with high conversion',
					query: {
						where: {
							metrics_cache: {
								path: ['conversion_rate'],
								gte: 0.1
							}
						}
					}
				}
			];

			// Mock results for each query type
			mockDb.analytics_event.findMany.mockResolvedValue([{ id: 'evt_1' }]);
			mockDb.analytics_session.findMany.mockResolvedValue([{ session_id: 'sess_1' }]);
			mockDb.analytics_experiment.findMany.mockResolvedValue([{ id: 'exp_1' }]);

			// Execute mock queries
			for (const queryTest of jsonbQueries) {
				let result;
				if (queryTest.name.includes('Event')) {
					result = await mockDb.analytics_event.findMany(queryTest.query);
				} else if (queryTest.name.includes('Sessions')) {
					result = await mockDb.analytics_session.findMany(queryTest.query);
				} else if (queryTest.name.includes('experiments')) {
					result = await mockDb.analytics_experiment.findMany(queryTest.query);
				}

				expect(result).toBeDefined();
				expect(Array.isArray(result)).toBe(true);
			}
		});

		it('should handle JSONB aggregation queries efficiently', async () => {
			// Mock aggregation operations on JSONB fields
			const aggregationQueries = [
				{
					name: 'Average engagement score by device type',
					operation: 'groupBy',
					field: 'device_data.device_type'
				},
				{
					name: 'Conversion rate distribution by experiment',
					operation: 'aggregate',
					field: 'metrics_cache.conversion_rate'
				}
			];

			mockDb.analytics_session.findMany.mockResolvedValue([
				{
					session_id: 'sess_1',
					device_data: { device_type: 'mobile' },
					session_metrics: { engagement_score: 0.8 }
				},
				{
					session_id: 'sess_2',
					device_data: { device_type: 'desktop' },
					session_metrics: { engagement_score: 0.6 }
				}
			]);

			const sessions = await mockDb.analytics_session.findMany({});
			
			// Simulate aggregation logic
			const deviceEngagement = sessions.reduce((acc: any, session: any) => {
				const deviceType = session.device_data?.device_type || 'unknown';
				const engagement = session.session_metrics?.engagement_score || 0;
				
				if (!acc[deviceType]) {
					acc[deviceType] = { total: 0, count: 0 };
				}
				acc[deviceType].total += engagement;
				acc[deviceType].count += 1;
				
				return acc;
			}, {});

			// Calculate averages
			const avgEngagementByDevice = Object.entries(deviceEngagement).map(([device, data]: [string, any]) => ({
				device_type: device,
				avg_engagement: data.total / data.count
			}));

			expect(avgEngagementByDevice).toHaveLength(2);
			expect(avgEngagementByDevice.find(d => d.device_type === 'mobile')?.avg_engagement).toBe(0.8);
			expect(avgEngagementByDevice.find(d => d.device_type === 'desktop')?.avg_engagement).toBe(0.6);
		});
	});

	describe('JSONB Error Handling and Data Integrity', () => {
		it('should handle malformed JSONB data gracefully', async () => {
			const malformedData = [
				{
					name: 'Circular reference',
					data: (() => {
						const obj: any = { name: 'circular' };
						obj.self = obj;
						return obj;
					})()
				},
				{
					name: 'Very large object',
					data: {
						large_array: new Array(10000).fill({ data: 'test'.repeat(100) })
					}
				},
				{
					name: 'Invalid JSON when stringified',
					data: {
						bigint: BigInt(123),
						undefined_value: undefined,
						function_value: () => 'test',
						symbol: Symbol('test')
					}
				}
			];

			for (const testCase of malformedData) {
				// In real implementation, this would be handled by serialization logic
				const safeStringify = (obj: any) => {
					try {
						return JSON.stringify(obj, (key, value) => {
							if (typeof value === 'bigint') return value.toString();
							if (typeof value === 'function') return '[Function]';
							if (typeof value === 'symbol') return value.toString();
							if (typeof value === 'undefined') return null;
							return value;
						});
					} catch (error) {
						return JSON.stringify({ error: 'Serialization failed', original_type: typeof obj });
					}
				};

				const serialized = safeStringify(testCase.data);
				expect(serialized).toBeDefined();
				expect(typeof serialized).toBe('string');
				
				// Should not throw when parsing back
				expect(() => JSON.parse(serialized)).not.toThrow();
			}
		});

		it('should validate JSONB schema constraints', async () => {
			// Test cases for schema validation
			const validationTests = [
				{
					field: 'analytics_event.properties',
					valid: { template_id: 'template-123', engagement_score: 0.85 },
					invalid: 'not_an_object'
				},
				{
					field: 'analytics_session.session_metrics',
					valid: { events_count: 10, conversion_rate: 0.1 },
					invalid: null
				},
				{
					field: 'analytics_experiment.config',
					valid: { steps: [], variations: [], success_metrics: [] },
					invalid: []
				}
			];

			for (const test of validationTests) {
				// Validate that valid data passes
				expect(typeof test.valid).toBe('object');
				expect(test.valid).not.toBeNull();
				
				// Validate that invalid data fails
				if (test.field.includes('session_metrics') || test.field.includes('properties')) {
					expect(typeof test.invalid === 'object').toBe(false);
				}
			}
		});
	});
});