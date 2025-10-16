/**
 * Base RPC Provider Implementation
 *
 * Provides common functionality for all RPC providers:
 * - Health tracking
 * - Circuit breaker
 * - Metrics collection
 * - Latency percentiles
 */

import type {
	RpcProvider,
	ProviderConfig,
	ProviderHealth,
	Network,
	RpcCallOptions,
	RpcRequest,
	RpcResponse,
	HealthStatus
} from './types';
import { CircuitBreaker } from './circuit-breaker';

export abstract class BaseRpcProvider implements RpcProvider {
	readonly config: ProviderConfig;

	// Health tracking per network
	private health = new Map<Network, ProviderHealthTracker>();

	// Circuit breakers per network
	private circuitBreakers = new Map<Network, CircuitBreaker>();

	constructor(config: ProviderConfig) {
		this.config = {
			timeout: 10000, // 10 seconds default
			maxRetries: 2,
			enabled: true,
			...config
		};

		// Initialize health trackers
		if (config.mainnet) {
			this.health.set('mainnet', new ProviderHealthTracker());
			this.circuitBreakers.set(
				'mainnet',
				new CircuitBreaker({
					failureThreshold: 5,
					successThreshold: 2,
					timeout: 30000, // 30 seconds
					enabled: true
				})
			);
		}

		if (config.testnet) {
			this.health.set('testnet', new ProviderHealthTracker());
			this.circuitBreakers.set(
				'testnet',
				new CircuitBreaker({
					failureThreshold: 5,
					successThreshold: 2,
					timeout: 30000,
					enabled: true
				})
			);
		}
	}

	/**
	 * Make RPC call - implements retry logic and health tracking
	 */
	async call<T = unknown>(
		method: string,
		params: unknown,
		network: Network,
		options?: RpcCallOptions
	): Promise<T> {
		const url = this.getUrl(network);
		if (!url) {
			throw new Error(`Provider ${this.config.name} does not support ${network}`);
		}

		const maxRetries = options?.maxRetries ?? this.config.maxRetries ?? 2;
		const timeout = options?.timeout ?? this.config.timeout ?? 10000;

		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			// Check circuit breaker
			const circuitBreaker = this.circuitBreakers.get(network);
			if (circuitBreaker && !circuitBreaker.allowRequest()) {
				throw new Error(
					`Circuit breaker open for ${this.config.name} on ${network}. Next attempt at ${circuitBreaker.getNextAttemptTime()?.toISOString()}`
				);
			}

			const startTime = Date.now();

			try {
				const result = await this.makeRequest<T>(method, params, url, timeout);
				const latency = Date.now() - startTime;

				// Record success
				this.recordSuccess(network, latency);

				return result;
			} catch (error) {
				const latency = Date.now() - startTime;
				lastError = error instanceof Error ? error : new Error(String(error));

				// Record failure
				this.recordFailure(network, latency, lastError.message);

				// Don't retry on last attempt
				if (attempt === maxRetries) {
					break;
				}

				// Exponential backoff
				await this.sleep(Math.min(1000 * Math.pow(2, attempt), 5000));
			}
		}

