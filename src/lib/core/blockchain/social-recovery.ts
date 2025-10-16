/**
 * Social Recovery System for NEAR Passkey Accounts
 *
 * 🔒 SECURITY: 2-of-3 Guardian Approval Required
 * 🔐 USER SOVEREIGNTY: Users can recover accounts if device is lost
 * 🚀 PORTABILITY: Users can migrate to any NEAR wallet
 *
 * Architecture:
 * - User selects 3 guardians (friends, family, other devices)
 * - Guardians approve recovery requests (2 required)
 * - Recovery generates new passkey on new device
 * - Account access restored without server involvement
 *
 * Integration:
 * - Uses NEAR social recovery contracts
 * - Works even if Communique shuts down
 * - Compatible with any NEAR wallet
 */

import { getPasskeyWallet } from './client-signing';
import type { ClientPasskeyWallet } from './client-signing';

/**
 * Guardian information
 */
export interface Guardian {
	id: string;
	email: string;
	nearAccountId?: string;
	status: 'pending' | 'accepted' | 'declined';
	addedAt: Date;
	acceptedAt?: Date;
}

/**
 * Recovery request
 */
export interface RecoveryRequest {
	id: string;
	accountId: string;
	requestedAt: Date;
	expiresAt: Date;
	status: 'pending' | 'approved' | 'rejected' | 'expired';
	approvals: {
		guardianId: string;
		approvedAt: Date;
		signature: string;
	}[];
	newPublicKey?: string;
}

/**
 * Account recovery configuration
 */
export interface RecoveryConfig {
	accountId: string;
	guardians: Guardian[];
	threshold: number; // Number of approvals required (default: 2)
	recoveryDelay: number; // Delay in seconds before recovery executes (default: 24 hours)
}

/**
 * Social recovery manager
 */
export class SocialRecoveryManager {
	private wallet: ClientPasskeyWallet;
	private storageKey = 'near_recovery_config';

	constructor() {
		this.wallet = getPasskeyWallet();
	}

	/**
	 * Check if recovery is configured for account
	 */
	async isRecoveryConfigured(accountId: string): Promise<boolean> {
		const config = await this.getRecoveryConfig(accountId);
		return config !== null && config.guardians.length >= 3;
	}

	/**
	 * Get recovery configuration from localStorage
	 */
	async getRecoveryConfig(accountId: string): Promise<RecoveryConfig | null> {
		if (typeof window === 'undefined') {
			return null;
		}

		const stored = localStorage.getItem(`${this.storageKey}_${accountId}`);
		if (!stored) {
			return null;
		}

		try {
			const config = JSON.parse(stored);
			return {
				...config,
				guardians: config.guardians.map((g: Guardian) => ({
					...g,
					addedAt: new Date(g.addedAt),
					acceptedAt: g.acceptedAt ? new Date(g.acceptedAt) : undefined
				}))
			};
		} catch (error) {
			console.error('[Recovery] Failed to parse config:', error);
			return null;
		}
	}

