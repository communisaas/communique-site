/**
 * Analytics Input Sanitization
 *
 * All user input is sanitized before storage.
 * Prevents PII leakage through dimensions.
 */

import {
	type Dimensions,
	type ErrorType,
	isDeliveryMethod,
	isErrorType,
	ERROR_TYPES
} from '$lib/types/analytics';

/**
 * Sanitize jurisdiction to state code only
 *
 * CRITICAL: Never allows district identifiers.
 * 'CA-11' becomes 'CA', 'ny' becomes 'NY'
 */
export function sanitizeJurisdiction(jurisdiction: string | undefined): string | undefined {
	if (!jurisdiction) return undefined;

	// Extract first 2 characters and uppercase
	const state = jurisdiction.substring(0, 2).toUpperCase();

	// Validate US state code format (2 uppercase letters)
	if (/^[A-Z]{2}$/.test(state)) {
		return state;
	}

	return undefined;
}

/**
 * Sanitize UTM source
 *
 * Alphanumeric and underscore only, max 50 chars.
 * Prevents URL/email leakage.
 */
export function sanitizeUtmSource(utmSource: string | undefined): string | undefined {
	if (!utmSource) return undefined;

	const sanitized = utmSource.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);

	return sanitized || undefined;
}

/**
 * Categorize error to allowed type
 *
 * CRITICAL: Raw error messages are NEVER stored.
 * Maps to generic categories only.
 */
export function categorizeError(error: string | Error): ErrorType {
	const message = typeof error === 'string' ? error : error.message;
	const lower = message.toLowerCase();

	if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
		return ERROR_TYPES.network;
	}
	if (lower.includes('timeout') || lower.includes('timed out')) {
		return ERROR_TYPES.timeout;
	}
	if (
		lower.includes('auth') ||
		lower.includes('unauthorized') ||
		lower.includes('401') ||
		lower.includes('forbidden') ||
		lower.includes('403')
	) {
		return ERROR_TYPES.auth;
	}
	if (
		lower.includes('validation') ||
		lower.includes('invalid') ||
		lower.includes('400') ||
		lower.includes('required')
	) {
		return ERROR_TYPES.validation;
	}

	return ERROR_TYPES.unknown;
}

/**
 * Sanitize all dimensions
 *
 * Validates and cleans all dimension values.
 */
export function sanitizeDimensions(dimensions: Dimensions | undefined): Dimensions {
	if (!dimensions) return {};

	const sanitized: Dimensions = {};

	// Template ID: allow (public identifier)
	if (dimensions.template_id && typeof dimensions.template_id === 'string') {
		// Basic validation: alphanumeric and common ID chars
		const cleaned = dimensions.template_id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
		if (cleaned) {
			sanitized.template_id = cleaned;
		}
	}

	// Jurisdiction: state code only
	if (dimensions.jurisdiction) {
		sanitized.jurisdiction = sanitizeJurisdiction(dimensions.jurisdiction);
	}

	// Delivery method: whitelist
	if (dimensions.delivery_method && isDeliveryMethod(dimensions.delivery_method)) {
		sanitized.delivery_method = dimensions.delivery_method;
	}

	// UTM source: sanitize
	if (dimensions.utm_source) {
		sanitized.utm_source = sanitizeUtmSource(dimensions.utm_source);
	}

	// Error type: whitelist
	if (dimensions.error_type && isErrorType(dimensions.error_type)) {
		sanitized.error_type = dimensions.error_type;
	}

	// Cohort token: validate UUID format
	if (dimensions.cohort_token && typeof dimensions.cohort_token === 'string') {
		// Basic UUID validation
		if (
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				dimensions.cohort_token
			)
		) {
			sanitized.cohort_token = dimensions.cohort_token.toLowerCase();
		}
	}

	return sanitized;
}
