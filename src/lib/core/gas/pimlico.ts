/**
 * Pimlico ERC-4337 bundler and paymaster client.
 *
 * Wraps Pimlico's JSON-RPC API for gas sponsorship on Scroll Sepolia / Scroll
 * mainnet. Uses raw fetch() for RPC calls -- no pimlico SDK dependency.
 *
 * Pimlico exposes a single endpoint that handles both bundler methods
 * (eth_sendUserOperation, eth_estimateUserOperationGas, eth_getUserOperationReceipt)
 * and paymaster methods (pm_getPaymasterStubData, pm_getPaymasterData).
 *
 * SERVER-ONLY: Reads PIMLICO_API_KEY from environment. Must not be imported
 * in client code (SvelteKit enforces via $lib/server boundary if placed there,
 * but this module uses $env/dynamic/private directly).
 *
 * @see types.ts           — UserOperation, GasEstimate, SponsorshipResult
 * @see user-operation.ts  — client-safe UserOp construction helpers
 */

import { env } from '$env/dynamic/private';
import type {
	UserOperation,
	GasEstimate,
	SponsorshipResult,
	SponsorshipPolicy
} from './types';

// =============================================================================
// Constants
// =============================================================================

/** EntryPoint v0.7 — canonical address on all EVM chains. */
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

/** Scroll Sepolia chain ID. */
const SCROLL_SEPOLIA_CHAIN_ID = 534351;

/** Scroll mainnet chain ID. */
const SCROLL_MAINNET_CHAIN_ID = 534352;

/** Pimlico API base URL. */
const PIMLICO_BASE_URL = 'https://api.pimlico.io/v2';

/** Network slug mapping for Pimlico endpoints. */
const NETWORK_SLUGS: Record<string, string> = {
	'scroll-sepolia': 'scroll-sepolia',
	'scroll': 'scroll'
};

/** Default timeout for RPC calls (15 seconds). */
const DEFAULT_RPC_TIMEOUT_MS = 15_000;

/** Default polling interval for receipt waiting (2 seconds). */
const DEFAULT_POLL_INTERVAL_MS = 2_000;

/** Default timeout for waiting on receipt (60 seconds). */
const DEFAULT_RECEIPT_TIMEOUT_MS = 60_000;

// =============================================================================
// PimlicoClient
// =============================================================================

/**
 * Low-level Pimlico JSON-RPC client.
 *
 * Handles authentication, request serialization, and error parsing for
 * Pimlico's bundler + paymaster API.
 */
export class PimlicoClient {
	private readonly apiUrl: string;
	private readonly apiKey: string;
	readonly network: string;
	readonly chainId: number;

	private rpcId = 0;

	constructor(apiKey: string, network: 'scroll-sepolia' | 'scroll') {
		this.apiKey = apiKey;
		this.network = network;
		this.chainId = network === 'scroll' ? SCROLL_MAINNET_CHAIN_ID : SCROLL_SEPOLIA_CHAIN_ID;

		const slug = NETWORK_SLUGS[network];
		this.apiUrl = `${PIMLICO_BASE_URL}/${slug}/rpc?apikey=${apiKey}`;
	}

