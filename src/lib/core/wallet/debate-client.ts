/**
 * Client-side Debate Market Client — browser wallet submits directly to Scroll.
 *
 * Replaces the server relayer for user operations (submitArgument, coSignArgument).
 * The user's own wallet signs the EIP-712 authorization AND submits the transaction,
 * so the user pays gas and the user's address is both `signer` and `beneficiary`.
 *
 * BROWSER ONLY: No $env/dynamic/private, no server-only dependencies.
 * Errors propagate naturally — the calling Svelte component handles UI feedback.
 *
 * Flow (submitArgument / coSignArgument):
 *   1. Validate proof inputs (field range, hex format, depth)
 *   2. Read nonce from DistrictGate.nonces(wallet.address)
 *   3. Build EIP-712 typed data via buildProofAuthorizationData
 *   4. Sign with wallet.signTypedData (MetaMask popup)
 *   5. Ensure ERC-20 token approval for stake amount
 *   6. Submit tx via Contract connected to user's Signer
 *   7. Wait for receipt, return { txHash }
 *
 * @see eip712.ts         — pure EIP-712 typed data construction
 * @see token.ts          — ERC-20 balance / allowance / approve helpers
 * @see evm-provider.ts   — EVMWalletProvider wrapping MetaMask
 * @see debate-market-client.ts (blockchain/) — legacy server relayer (being replaced)
 */

import { Contract, keccak256, solidityPacked, type BrowserProvider, type Provider } from 'ethers';
import type { EVMWalletProvider } from './evm-provider';
import {
	validateProofInputs,
	buildProofAuthorizationData,
	defaultDeadline,
	publicInputsToBigInt
} from './eip712';
import {
	DEBATE_MARKET_ADDRESS,
	STAKING_TOKEN_ADDRESS,
	ensureTokenApproval
} from './token';

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ABIs
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal DebateMarket ABI — only the functions called from the browser. */
const DEBATE_MARKET_ABI = [
	'function submitArgument(bytes32 debateId, uint8 stance, bytes32 bodyHash, bytes32 amendmentHash, uint256 stakeAmount, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature, address beneficiary)',
	'function coSignArgument(bytes32 debateId, uint256 argumentIndex, uint256 stakeAmount, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature, address beneficiary)',
	'function getDebateState(bytes32 debateId) view returns (uint8 status, uint256 deadline_, uint256 argumentCount, uint256 totalStake, uint256 uniqueParticipants)',
	// LMSR commit/reveal trading
	'function commitTrade(bytes32 debateId, bytes32 commitHash, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature)',
	'function revealTrade(bytes32 debateId, uint256 epoch, uint256 commitIndex, uint256 argumentIndex, uint8 direction, bytes32 nonce, bytes debateWeightProof, bytes32[2] debateWeightPublicInputs)',
	// View: epoch state
	'function currentEpoch(bytes32 debateId) view returns (uint256)',
	'function epochStartTime(bytes32 debateId) view returns (uint256)'
];

/** Minimal DistrictGate ABI — nonce lookup for EIP-712 signing. */
const DISTRICT_GATE_ABI = [
	'function nonces(address) view returns (uint256)'
];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Parameters for submitting a new argument from the browser. */
export interface ClientSubmitArgumentParams {
	/** Debate identifier (bytes32, 0x-prefixed). */
	debateId: string;

	/** Argument stance: 0=SUPPORT, 1=OPPOSE, 2=AMEND. */
	stance: number;

	/** keccak256 of the argument body text (bytes32). */
	bodyHash: string;

	/** keccak256 of the amendment text, or 0x000...0 if no amendment (bytes32). */
	amendmentHash: string;

	/** Stake amount in smallest token unit (e.g. 6 decimals for USDC). */
	stakeAmount: bigint;

	/** Hex-encoded ZK proof bytes. */
	proof: string;

	/** 31 field elements as decimal or hex strings. */
	publicInputs: string[];

