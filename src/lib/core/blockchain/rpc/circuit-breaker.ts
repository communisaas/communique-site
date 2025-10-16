/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by "opening" the circuit when a provider
 * is unhealthy, giving it time to recover before retrying.
 *
 * States:
 * - CLOSED: Normal operation, requests go through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */

import type { CircuitBreakerConfig } from './types';

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
	private state: CircuitState = 'closed';
	private consecutiveFailures = 0;
	private consecutiveSuccesses = 0;
	private openedAt: Date | null = null;
	private nextAttemptAt: Date | null = null;

	constructor(private readonly config: CircuitBreakerConfig) {}

	/**
	 * Check if circuit allows request
	 */
	allowRequest(): boolean {
		if (!this.config.enabled) return true;

		const now = new Date();

		switch (this.state) {
			case 'closed':
				// Normal operation
				return true;

			case 'open':
				// Check if timeout elapsed
				if (this.nextAttemptAt && now >= this.nextAttemptAt) {
					// Try half-open
					this.transitionToHalfOpen();
					return true;
				}
				// Still open, reject fast
				return false;

			case 'half-open':
				// Allow limited requests to test recovery
				return true;
		}
	}

	/**
	 * Record successful request
	 */
	recordSuccess(): void {
		if (!this.config.enabled) return;

		this.consecutiveFailures = 0;

		if (this.state === 'half-open') {
			this.consecutiveSuccesses++;
			if (this.consecutiveSuccesses >= this.config.successThreshold) {
				this.transitionToClosed();
			}
		}
	}

	/**
	 * Record failed request
	 */
	recordFailure(): void {
		if (!this.config.enabled) return;

		this.consecutiveSuccesses = 0;
		this.consecutiveFailures++;

		if (this.state === 'closed' || this.state === 'half-open') {
			if (this.consecutiveFailures >= this.config.failureThreshold) {
				this.transitionToOpen();
			}
		}
	}

	/**
	 * Get current state
	 */
	getState(): CircuitState {
		return this.state;
	}

	/**
	 * Get next attempt time (if open)
	 */
	getNextAttemptTime(): Date | null {
		return this.nextAttemptAt;
	}

	/**
	 * Reset circuit breaker
	 */
	reset(): void {
		this.state = 'closed';
		this.consecutiveFailures = 0;
		this.consecutiveSuccesses = 0;
		this.openedAt = null;
		this.nextAttemptAt = null;
	}

	/**
	 * Force open circuit (for testing/manual intervention)
	 */
	forceOpen(): void {
		this.transitionToOpen();
	}

	/**
	 * Force close circuit (for testing/manual intervention)
	 */
	forceClose(): void {
		this.transitionToClosed();
	}

	// State transitions

	private transitionToOpen(): void {
		this.state = 'open';
		this.openedAt = new Date();
		this.nextAttemptAt = new Date(Date.now() + this.config.timeout);
		this.consecutiveFailures = 0;
		this.consecutiveSuccesses = 0;
	}

	private transitionToHalfOpen(): void {
		this.state = 'half-open';
		this.consecutiveFailures = 0;
		this.consecutiveSuccesses = 0;
	}

	private transitionToClosed(): void {
		this.state = 'closed';
		this.openedAt = null;
		this.nextAttemptAt = null;
		this.consecutiveFailures = 0;
		this.consecutiveSuccesses = 0;
	}
}