	/**
	 * Execute a JSON-RPC call to Pimlico.
	 *
	 * @param method - RPC method name (e.g. "eth_sendUserOperation")
	 * @param params - Method parameters
	 * @returns Parsed result from the JSON-RPC response
	 * @throws On network errors, RPC errors, or timeouts
	 */
	async rpc(method: string, params: unknown[]): Promise<unknown> {
		const id = ++this.rpcId;

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), DEFAULT_RPC_TIMEOUT_MS);

		try {
			console.debug(`[gas/pimlico] RPC ${method} (id=${id})`);

			const response = await fetch(this.apiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jsonrpc: '2.0',
					id,
					method,
					params
				}),
				signal: controller.signal
			});

			if (!response.ok) {
				const body = await response.text().catch(() => '');
				throw new Error(
					`[gas/pimlico] HTTP ${response.status} from ${method}: ${body.slice(0, 200)}`
				);
			}

			const json = await response.json() as {
				result?: unknown;
				error?: { code: number; message: string; data?: unknown };
			};

			if (json.error) {
				const errMsg = json.error.data
					? `${json.error.message} — ${JSON.stringify(json.error.data).slice(0, 200)}`
					: json.error.message;
				throw new Error(`[gas/pimlico] RPC error in ${method}: ${errMsg}`);
			}

			return json.result;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				throw new Error(`[gas/pimlico] ${method} timed out after ${DEFAULT_RPC_TIMEOUT_MS}ms`);
			}
			throw err;
		} finally {
			clearTimeout(timeout);
		}
	}
}

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a PimlicoClient for Scroll Sepolia or mainnet.
 *
 * Reads PIMLICO_API_KEY from server environment. Throws if missing.
 *
 * @param options.network - Target network (default: "scroll-sepolia")
 * @returns Configured PimlicoClient
 */
export function createPimlicoClient(options?: {
	network?: 'scroll-sepolia' | 'scroll';
}): PimlicoClient {
	const apiKey = env.PIMLICO_API_KEY;
	if (!apiKey) {
		throw new Error('[gas/pimlico] PIMLICO_API_KEY not set in environment');
	}

	const network = options?.network ?? 'scroll-sepolia';
	return new PimlicoClient(apiKey, network);
}

// =============================================================================
// Gas Price
// =============================================================================

/**
 * Fetch current gas prices from Pimlico.
 *
 * Uses the pimlico_getUserOperationGasPrice method which returns three
 * speed tiers (slow, standard, fast). We use the "fast" tier to ensure
 * UserOps are included promptly.
 *
 * @returns maxFeePerGas and maxPriorityFeePerGas as bigints
 */
export async function getGasPrice(
	client: PimlicoClient
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
	const result = await client.rpc('pimlico_getUserOperationGasPrice', []) as {
		slow: { maxFeePerGas: string; maxPriorityFeePerGas: string };
		standard: { maxFeePerGas: string; maxPriorityFeePerGas: string };
		fast: { maxFeePerGas: string; maxPriorityFeePerGas: string };
	};

	return {
		maxFeePerGas: BigInt(result.fast.maxFeePerGas),
		maxPriorityFeePerGas: BigInt(result.fast.maxPriorityFeePerGas)
	};
}

// =============================================================================
// Gas Sponsorship
// =============================================================================

/**
 * Request gas sponsorship from Pimlico's verifying paymaster.
 *
 * Two-step process:
 *   1. pm_getPaymasterStubData — get stub paymaster fields for gas estimation
 *   2. eth_estimateUserOperationGas — estimate gas with stub data
 *   3. pm_getPaymasterData — get final signed paymaster data
 *
 * The policy check runs before calling Pimlico's API to reject disqualified
 * UserOps early (saves API calls and avoids sponsoring unwanted operations).
 *
 * @param client - PimlicoClient instance
 * @param userOp - Partial UserOperation (must have sender, callData, nonce at minimum)
 * @param policy - Optional sponsorship policy for server-side filtering
 * @returns SponsorshipResult with paymaster data if approved
 */