	/** Circuit depth: 18 | 20 | 22 | 24. */
	verifierDepth: number;

	/** DistrictGate contract address (verifyingContract in EIP-712 domain). */
	districtGateAddress: string;

	/** Chain ID (534351 for Scroll Sepolia). */
	chainId: number;
}

/** Parameters for co-signing an existing argument from the browser. */
export interface ClientCoSignArgumentParams {
	/** Debate identifier (bytes32, 0x-prefixed). */
	debateId: string;

	/** Index of the argument to co-sign (0-based). */
	argumentIndex: number;

	/** Stake amount in smallest token unit (e.g. 6 decimals for USDC). */
	stakeAmount: bigint;

	/** Hex-encoded ZK proof bytes. */
	proof: string;

	/** 31 field elements as decimal or hex strings. */
	publicInputs: string[];

	/** Circuit depth: 18 | 20 | 22 | 24. */
	verifierDepth: number;

	/** DistrictGate contract address (verifyingContract in EIP-712 domain). */
	districtGateAddress: string;

	/** Chain ID (534351 for Scroll Sepolia). */
	chainId: number;
}

/** Parsed on-chain debate state from getDebateState(). */
export interface DebateStateView {
	/** Debate status enum: 0=Proposed, 1=Active, 2=Resolved, 3=Cancelled. */
	status: number;

	/** Unix timestamp when the debate closes for new arguments. */
	deadline: number;

	/** Number of arguments submitted so far. */
	argumentCount: number;

	/** Total tokens staked across all arguments. */
	totalStake: bigint;

	/** Number of unique participant addresses. */
	uniqueParticipants: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// READ-ONLY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read the current on-chain state of a debate.
 *
 * Uses a read-only Provider (no signer needed). Suitable for polling
 * debate status from the UI without requiring wallet connection.
 *
 * @param provider - ethers v6 Provider (BrowserProvider or JsonRpcProvider)
 * @param debateId - bytes32 debate identifier
 * @returns Parsed debate state
 */
export async function readDebateState(
	provider: Provider,
	debateId: string
): Promise<DebateStateView> {
	const debateMarket = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, provider);

	const [status, deadline, argumentCount, totalStake, uniqueParticipants] =
		await debateMarket.getDebateState(debateId);

	return {
		status: Number(status),
		deadline: Number(deadline),
		argumentCount: Number(argumentCount),
		totalStake: BigInt(totalStake),
		uniqueParticipants: Number(uniqueParticipants)
	};
}

/**
 * Read the current EIP-712 nonce for a signer from the DistrictGate contract.
 *
 * The nonce is auto-incremented by the contract after each proof verification.
 * Used to construct the EIP-712 typed data for signing.
 *
 * @param provider - ethers v6 Provider (read-only)
 * @param districtGateAddress - DistrictGate contract address
 * @param signerAddress - Address to read the nonce for
 * @returns Current nonce as bigint
 */
export async function readNonce(
	provider: Provider,
	districtGateAddress: string,
	signerAddress: string
): Promise<bigint> {
	const districtGate = new Contract(districtGateAddress, DISTRICT_GATE_ABI, provider);
	return BigInt(await districtGate.nonces(signerAddress));
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE-CHANGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Submit a new argument to a debate, signed and submitted by the user's wallet.
 *
 * Full client-side flow:
 *   1. Validate proof inputs (count, hex format, field range, depth)
 *   2. Read nonce from DistrictGate.nonces(wallet.address)
 *   3. Build EIP-712 typed data for proof authorization
 *   4. Sign with wallet.signTypedData (triggers MetaMask popup)
 *   5. Send ETH with the transaction
 *   6. Call DebateMarket.submitArgument with all parameters
 *   7. Wait for on-chain confirmation
 *   8. Return the transaction hash
 *
 * The user's wallet address serves as BOTH the `signer` parameter (EIP-712
 * proof authorizer) and the `beneficiary` parameter (settlement recipient).
 *
 * @param wallet - Connected EVMWalletProvider (MetaMask/injected)
 * @param params - Argument submission parameters
 * @returns Transaction hash of the confirmed submission
 * @throws On validation failure, user rejection, insufficient gas/tokens, or revert
 */
