/**
 * ANALYTICS TYPE SYSTEM - Post-Consolidation Types (Phase 1: 8→3 Models)
 * 
 * This file contains TypeScript interfaces for our consolidated analytics system:
 * - analytics_event (unified event store with JSONB properties)
 * - analytics_session (enhanced session tracking with UTM data)
 * - analytics_experiment (unified campaigns/funnels/variations)
 */

// === CONSOLIDATED ANALYTICS TYPES (Phase 1) ===

// Unified Analytics Event (replaces analytics_event + analytics_event_property)
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
	properties: Record<string, any>; // JSONB field for flexible event properties
	computed_metrics: Record<string, any>; // JSONB field for cached aggregations
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
	};
	
	// Funnel progress tracking (JSONB)
	funnel_progress: Record<string, {
		current_step: number;
		completed_steps: number[];
		last_step_timestamp: string;
		conversion_likelihood?: number;
	}>;
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
		target_audience?: Record<string, any>;
		budget?: number;
		budget_currency?: string;
		// For A/B tests
		variations?: Array<{
			name: string;
			weight: number;
			config: Record<string, any>;
		}>;
		// Common
		targeting_rules?: Record<string, any>;
		success_metrics?: string[];
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
