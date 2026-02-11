/**
 * Test-specific helpers for safely accessing JsonValue fields
 * These provide more lenient typing for test scenarios while maintaining type safety
 */

import type { Prisma } from '@prisma/client';

/**
 * Test-safe access to any JsonValue field with fallback
 * This allows tests to access nested properties without TypeScript errors
 */
export function testJsonAccess<T = unknown>(
	jsonValue: Prisma.JsonValue,
	path: string,
	defaultValue?: T
): T | undefined {
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
	} catch {
		return defaultValue;
	}
}

/**
 * Test-safe config access for analytics experiments
 */
export function testConfigAccess(jsonValue: Prisma.JsonValue) {
	return new Proxy({} as object, {
		get: (target, prop) => {
			return testJsonAccess(jsonValue, String(prop));
		}
	});
}

/**
 * Test-safe metrics cache access for analytics experiments
 */
export function testMetricsCacheAccess(jsonValue: Prisma.JsonValue) {
	return new Proxy({} as object, {
		get: (target, prop) => {
			return testJsonAccess(jsonValue, String(prop));
		}
	});
}

/**
 * Test-safe properties access for analytics events
 */
export function testPropertiesAccess(jsonValue: Prisma.JsonValue) {
	return new Proxy({} as object, {
		get: (target, prop) => {
			return testJsonAccess(jsonValue, String(prop));
		}
	});
}

/**
 * Test-safe session metrics access
 */
export function testSessionMetricsAccess(jsonValue: Prisma.JsonValue) {
	return new Proxy({} as object, {
		get: (target, prop) => {
			return testJsonAccess(jsonValue, String(prop));
		}
	});
}

/**
 * Test-safe device data access
 */
export function testDeviceDataAccess(jsonValue: Prisma.JsonValue) {
	return new Proxy({} as object, {
		get: (target, prop) => {
			return testJsonAccess(jsonValue, String(prop));
		}
	});
}

/**
 * Test-safe computed metrics access
 */
export function testComputedMetricsAccess(jsonValue: Prisma.JsonValue) {
	return new Proxy({} as object, {
		get: (target, prop) => {
			return testJsonAccess(jsonValue, String(prop));
		}
	});
}

/**
 * Test-safe multipliers access for agent decisions
 */
export function testMultipliersAccess(jsonValue: Prisma.JsonValue) {
	return new Proxy({} as object, {
		get: (target, prop) => {
			return testJsonAccess(jsonValue, String(prop));
		}
	});
}

/**
 * Helper to create a mock result object that safely exposes JsonValue fields for testing
 */
export function createTestSafeObject<T extends Record<string, unknown>>(obj: T): T {
	return new Proxy(obj, {
		get: (target, prop) => {
			const value = target[prop as keyof T];

			// If it's a Prisma JsonValue field, make it test-safe
			if (value && typeof value === 'object' && value !== null) {
				// Check if it might be a JsonValue by looking for common properties
				const jsonFields = [
					'config',
					'metrics_cache',
					'properties',
					'session_metrics',
					'device_data',
					'computed_metrics',
					'multipliers'
				];
				if (jsonFields.includes(String(prop))) {
					return testJsonAccess(value as Prisma.JsonValue, '');
				}
			}

			return value;
		}
	});
}

/**
 * Alternative approach: Create type-safe accessors that work with the test patterns
 */
export function safeExperimentConfig(experiment: unknown) {
	const config =
		experiment && typeof experiment === 'object' && experiment !== null && 'config' in experiment
			? (experiment as Record<string, unknown>).config || {}
			: {};
	const configObj = config as Record<string, unknown>;
	return {
		steps: configObj.steps || [],
		targeting_rules: configObj.targeting_rules || {},
		optimization_goals: configObj.optimization_goals || {},
		statistical_config: configObj.statistical_config || {},
		budget: configObj.budget || 0,
		campaign_channels: configObj.campaign_channels || [],
		kpi_targets: configObj.kpi_targets || {},
		variations: configObj.variations || []
	};
}

export function safeMetricsCache(experiment: unknown) {
	const cache =
		experiment &&
		typeof experiment === 'object' &&
		experiment !== null &&
		'metrics_cache' in experiment
			? (experiment as Record<string, unknown>).metrics_cache || {}
			: {};
	const cacheObj = cache as Record<string, unknown>;
	return {
		participants_count: cacheObj.participants_count || 0,
		conversion_rate: cacheObj.conversion_rate || 0,
		step_conversion_rates: cacheObj.step_conversion_rates || {},
		drop_off_analysis: cacheObj.drop_off_analysis || {},
		winning_variation: cacheObj.winning_variation,
		variation_results: cacheObj.variation_results || {},
		statistical_significance: cacheObj.statistical_significance || 0,
		recommendation: cacheObj.recommendation,
		error: cacheObj.error,
		budget_spent: cacheObj.budget_spent || 0,
		funnel_completion_rate: cacheObj.funnel_completion_rate || 0,
		funnel_completion_rates: cacheObj.funnel_completion_rates || {},
		temporal_analysis: cacheObj.temporal_analysis || {}
	};
}

export function safeEventProperties(event: unknown) {
	return event && typeof event === 'object' && event !== null && 'properties' in event
		? (event as Record<string, unknown>).properties || {}
		: {};
}

export function safeSessionMetrics(session: unknown) {
	const metrics =
		session && typeof session === 'object' && session !== null && 'session_metrics' in session
			? (session as Record<string, unknown>).session_metrics || {}
			: {};
	const metricsObj = metrics as Record<string, unknown>;
	return {
		events_count: metricsObj.events_count || 0,
		page_views: metricsObj.page_views || 0,
		duration_ms: metricsObj.duration_ms || 0,
		conversion_count: metricsObj.conversion_count || 0,
		funnel_conversions: metricsObj.funnel_conversions || {},
		predictive_metrics: metricsObj.predictive_metrics || {},
		performance_metrics: metricsObj.performance_metrics || {}
	};
}

export function safeDeviceData(session: unknown) {
	const data =
		session && typeof session === 'object' && session !== null && 'device_data' in session
			? (session as Record<string, unknown>).device_data || {}
			: {};
	const dataObj = data as Record<string, unknown>;
	return {
		device_type: dataObj.device_type || 'desktop',
		viewport: dataObj.viewport || { width: 1920, height: 1080 },
		accessibility: dataObj.accessibility || {},
		connection_type: dataObj.connection_type || 'wifi'
	};
}

export function safeComputedMetrics(event: unknown) {
	const metrics =
		event && typeof event === 'object' && event !== null && 'computed_metrics' in event
			? (event as Record<string, unknown>).computed_metrics || {}
			: {};
	const metricsObj = metrics as Record<string, unknown>;
	return {
		engagement_score: metricsObj.engagement_score || 0,
		anomaly_detection: metricsObj.anomaly_detection || {},
		ml_insights: metricsObj.ml_insights || {},
		calculation_metadata: metricsObj.calculation_metadata || {},
		time_series_data: metricsObj.time_series_data || {},
		cohort_analysis: metricsObj.cohort_analysis || {},
		legacy_migration_flag: metricsObj.legacy_migration_flag
	};
}