export async function clientSubmitArgument(
	wallet: EVMWalletProvider,
	params: ClientSubmitArgumentParams
): Promise<{ txHash: string }> {
	// 1. Validate proof inputs
	const validationError = validateProofInputs(params.proof, params.publicInputs, params.verifierDepth);
	if (validationError) {
		throw new Error(`Proof validation failed: ${validationError}`);
	}

	const provider: BrowserProvider = wallet.ethersProvider;

	// 2. Read nonce from DistrictGate
	const nonce = await readNonce(provider, params.districtGateAddress, wallet.address);

	// 3. Build EIP-712 typed data
	const deadline = defaultDeadline();
	const { domain, types, value } = buildProofAuthorizationData({
		proof: params.proof,
		publicInputs: params.publicInputs,
		verifierDepth: params.verifierDepth,
		deadline,
		districtGateAddress: params.districtGateAddress,
		chainId: params.chainId,
		nonce
	});

	// 4. Sign with wallet (MetaMask popup)
	const signature = await wallet.signTypedData(domain, types, value);

	// 5. Get signer for tx submission
	const signer = await provider.getSigner(wallet.address);

	// 5b. Ensure ERC-20 token approval for stake amount
	await ensureTokenApproval(signer, STAKING_TOKEN_ADDRESS, DEBATE_MARKET_ADDRESS, params.stakeAmount);

	// 6. Build contract call
	const debateMarket = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, signer);

	const proofBytes = params.proof.startsWith('0x') ? params.proof : '0x' + params.proof;
	const publicInputsAsBigInt = publicInputsToBigInt(params.publicInputs);

	// 7. Submit transaction
	const tx = await debateMarket.submitArgument(
		params.debateId,           // bytes32 debateId
		params.stance,             // uint8 stance
		params.bodyHash,           // bytes32 bodyHash
		params.amendmentHash,      // bytes32 amendmentHash
		params.stakeAmount,        // uint256 stakeAmount
		wallet.address,            // address signer
		proofBytes,                // bytes proof
		publicInputsAsBigInt,      // uint256[31] publicInputs
		params.verifierDepth,      // uint8 verifierDepth
		deadline,                  // uint256 deadline
		signature,                 // bytes signature
		wallet.address             // address beneficiary
	);

	// 8. Wait for receipt
	const receipt = await tx.wait();

	return { txHash: receipt.hash };
}

/**
 * Co-sign an existing argument in a debate, signed and submitted by the user's wallet.
 *
 * Same flow as clientSubmitArgument but calls DebateMarket.coSignArgument with
 * an argumentIndex instead of stance/bodyHash/amendmentHash.
 *
 * The user's wallet address serves as BOTH the `signer` parameter (EIP-712
 * proof authorizer) and the `beneficiary` parameter (settlement recipient).
 *
 * @param wallet - Connected EVMWalletProvider (MetaMask/injected)
 * @param params - Co-sign parameters
 * @returns Transaction hash of the confirmed co-sign
 * @throws On validation failure, user rejection, insufficient gas/tokens, or revert
 */
