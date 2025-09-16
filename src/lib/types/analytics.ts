/**
 * ANALYTICS TYPE SYSTEM - Eliminate 'any' pollution in analytics data
 */

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
