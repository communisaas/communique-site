/**
 * NEAR Meta-Transaction (NEP-366) Infrastructure
 *
 * Enables gasless transactions for non-crypto users. The user signs a
 * DelegateAction off-chain; our server wraps it in a regular transaction
 * and submits it, paying the gas from a sponsor account.
 *
 * NEP-366 flow:
 *   1. Client builds a DelegateAction (sender, receiver, actions, nonce, expiry)
 *   2. Client signs it with their Ed25519 key -> SignedDelegateAction
 *   3. Client sends the SignedDelegateAction to POST /api/wallet/near/sponsor
 *   4. Server wraps it in a normal Transaction with a `signedDelegate` action
 *   5. Server signs the wrapping transaction with the sponsor key and broadcasts it
 *   6. NEAR runtime verifies the inner DelegateAction signature and executes it
 *
 * Functions marked CLIENT-SAFE can be imported from browser code.
 * Functions marked SERVER-ONLY use private keys / env vars and must not reach the client.
 *
 * @module near/meta-transactions
 */

import { PublicKey, KeyPair, type KeyPairString } from '@near-js/crypto';
import {
	DelegateAction,
	SignedDelegate,
	buildDelegateAction as nearBuildDelegateAction,
	actionCreators,
	createTransaction,
	encodeSignedDelegate,
	SCHEMA,
	Signature
} from '@near-js/transactions';
import { JsonRpcProvider } from '@near-js/providers';
import { KeyPairSigner } from '@near-js/signers';
import { baseDecode } from '@near-js/utils';
import { deserialize } from 'borsh';

// Re-export SDK types under our own names for stable public API
export type { DelegateAction } from '@near-js/transactions';
export type { SignedDelegate as SignedDelegateAction } from '@near-js/transactions';

// =============================================================================
// Types
// =============================================================================

