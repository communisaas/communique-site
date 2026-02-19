/**
 * Rate limiter for Google Maps Geocoding API
 *
 * Limits: 50 requests/second, 40K requests/month (free tier)
 * Circuit breaker: Opens when monthly quota exhausted, prevents cascading failures
 */

export interface RateLimitState {
	requestsThisSecond: number;
	requestsThisMonth: number;
	lastResetSecond: number;
	lastResetMonth: number;
	circuitBreakerOpen: boolean;
	circuitBreakerOpenedAt: number | null;
}

export interface RateLimitCheck {
	allowed: boolean;
	reason?: string;
	requestsRemaining?: {
		thisSecond: number;
		thisMonth: number;
	};
}

// Rate limits
const LIMIT_PER_SECOND = 50; // Google Maps API limit
const LIMIT_PER_MONTH = 40000; // Free tier limit

// Circuit breaker config
const CIRCUIT_BREAKER_RESET_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// Global state (in production, this would be in Redis for multi-instance support)
const state: RateLimitState = {
	requestsThisSecond: 0,
	requestsThisMonth: 0,
	lastResetSecond: Date.now(),
	lastResetMonth: Date.now(),
	circuitBreakerOpen: false,
	circuitBreakerOpenedAt: null
};

/**
 * Check if request is allowed under rate limits
 * Automatically resets counters and circuit breaker as needed
 */
export function checkRateLimit(): RateLimitCheck {
	const now = Date.now();

	// Reset per-second counter
	if (now - state.lastResetSecond >= 1000) {
		state.requestsThisSecond = 0;
		state.lastResetSecond = now;
	}

	// Reset per-month counter (30-day rolling window)
	const monthMs = 30 * 24 * 60 * 60 * 1000;
	if (now - state.lastResetMonth >= monthMs) {
		state.requestsThisMonth = 0;
		state.lastResetMonth = now;
		state.circuitBreakerOpen = false;
		state.circuitBreakerOpenedAt = null;
	}

	// Check circuit breaker auto-reset (24h after opening)
	if (
		state.circuitBreakerOpen &&
		state.circuitBreakerOpenedAt &&
		now - state.circuitBreakerOpenedAt >= CIRCUIT_BREAKER_RESET_TIME_MS
	) {
		console.debug('[geocoding-rate-limiter] Circuit breaker auto-reset after 24 hours');
		state.circuitBreakerOpen = false;
		state.circuitBreakerOpenedAt = null;
	}

	// Check circuit breaker
	if (state.circuitBreakerOpen) {
		return {
			allowed: false,
			reason: 'Circuit breaker open (monthly quota exceeded)',
			requestsRemaining: {
				thisSecond: LIMIT_PER_SECOND - state.requestsThisSecond,
				thisMonth: 0
			}
		};
	}

	// Check per-second limit
	if (state.requestsThisSecond >= LIMIT_PER_SECOND) {
		return {
			allowed: false,
			reason: 'Rate limit exceeded (50 req/sec)',
			requestsRemaining: {
				thisSecond: 0,
				thisMonth: LIMIT_PER_MONTH - state.requestsThisMonth
			}
		};
	}

	// Check per-month limit
	if (state.requestsThisMonth >= LIMIT_PER_MONTH) {
		state.circuitBreakerOpen = true;
		state.circuitBreakerOpenedAt = now;

		console.error(
			'[geocoding-rate-limiter]',
			JSON.stringify({
				timestamp: new Date().toISOString(),
				event: 'circuit_breaker_opened',
				reason: 'monthly_quota_exceeded',
				requests_this_month: state.requestsThisMonth,
				limit: LIMIT_PER_MONTH
			})
		);

		return {
			allowed: false,
			reason: 'Monthly quota exceeded (40K requests)',
			requestsRemaining: {
				thisSecond: LIMIT_PER_SECOND - state.requestsThisSecond,
				thisMonth: 0
			}
		};
	}

	// Increment counters
	state.requestsThisSecond++;
	state.requestsThisMonth++;

	return {
		allowed: true,
		requestsRemaining: {
			thisSecond: LIMIT_PER_SECOND - state.requestsThisSecond,
			thisMonth: LIMIT_PER_MONTH - state.requestsThisMonth
		}
	};
}

/**
 * Get current rate limit state (for monitoring/debugging)
 */
export function getRateLimitState(): RateLimitState {
	return { ...state };
}

/**
 * Manually reset rate limit state (for testing/debugging)
 */
export function resetRateLimitState(): void {
	state.requestsThisSecond = 0;
	state.requestsThisMonth = 0;
	state.lastResetSecond = Date.now();
	state.lastResetMonth = Date.now();
	state.circuitBreakerOpen = false;
	state.circuitBreakerOpenedAt = null;
}

/**
 * Manually open circuit breaker (for testing emergency scenarios)
 */
export function openCircuitBreaker(): void {
	state.circuitBreakerOpen = true;
	state.circuitBreakerOpenedAt = Date.now();

	console.warn(
		'[geocoding-rate-limiter]',
		JSON.stringify({
			timestamp: new Date().toISOString(),
			event: 'circuit_breaker_manually_opened'
		})
	);
}

/**
 * Manually close circuit breaker (for testing recovery)
 */
export function closeCircuitBreaker(): void {
	state.circuitBreakerOpen = false;
	state.circuitBreakerOpenedAt = null;

	console.debug(
		'[geocoding-rate-limiter]',
		JSON.stringify({
			timestamp: new Date().toISOString(),
			event: 'circuit_breaker_manually_closed'
		})
	);
}

/**
 * Get rate limit statistics for monitoring
 */
export function getRateLimitStats(): {
	requestsPerSecond: number;
	requestsPerMonth: number;
	limitsPerSecond: number;
	limitsPerMonth: number;
	circuitBreakerOpen: boolean;
	utilizationPercent: {
		perSecond: number;
		perMonth: number;
	};
} {
	return {
		requestsPerSecond: state.requestsThisSecond,
		requestsPerMonth: state.requestsThisMonth,
		limitsPerSecond: LIMIT_PER_SECOND,
		limitsPerMonth: LIMIT_PER_MONTH,
		circuitBreakerOpen: state.circuitBreakerOpen,
		utilizationPercent: {
			perSecond: (state.requestsThisSecond / LIMIT_PER_SECOND) * 100,
			perMonth: (state.requestsThisMonth / LIMIT_PER_MONTH) * 100
		}
	};
}
