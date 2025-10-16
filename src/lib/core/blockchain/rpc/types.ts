/**
 * NEAR Protocol RPC Abstraction Layer - Type Definitions
 *
 * Design Principles:
 * 1. Provider-agnostic interface (swap providers without code changes)
 * 2. Health-aware routing (automatic failover to healthy providers)
 * 3. Observable by default (metrics, tracing, logging)
 * 4. Resilient (circuit breakers, timeouts, retries)
 * 5. Zero external dependencies (pure TypeScript)
 */

/**
 * NEAR RPC JSON-RPC 2.0 request
 */
export interface RpcRequest {
	jsonrpc: '2.0';
	id: string | number;
	method: string;
	params: unknown;
}

/**
 * NEAR RPC JSON-RPC 2.0 response
 */
export interface RpcResponse<T = unknown> {
	jsonrpc: '2.0';
	id: string | number;
	result?: T;
	error?: RpcError;
}

/**
 * NEAR RPC error structure
 */
export interface RpcError {
	code: number;
	message: string;
	data?: unknown;
}

/**
 * Network type
 */
export type Network = 'mainnet' | 'testnet';

/**
 * Provider health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'circuit-open';

/**
 * Provider configuration
 */
export interface ProviderConfig {
	/** Provider name (e.g., "Ankr", "dRPC", "1RPC") */
	name: string;

	/** Mainnet RPC URL */
	mainnet: string | null;

	/** Testnet RPC URL */
	testnet: string | null;

	/** Provider priority (1 = highest) */
	priority: number;

	/** Known rate limits */
	limits?: {
		/** Requests per second */
		requestsPerSecond?: number;
		/** Monthly quota */
		monthlyQuota?: number;
		/** Daily quota */
		dailyQuota?: number;
		/** Compute units per second */
		computeUnitsPerSecond?: number;
	};

	/** Privacy features */
	privacy?: {
		/** Zero-knowledge/TEE */
		teeEnabled?: boolean;
		/** No metadata logging */
		noLogging?: boolean;
	};

	/** Request timeout in milliseconds */
	timeout?: number;

	/** Max retry attempts */
	maxRetries?: number;

	/** Enable this provider */
	enabled?: boolean;
}

/**
 * Provider health metrics
 */
export interface ProviderHealth {
	/** Provider name */
	provider: string;

	/** Network */
	network: Network;

	/** Current health status */
	status: HealthStatus;

	/** Total requests made */
	totalRequests: number;

	/** Successful requests */
	successfulRequests: number;

	/** Failed requests */
	failedRequests: number;

	/** Success rate (0-1) */
	successRate: number;

	/** Average latency in milliseconds */
	averageLatency: number;

	/** P95 latency in milliseconds */
	p95Latency: number;

	/** Last success timestamp */
	lastSuccess: Date | null;

	/** Last failure timestamp */
	lastFailure: Date | null;

	/** Last failure reason */
	lastFailureReason: string | null;

	/** Circuit breaker state */
	circuitBreakerState: 'closed' | 'open' | 'half-open';

	/** Circuit breaker opens at timestamp (if open) */
	circuitBreakerOpensUntil: Date | null;
}

/**
 * RPC call options
 */
export interface RpcCallOptions {
	/** Network to use */
	network?: Network;

	/** Timeout in milliseconds (overrides provider default) */
	timeout?: number;

	/** Retry on failure */
	retry?: boolean;

	/** Max retry attempts (overrides provider default) */
	maxRetries?: number;

	/** Preferred provider (will try this first) */
	preferredProvider?: string;

	/** Skip unhealthy providers */
	skipUnhealthy?: boolean;
}

/**
 * RPC call result with metadata
 */
export interface RpcCallResult<T = unknown> {
	/** Result data */
	data: T;

	/** Provider that served this request */
	provider: string;

	/** Network used */
	network: Network;

	/** Latency in milliseconds */
	latency: number;

	/** Was this a retry? */
	isRetry: boolean;

	/** Attempt number (1-indexed) */
	attemptNumber: number;
}

/**
 * Provider interface - implement this to add new providers
 */
export interface RpcProvider {
	/** Provider configuration */
	readonly config: ProviderConfig;

	/** Make RPC call */
	call<T = unknown>(
		method: string,
		params: unknown,
		network: Network,
		options?: RpcCallOptions
	): Promise<T>;

	/** Check provider health */
	checkHealth(network: Network): Promise<boolean>;

	/** Get provider health metrics */
	getHealth(network: Network): ProviderHealth;

	/** Reset provider health (for testing/recovery) */
	resetHealth(network: Network): void;
}

/**
 * Provider selection strategy
 */
export type ProviderSelectionStrategy =
	| 'priority' // Use highest priority healthy provider
	| 'round-robin' // Rotate through healthy providers
	| 'latency' // Use lowest latency provider
	| 'random'; // Random healthy provider

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
	/** Failure threshold to open circuit (consecutive failures) */
	failureThreshold: number;

	/** Success threshold to close circuit (consecutive successes in half-open) */
	successThreshold: number;

	/** Time to wait before trying half-open (milliseconds) */
	timeout: number;

	/** Enable circuit breaker */
	enabled: boolean;
}

/**
 * RPC Manager configuration
 */
export interface RpcManagerConfig {
	/** Provider selection strategy */
	strategy?: ProviderSelectionStrategy;

	/** Circuit breaker configuration */
	circuitBreaker?: CircuitBreakerConfig;

	/** Default network */
	defaultNetwork?: Network;

	/** Default timeout (milliseconds) */
	defaultTimeout?: number;

	/** Default max retries */
	defaultMaxRetries?: number;

	/** Enable metrics collection */
	enableMetrics?: boolean;

	/** Enable request logging */
	enableLogging?: boolean;
}

/**
 * RPC metrics
 */
export interface RpcMetrics {
	/** Total calls across all providers */
	totalCalls: number;

	/** Successful calls */
	successfulCalls: number;

	/** Failed calls */
	failedCalls: number;

	/** Average latency across all providers */
	averageLatency: number;

	/** Calls by provider */
	callsByProvider: Record<string, number>;

	/** Calls by method */
	callsByMethod: Record<string, number>;

	/** Calls by network */
	callsByNetwork: Record<Network, number>;

	/** Health by provider */
	providerHealth: Record<string, Record<Network, ProviderHealth>>;
}

/**
 * RPC call trace for debugging
 */
export interface RpcCallTrace {
	/** Unique trace ID */
	traceId: string;

	/** Method called */
	method: string;

	/** Parameters */
	params: unknown;

	/** Network */
	network: Network;

	/** Start timestamp */
	startTime: Date;

	/** End timestamp */
	endTime: Date | null;

	/** Total duration (milliseconds) */
	duration: number | null;

	/** Attempts made */
	attempts: Array<{
		provider: string;
		startTime: Date;
		endTime: Date;
		duration: number;
		success: boolean;
		error?: string;
	}>;

	/** Final result */
	result: {
		success: boolean;
		provider: string | null;
		error?: string;
	};
}
