/**
 * RPC Manager - Health-Aware Failover Orchestration
 *
 * Responsibilities:
 * - Route requests to healthy providers
 * - Implement failover strategies
 * - Collect metrics across all providers
 * - Provide observability
 *
 * Design Principles:
 * - Zero-downtime provider switching
 * - Automatic health-based routing
 * - Observable by default
 * - Easy to add new providers
 */

import type {
	RpcProvider,
	RpcCallOptions,
	RpcCallResult,
	RpcManagerConfig,
	RpcMetrics,
	RpcCallTrace,
	Network,
	ProviderSelectionStrategy
} from './types';

export class RpcManager {
	private providers: RpcProvider[] = [];
	private config: Required<RpcManagerConfig>;
	private traces: RpcCallTrace[] = [];
	private readonly MAX_TRACES = 100; // Keep last 100 traces

	constructor(providers: RpcProvider[], config?: RpcManagerConfig) {
		this.providers = providers;
		this.config = {
			strategy: config?.strategy ?? 'priority',
			circuitBreaker: config?.circuitBreaker ?? {
				failureThreshold: 5,
				successThreshold: 2,
				timeout: 30000,
				enabled: true
			},
			defaultNetwork: config?.defaultNetwork ?? 'mainnet',
			defaultTimeout: config?.defaultTimeout ?? 10000,
			defaultMaxRetries: config?.defaultMaxRetries ?? 2,
			enableMetrics: config?.enableMetrics ?? true,
			enableLogging: config?.enableLogging ?? true
		};
	}

	/**
	 * Make RPC call with automatic failover
	 */
	async call<T = unknown>(
		method: string,
		params: unknown,
		options?: RpcCallOptions
	): Promise<RpcCallResult<T>> {
		const network = options?.network ?? this.config.defaultNetwork;
		const traceId = this.generateTraceId();
		const trace: RpcCallTrace = {
			traceId,
			method,
			params,
			network,
			startTime: new Date(),
			endTime: null,
			duration: null,
			attempts: [],
			result: {
				success: false,
				provider: null
			}
		};

		try {
			// Get ordered list of providers to try
			const providers = this.selectProviders(network, options);

			if (providers.length === 0) {
				throw new Error(`No available providers for ${network}`);
			}

			let lastError: Error | null = null;

			// Try each provider in order
			for (let i = 0; i < providers.length; i++) {
				const provider = providers[i];
				const attemptStart = Date.now();

				try {
					// Check if we should skip unhealthy providers
					if (options?.skipUnhealthy !== false) {
						const health = provider.getHealth(network);
						if (health.status === 'unhealthy' || health.status === 'circuit-open') {
							this.log(
								`Skipping ${provider.config.name} (${health.status})`
							);
							continue;
						}
					}

					this.log(`Trying provider ${i + 1}/${providers.length}: ${provider.config.name}`);

					// Make the call
					const startTime = Date.now();
					const data = await provider.call<T>(method, params, network, options);
					const latency = Date.now() - startTime;

					// Record success
					trace.attempts.push({
						provider: provider.config.name,
						startTime: new Date(startTime),
						endTime: new Date(),
						duration: latency,
						success: true
					});

					trace.endTime = new Date();
					trace.duration = Date.now() - trace.startTime.getTime();
					trace.result = {
						success: true,
						provider: provider.config.name
					};

					this.log(
						`✓ ${provider.config.name} succeeded in ${latency}ms`
					);

					return {
						data,
						provider: provider.config.name,
						network,
						latency,
						isRetry: i > 0,
						attemptNumber: i + 1
					};
				} catch (error) {
					const attemptDuration = Date.now() - attemptStart;
					lastError = error instanceof Error ? error : new Error(String(error));

					// Record failure
					trace.attempts.push({
						provider: provider.config.name,
						startTime: new Date(attemptStart),
						endTime: new Date(),
						duration: attemptDuration,
						success: false,
						error: lastError.message
					});

					this.log(
						`✗ ${provider.config.name} failed: ${lastError.message}`
					);

					// Continue to next provider
					continue;
				}
			}

			// All providers failed
			trace.endTime = new Date();
			trace.duration = Date.now() - trace.startTime.getTime();
			trace.result = {
				success: false,
				provider: null,
				error: lastError?.message ?? 'All providers failed'
			};

			throw lastError ?? new Error('All RPC providers failed');
		} finally {
			// Store trace
			if (this.config.enableMetrics) {
				this.addTrace(trace);
			}
		}
	}

