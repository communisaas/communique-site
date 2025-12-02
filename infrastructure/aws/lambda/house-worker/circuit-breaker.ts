export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
	failureThreshold: number;
	resetTimeout: number;
	monitoringWindow?: number;
	onStateChange?: (state: CircuitBreakerState) => void;
	onFailure?: (error: Error) => void;
	onSuccess?: () => void;
}

export interface CircuitBreakerStats {
	state: CircuitBreakerState;
	failureCount: number;
	successCount: number;
	lastFailureTime?: number | undefined;
	lastSuccessTime?: number | undefined;
	nextAttemptTime?: number | undefined;
	totalExecutions: number;
	stateChanges: number;
}

export class CircuitBreakerError extends Error {
	constructor(
		message: string,
		public readonly state: CircuitBreakerState
	) {
		super(message);
		this.name = 'CircuitBreakerError';
	}
}

/**
 * Circuit breaker implementation for protecting against cascading failures
 * when the GCP proxy becomes unavailable or overwhelmed.
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Failure threshold reached, all requests fail fast
 * - HALF_OPEN: Testing if service has recovered, limited requests allowed
 */
export class CircuitBreaker {
	private state: CircuitBreakerState = 'CLOSED';
	private failureCount = 0;
	private successCount = 0;
	private lastFailureTime?: number | undefined;
	private lastSuccessTime?: number | undefined;
	private nextAttemptTime?: number | undefined;
	private totalExecutions = 0;
	private stateChanges = 0;

	constructor(private readonly config: CircuitBreakerConfig) {
		if (config.failureThreshold <= 0) {
			throw new Error('Failure threshold must be greater than 0');
		}

		if (config.resetTimeout <= 0) {
			throw new Error('Reset timeout must be greater than 0');
		}

		console.log(
			`Circuit breaker initialized: threshold=${config.failureThreshold}, resetTimeout=${config.resetTimeout}ms`
		);
	}

	/**
	 * Execute a function with circuit breaker protection
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		this.totalExecutions++;

		// Check if circuit breaker should allow the request
		if (!this.shouldAllowRequest()) {
			const timeUntilNextAttempt = this.nextAttemptTime ? this.nextAttemptTime - Date.now() : 0;
			throw new CircuitBreakerError(
				`Circuit breaker is ${this.state}. Next attempt in ${Math.max(0, Math.ceil(timeUntilNextAttempt / 1000))} seconds.`,
				this.state
			);
		}

		try {
			console.log(
				`Circuit breaker executing request (state: ${this.state}, failures: ${this.failureCount})`
			);

			const result = await fn();

			// Success - handle state transitions
			this.onSuccess();

			return result;
		} catch (error) {
			// Failure - handle state transitions
			this.onFailure(error instanceof Error ? error : new Error('Unknown error'));

			// Re-throw the original error
			throw error;
		}
	}

	/**
	 * Determine if the circuit breaker should allow a request
	 */
	private shouldAllowRequest(): boolean {
		const now = Date.now();

		switch (this.state) {
			case 'CLOSED':
				// Normal operation - allow all requests
				return true;

			case 'OPEN':
				// Check if reset timeout has elapsed
				if (this.nextAttemptTime && now >= this.nextAttemptTime) {
					this.transitionTo('HALF_OPEN');
					return true;
				}
				return false;

			case 'HALF_OPEN':
				// Allow limited requests to test if service has recovered
				return true;

			default:
				// Shouldn't happen, but be safe
				return false;
		}
	}

	/**
	 * Handle successful execution
	 */
	private onSuccess(): void {
		this.lastSuccessTime = Date.now();
		this.successCount++;

		if (this.config.onSuccess) {
			this.config.onSuccess();
		}

		switch (this.state) {
			case 'HALF_OPEN':
				// Success in half-open state - transition to closed
				console.log('Circuit breaker: Service recovered, transitioning to CLOSED');
				this.reset();
				this.transitionTo('CLOSED');
				break;

			case 'CLOSED':
				// Normal success - reset failure count
				this.failureCount = 0;
				break;
		}
	}