export async function sponsorUserOperation(
	client: PimlicoClient,
	userOp: Partial<UserOperation>,
	policy?: SponsorshipPolicy
): Promise<SponsorshipResult> {
	// --- Policy pre-check ---
	if (policy) {
		const policyResult = checkPolicy(userOp, policy);
		if (!policyResult.allowed) {
			return { sponsored: false, reason: policyResult.reason };
		}
	}

	try {
		// Step 1: Get paymaster stub data for gas estimation
		const hexUserOp = userOpToHex(userOp);

		const stubResult = await client.rpc('pm_getPaymasterStubData', [
			hexUserOp,
			ENTRY_POINT_V07,
			toHex(client.chainId)
		]) as {
			paymaster: string;
			paymasterData: string;
			paymasterVerificationGasLimit: string;
			paymasterPostOpGasLimit: string;
		};

		// Step 2: Estimate gas with stub paymaster data
		const userOpWithStub: Partial<UserOperation> = {
			...userOp,
			paymaster: stubResult.paymaster,
			paymasterData: stubResult.paymasterData,
			paymasterVerificationGasLimit: BigInt(stubResult.paymasterVerificationGasLimit),
			paymasterPostOpGasLimit: BigInt(stubResult.paymasterPostOpGasLimit)
		};

		const gasEstimate = await estimateUserOperationGas(
			client,
			userOpWithStub,
			ENTRY_POINT_V07
		);

		// Apply gas estimates
		const userOpWithGas: Partial<UserOperation> = {
			...userOpWithStub,
			callGasLimit: gasEstimate.callGasLimit,
			verificationGasLimit: gasEstimate.verificationGasLimit,
			preVerificationGas: gasEstimate.preVerificationGas,
			maxFeePerGas: gasEstimate.maxFeePerGas,
			maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas
		};

		// Policy: check max gas per op
		if (policy?.maxGasPerOp !== undefined) {
			const totalGas = gasEstimate.callGasLimit
				+ gasEstimate.verificationGasLimit
				+ gasEstimate.preVerificationGas;
			const totalCost = totalGas * gasEstimate.maxFeePerGas;

			if (totalCost > policy.maxGasPerOp) {
				return {
					sponsored: false,
					reason: `Gas cost ${totalCost} exceeds policy max ${policy.maxGasPerOp}`
				};
			}
		}

		// Step 3: Get final signed paymaster data
		const finalResult = await client.rpc('pm_getPaymasterData', [
			userOpToHex(userOpWithGas),
			ENTRY_POINT_V07,
			toHex(client.chainId)
		]) as {
			paymaster: string;
			paymasterData: string;
			paymasterVerificationGasLimit: string;
			paymasterPostOpGasLimit: string;
		};

		console.debug('[gas/pimlico] Sponsorship approved for', userOp.sender);

		return {
			sponsored: true,
			paymaster: finalResult.paymaster,
			paymasterData: finalResult.paymasterData,
			paymasterVerificationGasLimit: BigInt(finalResult.paymasterVerificationGasLimit),
			paymasterPostOpGasLimit: BigInt(finalResult.paymasterPostOpGasLimit),
			// Gas estimates from estimation step — callers must merge these into the UserOp
			callGasLimit: gasEstimate.callGasLimit,
			verificationGasLimit: gasEstimate.verificationGasLimit,
			preVerificationGas: gasEstimate.preVerificationGas,
			maxFeePerGas: gasEstimate.maxFeePerGas,
			maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[gas/pimlico] Sponsorship failed:', msg);

		return {
			sponsored: false,
			reason: `Paymaster error: ${msg}`
		};
	}
}

// =============================================================================
// Gas Estimation
// =============================================================================

/**
 * Estimate gas for a UserOperation via Pimlico's bundler.
 *
 * Calls eth_estimateUserOperationGas which returns recommended gas limits.
 * Also fetches current gas prices via pimlico_getUserOperationGasPrice.
 *
 * @param client - PimlicoClient instance
 * @param userOp - Partial UserOperation to estimate
 * @param entryPoint - EntryPoint contract address (default: v0.7)
 * @returns Gas estimates for all gas fields
 */
export async function estimateUserOperationGas(
	client: PimlicoClient,
	userOp: Partial<UserOperation>,
	entryPoint: string = ENTRY_POINT_V07
): Promise<GasEstimate> {
	// Fetch gas prices and estimation in parallel
	const [gasPrices, estimation] = await Promise.all([
		getGasPrice(client),
		client.rpc('eth_estimateUserOperationGas', [
			userOpToHex(userOp),
			entryPoint
		]) as Promise<{
			callGasLimit: string;
			verificationGasLimit: string;
			preVerificationGas: string;
			paymasterVerificationGasLimit?: string;
			paymasterPostOpGasLimit?: string;
		}>
	]);

	const estimate: GasEstimate = {
		callGasLimit: BigInt(estimation.callGasLimit),
		verificationGasLimit: BigInt(estimation.verificationGasLimit),
		preVerificationGas: BigInt(estimation.preVerificationGas),
		maxFeePerGas: gasPrices.maxFeePerGas,
		maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas
	};

	if (estimation.paymasterVerificationGasLimit) {
		estimate.paymasterVerificationGasLimit = BigInt(estimation.paymasterVerificationGasLimit);
	}
	if (estimation.paymasterPostOpGasLimit) {
		estimate.paymasterPostOpGasLimit = BigInt(estimation.paymasterPostOpGasLimit);
	}

	return estimate;
}

// =============================================================================
// UserOp Submission
// =============================================================================

/**
 * Submit a signed UserOperation to Pimlico's bundler.
 *
 * The UserOp must be fully populated (all gas fields, signature, paymaster data)
 * before submission. Returns the userOpHash which can be used to poll for the
 * on-chain receipt.
 *
 * @param client - PimlicoClient instance
 * @param userOp - Fully signed UserOperation
 * @param entryPoint - EntryPoint contract address (default: v0.7)
 * @returns userOpHash (bytes32)
 */
export async function sendUserOperation(
	client: PimlicoClient,
	userOp: UserOperation,
	entryPoint: string = ENTRY_POINT_V07
): Promise<string> {
	const result = await client.rpc('eth_sendUserOperation', [
		userOpToHex(userOp),
		entryPoint
	]);

	const userOpHash = result as string;
	console.debug('[gas/pimlico] UserOp submitted:', userOpHash);

	return userOpHash;
}

// =============================================================================
// Receipt Polling
// =============================================================================

/**
 * Wait for a UserOperation to be included in a block.
 *
 * Polls eth_getUserOperationReceipt until the UserOp is mined or the
 * timeout is reached.
 *
 * @param client - PimlicoClient instance
 * @param userOpHash - Hash returned by sendUserOperation
 * @param options.timeout - Max wait time in ms (default: 60s)
 * @param options.pollInterval - Polling interval in ms (default: 2s)
 * @returns Transaction hash and success status
 * @throws On timeout
 */
export async function waitForUserOperationReceipt(
	client: PimlicoClient,
	userOpHash: string,
	options?: { timeout?: number; pollInterval?: number }
): Promise<{ txHash: string; success: boolean }> {
	const timeout = options?.timeout ?? DEFAULT_RECEIPT_TIMEOUT_MS;
	const pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL_MS;

	const deadline = Date.now() + timeout;

	while (Date.now() < deadline) {
		try {
			const receipt = await client.rpc('eth_getUserOperationReceipt', [
				userOpHash
			]) as {
				receipt: { transactionHash: string };
				success: boolean;
			} | null;

			if (receipt) {
				console.debug('[gas/pimlico] UserOp mined:', {
					userOpHash,
					txHash: receipt.receipt.transactionHash,
					success: receipt.success
				});

				return {
					txHash: receipt.receipt.transactionHash,
					success: receipt.success
				};
			}
		} catch (err) {
			// Receipt not yet available — continue polling
			console.debug('[gas/pimlico] Receipt not ready, polling...', {
				userOpHash,
				error: err instanceof Error ? err.message : String(err)
			});
		}

		await sleep(pollInterval);
	}

	throw new Error(
		`[gas/pimlico] Timed out waiting for UserOp receipt after ${timeout}ms: ${userOpHash}`
	);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a bigint or number to a hex string (0x-prefixed, no leading zeros).
 * Returns "0x0" for zero values.
 */
function toHex(value: bigint | number): string {
	const n = BigInt(value);
	if (n === 0n) return '0x0';
	return '0x' + n.toString(16);
}

/**
 * Convert a Partial<UserOperation> to JSON-RPC hex format.
 *
 * The ERC-4337 RPC spec requires all numeric fields as hex strings.
 * Optional fields are omitted if undefined.
 */
function userOpToHex(userOp: Partial<UserOperation>): Record<string, string> {
	const result: Record<string, string> = {};

	if (userOp.sender) result.sender = userOp.sender;
	if (userOp.nonce !== undefined) result.nonce = toHex(userOp.nonce);
	if (userOp.factory) result.factory = userOp.factory;
	if (userOp.factoryData) result.factoryData = userOp.factoryData;
	if (userOp.callData) result.callData = userOp.callData;
	if (userOp.callGasLimit !== undefined) result.callGasLimit = toHex(userOp.callGasLimit);
	if (userOp.verificationGasLimit !== undefined) result.verificationGasLimit = toHex(userOp.verificationGasLimit);
	if (userOp.preVerificationGas !== undefined) result.preVerificationGas = toHex(userOp.preVerificationGas);
	if (userOp.maxFeePerGas !== undefined) result.maxFeePerGas = toHex(userOp.maxFeePerGas);
	if (userOp.maxPriorityFeePerGas !== undefined) result.maxPriorityFeePerGas = toHex(userOp.maxPriorityFeePerGas);
	if (userOp.paymaster) result.paymaster = userOp.paymaster;
	if (userOp.paymasterVerificationGasLimit !== undefined) result.paymasterVerificationGasLimit = toHex(userOp.paymasterVerificationGasLimit);
	if (userOp.paymasterPostOpGasLimit !== undefined) result.paymasterPostOpGasLimit = toHex(userOp.paymasterPostOpGasLimit);
	if (userOp.paymasterData) result.paymasterData = userOp.paymasterData;
	if (userOp.signature) result.signature = userOp.signature;

	return result;
}

/**
 * Check a UserOp against a sponsorship policy.
 *
 * Validates the target contract and per-user rate limits (rate limiting
 * requires external state and is left as a TODO placeholder).
 */
function checkPolicy(
	userOp: Partial<UserOperation>,
	policy: SponsorshipPolicy
): { allowed: boolean; reason?: string } {
	// Check allowed targets: the sender (smart account) calls execute()
	// which encodes the actual target in callData. For now we validate
	// that the sender itself is allowed (the smart account address is
	// the contract the EntryPoint calls). Full callData target extraction
	// would require decoding the execute() wrapper.
	if (policy.allowedTargets.length > 0 && userOp.sender) {
		const senderLower = userOp.sender.toLowerCase();
		const allowed = policy.allowedTargets.some(
			(t) => t.toLowerCase() === senderLower
		);

		// If sender isn't in the allow list, that's fine — the allowedTargets
		// should contain the DEBATE_MARKET_ADDRESS. We can't decode the inner
		// target from callData here without the smart account ABI, so we do a
		// best-effort check: if the callData contains the target address bytes.
		if (!allowed && userOp.callData) {
			const callDataLower = userOp.callData.toLowerCase();
			const targetFound = policy.allowedTargets.some(
				(t) => callDataLower.includes(t.toLowerCase().replace('0x', ''))
			);
			if (!targetFound) {
				return {
					allowed: false,
					reason: `Target contract not in allowedTargets: ${policy.allowedTargets.join(', ')}`
				};
			}
		}
	}

	// Rate limiting (maxOpsPerUserPerDay) would need external state
	// (e.g. KV store or database). Log a warning if configured but not enforced.
	if (policy.maxOpsPerUserPerDay !== undefined) {
		console.debug(
			'[gas/pimlico] Rate limiting configured but requires external state tracking. ' +
			'maxOpsPerUserPerDay:', policy.maxOpsPerUserPerDay
		);
	}

	return { allowed: true };
}

/** Promise-based sleep. */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