	/**
	 * Get metrics across all providers
	 */
	getMetrics(): RpcMetrics {
		let totalCalls = 0;
		let successfulCalls = 0;
		let failedCalls = 0;
		let totalLatency = 0;

		const callsByProvider: Record<string, number> = {};
		const callsByMethod: Record<string, number> = {};
		const callsByNetwork: Record<Network, number> = { mainnet: 0, testnet: 0 };
		const providerHealth: Record<string, Record<Network, any>> = {};

		// Aggregate from traces
		for (const trace of this.traces) {
			totalCalls++;

			if (trace.result.success) {
				successfulCalls++;
			} else {
				failedCalls++;
			}

			if (trace.duration) {
				totalLatency += trace.duration;
			}

			// By method
			callsByMethod[trace.method] = (callsByMethod[trace.method] || 0) + 1;

			// By network
			callsByNetwork[trace.network]++;

			// By provider
			if (trace.result.provider) {
				callsByProvider[trace.result.provider] =
					(callsByProvider[trace.result.provider] || 0) + 1;
			}
		}

		// Get provider health
		for (const provider of this.providers) {
			providerHealth[provider.config.name] = { mainnet: null, testnet: null };

			for (const network of ['mainnet', 'testnet'] as Network[]) {
				try {
					providerHealth[provider.config.name][network] = provider.getHealth(network);
				} catch {
					// Provider doesn't support this network
				}
			}
		}

		return {
			totalCalls,
			successfulCalls,
			failedCalls,
			averageLatency: totalCalls > 0 ? totalLatency / totalCalls : 0,
			callsByProvider,
			callsByMethod,
			callsByNetwork,
			providerHealth
		};
	}

	/**
	 * Get recent call traces (for debugging)
	 */
	getTraces(limit = 10): RpcCallTrace[] {
		return this.traces.slice(-limit);
	}

	/**
	 * Add a new provider at runtime
	 */
	addProvider(provider: RpcProvider): void {
		this.providers.push(provider);
		this.log(`Added provider: ${provider.config.name}`);
	}

	/**
	 * Remove a provider at runtime
	 */
	removeProvider(providerName: string): void {
		this.providers = this.providers.filter((p) => p.config.name !== providerName);
		this.log(`Removed provider: ${providerName}`);
	}

	/**
	 * Enable/disable a provider without removing it
	 */
	setProviderEnabled(providerName: string, enabled: boolean): void {
		const provider = this.providers.find((p) => p.config.name === providerName);
		if (provider) {
			provider.config.enabled = enabled;
			this.log(`${enabled ? 'Enabled' : 'Disabled'} provider: ${providerName}`);
		}
	}

	/**
	 * Get all providers
	 */
	getProviders(): RpcProvider[] {
		return [...this.providers];
	}

	/**
	 * Reset all provider health
	 */
	resetAllHealth(): void {
		for (const provider of this.providers) {
			for (const network of ['mainnet', 'testnet'] as Network[]) {
				try {
					provider.resetHealth(network);
				} catch {
					// Provider doesn't support this network
				}
			}
		}
		this.log('Reset health for all providers');
	}

	// Private methods

	/**
	 * Select providers to try based on strategy
	 */
	private selectProviders(network: Network, options?: RpcCallOptions): RpcProvider[] {
		// Filter to enabled providers that support this network
		let candidates = this.providers.filter(
			(p) => p.config.enabled && p.config[network] !== null
		);

		if (candidates.length === 0) {
			return [];
		}

		// If preferred provider specified, put it first
		if (options?.preferredProvider) {
			const preferred = candidates.find((p) => p.config.name === options.preferredProvider);
			if (preferred) {
				candidates = [
					preferred,
					...candidates.filter((p) => p.config.name !== options.preferredProvider)
				];
			}
		}

		// Apply selection strategy
		switch (this.config.strategy) {
			case 'priority':
				return this.sortByPriority(candidates);

			case 'latency':
				return this.sortByLatency(candidates, network);

			case 'round-robin':
				return this.roundRobin(candidates);

			case 'random':
				return this.shuffle(candidates);

			default:
				return this.sortByPriority(candidates);
		}
	}

	/**
	 * Sort providers by priority (highest first)
	 */
	private sortByPriority(providers: RpcProvider[]): RpcProvider[] {
		return [...providers].sort((a, b) => a.config.priority - b.config.priority);
	}

	/**
	 * Sort providers by latency (lowest first)
	 */
	private sortByLatency(providers: RpcProvider[], network: Network): RpcProvider[] {
		return [...providers].sort((a, b) => {
			const healthA = a.getHealth(network);
			const healthB = b.getHealth(network);
			return healthA.averageLatency - healthB.averageLatency;
		});
	}

	/**
	 * Round-robin provider selection
	 */
	private roundRobin(providers: RpcProvider[]): RpcProvider[] {
		// Simple implementation: rotate array
		// In production, you'd track state across calls
		const rotated = [...providers];
		rotated.push(rotated.shift()!);
		return rotated;
	}

	/**
	 * Shuffle providers randomly
	 */
	private shuffle(providers: RpcProvider[]): RpcProvider[] {
		const shuffled = [...providers];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	/**
	 * Generate unique trace ID
	 */
	private generateTraceId(): string {
		return `rpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Add trace to history (ring buffer)
	 */
	private addTrace(trace: RpcCallTrace): void {
		this.traces.push(trace);
		if (this.traces.length > this.MAX_TRACES) {
			this.traces.shift();
		}
	}

	/**
	 * Log message (if logging enabled)
	 */
	private log(message: string): void {
		if (this.config.enableLogging) {
			console.log(`[RPC Manager] ${message}`);
		}
	}
}
