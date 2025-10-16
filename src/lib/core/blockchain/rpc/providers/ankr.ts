/**
 * Ankr RPC Provider
 *
 * Free Tier Limits (October 2025):
 * - 30 requests/second
 * - 200M API credits/month
 * - 65+ blockchains supported
 *
 * Documentation: https://www.ankr.com/rpc/
 */

import { BaseRpcProvider } from '../base-provider';
import type { ProviderConfig } from '../types';

export class AnkrProvider extends BaseRpcProvider {
	constructor() {
		const config: ProviderConfig = {
			name: 'Ankr',
			mainnet: 'https://rpc.ankr.com/near',
			testnet: 'https://rpc.ankr.com/near_testnet',
			priority: 1, // Highest priority (most generous free tier)
			limits: {
				requestsPerSecond: 30,
				monthlyQuota: 200_000_000 // 200M API credits
			},
			timeout: 10000,
			maxRetries: 2,
			enabled: true
		};

		super(config);
	}
}
