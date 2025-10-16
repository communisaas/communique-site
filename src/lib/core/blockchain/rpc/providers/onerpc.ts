/**
 * 1RPC Provider (Privacy-Focused)
 *
 * Free Tier Limits:
 * - "Always free" commitment
 * - Daily quota (exact limit undisclosed)
 * - 2MB per request size limit
 * - Resets daily at 00:00 UTC
 *
 * Privacy Features:
 * - TEE-attested relays (Trusted Execution Environment)
 * - Zero metadata logging
 * - Metadata erased after request completion
 *
 * Documentation: https://docs.1rpc.io/
 */

import { BaseRpcProvider } from '../base-provider';
import type { ProviderConfig } from '../types';

export class OneRpcProvider extends BaseRpcProvider {
	constructor() {
		const config: ProviderConfig = {
			name: '1RPC',
			mainnet: 'https://1rpc.io/near',
			testnet: null, // Testnet support unclear
			priority: 3, // Tertiary (privacy-focused backup)
			limits: {
				dailyQuota: undefined // Undisclosed, use cautiously
			},
			privacy: {
				teeEnabled: true,
				noLogging: true
			},
			timeout: 10000,
			maxRetries: 2,
			enabled: true
		};

		super(config);
	}
}