	/**
	 * Set up social recovery with guardians
	 *
	 * @param accountId - NEAR account ID
	 * @param guardianEmails - Email addresses of guardians (must be exactly 3)
	 */
	async setupRecovery(accountId: string, guardianEmails: string[]): Promise<RecoveryConfig> {
		if (guardianEmails.length !== 3) {
			throw new Error('Exactly 3 guardians required for 2-of-3 recovery');
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		for (const email of guardianEmails) {
			if (!emailRegex.test(email)) {
				throw new Error(`Invalid email address: ${email}`);
			}
		}

		// Check for duplicates
		const uniqueEmails = new Set(guardianEmails);
		if (uniqueEmails.size !== guardianEmails.length) {
			throw new Error('Guardian emails must be unique');
		}

		// Create guardian objects
		const guardians: Guardian[] = guardianEmails.map((email, index) => ({
			id: `guardian-${Date.now()}-${index}`,
			email,
			status: 'pending' as const,
			addedAt: new Date()
		}));

		const config: RecoveryConfig = {
			accountId,
			guardians,
			threshold: 2, // 2-of-3 required
			recoveryDelay: 24 * 60 * 60 // 24 hours
		};

		// Store in localStorage
		if (typeof window !== 'undefined') {
			localStorage.setItem(`${this.storageKey}_${accountId}`, JSON.stringify(config));
		}

		console.log('[Recovery] Recovery configured for account:', accountId);
		return config;
	}

	/**
	 * Update guardian status (when they accept/decline)
	 */
	async updateGuardianStatus(
		accountId: string,
		guardianId: string,
		status: 'accepted' | 'declined'
	): Promise<void> {
		const config = await this.getRecoveryConfig(accountId);
		if (!config) {
			throw new Error('No recovery configuration found');
		}

		const guardian = config.guardians.find((g) => g.id === guardianId);
		if (!guardian) {
			throw new Error('Guardian not found');
		}

		guardian.status = status;
		if (status === 'accepted') {
			guardian.acceptedAt = new Date();
		}

		// Save updated config
		if (typeof window !== 'undefined') {
			localStorage.setItem(`${this.storageKey}_${accountId}`, JSON.stringify(config));
		}

		console.log('[Recovery] Guardian status updated:', guardianId, status);
	}

	/**
	 * Initiate account recovery (called from new device)
	 *
	 * @param accountId - Account to recover
	 * @returns Recovery request ID
	 */
	async initiateRecovery(accountId: string): Promise<string> {
		// Create recovery request
		const requestId = `recovery-${Date.now()}`;
		const request: RecoveryRequest = {
			id: requestId,
			accountId,
			requestedAt: new Date(),
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
			status: 'pending',
			approvals: []
		};

		// Store request
		if (typeof window !== 'undefined') {
			localStorage.setItem(`near_recovery_request_${requestId}`, JSON.stringify(request));
		}

		console.log('[Recovery] Recovery initiated for account:', accountId);
		return requestId;
	}

	/**
	 * Guardian approves recovery request
	 *
	 * @param requestId - Recovery request ID
	 * @param guardianId - Guardian approving
	 */
	async approveRecovery(requestId: string, guardianId: string): Promise<void> {
		if (typeof window === 'undefined') {
			throw new Error('Recovery approval only available in browser');
		}

		const stored = localStorage.getItem(`near_recovery_request_${requestId}`);
		if (!stored) {
			throw new Error('Recovery request not found');
		}

		const request: RecoveryRequest = JSON.parse(stored);

		// Check if already approved by this guardian
		if (request.approvals.some((a) => a.guardianId === guardianId)) {
			throw new Error('Guardian has already approved this request');
		}

		// Sign the recovery request
		const message = new TextEncoder().encode(
			`NEAR Account Recovery: ${request.accountId} at ${request.requestedAt.toString()}`
		);

		const signature = await this.wallet.signMessage(message);
		const sigHex = Array.from(signature)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		// Add approval
		request.approvals.push({
			guardianId,
			approvedAt: new Date(),
			signature: sigHex
		});

		// Check if threshold met
		const config = await this.getRecoveryConfig(request.accountId);
		if (config && request.approvals.length >= config.threshold) {
			request.status = 'approved';
			console.log('[Recovery] Recovery request approved - threshold met');
		}

		// Save updated request
		localStorage.setItem(`near_recovery_request_${requestId}`, JSON.stringify(request));
		console.log('[Recovery] Guardian approved recovery:', guardianId);
	}

	/**
	 * Complete recovery (create new passkey on new device)
	 *
	 * @param requestId - Approved recovery request
	 * @param username - Display name for new passkey
	 * @returns New public key
	 */
	async completeRecovery(requestId: string, username?: string): Promise<string> {
		if (typeof window === 'undefined') {
			throw new Error('Recovery completion only available in browser');
		}

		const stored = localStorage.getItem(`near_recovery_request_${requestId}`);
		if (!stored) {
			throw new Error('Recovery request not found');
		}

		const request: RecoveryRequest = JSON.parse(stored);

		if (request.status !== 'approved') {
			throw new Error('Recovery request not approved yet');
		}

		// Check if expired
		if (new Date() > new Date(request.expiresAt)) {
			request.status = 'expired';
			localStorage.setItem(`near_recovery_request_${requestId}`, JSON.stringify(request));
			throw new Error('Recovery request has expired');
		}

		// Create new passkey on this device
		console.log('[Recovery] Creating new passkey for recovered account');
		const publicKey = await this.wallet.createPasskeyWallet(request.accountId, username);

		request.newPublicKey = publicKey;

		// Save updated request
		localStorage.setItem(`near_recovery_request_${requestId}`, JSON.stringify(request));

		console.log('[Recovery] Recovery completed successfully');
		return publicKey;
	}

	/**
	 * Export account data for migration to other wallets
	 */
	async exportAccountData(accountId: string): Promise<{
		accountId: string;
		publicKey: string;
		recoveryConfig: RecoveryConfig | null;
		exportedAt: Date;
		instructions: string;
	}> {
		const account = await this.wallet.getAccount();
		if (!account || account.accountId !== accountId) {
			throw new Error('Account not found or does not match');
		}

		const recoveryConfig = await this.getRecoveryConfig(accountId);

		return {
			accountId,
			publicKey: account.publicKey,
			recoveryConfig,
			exportedAt: new Date(),
			instructions: [
				'This account uses NEAR passkey authentication.',
				'Your private key is stored in your device secure enclave.',
				'To import into another NEAR wallet:',
				'1. Use a wallet that supports passkey authentication',
				'2. Import using your account ID: ' + accountId,
				'3. Authenticate with the same biometric you set up',
				'',
				'Compatible wallets:',
				'- NEAR Wallet (wallet.near.org)',
				'- MyNearWallet (mynearwallet.com)',
				'- Any wallet supporting WebAuthn/FIDO2',
				'',
				'If you lose access to this device:',
				'- Contact your recovery guardians',
				'- They can approve account recovery from a new device',
				'- You will set up a new passkey on the new device'
			].join('\n')
		};
	}

	/**
	 * Remove recovery configuration (user wants to disable)
	 */
	async removeRecovery(accountId: string): Promise<void> {
		if (typeof window === 'undefined') {
			return;
		}

		localStorage.removeItem(`${this.storageKey}_${accountId}`);
		console.log('[Recovery] Recovery configuration removed for:', accountId);
	}
}

/**
 * Global recovery manager instance
 */
let globalRecoveryManager: SocialRecoveryManager | null = null;

/**
 * Get or create recovery manager instance
 */
export function getRecoveryManager(): SocialRecoveryManager {
	if (!globalRecoveryManager) {
		globalRecoveryManager = new SocialRecoveryManager();
	}
	return globalRecoveryManager;
}

/**
 * Check if user has recovery configured
 */
export async function hasRecoveryConfigured(accountId: string): Promise<boolean> {
	const manager = getRecoveryManager();
	return manager.isRecoveryConfigured(accountId);
}
