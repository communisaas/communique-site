/**
 * Comprehensive type definitions for all Prisma JsonValue fields
 * This file contains type interfaces for every JSON field in the database schema
 * and provides type-safe access patterns for JsonValue data.
 */

import type { Prisma } from '@prisma/client';

// ============= ANALYTICS SCHEMA TYPES =============

export interface AnalyticsSessionMetrics {
	events_count: number;
	page_views: number;
	duration_ms: number;
	conversion_count: number;
	bounce_rate: number;
	funnel_conversions: number;
	last_event_timestamp: string;
	predictive_metrics: {
		lifetime_value_estimate: number;
		churn_probability: number;
		engagement_score: number;
	};
	performance_metrics: {
		error_count: number;
		load_time_avg: number;
		interaction_delay: number;
	};
}

export interface AnalyticsDeviceData {
	ip_address: string;
	user_agent: string;
	fingerprint: string;
	device_type: 'desktop' | 'mobile' | 'tablet';
	browser: string;
	os: string;
	viewport: {
		width: number;
		height: number;
	};
	connection_type: '3g' | '4g' | '5g' | 'wifi' | 'ethernet';
	accessibility: {
		screen_reader: boolean;
		high_contrast: boolean;
		reduced_motion: boolean;
	};
}

export interface AnalyticsFunnelProgress {
	[funnelId: string]: {
		current_step: number;
		completed_steps: number[];
		started_at: string;
		last_step_at: string;
		completion_rate: number;
	};
}

export interface AnalyticsEventProperties {
	[key: string]: unknown;
	// Common properties
	template_id?: string;
	variation?: string;
	step?: number;
	page?: string;
	language?: string;
	migration_source?: string;

	// Nested objects
	user_interaction?: {
		mouse_events: Array<{
			type: 'click' | 'hover' | 'scroll';
			target: string;
			timestamp: number;
		}>;
		keyboard_events: Array<{
			type: 'keydown' | 'keyup';
			key: string;
			timestamp: number;
		}>;
	};

	page_metadata?: {
		title: string;
		url: string;
		tags: string[];
		category: string;
	};

	performance_metrics?: {
		load_time: number;
		first_paint: number;
		largest_contentful_paint: number;
	};

	engagement_data?: {
		interactions: string[];
		time_on_page: number;
		scroll_depth: number;
	};

	// International and complex data
	international_text?: {
		chinese?: string;
		emoji?: string;
		arabic?: string;
	};

	special_characters?: {
		json_meta?: string;
		html_entities?: string;
		unicode_symbols?: string;
	};

	edge_cases?: {
		very_long_string?: string;
		empty_object?: Record<string, never>;
		null_prototype?: unknown;
	};

	// Arrays and mixed data
	mixed_array?: unknown[];
	user_journey?: Array<{
		step: string;
		timestamp: number;
		duration: number;
	}>;

	experimental_flags?: Array<{
		name: string;
		enabled: boolean;
		version: string;
	}>;
}

export interface AnalyticsComputedMetrics {
	engagement_score: number;
	conversion_probability: number;
	anomaly_detection: {
		is_anomaly: boolean;
		anomaly_score: number;
		explanation: string;
	};
	ml_insights: {
		clustering_assignment: string;
		propensity_scores: {
			advocacy: number;
			engagement: number;
			retention: number;
		};
	};
	calculation_metadata: {
		model_version: string;
		computed_at: string;
		confidence_interval: [number, number];
	};
	time_series_data: {
		hourly_engagement: Array<{
			hour: number;
			score: number;
		}>;
	};
	cohort_analysis: {
		ltv_estimate: number;
		retention_rate: number;
		churn_risk: number;
	};
	legacy_migration_flag?: boolean;
}

// ============= EXPERIMENT SCHEMA TYPES =============

export interface AnalyticsExperimentConfig {
	steps?: Array<{
		goal_event: string;
		name: string;
		description: string;
	}>;

	variations?: Array<{
		name: string;
		weight: number;
		config: {
			auth_modal_style?: string;
			profile_required?: boolean;
			personalization_level?: string;
		};
	}>;

	targeting_rules?: {
		template_categories?: string[];
		geo_restrictions?: string[];
		geographic?: {
			included_countries: string[];
			excluded_regions: string[];
		};
		demographic?: {
			age_range: [number, number];
			languages: string[];
		};
	};