	/**
	 * Handle failed execution
	 */
	private onFailure(error: Error): void {
		this.lastFailureTime = Date.now();
		this.failureCount++;

		console.log(
			`Circuit breaker: Request failed (${this.failureCount}/${this.config.failureThreshold}):`,
			error.message
		);

		if (this.config.onFailure) {
			this.config.onFailure(error);
		}

		switch (this.state) {
			case 'CLOSED':
				// Check if failure threshold is reached
				if (this.failureCount >= this.config.failureThreshold) {
					console.log(
						`Circuit breaker: Failure threshold reached (${this.failureCount}), transitioning to OPEN`
					);
					this.transitionTo('OPEN');
					this.scheduleResetAttempt();
				}
				break;

			case 'HALF_OPEN':
				// Failure in half-open state - go back to open
				console.log('Circuit breaker: Service still failing, transitioning back to OPEN');
				this.transitionTo('OPEN');
				this.scheduleResetAttempt();
				break;
		}
	}

	/**
	 * Transition to a new state
	 */
	private transitionTo(newState: CircuitBreakerState): void {
		if (this.state !== newState) {
			const oldState = this.state;
			this.state = newState;
			this.stateChanges++;

			console.log(`Circuit breaker state transition: ${oldState} -> ${newState}`);

			if (this.config.onStateChange) {
				this.config.onStateChange(newState);
			}
		}
	}

	/**
	 * Schedule the next reset attempt
	 */
	private scheduleResetAttempt(): void {
		this.nextAttemptTime = Date.now() + this.config.resetTimeout;
		console.log(
			`Circuit breaker: Next reset attempt scheduled for ${new Date(this.nextAttemptTime).toISOString()}`
		);
	}

	/**
	 * Reset the circuit breaker to initial state
	 */
	private reset(): void {
		this.failureCount = 0;
		this.nextAttemptTime = undefined;
		console.log('Circuit breaker: Reset to initial state');
	}

	/**
	 * Get current circuit breaker state
	 */
	getState(): CircuitBreakerState {
		return this.state;
	}

	/**
	 * Get comprehensive circuit breaker statistics
	 */
	getStats(): CircuitBreakerStats {
		return {
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			lastFailureTime: this.lastFailureTime,
			lastSuccessTime: this.lastSuccessTime,
			nextAttemptTime: this.nextAttemptTime,
			totalExecutions: this.totalExecutions,
			stateChanges: this.stateChanges
		};
	}

	/**
	 * Get health status with human-readable information
	 */
	getHealthStatus(): {
		healthy: boolean;
		state: CircuitBreakerState;
		message: string;
		stats: CircuitBreakerStats;
	} {
		const stats = this.getStats();
		let healthy = false;
		let message = '';

		switch (this.state) {
			case 'CLOSED':
				healthy = true;
				message = 'Circuit breaker is healthy and allowing all requests';
				break;

			case 'OPEN':
				healthy = false;
				const timeUntilNextAttempt = this.nextAttemptTime ? this.nextAttemptTime - Date.now() : 0;
				message = `Circuit breaker is open due to ${this.failureCount} failures. Next attempt in ${Math.max(0, Math.ceil(timeUntilNextAttempt / 1000))} seconds.`;
				break;

			case 'HALF_OPEN':
				healthy = false; // Cautiously unhealthy until proven otherwise
				message = 'Circuit breaker is testing service recovery';
				break;
		}

		return {
			healthy,
			state: this.state,
			message,
			stats
		};
	}

	/**
	 * Manually open the circuit breaker (for testing or emergency situations)
	 */
	manuallyOpen(reason = 'Manually opened'): void {
		console.log(`Circuit breaker manually opened: ${reason}`);
		this.transitionTo('OPEN');
		this.scheduleResetAttempt();
	}

	/**
	 * Manually close the circuit breaker (for testing or recovery situations)
	 */
	manuallyClose(reason = 'Manually closed'): void {
		console.log(`Circuit breaker manually closed: ${reason}`);
		this.reset();
		this.transitionTo('CLOSED');
	}

	/**
	 * Force a half-open state (for testing)
	 */
	manuallyHalfOpen(reason = 'Manually set to half-open'): void {
		console.log(`Circuit breaker manually set to half-open: ${reason}`);
		this.transitionTo('HALF_OPEN');
	}
}
