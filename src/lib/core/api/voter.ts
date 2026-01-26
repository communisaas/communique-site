/**
 * VOTER Protocol Integration
 *
 * Re-exports from the blockchain client for backward compatibility.
 */

// Re-export from the blockchain client
export {
	certifyEmailDelivery,
	voterBlockchainClient,
	type VOTERAction,
	type VOTERActionResult,
	type TransactionReceipt,
	type VOTERActionSuccess,
	type VOTERActionError
} from '../blockchain/voter-client.js';

// Re-export types
export type { ApiResponse } from './client';