export async function clientCoSignArgument(
	wallet: EVMWalletProvider,
	params: ClientCoSignArgumentParams
): Promise<{ txHash: string }> {
	// 1. Validate proof inputs
	const validationError = validateProofInputs(params.proof, params.publicInputs, params.verifierDepth);
	if (validationError) {
		throw new Error(`Proof validation failed: ${validationError}`);
	}

	const provider: BrowserProvider = wallet.ethersProvider;

	// 2. Read nonce from DistrictGate
	const nonce = await readNonce(provider, params.districtGateAddress, wallet.address);

	// 3. Build EIP-712 typed data
	const deadline = defaultDeadline();
	const { domain, types, value } = buildProofAuthorizationData({
		proof: params.proof,
		publicInputs: params.publicInputs,
		verifierDepth: params.verifierDepth,
		deadline,
		districtGateAddress: params.districtGateAddress,
		chainId: params.chainId,
		nonce
	});

	// 4. Sign with wallet (MetaMask popup)
	const signature = await wallet.signTypedData(domain, types, value);

	// 5. Get signer for tx submission
	const signer = await provider.getSigner(wallet.address);

	// 5b. Ensure ERC-20 token approval for stake amount
	await ensureTokenApproval(signer, STAKING_TOKEN_ADDRESS, DEBATE_MARKET_ADDRESS, params.stakeAmount);

	// 6. Build contract call
	const debateMarket = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, signer);

	const proofBytes = params.proof.startsWith('0x') ? params.proof : '0x' + params.proof;
	const publicInputsAsBigInt = publicInputsToBigInt(params.publicInputs);

	// 7. Submit transaction
	const tx = await debateMarket.coSignArgument(
		params.debateId,           // bytes32 debateId
		params.argumentIndex,      // uint256 argumentIndex
		params.stakeAmount,        // uint256 stakeAmount
		wallet.address,            // address signer
		proofBytes,                // bytes proof
		publicInputsAsBigInt,      // uint256[31] publicInputs
		params.verifierDepth,      // uint8 verifierDepth
		deadline,                  // uint256 deadline
		signature,                 // bytes signature
		wallet.address             // address beneficiary
	);

	// 8. Wait for receipt
	const receipt = await tx.wait();

	return { txHash: receipt.hash };
}

// ═══════════════════════════════════════════════════════════════════════════
// LMSR TRADE FUNCTIONS (commit-reveal)
// ═══════════════════════════════════════════════════════════════════════════

import {
	storePreimage,
	getPreimage,
	clearPreimage,
	type TradePreimage,
	type TradeDirection
} from './trade-preimage-store';

// Re-export types for convenience
export type { TradePreimage, TradeDirection };

/** Parameters for committing a trade from the browser. */
export interface ClientCommitTradeParams {
	/** Debate identifier (bytes32, 0x-prefixed). */
	debateId: string;

	/** Index of the argument to trade on. */
	argumentIndex: number;

	/** Trade direction: 0=BUY, 1=SELL. */
	direction: TradeDirection;

	/** Weighted amount from debate-weight ZK proof. Decimal string. */
	weightedAmount: string;

	/** Note commitment from debate-weight ZK proof. bytes32, 0x-prefixed. */
	noteCommitment: string;

	/** Hex-encoded three-tree ZK proof bytes. */
	proof: string;

	/** 31 field elements as decimal or hex strings (three-tree circuit). */
	publicInputs: string[];

	/** Circuit depth: 18 | 20 | 22 | 24. */
	verifierDepth: number;

	/** DistrictGate contract address (verifyingContract in EIP-712 domain). */
	districtGateAddress: string;

	/** Chain ID (534351 for Scroll Sepolia). */
	chainId: number;
}

/** Parameters for revealing a trade from the browser. */
export interface ClientRevealTradeParams {
	/** Debate identifier (bytes32, 0x-prefixed). */
	debateId: string;

	/** Epoch the commitment was made in. */
	epoch: number;

	/** Hex-encoded debate-weight ZK proof bytes. */
	debateWeightProof: string;

	/** [weightedAmount, noteCommitment] — 2 public inputs from debate-weight proof. */
	debateWeightPublicInputs: [string, string];
}

/**
 * Read the current epoch number for a debate.
 *
 * @param provider - ethers v6 Provider (read-only)
 * @param debateId - bytes32 debate identifier
 * @returns Current epoch number
 */