	optimization_goals?: {
		primary: string;
		secondary: string[];
	};

	statistical_config?: {
		confidence_level: number;
		minimum_sample_size: number;
		expected_effect_size: number;
	};

	// Campaign specific
	budget?: number;
	campaign_channels?: string[];
	kpi_targets?: {
		total_reach: number;
		conversion_rate: number;
		cost_per_acquisition: number;
	};
}

export interface AnalyticsExperimentMetricsCache {
	participants_count: number;
	conversion_rate: number;
	winning_variation?: string;
	statistical_significance?: number;
	recommendation?: string;
	error?: string;

	// Funnel specific
	funnel_completion_rate?: number;
	step_conversion_rates?: {
		[stepKey: string]: number;
	};
	drop_off_analysis?: {
		highest_drop_off_step: number;
		drop_off_reasons: string[];
	};

	// A/B Test specific
	variation_results?: {
		[variationName: string]: {
			conversion_rate: number;
			sample_size: number;
			confidence_interval: [number, number];
		};
	};

	// Campaign specific
	budget_spent?: number;
	cost_metrics?: {
		cost_per_click: number;
		cost_per_conversion: number;
		return_on_ad_spend: number;
	};

	// Funnel analysis
	funnel_completion_rates?: {
		overall: number;
		by_variation: Record<string, number>;
	};

	temporal_analysis?: {
		daily_conversion_rates: Array<{
			date: string;
			rate: number;
		}>;
	};
}

// ============= AGENT & DECISION TYPES =============

export interface AgentDecisionMultipliers {
	urgency: number;
	participation_score: number;
	market_conditions: number;
	time_decay: number;
	geographic_relevance: number;
	template_quality: number;
}

export interface AgentDecisionData {
	agent_source: string;
	decision_type: string;
	confidence: number;
	reasoning: string;
	multipliers: AgentDecisionMultipliers;
	timestamp: string;
	model_version: string;
}

export interface NetworkActivityData {
	total_actions: number;
	recent_activity_score: number;
	network_effects: {
		viral_coefficient: number;
		cascade_depth: number;
		influence_radius: number;
	};
	geographic_distribution: Record<string, number>;
	temporal_patterns: {
		peak_hours: number[];
		weekly_pattern: number[];
	};
}

// ============= AUDIT & USER TYPES =============

export interface AuditLogData {
	action_details: Record<string, unknown>;
	request_metadata: {
		ip_address: string;
		user_agent: string;
		session_id: string;
	};
	context: {
		template_id?: string;
		challenge_id?: string;
		transaction_hash?: string;
	};
	validation_results?: {
		passed: boolean;
		checks: Record<string, boolean>;
		error_messages: string[];
	};
}

export interface CertificationData {
	certificate_hash: string;
	issuer: string;
	verification_method: string;
	claims: Record<string, unknown>;
	expiry_date?: string;
	revocation_status?: 'active' | 'revoked' | 'expired';
}

export interface ConsensusData {
	agent_votes: Record<string, number>;
	consensus_algorithm: string;
	threshold_met: boolean;
	dissenting_opinions?: Array<{
		agent: string;
		vote: number;
		reasoning: string;
	}>;
}

export interface UserVerificationData {
	method: 'email' | 'phone' | 'government_id' | 'didit' | 'oauth';
	verified_at: string;
	provider?: string;
	provider_data?: Record<string, unknown>;
	confidence_score?: number;
	additional_checks?: Record<string, boolean>;
}

export interface PoliticalEmbedding {
	dimensions: number[];
	embedding_version: string;
	computed_at: string;
	confidence: number;
	source_data: {
		template_interactions: number;
		explicit_preferences: Record<string, unknown>;
		behavioral_signals: Record<string, unknown>;
	};
}

export interface CommunitySheaves {
	sheaf_id: string;
	topology: {
		nodes: Array<{
			id: string;
			type: string;
			properties: Record<string, unknown>;
		}>;
		edges: Array<{
			source: string;
			target: string;
			weight: number;
		}>;
	};
	calculated_at: string;
	stability_score: number;
}

// ============= TEMPLATE TYPES =============

