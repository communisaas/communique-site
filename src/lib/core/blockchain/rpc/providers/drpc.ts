/**
 * dRPC Provider
 *
 * Free Tier Limits (Updated June 2025):
 * - 210M Compute Units per 30 days
 * - 120,000 CU/minute per IP (normal conditions)
 * - ~2,100 CU/second dynamic limit
 * - Minimum 50,400 CU/minute during peak demand
 *
 * Documentation: https://drpc.org/docs/
 */

import { BaseRpcProvider } from '../base-provider';
import type { ProviderConfig } from '../types';

export class DRpcProvider extends BaseRpcProvider {
	constructor() {
		const config: ProviderConfig = {
			name: 'dRPC',
			mainnet: 'https://near.drpc.org/',
			testnet: 'https://near-testnet.drpc.org/',
			priority: 2, // Secondary (excellent backup)
			limits: {
				computeUnitsPerSecond: 2100,
				monthlyQuota: 210_000_000 // 210M CU per 30 days
			},
			timeout: 10000,
			maxRetries: 2,
			enabled: true
		};

		super(config);
	}
}
