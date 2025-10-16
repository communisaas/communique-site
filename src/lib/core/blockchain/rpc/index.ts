/**
 * NEAR Protocol RPC - Main Exports
 *
 * Zero-Budget Production Stack (October 2025):
 * - Ankr: 30 req/sec, 200M credits/month (Primary)
 * - dRPC: 210M CU/month, ~2,100 CU/sec (Secondary)
 * - 1RPC: Privacy-focused, daily quota (Tertiary)
 *
 * Usage:
 * ```typescript
 * import { rpc } from '$lib/core/blockchain/rpc';
 *
 * // Simple call
 * const result = await rpc.call('status', []);
 *
 * // With options
 * const account = await rpc.call(
 *   'query',
 *   { request_type: 'view_account', account_id: 'alice.near' },
 *   { network: 'mainnet', preferredProvider: 'Ankr' }
 * );
 *
 * // Get metrics
 * const metrics = rpc.getMetrics();
 * console.log('Success rate:', metrics.successfulCalls / metrics.totalCalls);
 * ```
 */

import { RpcManager } from './manager';
import { AnkrProvider } from './providers/ankr';
import { DRpcProvider } from './providers/drpc';
import { OneRpcProvider } from './providers/onerpc';

// Export types
export type * from './types';

// Export classes (for advanced usage)
export { RpcManager } from './manager';
export { BaseRpcProvider } from './base-provider';
export { CircuitBreaker } from './circuit-breaker';
export { AnkrProvider } from './providers/ankr';
export { DRpcProvider } from './providers/drpc';
export { OneRpcProvider } from './providers/onerpc';

/**
 * Global RPC manager instance with free tier providers
 */
export const rpc = new RpcManager(
	[
		new AnkrProvider(), // Priority 1: Most generous free tier
		new DRpcProvider(), // Priority 2: Excellent backup
		new OneRpcProvider() // Priority 3: Privacy-focused
	],
	{
		strategy: 'priority', // Try providers in priority order
		defaultNetwork: 'mainnet',
		defaultTimeout: 10000,
		defaultMaxRetries: 2,
		enableMetrics: true,
		enableLogging: import.meta.env.DEV // Log in development only
	}
);

/**
 * Helper: Query NEAR account state
 */
export async function queryAccount(accountId: string, network?: 'mainnet' | 'testnet') {
	return rpc.call(
		'query',
		{
			request_type: 'view_account',
			finality: 'final',
			account_id: accountId
		},
		{ network }
	);
}

/**
 * Helper: View contract method
 */
export async function viewMethod(
	contractId: string,
	methodName: string,
	args: Record<string, unknown> = {},
	network?: 'mainnet' | 'testnet'
) {
	const argsBase64 = typeof window !== 'undefined'
		? btoa(JSON.stringify(args))
		: Buffer.from(JSON.stringify(args)).toString('base64');

	return rpc.call(
		'query',
		{
			request_type: 'call_function',
			finality: 'final',
			account_id: contractId,
			method_name: methodName,
			args_base64: argsBase64
		},
		{ network }
	);
}

/**
 * Helper: Get NEAR network status
 */
export async function getNetworkStatus(network?: 'mainnet' | 'testnet') {
	return rpc.call('status', [], { network });
}

/**
 * Helper: Get transaction status
 */
export async function getTransactionStatus(
	txHash: string,
	accountId: string,
	network?: 'mainnet' | 'testnet'
) {
	return rpc.call('tx', { tx_hash: txHash, sender_account_id: accountId }, { network });
}
