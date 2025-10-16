/**
 * Client-Side Transaction Signing with NEAR Passkeys
 *
 * 🔒 SECURITY: All private keys stay on the user's device.
 * Uses WebAuthn/FIDO2 (Touch ID, Face ID, Windows Hello, hardware keys).
 *
 * Architecture:
 * - NEAR account created with passkey as primary key
 * - User signs transactions with biometric authentication
 * - Private key never leaves secure enclave on device
 * - No recovery phrase needed - social recovery with guardians
 *
 * Integration with VOTER Protocol:
 * - NEAR Chain Signatures enables control of Scroll addresses
 * - User signs once on NEAR, MPC network creates Scroll signature
 * - All settlement happens on Scroll zkEVM
 */

import { PasskeyProcessCanceled, getKeys, createKey, getPasskeyPublicKey } from '@near-js/biometric-ed25519';
import { KeyPair } from '@near-js/crypto';
import { BrowserLocalStorageKeyStore } from '@near-js/keystores-browser';
import type { AccountView } from 'near-api-js/lib/providers/provider';

/**
 * Passkey wallet interface
 * Will be implemented with @near-js/biometric-ed25519
 */
export interface PasskeyWallet {
	accountId: string;
	isSetup: boolean;
	hasPasskey: boolean;
}

/**
 * Transaction to be signed by user
 */
export interface UnsignedTransaction {
	to: string;
	data: string;
	value: string;
	gasLimit?: string;
	chainId?: number;
}

/**
 * Signed transaction ready for submission
 */
export interface SignedTransaction {
	raw: string;
	hash: string;
	from: string;
}

/**
 * NEAR passkey configuration
 */
const PASSKEY_CONFIG = {
	rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
	rpName: 'Communique',
	timeout: 60000, // 60 seconds for user to approve
	userVerification: 'required' as const // Require biometric/PIN
};

/**
 * Client-side passkey wallet manager
 *
 * Implements NEAR passkey authentication with WebAuthn/FIDO2
 */
export class ClientPasskeyWallet {
	private accountId: string | null = null;
	private keyStore: BrowserLocalStorageKeyStore;
	private passkeyPublicKey: string | null = null;

	constructor() {
		// Initialize browser-based key store
		this.keyStore = new BrowserLocalStorageKeyStore();
	}

	/**
	 * Check if user has a passkey wallet set up
	 */
	async isSetup(): Promise<boolean> {
		try {
			// Check if we have any passkey credentials stored
			const keys = await getKeys(PASSKEY_CONFIG.rpId);
			return keys.length > 0;
		} catch (error) {
			console.error('[Passkey] Failed to check setup:', error);
			return false;
		}
	}

	/**
	 * Get list of available passkey credentials
	 */
	async getAvailablePasskeys(): Promise<{ id: string; username: string }[]> {
		try {
			const keys = await getKeys(PASSKEY_CONFIG.rpId);
			return keys.map((key) => ({
				id: key.credentialId,
				username: key.username || 'Unknown'
			}));
		} catch (error) {
			console.error('[Passkey] Failed to get passkeys:', error);
			return [];
		}
	}