export interface TemplateMetrics {
	page_views: number;
	events_count: number;
	conversion_count: number;
	delivered: number;
	success_rate: number;
	engagement_metrics: {
		time_on_page: number;
		scroll_depth: number;
		interaction_count: number;
	};
	geographic_distribution: Record<string, number>;
	temporal_analysis: {
		hourly_usage: number[];
		daily_trends: Array<{
			date: string;
			usage: number;
		}>;
	};
}

export interface CorrectionLog {
	changes: Array<{
		type: 'grammar' | 'clarity' | 'factual' | 'formatting';
		original: string;
		corrected: string;
		confidence: number;
		agent_source: string;
	}>;
	summary: {
		total_changes: number;
		severity_reduced: number;
		quality_improvement: number;
	};
	agent_consensus: {
		agreement_score: number;
		dissenting_agents: string[];
	};
}

export interface AgentVotes {
	[agentName: string]: {
		score: number;
		confidence: number;
		reasoning: string;
		criteria_scores: {
			grammar: number;
			clarity: number;
			factual_accuracy: number;
			persuasiveness: number;
		};
	};
}

export interface OriginalContent {
	subject: string;
	body: string;
	metadata: {
		length: number;
		readability_score: number;
		sentiment: number;
	};
	preserved_at: string;
}

// ============= TYPE GUARDS =============

export function isAnalyticsSessionMetrics(value: unknown): value is AnalyticsSessionMetrics {
	return (
		typeof value === 'object' &&
		value !== null &&
		'events_count' in value &&
		typeof (value as AnalyticsSessionMetrics).events_count === 'number'
	);
}

export function isAnalyticsDeviceData(value: unknown): value is AnalyticsDeviceData {
	return (
		typeof value === 'object' &&
		value !== null &&
		'device_type' in value &&
		typeof (value as AnalyticsDeviceData).device_type === 'string'
	);
}

export function isAnalyticsEventProperties(value: unknown): value is AnalyticsEventProperties {
	return typeof value === 'object' && value !== null;
}

export function isAnalyticsComputedMetrics(value: unknown): value is AnalyticsComputedMetrics {
	return (
		typeof value === 'object' &&
		value !== null &&
		'engagement_score' in value &&
		typeof (value as AnalyticsComputedMetrics).engagement_score === 'number'
	);
}

export function isAnalyticsExperimentConfig(value: unknown): value is AnalyticsExperimentConfig {
	return typeof value === 'object' && value !== null;
}

export function isAnalyticsExperimentMetricsCache(
	value: unknown
): value is AnalyticsExperimentMetricsCache {
	return (
		typeof value === 'object' &&
		value !== null &&
		'participants_count' in value &&
		typeof (value as AnalyticsExperimentMetricsCache).participants_count === 'number'
	);
}

export function isAgentDecisionMultipliers(value: unknown): value is AgentDecisionMultipliers {
	return (
		typeof value === 'object' &&
		value !== null &&
		'urgency' in value &&
		typeof (value as AgentDecisionMultipliers).urgency === 'number'
	);
}

export function isTemplateMetrics(value: unknown): value is TemplateMetrics {
	return (
		typeof value === 'object' &&
		value !== null &&
		'page_views' in value &&
		typeof (value as TemplateMetrics).page_views === 'number'
	);
}

export function isUserVerificationData(value: unknown): value is UserVerificationData {
	return (
		typeof value === 'object' &&
		value !== null &&
		'method' in value &&
		typeof (value as UserVerificationData).method === 'string'
	);
}

// ============= SAFE ACCESS HELPERS =============

export function getSessionMetrics(jsonValue: Prisma.JsonValue): AnalyticsSessionMetrics {
	if (isAnalyticsSessionMetrics(jsonValue)) {
		return jsonValue;
	}

	// Return safe defaults
	return {
		events_count: 0,
		page_views: 0,
		duration_ms: 0,
		conversion_count: 0,
		bounce_rate: 0,
		funnel_conversions: 0,
		last_event_timestamp: new Date().toISOString(),
		predictive_metrics: {
			lifetime_value_estimate: 0,
			churn_probability: 0.5,
			engagement_score: 0
		},
		performance_metrics: {
			error_count: 0,
			load_time_avg: 0,
			interaction_delay: 0
		}
	};
}