export async function readCurrentEpoch(
	provider: Provider,
	debateId: string
): Promise<number> {
	const debateMarket = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, provider);
	return Number(await debateMarket.currentEpoch(debateId));
}

/**
 * Commit a trade to a debate's LMSR market, signed and submitted by the user's wallet.
 *
 * Full client-side flow:
 *   1. Validate three-tree proof inputs
 *   2. Read current epoch from contract
 *   3. Generate random nonce for commitment
 *   4. Compute commitment hash: keccak256(argumentIndex, direction, weightedAmount, noteCommitment, epoch, nonce)
 *   5. Read EIP-712 nonce from DistrictGate
 *   6. Build EIP-712 typed data and sign (MetaMask popup)
 *   7. Submit commitTrade transaction
 *   8. Extract commitIndex from TradeCommitted event
 *   9. Persist preimage in IndexedDB for reveal phase
 *   10. Return txHash + commitIndex
 *
 * IMPORTANT: If step 9 fails (IndexedDB write), the trade is still committed on-chain
 * but the preimage may be lost. The function still returns success with a warning.
 *
 * @param wallet - Connected EVMWalletProvider (MetaMask/injected)
 * @param params - Trade commitment parameters
 * @returns Transaction hash and commit index
 * @throws On validation failure, user rejection, or contract revert
 */
export async function clientCommitTrade(
	wallet: EVMWalletProvider,
	params: ClientCommitTradeParams
): Promise<{ txHash: string; commitIndex: number }> {
	// 1. Validate proof inputs
	const validationError = validateProofInputs(params.proof, params.publicInputs, params.verifierDepth);
	if (validationError) {
		throw new Error(`Proof validation failed: ${validationError}`);
	}

	const provider: BrowserProvider = wallet.ethersProvider;
	const debateMarket = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, provider);

	// 2. Read current epoch
	const epoch = Number(await debateMarket.currentEpoch(params.debateId));

	// 3. Generate random nonce (32 bytes)
	const nonceBytes = new Uint8Array(32);
	crypto.getRandomValues(nonceBytes);
	const nonce = '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

	// 4. Compute commitment hash
	// Format: keccak256(abi.encodePacked(argumentIndex, direction, weightedAmount, noteCommitment, epoch, nonce))
	const commitHash = keccak256(
		solidityPacked(
			['uint256', 'uint8', 'uint256', 'bytes32', 'uint256', 'bytes32'],
			[params.argumentIndex, params.direction, BigInt(params.weightedAmount), params.noteCommitment, epoch, nonce]
		)
	);

	// 5. Read EIP-712 nonce from DistrictGate
	const eip712Nonce = await readNonce(provider, params.districtGateAddress, wallet.address);

	// 6. Build EIP-712 typed data and sign
	const deadline = defaultDeadline();
	const { domain, types, value } = buildProofAuthorizationData({
		proof: params.proof,
		publicInputs: params.publicInputs,
		verifierDepth: params.verifierDepth,
		deadline,
		districtGateAddress: params.districtGateAddress,
		chainId: params.chainId,
		nonce: eip712Nonce
	});

	const signature = await wallet.signTypedData(domain, types, value);

	// 7. Submit commitTrade transaction
	const signer = await provider.getSigner(wallet.address);
	const debateMarketSigner = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, signer);

	const proofBytes = params.proof.startsWith('0x') ? params.proof : '0x' + params.proof;
	const publicInputsAsBigInt = publicInputsToBigInt(params.publicInputs);

	const tx = await debateMarketSigner.commitTrade(
		params.debateId,        // bytes32 debateId
		commitHash,             // bytes32 commitHash
		wallet.address,         // address signer
		proofBytes,             // bytes proof
		publicInputsAsBigInt,   // uint256[31] publicInputs
		params.verifierDepth,   // uint8 verifierDepth
		deadline,               // uint256 deadline
		signature               // bytes signature
	);

	const receipt = await tx.wait();

	// 8. Extract commitIndex from TradeCommitted event
	// Event: TradeCommitted(bytes32 indexed debateId, uint256 epoch, bytes32 commitHash, uint256 commitIndex)
	let commitIndex = 0;
	for (const log of receipt.logs) {
		try {
			const parsed = debateMarketSigner.interface.parseLog({
				topics: log.topics as string[],
				data: log.data
			});
			if (parsed && parsed.name === 'TradeCommitted') {
				commitIndex = Number(parsed.args[3]); // 4th arg is commitIndex
				break;
			}
		} catch {
			// Not our event, skip
		}
	}

	// 9. Persist preimage in IndexedDB
	try {
		await storePreimage({
			debateId: params.debateId,
			epoch,
			commitIndex,
			argumentIndex: params.argumentIndex,
			direction: params.direction,
			weightedAmount: params.weightedAmount,
			noteCommitment: params.noteCommitment,
			nonce,
			commitHash,
			commitTxHash: receipt.hash,
			storedAt: new Date().toISOString()
		});
	} catch (idbError) {
		// Critical but non-fatal: the on-chain commit succeeded.
		// Log prominently so the user can attempt manual recovery.
		console.error(
			'[debate-client] CRITICAL: Failed to persist trade preimage in IndexedDB.',
			'The trade is committed on-chain but the preimage may be lost.',
			'Preimage data for manual recovery:',
			{ debateId: params.debateId, epoch, commitIndex, nonce, commitHash },
			idbError
		);
	}

	return { txHash: receipt.hash, commitIndex };
}