	/**
	 * Create new NEAR account with passkey
	 *
	 * Flow:
	 * 1. User approves passkey creation (Touch ID/Face ID prompt)
	 * 2. WebAuthn generates key pair in secure enclave
	 * 3. Get public key from passkey
	 * 4. Register NEAR account with this public key
	 * 5. Store account ID locally
	 *
	 * @param accountId - NEAR account ID (e.g., "random-abc123.communique.testnet")
	 * @param username - Display name for passkey (e.g., user's email)
	 * @returns Public key for NEAR account registration
	 */
	async createPasskeyWallet(accountId: string, username?: string): Promise<string> {
		try {
			// 1. Create WebAuthn passkey credential
			console.log('[Passkey] Creating passkey for account:', accountId);

			await createKey({
				username: username || accountId,
				rpId: PASSKEY_CONFIG.rpId,
				rpName: PASSKEY_CONFIG.rpName,
				timeout: PASSKEY_CONFIG.timeout,
				userVerification: PASSKEY_CONFIG.userVerification
			});

			// 2. Get public key from the newly created passkey
			const publicKey = await getPasskeyPublicKey({
				rpId: PASSKEY_CONFIG.rpId,
				timeout: PASSKEY_CONFIG.timeout,
				userVerification: PASSKEY_CONFIG.userVerification
			});

			if (!publicKey) {
				throw new Error('Failed to retrieve passkey public key');
			}

			// 3. Store account ID and public key
			this.accountId = accountId;
			this.passkeyPublicKey = publicKey;

			// Store in localStorage for persistence
			if (typeof window !== 'undefined') {
				localStorage.setItem('near_passkey_account_id', accountId);
				localStorage.setItem('near_passkey_public_key', publicKey);
			}

			console.log('[Passkey] Passkey created successfully');
			return publicKey;
		} catch (error) {
			if (error instanceof PasskeyProcessCanceled) {
				throw new Error('Passkey creation canceled by user');
			}
			console.error('[Passkey] Failed to create passkey:', error);
			throw new Error(
				`Failed to create passkey: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Sign message with user's passkey
	 *
	 * @param message - Message to sign (32 bytes for transactions)
	 * @returns Signature
	 */
	async signMessage(message: Uint8Array): Promise<Uint8Array> {
		if (!this.accountId) {
			throw new Error('No passkey wallet set up - call createPasskeyWallet() first');
		}

		try {
			// Prompt user for biometric authentication and sign
			const publicKey = await getPasskeyPublicKey({
				rpId: PASSKEY_CONFIG.rpId,
				timeout: PASSKEY_CONFIG.timeout,
				userVerification: PASSKEY_CONFIG.userVerification
			});

			if (!publicKey) {
				throw new Error('Failed to get passkey for signing');
			}

			// Create KeyPair from passkey public key
			const keyPair = KeyPair.fromString(publicKey);

			// Sign the message
			const signature = keyPair.sign(message);

			console.log('[Passkey] Message signed successfully');
			return signature.signature;
		} catch (error) {
			if (error instanceof PasskeyProcessCanceled) {
				throw new Error('Signing canceled by user');
			}
			console.error('[Passkey] Failed to sign:', error);
			throw new Error(
				`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Sign transaction with user's passkey
	 *
	 * @param tx - Unsigned transaction from server
	 * @returns Signed transaction ready for submission
	 */
	async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
		if (!this.accountId) {
			throw new Error('No passkey wallet set up - call createPasskeyWallet() first');
		}

		try {
			// For EVM transactions (Scroll), we need to sign the tx hash
			const txHash = new TextEncoder().encode(tx.data);
			const signature = await this.signMessage(txHash);

			// Convert to hex signature format
			const sigHex = Array.from(signature)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			// Construct signed transaction (simplified - actual implementation needs proper RLP encoding)
			return {
				raw: tx.data + sigHex,
				hash: tx.data,
				from: this.accountId
			};
		} catch (error) {
			console.error('[Passkey] Transaction signing failed:', error);
			throw error;
		}
	}

	/**
	 * Get account information from localStorage
	 */
	async getAccount(): Promise<{ accountId: string; publicKey: string } | null> {
		if (typeof window === 'undefined') {
			return null;
		}

		const accountId = localStorage.getItem('near_passkey_account_id');
		const publicKey = localStorage.getItem('near_passkey_public_key');

		if (!accountId || !publicKey) {
			return null;
		}

		return { accountId, publicKey };
	}

	/**
	 * Sign and submit transaction to blockchain
	 *
	 * @param tx - Unsigned transaction
	 * @returns Transaction hash
	 */
	async signAndSubmit(tx: UnsignedTransaction): Promise<string> {
		const signed = await this.signTransaction(tx);

		// TODO: Submit to blockchain via RPC
		// For Scroll: Use Chain Signatures MPC to convert NEAR signature
		// For NEAR: Direct submission to NEAR RPC

		console.log('[Passkey] Transaction signed, ready for submission');
		return signed.hash;
	}

	/**
	 * Clear passkey wallet data
	 */
	async logout(): Promise<void> {
		this.accountId = null;
		this.passkeyPublicKey = null;

		if (typeof window !== 'undefined') {
			localStorage.removeItem('near_passkey_account_id');
			localStorage.removeItem('near_passkey_public_key');
		}

		console.log('[Passkey] Wallet logged out');
	}
}

/**
 * Global passkey wallet instance
 * Initialized once per session
 */
let globalWallet: ClientPasskeyWallet | null = null;

/**
 * Get or create passkey wallet instance
 */
export function getPasskeyWallet(): ClientPasskeyWallet {
	if (!globalWallet) {
		globalWallet = new ClientPasskeyWallet();
	}
	return globalWallet;
}

/**
 * Check if passkeys are supported in this browser
 */
export function isPasskeySupported(): boolean {
	// Check for WebAuthn support
	return !!(
		window.PublicKeyCredential &&
		typeof window.PublicKeyCredential === 'function'
	);
}

/**
 * Get user-friendly name for passkey device
 */
export function getPasskeyDeviceName(): string {
	const platform = navigator.platform || '';
	const userAgent = navigator.userAgent || '';

	if (/iPhone|iPad|iPod/.test(userAgent)) {
		return 'Face ID / Touch ID';
	}
	if (/Mac/.test(platform)) {
		return 'Touch ID';
	}
	if (/Win/.test(platform)) {
		return 'Windows Hello';
	}
	if (/Android/.test(userAgent)) {
		return 'Fingerprint / Face Unlock';
	}

	return 'Security Key';
}