export function getDeviceData(jsonValue: Prisma.JsonValue): AnalyticsDeviceData {
	if (isAnalyticsDeviceData(jsonValue)) {
		return jsonValue;
	}

	return {
		ip_address: '0.0.0.0',
		user_agent: 'Unknown',
		fingerprint: '',
		device_type: 'desktop',
		browser: 'Unknown',
		os: 'Unknown',
		viewport: { width: 1920, height: 1080 },
		connection_type: 'wifi',
		accessibility: {
			screen_reader: false,
			high_contrast: false,
			reduced_motion: false
		}
	};
}

export function getEventProperties(jsonValue: Prisma.JsonValue): AnalyticsEventProperties {
	if (isAnalyticsEventProperties(jsonValue)) {
		return jsonValue as AnalyticsEventProperties;
	}
	return {};
}

export function getComputedMetrics(jsonValue: Prisma.JsonValue): AnalyticsComputedMetrics {
	if (isAnalyticsComputedMetrics(jsonValue)) {
		return jsonValue;
	}

	return {
		engagement_score: 0,
		conversion_probability: 0,
		anomaly_detection: {
			is_anomaly: false,
			anomaly_score: 0,
			explanation: 'No data available'
		},
		ml_insights: {
			clustering_assignment: 'unassigned',
			propensity_scores: {
				advocacy: 0,
				engagement: 0,
				retention: 0
			}
		},
		calculation_metadata: {
			model_version: 'v1.0.0',
			computed_at: new Date().toISOString(),
			confidence_interval: [0, 0]
		},
		time_series_data: {
			hourly_engagement: []
		},
		cohort_analysis: {
			ltv_estimate: 0,
			retention_rate: 0,
			churn_risk: 0.5
		}
	};
}

export function getExperimentConfig(jsonValue: Prisma.JsonValue): AnalyticsExperimentConfig {
	if (isAnalyticsExperimentConfig(jsonValue)) {
		return jsonValue as AnalyticsExperimentConfig;
	}
	return {};
}

export function getExperimentMetricsCache(
	jsonValue: Prisma.JsonValue
): AnalyticsExperimentMetricsCache {
	if (isAnalyticsExperimentMetricsCache(jsonValue)) {
		return jsonValue;
	}

	return {
		participants_count: 0,
		conversion_rate: 0
	};
}

export function getAgentDecisionMultipliers(jsonValue: Prisma.JsonValue): AgentDecisionMultipliers {
	if (isAgentDecisionMultipliers(jsonValue)) {
		return jsonValue;
	}

	return {
		urgency: 1.0,
		participation_score: 1.0,
		market_conditions: 1.0,
		time_decay: 1.0,
		geographic_relevance: 1.0,
		template_quality: 1.0
	};
}

export function getTemplateMetrics(jsonValue: Prisma.JsonValue): TemplateMetrics {
	if (isTemplateMetrics(jsonValue)) {
		return jsonValue;
	}

	return {
		page_views: 0,
		events_count: 0,
		conversion_count: 0,
		delivered: 0,
		success_rate: 0,
		engagement_metrics: {
			time_on_page: 0,
			scroll_depth: 0,
			interaction_count: 0
		},
		geographic_distribution: {},
		temporal_analysis: {
			hourly_usage: new Array(24).fill(0),
			daily_trends: []
		}
	};
}

export function getUserVerificationData(jsonValue: Prisma.JsonValue): UserVerificationData | null {
	if (isUserVerificationData(jsonValue)) {
		return jsonValue;
	}
	return null;
}

// ============= UTILITY FUNCTIONS =============

/**
 * Safely access nested properties in JSON data
 */
export function safeJsonAccess<T>(jsonValue: Prisma.JsonValue, path: string, defaultValue: T): T {
	try {
		if (!jsonValue || typeof jsonValue !== 'object' || jsonValue === null) {
			return defaultValue;
		}

		const keys = path.split('.');
		let current: unknown = jsonValue;

		for (const key of keys) {
			if (current && typeof current === 'object' && key in current) {
				current = (current as Record<string, unknown>)[key];
			} else {
				return defaultValue;
			}
		}

		return current as T;
	} catch (error) {
		return defaultValue;
	}
}

/**
 * Safely update nested properties in JSON data
 */
export function safeJsonUpdate<T extends Record<string, unknown>>(
	jsonValue: Prisma.JsonValue,
	updates: Partial<T>
): T {
	const base = (typeof jsonValue === 'object' && jsonValue !== null ? jsonValue : {}) as T;
	return { ...base, ...updates };
}