		throw lastError || new Error('RPC call failed');
	}

	/**
	 * Check provider health
	 */
	async checkHealth(network: Network): Promise<boolean> {
		try {
			// Simple health check: query a lightweight method
			await this.call('status', [], network, { maxRetries: 0, timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get provider health metrics
	 */
	getHealth(network: Network): ProviderHealth {
		const tracker = this.health.get(network);
		const circuitBreaker = this.circuitBreakers.get(network);

		if (!tracker) {
			throw new Error(`No health tracker for ${network}`);
		}

		const stats = tracker.getStats();
		const cbState = circuitBreaker?.getState() ?? 'closed';
		const nextAttempt = circuitBreaker?.getNextAttemptTime() ?? null;

		// Determine health status
		let status: HealthStatus;
		if (cbState === 'open') {
			status = 'circuit-open';
		} else if (stats.successRate < 0.5) {
			status = 'unhealthy';
		} else if (stats.successRate < 0.9) {
			status = 'degraded';
		} else {
			status = 'healthy';
		}

		return {
			provider: this.config.name,
			network,
			status,
			totalRequests: stats.totalRequests,
			successfulRequests: stats.successfulRequests,
			failedRequests: stats.failedRequests,
			successRate: stats.successRate,
			averageLatency: stats.averageLatency,
			p95Latency: stats.p95Latency,
			lastSuccess: stats.lastSuccess,
			lastFailure: stats.lastFailure,
			lastFailureReason: stats.lastFailureReason,
			circuitBreakerState: cbState,
			circuitBreakerOpensUntil: nextAttempt
		};
	}

	/**
	 * Reset provider health
	 */
	resetHealth(network: Network): void {
		const tracker = this.health.get(network);
		const circuitBreaker = this.circuitBreakers.get(network);

		tracker?.reset();
		circuitBreaker?.reset();
	}

	// Protected methods for subclasses

	/**
	 * Get URL for network
	 */
	protected getUrl(network: Network): string | null {
		return this.config[network];
	}

	/**
	 * Make HTTP request to RPC endpoint
	 */
	protected async makeRequest<T>(
		method: string,
		params: unknown,
		url: string,
		timeout: number
	): Promise<T> {
		const request: RpcRequest = {
			jsonrpc: '2.0',
			id: Date.now(),
			method,
			params
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(request),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data: RpcResponse<T> = await response.json();

			if (data.error) {
				throw new Error(`RPC Error [${data.error.code}]: ${data.error.message}`);
			}

			if (data.result === undefined) {
				throw new Error('RPC response missing result field');
			}

			return data.result;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Request timeout after ${timeout}ms`);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Record successful request
	 */
	private recordSuccess(network: Network, latency: number): void {
		const tracker = this.health.get(network);
		const circuitBreaker = this.circuitBreakers.get(network);

		tracker?.recordSuccess(latency);
		circuitBreaker?.recordSuccess();
	}

	/**
	 * Record failed request
	 */
	private recordFailure(network: Network, latency: number, reason: string): void {
		const tracker = this.health.get(network);
		const circuitBreaker = this.circuitBreakers.get(network);

		tracker?.recordFailure(latency, reason);
		circuitBreaker?.recordFailure();
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Provider health tracking
 */
class ProviderHealthTracker {
	private totalRequests = 0;
	private successfulRequests = 0;
	private failedRequests = 0;
	private latencies: number[] = [];
	private lastSuccess: Date | null = null;
	private lastFailure: Date | null = null;
	private lastFailureReason: string | null = null;

	// Keep last 100 latencies for percentile calculation
	private readonly MAX_LATENCIES = 100;

	recordSuccess(latency: number): void {
		this.totalRequests++;
		this.successfulRequests++;
		this.lastSuccess = new Date();
		this.addLatency(latency);
	}

	recordFailure(latency: number, reason: string): void {
		this.totalRequests++;
		this.failedRequests++;
		this.lastFailure = new Date();
		this.lastFailureReason = reason;
		this.addLatency(latency);
	}

	getStats() {
		const successRate = this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 0;

		const averageLatency =
			this.latencies.length > 0
				? this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length
				: 0;

		const p95Latency = this.calculatePercentile(95);

		return {
			totalRequests: this.totalRequests,
			successfulRequests: this.successfulRequests,
			failedRequests: this.failedRequests,
			successRate,
			averageLatency,
			p95Latency,
			lastSuccess: this.lastSuccess,
			lastFailure: this.lastFailure,
			lastFailureReason: this.lastFailureReason
		};
	}

	reset(): void {
		this.totalRequests = 0;
		this.successfulRequests = 0;
		this.failedRequests = 0;
		this.latencies = [];
		this.lastSuccess = null;
		this.lastFailure = null;
		this.lastFailureReason = null;
	}

	private addLatency(latency: number): void {
		this.latencies.push(latency);
		if (this.latencies.length > this.MAX_LATENCIES) {
			this.latencies.shift();
		}
	}

	private calculatePercentile(percentile: number): number {
		if (this.latencies.length === 0) return 0;

		const sorted = [...this.latencies].sort((a, b) => a - b);
		const index = Math.ceil((percentile / 100) * sorted.length) - 1;
		return sorted[Math.max(0, index)];
	}
}
