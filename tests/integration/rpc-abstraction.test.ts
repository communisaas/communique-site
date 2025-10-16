/**
 * RPC Abstraction Layer Integration Tests
 *
 * Tests the production-grade RPC abstraction layer with:
 * - Provider failover on errors
 * - Circuit breaker pattern
 * - Health tracking and metrics
 * - Request tracing
 * - Helper functions
 *
 * These are integration tests that verify the RPC layer behavior
 * without making actual network requests (using mocks).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RpcManager } from '../../src/lib/core/blockchain/rpc/manager';
import { BaseRpcProvider } from '../../src/lib/core/blockchain/rpc/base-provider';
import { CircuitBreaker } from '../../src/lib/core/blockchain/rpc/circuit-breaker';
import type { ProviderConfig, Network } from '../../src/lib/core/blockchain/rpc/types';

// Mock provider for testing
class MockRpcProvider extends BaseRpcProvider {
	public callCount = 0;
	public shouldFail = false;
	public failureCount = 0;
	public latencyMs = 100;

	constructor(name: string, priority: number) {
		const config: ProviderConfig = {
			name,
			mainnet: `https://mock-${name.toLowerCase()}.example.com/mainnet`,
			testnet: `https://mock-${name.toLowerCase()}.example.com/testnet`,
			priority,
			timeout: 10000,
			maxRetries: 0, // No retries in mock (we test manager-level retries)
			enabled: true
		};
		super(config);
	}

	// Override makeRequest to avoid actual HTTP calls
	protected async makeRequest<T>(
		method: string,
		params: unknown,
		url: string,
		timeout: number
	): Promise<T> {
		this.callCount++;

		// Simulate latency
		await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

		// Simulate failures if configured
		if (this.shouldFail) {
			this.failureCount++;
			throw new Error(`Mock RPC error from ${this.config.name}`);
		}

		// Return mock response
		return {
			result: `mock-result-${method}`,
			provider: this.config.name,
			method,
			params
		} as T;
	}

	// Reset for next test
	reset() {
		this.callCount = 0;
		this.failureCount = 0;
		this.shouldFail = false;
		this.latencyMs = 100;
	}
}

describe('RPC Abstraction Layer - Integration Tests', () => {
	let primaryProvider: MockRpcProvider;
	let secondaryProvider: MockRpcProvider;
	let tertiaryProvider: MockRpcProvider;
	let rpcManager: RpcManager;

	beforeEach(() => {
		// Create mock providers
		primaryProvider = new MockRpcProvider('MockPrimary', 1);
		secondaryProvider = new MockRpcProvider('MockSecondary', 2);
		tertiaryProvider = new MockRpcProvider('MockTertiary', 3);

		// Create RPC manager
		rpcManager = new RpcManager(
			[primaryProvider, secondaryProvider, tertiaryProvider],
			{
				strategy: 'priority',
				defaultNetwork: 'mainnet',
				defaultTimeout: 10000,
				defaultMaxRetries: 2,
				enableMetrics: true,
				enableLogging: false // Disable logs in tests
			}
		);
	});

	describe('Provider Failover', () => {
		it('should use primary provider when healthy', async () => {
			const result = await rpcManager.call('status', []);

			expect(result.provider).toBe('MockPrimary');
			expect(result.isRetry).toBe(false);
			expect(result.attemptNumber).toBe(1);
			expect(primaryProvider.callCount).toBe(1);
			expect(secondaryProvider.callCount).toBe(0);
			expect(tertiaryProvider.callCount).toBe(0);
		});

		it('should failover to secondary provider on primary failure', async () => {
			// Configure primary to fail
			primaryProvider.shouldFail = true;

			const result = await rpcManager.call('status', []);

			expect(result.provider).toBe('MockSecondary');
			expect(result.isRetry).toBe(true);
			expect(result.attemptNumber).toBe(2);
			expect(primaryProvider.failureCount).toBe(1);
			expect(secondaryProvider.callCount).toBe(1);
		});

		it('should failover to tertiary provider on primary and secondary failure', async () => {
			// Configure both to fail
			primaryProvider.shouldFail = true;
			secondaryProvider.shouldFail = true;

			const result = await rpcManager.call('status', []);

			expect(result.provider).toBe('MockTertiary');
			expect(result.isRetry).toBe(true);
			expect(result.attemptNumber).toBe(3);
			expect(primaryProvider.failureCount).toBe(1);
			expect(secondaryProvider.failureCount).toBe(1);
			expect(tertiaryProvider.callCount).toBe(1);
		});

		it('should throw error when all providers fail', async () => {
			// Configure all to fail
			primaryProvider.shouldFail = true;
			secondaryProvider.shouldFail = true;
			tertiaryProvider.shouldFail = true;

			await expect(rpcManager.call('status', [])).rejects.toThrow();
			expect(primaryProvider.failureCount).toBe(1);
			expect(secondaryProvider.failureCount).toBe(1);
			expect(tertiaryProvider.failureCount).toBe(1);
		});

		it('should skip unhealthy providers', async () => {
			// Make primary unhealthy by causing multiple failures
			primaryProvider.shouldFail = true;
			for (let i = 0; i < 5; i++) {
				try {
					await primaryProvider.call('status', [], 'mainnet');
				} catch {
					// Expected to fail
				}
			}

			// Now primary should be unhealthy, manager should skip to secondary
			primaryProvider.shouldFail = false; // Even if healthy now
			const result = await rpcManager.call('status', []);

			// Should skip primary (unhealthy) and use secondary
			expect(result.provider).toBe('MockSecondary');
		});
	});

	describe('Circuit Breaker', () => {
		it('should open circuit after threshold failures', async () => {
			const circuitBreaker = new CircuitBreaker({
				failureThreshold: 3,
				successThreshold: 2,
				timeout: 1000,
				enabled: true
			});

			expect(circuitBreaker.getState()).toBe('closed');

			// Trigger failures
			for (let i = 0; i < 3; i++) {
				circuitBreaker.recordFailure();
			}

			expect(circuitBreaker.getState()).toBe('open');
			expect(circuitBreaker.allowRequest()).toBe(false);
		});

		it('should transition to half-open after timeout', async () => {
			const circuitBreaker = new CircuitBreaker({
				failureThreshold: 3,
				successThreshold: 2,
				timeout: 100, // 100ms timeout
				enabled: true
			});

			// Open circuit
			for (let i = 0; i < 3; i++) {
				circuitBreaker.recordFailure();
			}
			expect(circuitBreaker.getState()).toBe('open');

			// Wait for timeout
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should allow one request (half-open)
			expect(circuitBreaker.allowRequest()).toBe(true);
			expect(circuitBreaker.getState()).toBe('half-open');
		});

		it('should close circuit after success threshold in half-open', async () => {
			const circuitBreaker = new CircuitBreaker({
				failureThreshold: 3,
				successThreshold: 2,
				timeout: 100,
				enabled: true
			});

			// Open circuit
			for (let i = 0; i < 3; i++) {
				circuitBreaker.recordFailure();
			}

			// Wait for timeout
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Record successes
			circuitBreaker.recordSuccess();
			expect(circuitBreaker.getState()).toBe('half-open');

			circuitBreaker.recordSuccess();
			expect(circuitBreaker.getState()).toBe('closed');
		});

		it('should reopen circuit on failure in half-open', async () => {
			const circuitBreaker = new CircuitBreaker({
				failureThreshold: 3,
				successThreshold: 2,
				timeout: 100,
				enabled: true
			});

			// Open circuit
			for (let i = 0; i < 3; i++) {
				circuitBreaker.recordFailure();
			}

			// Wait for timeout
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Transition to half-open
			circuitBreaker.allowRequest();

			// Record failure - should reopen
			circuitBreaker.recordFailure();
			expect(circuitBreaker.getState()).toBe('open');
		});
	});

	describe('Health Tracking', () => {
		it('should track successful requests', async () => {
			await rpcManager.call('status', []);
			await rpcManager.call('query', { account_id: 'test.near' });

			const health = primaryProvider.getHealth('mainnet');
			expect(health.totalRequests).toBe(2);
			expect(health.successRate).toBe(100);
			expect(health.status).toBe('healthy');
		});

		it('should track failed requests', async () => {
			primaryProvider.shouldFail = true;

			// All will fail, fallback to secondary
			await rpcManager.call('status', []);

			const health = primaryProvider.getHealth('mainnet');
			expect(health.totalRequests).toBe(1);
			expect(health.successRate).toBe(0);
			expect(health.status).toBe('degraded');
		});

		it('should calculate average latency', async () => {
			primaryProvider.latencyMs = 100;
			await rpcManager.call('status', []);

			primaryProvider.latencyMs = 200;
			await rpcManager.call('status', []);

			const health = primaryProvider.getHealth('mainnet');
			expect(health.averageLatency).toBeGreaterThan(100);
			expect(health.averageLatency).toBeLessThan(200);
		});

		it('should calculate P95 latency', async () => {
			// Make 100 requests with varying latencies
			for (let i = 0; i < 100; i++) {
				primaryProvider.latencyMs = i * 5; // 0ms to 495ms
				try {
					await rpcManager.call('status', []);
				} catch {
					// Ignore failures
				}
			}

			const health = primaryProvider.getHealth('mainnet');
			expect(health.p95Latency).toBeGreaterThan(health.averageLatency);
			expect(health.p95Latency).toBeLessThanOrEqual(495);
		});

		it('should track health per network', async () => {
			await rpcManager.call('status', [], { network: 'mainnet' });
			await rpcManager.call('status', [], { network: 'testnet' });

			const mainnetHealth = primaryProvider.getHealth('mainnet');
			const testnetHealth = primaryProvider.getHealth('testnet');

			expect(mainnetHealth.network).toBe('mainnet');
			expect(testnetHealth.network).toBe('testnet');
			expect(mainnetHealth.totalRequests).toBe(1);
			expect(testnetHealth.totalRequests).toBe(1);
		});
	});

	describe('Metrics Aggregation', () => {
		it('should aggregate metrics across all providers', async () => {
			await rpcManager.call('status', []);
			await rpcManager.call('query', { account_id: 'test.near' });

			const metrics = rpcManager.getMetrics();

			expect(metrics.totalCalls).toBe(2);
			expect(metrics.successfulCalls).toBe(2);
			expect(metrics.failedCalls).toBe(0);
			expect(metrics.callsByProvider['MockPrimary']).toBe(2);
		});

		it('should track calls by method', async () => {
			await rpcManager.call('status', []);
			await rpcManager.call('status', []);
			await rpcManager.call('query', { account_id: 'test.near' });

			const metrics = rpcManager.getMetrics();

			expect(metrics.callsByMethod['status']).toBe(2);
			expect(metrics.callsByMethod['query']).toBe(1);
		});

		it('should track calls by network', async () => {
			await rpcManager.call('status', [], { network: 'mainnet' });
			await rpcManager.call('status', [], { network: 'mainnet' });
			await rpcManager.call('status', [], { network: 'testnet' });

			const metrics = rpcManager.getMetrics();

			expect(metrics.callsByNetwork['mainnet']).toBe(2);
			expect(metrics.callsByNetwork['testnet']).toBe(1);
		});

		it('should include provider health in metrics', async () => {
			await rpcManager.call('status', []);

			const metrics = rpcManager.getMetrics();

			expect(metrics.providerHealth).toBeDefined();
			expect(metrics.providerHealth['MockPrimary']).toBeDefined();
			expect(metrics.providerHealth['MockPrimary']['mainnet']).toBeDefined();
		});
	});

	describe('Request Tracing', () => {
		it('should trace successful requests', async () => {
			await rpcManager.call('status', []);

			const traces = rpcManager.getTraces(1);
			expect(traces).toHaveLength(1);

			const trace = traces[0];
			expect(trace.method).toBe('status');
			expect(trace.network).toBe('mainnet');
			expect(trace.result.success).toBe(true);
			expect(trace.result.provider).toBe('MockPrimary');
			expect(trace.attempts).toHaveLength(1);
			expect(trace.duration).toBeGreaterThan(0);
		});

		it('should trace failed requests with all attempts', async () => {
			primaryProvider.shouldFail = true;
			secondaryProvider.shouldFail = true;

			await rpcManager.call('status', []);

			const traces = rpcManager.getTraces(1);
			const trace = traces[0];

			expect(trace.result.success).toBe(true); // Eventually succeeded with tertiary
			expect(trace.attempts).toHaveLength(3); // Tried all three
			expect(trace.attempts[0].provider).toBe('MockPrimary');
			expect(trace.attempts[0].success).toBe(false);
			expect(trace.attempts[1].provider).toBe('MockSecondary');
			expect(trace.attempts[1].success).toBe(false);
			expect(trace.attempts[2].provider).toBe('MockTertiary');
			expect(trace.attempts[2].success).toBe(true);
		});

		it('should limit traces to 100 most recent', async () => {
			// Make 150 requests
			for (let i = 0; i < 150; i++) {
				await rpcManager.call('status', []);
			}

			const traces = rpcManager.getTraces(200); // Try to get 200
			expect(traces.length).toBeLessThanOrEqual(100); // Ring buffer limit
		});
	});

	describe('Provider Selection Strategies', () => {
		it('should use priority strategy by default', async () => {
			const result = await rpcManager.call('status', []);
			expect(result.provider).toBe('MockPrimary'); // Priority 1
		});

		it('should support preferred provider option', async () => {
			const result = await rpcManager.call('status', [], {
				preferredProvider: 'MockSecondary'
			});

			expect(result.provider).toBe('MockSecondary');
		});

		it('should fallback from preferred provider on failure', async () => {
			secondaryProvider.shouldFail = true;

			const result = await rpcManager.call('status', [], {
				preferredProvider: 'MockSecondary'
			});

			// Should try secondary first (preferred), then fallback
			expect(result.provider).not.toBe('MockSecondary');
			expect(secondaryProvider.failureCount).toBe(1);
		});
	});

	describe('Runtime Provider Management', () => {
		it('should add provider at runtime', () => {
			const newProvider = new MockRpcProvider('MockDynamic', 0);
			rpcManager.addProvider(newProvider);

			const providers = rpcManager.getProviders();
			expect(providers).toHaveLength(4);
			expect(providers.some((p) => p.config.name === 'MockDynamic')).toBe(true);
		});

		it('should remove provider at runtime', () => {
			rpcManager.removeProvider('MockTertiary');

			const providers = rpcManager.getProviders();
			expect(providers).toHaveLength(2);
			expect(providers.some((p) => p.config.name === 'MockTertiary')).toBe(false);
		});

		it('should enable/disable provider at runtime', async () => {
			rpcManager.setProviderEnabled('MockPrimary', false);

			const result = await rpcManager.call('status', []);

			// Should skip disabled primary
			expect(result.provider).toBe('MockSecondary');
		});

		it('should reset all provider health', async () => {
			// Make providers unhealthy
			primaryProvider.shouldFail = true;
			for (let i = 0; i < 5; i++) {
				try {
					await rpcManager.call('status', []);
				} catch {
					// Expected
				}
			}

			// Reset health
			rpcManager.resetAllHealth();

			// Check health is reset
			const health = primaryProvider.getHealth('mainnet');
			expect(health.circuitBreakerState).toBe('closed');
		});
	});

	describe('Network Support', () => {
		it('should support mainnet requests', async () => {
			const result = await rpcManager.call('status', [], { network: 'mainnet' });

			expect(result.network).toBe('mainnet');
		});

		it('should support testnet requests', async () => {
			const result = await rpcManager.call('status', [], { network: 'testnet' });

			expect(result.network).toBe('testnet');
		});

		it('should filter providers by network support', () => {
			// Create provider that only supports mainnet
			const mainnetOnlyConfig: ProviderConfig = {
				name: 'MainnetOnly',
				mainnet: 'https://mainnet.example.com',
				testnet: null, // No testnet support
				priority: 0,
				timeout: 10000,
				maxRetries: 2,
				enabled: true
			};

			class MainnetOnlyProvider extends BaseRpcProvider {
				constructor() {
					super(mainnetOnlyConfig);
				}
				protected async makeRequest<T>(): Promise<T> {
					return { result: 'mainnet-only' } as T;
				}
			}

			const mainnetProvider = new MainnetOnlyProvider();
			const testManager = new RpcManager([mainnetProvider], {
				strategy: 'priority',
				defaultNetwork: 'mainnet'
			});

			// Testnet request should fail (no providers)
			expect(testManager.call('status', [], { network: 'testnet' })).rejects.toThrow();
		});
	});

	describe('Error Handling', () => {
		it('should handle timeout errors', async () => {
			primaryProvider.latencyMs = 15000; // Exceed default timeout

			const result = await rpcManager.call('status', [], { timeout: 100 });

			// Should failover to secondary
			expect(result.provider).toBe('MockSecondary');
		});

		it('should provide detailed error information', async () => {
			primaryProvider.shouldFail = true;
			secondaryProvider.shouldFail = true;
			tertiaryProvider.shouldFail = true;

			try {
				await rpcManager.call('status', []);
				throw new Error('Should have thrown');
			} catch (error) {
				expect(error).toBeDefined();
				expect(error instanceof Error).toBe(true);
			}
		});
	});
});