/**
 * Reveal a previously committed trade, using the stored preimage.
 *
 * Full client-side flow:
 *   1. Retrieve preimage from IndexedDB
 *   2. Submit revealTrade with debate-weight ZK proof
 *   3. Clear preimage from IndexedDB
 *   4. Return txHash
 *
 * No EIP-712 signature is needed for reveal — the contract verifies the caller
 * is the original committer (msg.sender == commitment.committer).
 *
 * @param wallet - Connected EVMWalletProvider (MetaMask/injected)
 * @param params - Reveal parameters + debate-weight ZK proof
 * @returns Transaction hash
 * @throws On missing preimage, user rejection, or contract revert
 */
export async function clientRevealTrade(
	wallet: EVMWalletProvider,
	params: ClientRevealTradeParams
): Promise<{ txHash: string }> {
	// 1. Retrieve preimage
	const preimage = await getPreimage(params.debateId, params.epoch);
	if (!preimage) {
		throw new Error(
			`No stored preimage for debate ${params.debateId.slice(0, 12)}... epoch ${params.epoch}. ` +
			'The trade preimage may have been lost. This trade is forfeit.'
		);
	}

	const provider: BrowserProvider = wallet.ethersProvider;
	const signer = await provider.getSigner(wallet.address);
	const debateMarket = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, signer);

	const debateWeightProofBytes = params.debateWeightProof.startsWith('0x')
		? params.debateWeightProof
		: '0x' + params.debateWeightProof;

	// 2. Submit revealTrade
	const tx = await debateMarket.revealTrade(
		params.debateId,                     // bytes32 debateId
		params.epoch,                        // uint256 epoch
		preimage.commitIndex,                // uint256 commitIndex
		preimage.argumentIndex,              // uint256 argumentIndex
		preimage.direction,                  // uint8 direction
		preimage.nonce,                      // bytes32 nonce
		debateWeightProofBytes,              // bytes debateWeightProof
		params.debateWeightPublicInputs      // bytes32[2] debateWeightPublicInputs
	);

	const receipt = await tx.wait();

	// 3. Clear preimage (trade is revealed, no longer needed)
	try {
		await clearPreimage(params.debateId, params.epoch);
	} catch {
		// Non-critical — preimage is just stale data at this point
		console.warn('[debate-client] Failed to clear preimage from IndexedDB (non-critical)');
	}

	return { txHash: receipt.hash };
}
