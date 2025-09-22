/**
 * ANALYTICS TYPE SYSTEM - Post-Consolidation Types (Phase 1: 8→3 Models)
 *
 * This file contains TypeScript interfaces for our consolidated analytics system:
 * - analytics_event (unified _event store with JSONB properties)
 * - analytics_session (enhanced session tracking with UTM data)
 * - analytics_experiment (unified campaigns/funnels/variations)
 */

// === CONSOLIDATED ANALYTICS TYPES (Phase 1) ===

// Unified Analytics Event (replaces analytics_event + analytics__event_property)
export interface AnalyticsEvent {
	id: string;
	session_id: string;
	user_id?: string;
	timestamp: Date;
	name: string;
	event_type: 'pageview' | 'interaction' | 'conversion' | 'funnel' | 'campaign';
	template_id?: string;
	funnel_step?: number;
	experiment_id?: string;
	properties: Record<string, unknown>; // JSONB field for flexible event properties
	computed_metrics: Record<string, unknown>; // JSONB field for cached aggregations
	created_at: Date;
}

// Enhanced Analytics Session (replaces user_session)
export interface AnalyticsSession {
	session_id: string;
	user_id?: string;
	created_at: Date;
	updated_at: Date;

	// UTM and acquisition data
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	landing_page?: string;
	referrer?: string;

	// Device and technical data (JSONB)
	device_data: {
		ip_address?: string;
		user_agent?: string;
		fingerprint?: string;
		viewport?: { width: number; height: number };
		browser?: string;
		os?: string;
	};

	// Session metrics (JSONB)
	session_metrics: {
		events_count: number;
		page_views: number;
		duration_ms?: number;
		bounce_rate?: number;
		conversion_count?: number;
		conversion_value?: number;
		funnel_conversions?: Record<string, unknown>;
		// Additional metrics for advanced analytics
		predictive_metrics?: Record<string, unknown>;
		performance_metrics?: Record<string, unknown>;
	};

	// Funnel progress tracking (JSONB)
	funnel_progress: Record<
		string,
		{
			current_step: number;
			completed_steps: number[];
			last_step_timestamp: string;
			conversion_likelihood?: number;
		}
	>;
}

// Unified Analytics Experiment (replaces analytics_funnel + analytics_campaign + analytics_variation)
export interface AnalyticsExperiment {
	id: string;
	name: string;
	type: 'funnel' | 'campaign' | 'ab_test';
	status: 'active' | 'paused' | 'completed';

	// Unified configuration (JSONB for maximum flexibility)
	config: {
		// For funnels
		steps?: Array<{
			name: string;
			order: number;
			required: boolean;
			goal_event?: string;
		}>;
		// For campaigns
		target_audience?: Record<string, unknown>;
		budget?: number;
		budget_currency?: string;
		budget_allocation?: Record<string, unknown>;
		campaign_channels?: Array<{
			name: string;
			budget_share: number;
			targeting: Record<string, unknown>;
		}>;
		kpi_targets?: Record<string, unknown>;
		// For A/B tests
		variations?: Array<{
			name: string;
			weight: number;
			config: Record<string, unknown>;
		}>;
		// Common
		targeting_rules?: Record<string, unknown>;
		success_metrics?: string[];
		optimization_goals?: Record<string, unknown>;
		statistical_config?: Record<string, unknown>;
		hypothesis?: Record<string, unknown>;
		statistical_confidence?: number;
	};

	// Timeline
	start_date?: Date;
	end_date?: Date;

	// Performance metrics cache (JSONB)
	metrics_cache: {
		participants_count?: number;
		conversion_rate?: number;
		conversion_count?: number;
		revenue?: number;
		engagement_rate?: number;
		completion_rate?: number;
		statistical_significance?: number;
		confidence_interval?: [number, number];
		last_calculated: string;
		// Additional metrics for campaigns and experiments
		reach_count?: number;
		winning_variation?: Record<string, unknown>;
		variation_results?: Record<string, unknown>;
		drop_off_analysis?: Record<string, unknown>;
		step_conversion_rates?: Record<string, number>;
		recommendation?: string;
		error?: string;
		budget_spent?: number;
		funnel_completion_rate?: number;
		funnel_completion_rates?: Record<string, number>;
		temporal_analysis?: Record<string, unknown>;
		cost_per_conversion?: number;
		predictive_metrics?: Record<string, unknown>;
		performance_metrics?: Record<string, unknown>;
	};

	created_at: Date;
	updated_at: Date;
}

// === SPECIALIZED ANALYTICS TYPES ===

// Percolation Analysis Response
export interface PercolationData {
	success: boolean;
	data: {
		interpretation: {
			cascade_status: 'subcritical' | 'critical' | 'supercritical';
			confidence: number;
			threshold_distance: number;
		};
		percolation_threshold: number;
		largest_component_size: number;
		total_components: number;
		activation_probability: number;
	};
	processing_time_ms: number;
}

// Sheaf Fusion Response
export interface FusionData {
	success: boolean;
	data: {
		coherence_score: number;
		fusion_quality: 'low' | 'medium' | 'high';
		category_coverage: number;
		mathematical_consistency: number;
		sections: Array<{
			name: string;
			coherence: number;
			contribution: number;
		}>;
	};
	category: string;
	processing_time_ms: number;
}

// Analytics API Error Response
export interface AnalyticsError {
	success: false;
	error: string;
	code?: string;
	timestamp: string;
}

// === TYPE GUARDS FOR PRISMA JSON FIELDS ===

// Type guard for session_metrics JSON field
export interface SessionMetrics {
	events_count: number;
	page_views: number;
	duration_ms?: number;
	bounce_rate?: number;
	conversion_count?: number;
	conversion_value?: number;
	funnel_conversions?: Record<string, unknown>;
	// Additional metrics for advanced analytics
	predictive_metrics?: Record<string, unknown>;
	performance_metrics?: Record<string, unknown>;
}

export function isSessionMetrics(value: unknown): value is SessionMetrics {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const obj = value as Record<string, unknown>;
	return typeof obj.events_count === 'number' && typeof obj.page_views === 'number';
}

export function getSessionMetrics(value: unknown): SessionMetrics {
	if (isSessionMetrics(value)) {
		return value;
	}

	// Return safe defaults if the data is invalid or missing
	return {
		events_count: 0,
		page_views: 0,
		conversion_count: 0
	};
}

// Type guard for device_data JSON field
export interface DeviceData {
	ip_address?: string;
	user_agent?: string;
	fingerprint?: string;
	viewport?: { width: number; height: number };
	browser?: string;
	os?: string;
}

export function isDeviceData(value: unknown): value is DeviceData {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	// Device data is optional, so we just check it's an object
	return true;
}

export function getDeviceData(value: unknown): DeviceData {
	if (isDeviceData(value)) {
		return value as DeviceData;
	}

	return {};
}