/** Result of relaying a meta-transaction to NEAR */
export interface MetaTxResult {
	success: boolean;
	/** Transaction hash on success */
	txHash?: string;
	/** Error message on failure */
	error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const LOG_PREFIX = '[near/meta-tx]';

/** NEAR RPC endpoints by network */
const RPC_URLS: Record<string, string> = {
	testnet: 'https://rpc.testnet.near.org',
	mainnet: 'https://rpc.mainnet.near.org'
};

/**
 * Default block height buffer for DelegateAction expiry.
 * ~200 blocks ~ 3-4 minutes at NEAR's ~1.3s block time.
 * Exported for use by callers constructing DelegateActions.
 */
export const DEFAULT_BLOCK_HEIGHT_TTL = 200n;

// =============================================================================
// CLIENT-SAFE: DelegateAction Construction
// =============================================================================

/**
 * Build a DelegateAction for a NEAR function call.
 *
 * CLIENT-SAFE: No private keys or server env vars used.
 *
 * The caller must provide the current nonce (from viewAccessKey) and a
 * maxBlockHeight (from viewBlock + buffer). The returned DelegateAction
 * is ready to be signed by the user's keypair.
 *
 * @param params - Parameters for the delegate action
 * @returns A DelegateAction ready for signing
 */
export function buildDelegateActionForFunctionCall(params: {
	/** User's NEAR account ID */
	senderId: string;
	/** Target contract (e.g., MPC signer) */
	receiverId: string;
	/** Contract method to call */
	methodName: string;
	/** Method arguments (will be JSON-serialized) */
	args: Record<string, unknown>;
	/** Gas to attach (yoctoNEAR-equivalent gas units) */
	gas: bigint;
	/** Deposit to attach (yoctoNEAR), typically 0n for meta-tx */
	deposit: bigint;
	/** User's public key in NEAR format (ed25519:base58...) */
	publicKey: string;
	/** Current access key nonce + 1 */
	nonce: bigint;
	/** Block height at which this action expires */
	maxBlockHeight: bigint;
}): DelegateAction {
	const {
		senderId,
		receiverId,
		methodName,
		args,
		gas,
		deposit,
		publicKey,
		nonce,
		maxBlockHeight
	} = params;

	// Build the inner FunctionCall action using the SDK's action creator
	const functionCallAction = actionCreators.functionCall(methodName, args, gas, deposit);

	// Construct the DelegateAction via the SDK builder
	return nearBuildDelegateAction({
		senderId,
		receiverId,
		actions: [functionCallAction],
		nonce,
		maxBlockHeight,
		publicKey: PublicKey.from(publicKey)
	});
}

/**
 * Sign a DelegateAction with a NEAR keypair.
 *
 * CLIENT-SAFE: Uses the caller-provided keypair (could be in-browser key).
 *
 * @param delegateAction - The unsigned DelegateAction
 * @param keyPair - NEAR KeyPair to sign with
 * @returns The signed delegate action, ready for relay
 */
export async function signDelegateAction(
	delegateAction: DelegateAction,
	keyPair: KeyPair
): Promise<SignedDelegate> {
	const signer = new KeyPairSigner(keyPair);
	const [, signedDelegate] = await signer.signDelegateAction(delegateAction);
	return signedDelegate;
}

// =============================================================================
// CLIENT-SAFE: Serialization Utilities
// =============================================================================

/**
 * Serialize a SignedDelegate to a base64 string for transport to the relay endpoint.
 *
 * CLIENT-SAFE: Pure serialization, no secrets.
 *
 * @param signedDelegate - The signed delegate action
 * @returns Base64-encoded borsh bytes
 */
export function serializeSignedDelegate(signedDelegate: SignedDelegate): string {
	const bytes = encodeSignedDelegate(signedDelegate);
	// Use btoa-compatible encoding that works in both browser and Workers
	return uint8ArrayToBase64(bytes);
}

/**
 * Deserialize a base64-encoded SignedDelegate received from the client.
 *
 * @param base64 - Base64-encoded borsh bytes
 * @returns Deserialized SignedDelegate
 * @throws If deserialization fails
 */
export function deserializeSignedDelegate(base64: string): SignedDelegate {
	const bytes = base64ToUint8Array(base64);
	const raw = deserialize(SCHEMA.SignedDelegate, bytes) as {
		delegateAction: DelegateAction;
		signature: Signature;
	};
	return new SignedDelegate({
		delegateAction: new DelegateAction({
			senderId: raw.delegateAction.senderId,
			receiverId: raw.delegateAction.receiverId,
			actions: raw.delegateAction.actions,
			nonce: raw.delegateAction.nonce,
			maxBlockHeight: raw.delegateAction.maxBlockHeight,
			publicKey: raw.delegateAction.publicKey
		}),
		signature: raw.signature
	});
}

// =============================================================================
// SERVER-ONLY: Relay Infrastructure
// =============================================================================

/**
 * Relay a SignedDelegateAction to NEAR via our gas sponsor account.
 *
 * SERVER-ONLY: Uses NEAR_SPONSOR_PRIVATE_KEY and NEAR_SPONSOR_ACCOUNT_ID
 * environment variables. Do NOT import this function in client code.
 *
 * The sponsor account wraps the SignedDelegate inside a normal Transaction
 * (as a `signedDelegate` action type), signs it with its own key, and
 * broadcasts it. The NEAR runtime then verifies and executes the inner
 * DelegateAction using the original user's signature.
 *
 * @param signedDelegateAction - The user's signed delegate action
 * @param options - Network configuration
 * @returns Result with transaction hash on success
 */
export async function relayDelegateAction(
	signedDelegateAction: SignedDelegate,
	options?: { network?: 'testnet' | 'mainnet' }
): Promise<MetaTxResult> {
	// Lazy import to keep this function tree-shakeable from client bundles.
	// The env import will cause a build error if client code tries to import
	// this function, which is the desired behavior.
	const { env } = await import('$env/dynamic/private');

	const network = options?.network ?? 'testnet';
	const sponsorPrivateKey = env.NEAR_SPONSOR_PRIVATE_KEY;
	const sponsorAccountId = env.NEAR_SPONSOR_ACCOUNT_ID;

	if (!sponsorPrivateKey) {
		console.error(`${LOG_PREFIX} NEAR_SPONSOR_PRIVATE_KEY is not set`);
		return { success: false, error: 'Sponsor key not configured' };
	}

	if (!sponsorAccountId) {
		console.error(`${LOG_PREFIX} NEAR_SPONSOR_ACCOUNT_ID is not set`);
		return { success: false, error: 'Sponsor account not configured' };
	}

	const rpcUrl = RPC_URLS[network];
	if (!rpcUrl) {
		return { success: false, error: `Unknown network: ${network}` };
	}

	try {
		const provider = new JsonRpcProvider({ url: rpcUrl });
		const sponsorKeyPair = KeyPair.fromString(sponsorPrivateKey as KeyPairString);
		const sponsorSigner = new KeyPairSigner(sponsorKeyPair);
		const sponsorPublicKey = await sponsorSigner.getPublicKey();

		// Get the sponsor's current access key nonce and recent block hash
		const accessKey = await provider.viewAccessKey(sponsorAccountId, sponsorPublicKey);
		const block = await provider.viewBlock({ finality: 'final' });
		const blockHash = baseDecode(block.header.hash);
		const nonce = BigInt(accessKey.nonce) + 1n;

		// Build the wrapping transaction:
		// The sender is the sponsor, the receiver is the original user's sender_id
		// (NEAR runtime routes the SignedDelegate to its designated receiver).
		// The action is a single `signedDelegate` action containing the user's
		// signed meta-transaction.
		const delegateActionWrapper = actionCreators.signedDelegate({
			delegateAction: signedDelegateAction.delegateAction,
			signature: signedDelegateAction.signature
		});

		const tx = createTransaction(
			sponsorAccountId,
			sponsorPublicKey,
			signedDelegateAction.delegateAction.senderId,
			nonce,
			[delegateActionWrapper],
			blockHash
		);

		// Sign the wrapping transaction with the sponsor's key
		const [, signedTx] = await sponsorSigner.signTransaction(tx);

		// Broadcast and wait for execution
		console.log(
			`${LOG_PREFIX} Relaying meta-tx from ${signedDelegateAction.delegateAction.senderId} ` +
				`to ${signedDelegateAction.delegateAction.receiverId} via sponsor ${sponsorAccountId}`
		);

		const outcome = await provider.sendTransactionUntil(signedTx, 'INCLUDED_FINAL');

		// Extract transaction hash from the outcome
		const txHash =
			outcome.transaction_outcome?.id ??
			outcome.transaction?.hash ??
			'unknown';

		// Check for execution failure
		if (
			typeof outcome.status === 'object' &&
			outcome.status !== null &&
			'Failure' in outcome.status
		) {
			const failureMessage =
				typeof outcome.status.Failure === 'object'
					? JSON.stringify(outcome.status.Failure)
					: String(outcome.status.Failure);
			console.error(`${LOG_PREFIX} Meta-tx execution failed:`, failureMessage);
			return {
				success: false,
				txHash: String(txHash),
				error: `Transaction failed: ${failureMessage}`
			};
		}

		console.log(`${LOG_PREFIX} Meta-tx relayed successfully: ${txHash}`);
		return { success: true, txHash: String(txHash) };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`${LOG_PREFIX} Failed to relay meta-tx:`, message);
		return { success: false, error: message };
	}
}

// =============================================================================
// Internal Utilities
// =============================================================================

/** Convert Uint8Array to base64 string (works in both browser and Workers) */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/** Convert base64 string to Uint8Array (works in both browser and Workers) */
function base64ToUint8Array(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
