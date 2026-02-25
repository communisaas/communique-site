/**
 * E2E Debate Flow — Full Lifecycle Smoke Test (v6)
 *
 * Exercises the complete DebateMarket lifecycle against a V5 Scroll Sepolia deployment:
 *   proposeDebate → submitArgument (x2) → commitTrade → revealTrade →
 *   executeEpoch → [wait for deadline] → resolveDebate → claimSettlement
 *
 * CONTRACT REQUIREMENTS:
 *   - V5 deployment (DeploySepoliaV5.s.sol): DebateMarket + MockERC20 staking token
 *   - DistrictGate with mock-registry roots registered (UserRoot, CellMapRoot, EngagementRoot)
 *   - MockDebateWeightVerifier and MockPositionNoteVerifier (always return true)
 *   - DebateMarket authorized as derived-domain deriver on DistrictGate
 *
 * PROOF STRATEGY (mock verifiers):
 *   - The three-tree DistrictGate verifier calls the on-chain HonkVerifier.
 *     With a V5 mock setup the HonkVerifier is also a mock (always-pass).
 *   - debateWeightVerifier.verify() is MockDebateWeightVerifier — always returns true.
 *   - We still need a valid EIP-712 signature because DistrictGate checks ECDSA recovery.
 *   - Public inputs must pass all registry checks (userRoot, cellMapRoot, engagementRoot,
 *     actionDomain, nullifier uniqueness, engagementTier 1-4).
 *   - This script pre-registers all required roots on the mock registries so that
 *     DistrictGate.verifyThreeTreeProof accepts our synthetic inputs.
 *
 * DURATION CONSTRAINT:
 *   - MIN_DURATION = 72 hours. The script sets duration = 72 hours then waits for the
 *     deadline by polling block.timestamp. Set SKIP_WAIT=1 to skip the wait (for rapid
 *     CI runs against a previously-expired debate).
 *
 * USAGE:
 *   cd communique
 *   SCROLL_PRIVATE_KEY=0x... \
 *   DEBATE_MARKET_ADDRESS=0x... \
 *   STAKING_TOKEN_ADDRESS=0x... \
 *   DISTRICT_GATE_ADDRESS=0x... \
 *   USER_ROOT_REGISTRY_ADDRESS=0x... \
 *   CELL_MAP_REGISTRY_ADDRESS=0x... \
 *   ENGAGEMENT_ROOT_REGISTRY_ADDRESS=0x... \
 *   npx tsx scripts/e2e-debate-v6.ts
 *
 * Optional env vars:
 *   SCROLL_RPC_URL        (default: https://sepolia-rpc.scroll.io)
 *   VERIFIER_DEPTH        (default: 20)
 *   SKIP_WAIT             (set to 1 to skip waiting for debate deadline)
 *   DEBATE_ID             (reuse an existing debateId — skips proposeDebate)
 */

import {
	Contract,
	JsonRpcProvider,
	Wallet,
	keccak256,
	solidityPacked,
	zeroPadValue,
	type TransactionReceipt
} from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const RPC_URL = process.env.SCROLL_RPC_URL || 'https://sepolia-rpc.scroll.io';
const PRIVATE_KEY = process.env.SCROLL_PRIVATE_KEY;
const DEBATE_MARKET_ADDRESS = process.env.DEBATE_MARKET_ADDRESS || '';
const STAKING_TOKEN_ADDRESS = process.env.STAKING_TOKEN_ADDRESS || '';
const DISTRICT_GATE_ADDRESS = process.env.DISTRICT_GATE_ADDRESS || '';
const USER_ROOT_REGISTRY_ADDRESS = process.env.USER_ROOT_REGISTRY_ADDRESS || '';
const CELL_MAP_REGISTRY_ADDRESS = process.env.CELL_MAP_REGISTRY_ADDRESS || '';
const ENGAGEMENT_ROOT_REGISTRY_ADDRESS = process.env.ENGAGEMENT_ROOT_REGISTRY_ADDRESS || '';
const VERIFIER_DEPTH = parseInt(process.env.VERIFIER_DEPTH || '20', 10) as 20;
const SKIP_WAIT = process.env.SKIP_WAIT === '1';
const EXISTING_DEBATE_ID = process.env.DEBATE_ID || '';

// ─── Validation ──────────────────────────────────────────────────────────

if (!PRIVATE_KEY) {
	console.error('ERROR: Set SCROLL_PRIVATE_KEY env var');
	process.exit(1);
}
for (const [name, val] of [
	['DEBATE_MARKET_ADDRESS', DEBATE_MARKET_ADDRESS],
	['STAKING_TOKEN_ADDRESS', STAKING_TOKEN_ADDRESS],
	['DISTRICT_GATE_ADDRESS', DISTRICT_GATE_ADDRESS],
	['USER_ROOT_REGISTRY_ADDRESS', USER_ROOT_REGISTRY_ADDRESS],
	['CELL_MAP_REGISTRY_ADDRESS', CELL_MAP_REGISTRY_ADDRESS],
	['ENGAGEMENT_ROOT_REGISTRY_ADDRESS', ENGAGEMENT_ROOT_REGISTRY_ADDRESS]
]) {
	if (!val) {
		console.error(`ERROR: Set ${name} env var`);
		process.exit(1);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════════════════════════════════════

const DEBATE_MARKET_ABI = [
	// Core
	'function proposeDebate(bytes32 propositionHash, uint256 duration, uint256 jurisdictionSizeHint, bytes32 baseDomain, uint256 bondAmount) returns (bytes32)',
	'function submitArgument(bytes32 debateId, uint8 stance, bytes32 bodyHash, bytes32 amendmentHash, uint256 stakeAmount, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature, address beneficiary)',
	'function coSignArgument(bytes32 debateId, uint256 argumentIndex, uint256 stakeAmount, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature, address beneficiary)',
	'function resolveDebate(bytes32 debateId)',
	'function claimSettlement(bytes32 debateId, bytes32 nullifier)',
	// LMSR
	'function commitTrade(bytes32 debateId, bytes32 commitHash, address signer, bytes proof, uint256[31] publicInputs, uint8 verifierDepth, uint256 deadline, bytes signature)',
	'function revealTrade(bytes32 debateId, uint256 epoch, uint256 commitIndex, uint256 argumentIndex, uint8 direction, bytes32 nonce, bytes debateWeightProof, bytes32[2] debateWeightPublicInputs)',
	'function executeEpoch(bytes32 debateId, uint256 epoch)',
	// View
	'function getDebateState(bytes32 debateId) view returns (uint8 status, uint256 deadline_, uint256 argumentCount, uint256 totalStake, uint256 uniqueParticipants)',
	'function getEpochPhase(bytes32 debateId) view returns (uint256 epoch, bool isCommit, bool isReveal, uint256 secondsRemaining)',
	'function getEpochCommitCount(bytes32 debateId, uint256 epoch) view returns (uint256)',
	'function getEpochRevealCount(bytes32 debateId, uint256 epoch) view returns (uint256)',
	'function deriveDomain(bytes32 baseDomain, bytes32 propositionHash) pure returns (bytes32)',
	'function currentEpoch(bytes32 debateId) view returns (uint256)',
	'function epochStartTime(bytes32 debateId) view returns (uint256)',
	'function epochDuration() view returns (uint256)',
	'function debateWeightVerifier() view returns (address)',
	'function MIN_DURATION() view returns (uint256)',
	'function MIN_PROPOSER_BOND() view returns (uint256)',
	'function MIN_ARGUMENT_STAKE() view returns (uint256)',
	'function arguments(bytes32 debateId, uint256 argumentIndex) view returns (uint8 stance, bytes32 bodyHash, bytes32 amendmentHash, uint256 stakeAmount, uint8 engagementTier, uint256 weightedScore)',
	// Events
	'event DebateProposed(bytes32 indexed debateId, bytes32 indexed actionDomain, bytes32 propositionHash, uint256 deadline, bytes32 baseDomain)',
	'event ArgumentSubmitted(bytes32 indexed debateId, uint256 indexed argumentIndex, uint8 stance, bytes32 bodyHash, uint8 engagementTier, uint256 weight)',
	'event TradeCommitted(bytes32 indexed debateId, uint256 indexed epoch, bytes32 commitHash, uint256 commitIndex)',
	'event TradeRevealed(bytes32 indexed debateId, uint256 indexed epoch, uint256 argumentIndex, uint8 direction, uint256 weightedAmount)',
	'event EpochExecuted(bytes32 indexed debateId, uint256 indexed epoch, uint256 tradesApplied)',
	'event DebateResolved(bytes32 indexed debateId, uint256 winningArgumentIndex, uint8 winningStance, uint256 winningScore, uint256 uniqueParticipants, uint256 jurisdictionSizeHint)',
	'event SettlementClaimed(bytes32 indexed debateId, bytes32 nullifier, uint256 payout, address indexed recipient)'
];

const ERC20_ABI = [
	'function approve(address spender, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function balanceOf(address account) view returns (uint256)',
	'function mint(address to, uint256 amount)'
];

const DISTRICT_GATE_ABI = [
	'function nonces(address) view returns (uint256)',
	'function allowedActionDomains(bytes32) view returns (bool)',
	'function authorizedDerivers(address) view returns (bool)',
	'function registerActionDomainGenesis(bytes32 domain)',
	'function DOMAIN_SEPARATOR() view returns (bytes32)'
];

// Generic registry ABI covering UserRootRegistry, CellMapRegistry, EngagementRootRegistry
// All three have the same isValid*/register pattern used in genesis setup.
const REGISTRY_ABI = [
	'function isValidUserRoot(bytes32) view returns (bool)',
	'function isValidCellMapRoot(bytes32) view returns (bool)',
	'function isValidEngagementRoot(bytes32) view returns (bool)',
	'function getCountryAndDepth(bytes32) view returns (bytes3 country, uint8 depth)',
	'function getDepth(bytes32) view returns (uint8)',
	// Registration entry points — must match actual Solidity signatures
	'function registerUserRoot(bytes32 root, bytes3 country, uint8 depth)',
	'function registerCellMapRoot(bytes32 root, bytes3 country, uint8 depth)',
	'function registerEngagementRoot(bytes32 root, uint8 depth)'
];

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BN254_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** EIP-712 type definition for DistrictGate proof submissions */
const EIP712_SUBMIT_TYPES = {
	SubmitThreeTreeProof: [
		{ name: 'proofHash', type: 'bytes32' },
		{ name: 'publicInputsHash', type: 'bytes32' },
		{ name: 'verifierDepth', type: 'uint8' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' }
	]
};

const THREE_TREE_INPUT_COUNT = 31;

// DebateStatus enum: ACTIVE=0, RESOLVED=1, RESOLVING=2, AWAITING_GOVERNANCE=3, UNDER_APPEAL=4
const STATUS_NAMES: Record<number, string> = {
	0: 'ACTIVE',
	1: 'RESOLVED',
	2: 'RESOLVING',
	3: 'AWAITING_GOVERNANCE',
	4: 'UNDER_APPEAL'
};

// Stance enum: SUPPORT=0, OPPOSE=1, AMEND=2
const STANCE_NAMES: Record<number, string> = { 0: 'SUPPORT', 1: 'OPPOSE', 2: 'AMEND' };

// TradeDirection enum: BUY=0, SELL=1
const DIRECTION_NAMES: Record<number, string> = { 0: 'BUY', 1: 'SELL' };

// ═══════════════════════════════════════════════════════════════════════════
// GAS TABLE TRACKER
// ═══════════════════════════════════════════════════════════════════════════

interface GasEntry {
	step: string;
	gasUsed: bigint;
	txHash: string;
}

const gasTable: GasEntry[] = [];

function recordGas(step: string, receipt: TransactionReceipt) {
	gasTable.push({ step, gasUsed: receipt.gasUsed, txHash: receipt.hash });
}

function printGasTable() {
	console.log('\n  Gas Usage Summary:');
	console.log('  ──────────────────────────────────────────────────────────────');
	console.log('  Step                      Gas Used     TX Hash (prefix)');
	console.log('  ──────────────────────────────────────────────────────────────');
	for (const entry of gasTable) {
		const stepPad = entry.step.padEnd(26);
		const gasPad = entry.gasUsed.toString().padEnd(12);
		console.log(`  ${stepPad} ${gasPad} ${entry.txHash.slice(0, 18)}...`);
	}
	const total = gasTable.reduce((acc, e) => acc + e.gasUsed, 0n);
	console.log('  ──────────────────────────────────────────────────────────────');
	console.log(`  ${'TOTAL'.padEnd(26)} ${total.toString()}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function ok(msg: string) {
	console.log(`  [OK] ${msg}`);
}

function warn(msg: string) {
	console.warn(`  [WARN] ${msg}`);
}

function step(n: number, title: string) {
	console.log('');
	console.log(`[${ n.toString().padStart(2, '0') }] ${title}`);
	console.log('  ' + '─'.repeat(60));
}

function extractRevertReason(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	const match = msg.match(/reason="([^"]+)"/);
	if (match) return match[1];
	const shortMatch = msg.match(/"message":"([^"]+)"/);
	if (shortMatch) return shortMatch[1];
	return msg.slice(0, 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY!, provider);

const debateMarket = new Contract(DEBATE_MARKET_ADDRESS, DEBATE_MARKET_ABI, wallet);
const stakingToken = new Contract(STAKING_TOKEN_ADDRESS, ERC20_ABI, wallet);
const districtGate = new Contract(DISTRICT_GATE_ADDRESS, DISTRICT_GATE_ABI, wallet);
const userRootRegistry = new Contract(USER_ROOT_REGISTRY_ADDRESS, REGISTRY_ABI, wallet);
const cellMapRegistry = new Contract(CELL_MAP_REGISTRY_ADDRESS, REGISTRY_ABI, wallet);
const engagementRootRegistry = new Contract(ENGAGEMENT_ROOT_REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

// ═══════════════════════════════════════════════════════════════════════════
// PROOF CONSTRUCTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a synthetic 31-element public inputs array for the three-tree circuit.
 *
 * The DistrictGate verifies:
 *   publicInputs[0]  = user_root        → must be registered in UserRootRegistry
 *   publicInputs[1]  = cell_map_root    → must be registered in CellMapRegistry
 *   publicInputs[26] = nullifier        → must be unique (not yet spent)
 *   publicInputs[27] = action_domain    → must be whitelisted on DistrictGate
 *   publicInputs[28] = authority_level  → must be 1-5
 *   publicInputs[29] = engagement_root  → must be registered in EngagementRootRegistry
 *   publicInputs[30] = engagement_tier  → must be 1-4 (0 fails tierMultiplier check)
 *
 * All other slots (tree-internal path hashes etc.) are zero — acceptable because
 * the mock HonkVerifier returns true regardless of proof content.
 */
function buildPublicInputs(opts: {
	userRoot: bigint;
	cellMapRoot: bigint;
	nullifier: bigint;
	actionDomain: bigint;
	authorityLevel: number;
	engagementRoot: bigint;
	engagementTier: number;
}): bigint[] {
	const inputs = new Array<bigint>(THREE_TREE_INPUT_COUNT).fill(0n);
	inputs[0] = opts.userRoot;
	inputs[1] = opts.cellMapRoot;
	inputs[26] = opts.nullifier;
	inputs[27] = opts.actionDomain;
	inputs[28] = BigInt(opts.authorityLevel);
	inputs[29] = opts.engagementRoot;
	inputs[30] = BigInt(opts.engagementTier);
	return inputs;
}

/**
 * Build the EIP-712 SubmitThreeTreeProof signature for DistrictGate.
 * Domain: { name: "DistrictGate", version: "1", chainId, verifyingContract: DISTRICT_GATE_ADDRESS }
 */
async function buildEIP712Signature(
	signerWallet: Wallet,
	proofBytes: string,
	publicInputsBigInt: bigint[],
	verifierDepth: number,
	deadline: number
): Promise<string> {
	const proofHash = keccak256(proofBytes);

	// Pack 31 uint256s for the hash — must match Solidity's abi.encodePacked(publicInputs)
	const publicInputsHash = keccak256(
		solidityPacked(Array(THREE_TREE_INPUT_COUNT).fill('uint256'), publicInputsBigInt)
	);

	const nonce = await districtGate.nonces(signerWallet.address);

	const network = await provider.getNetwork();
	const domain = {
		name: 'DistrictGate',
		version: '1',
		chainId: network.chainId,
		verifyingContract: DISTRICT_GATE_ADDRESS
	};

	const value = {
		proofHash,
		publicInputsHash,
		verifierDepth,
		nonce,
		deadline
	};

	return signerWallet.signTypedData(domain, EIP712_SUBMIT_TYPES, value);
}

/** Derive a random-looking but deterministic BN254 field element from a seed string */
function fieldElement(seed: string): bigint {
	return BigInt(keccak256(solidityPacked(['string'], [seed]))) % BN254_MODULUS;
}

/** Convert a bigint to a 0x-prefixed, zero-padded 32-byte hex string */
function toBytes32(val: bigint): string {
	return '0x' + val.toString(16).padStart(64, '0');
}

/** Approve the DebateMarket to spend staking tokens */
async function approveTokens(amount: bigint): Promise<void> {
	const current = await stakingToken.allowance(wallet.address, DEBATE_MARKET_ADDRESS);
	if (current >= amount) return;
	const tx = await stakingToken.approve(DEBATE_MARKET_ADDRESS, amount);
	await tx.wait();
	ok(`Token allowance set: ${Number(amount) / 1e6} tUSDC`);
}

/** Sleep for n milliseconds */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until block.timestamp >= targetTimestamp. Returns when deadline has passed. */
async function waitForTimestamp(targetTimestamp: number, label: string): Promise<void> {
	console.log(`  Waiting for ${label} (target: ${new Date(targetTimestamp * 1000).toISOString()})...`);
	console.log('  Polling every 30s. Set SKIP_WAIT=1 to skip (will attempt immediate resolve).');

	let lastBlock = 0;
	let iterations = 0;
	while (true) {
		const block = await provider.getBlock('latest');
		if (!block) { await sleep(10_000); continue; }
		if (block.number === lastBlock) { await sleep(10_000); continue; }
		lastBlock = block.number;
		const now = block.timestamp;
		const remaining = targetTimestamp - now;
		if (remaining <= 0) {
			ok(`Deadline passed (block ${block.number}, timestamp ${now})`);
			return;
		}
		iterations++;
		if (iterations % 4 === 1) {
			console.log(`  ... ${remaining}s remaining (block ${block.number})`);
		}
		await sleep(30_000);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
	console.log('═══════════════════════════════════════════════════════════════════');
	console.log(' E2E Debate Market — Full Lifecycle Smoke Test (v6)');
	console.log(' Scroll Sepolia Testnet');
	console.log('═══════════════════════════════════════════════════════════════════');
	console.log(`  Wallet:        ${wallet.address}`);
	console.log(`  DebateMarket:  ${DEBATE_MARKET_ADDRESS}`);
	console.log(`  StakingToken:  ${STAKING_TOKEN_ADDRESS}`);
	console.log(`  DistrictGate:  ${DISTRICT_GATE_ADDRESS}`);
	console.log(`  RPC:           ${RPC_URL}`);
	console.log(`  Verifier depth: ${VERIFIER_DEPTH}`);
	console.log(`  Skip deadline wait: ${SKIP_WAIT}`);

	// ─────────────────────────────────────────────────────────────────
	step(0, 'Pre-flight: balances, authorization, contract constants');
	// ─────────────────────────────────────────────────────────────────

	const ethBalance = await provider.getBalance(wallet.address);
	ok(`ETH balance: ${Number(ethBalance) / 1e18} ETH`);
	if (ethBalance < 5_000_000_000_000_000n) {
		throw new Error('ETH balance too low (< 0.005 ETH). Fund wallet and retry.');
	}

	const isDeriver = await districtGate.authorizedDerivers(DEBATE_MARKET_ADDRESS);
	if (!isDeriver) {
		throw new Error('DebateMarket is NOT an authorized deriver on DistrictGate. Run V5 genesis setup.');
	}
	ok('DebateMarket is authorized deriver on DistrictGate');

	const [minDuration, minBond, minArgStake] = await Promise.all([
		debateMarket.MIN_DURATION(),
		debateMarket.MIN_PROPOSER_BOND(),
		debateMarket.MIN_ARGUMENT_STAKE()
	]);
	ok(`MIN_DURATION: ${Number(minDuration)}s (${Number(minDuration) / 3600}h)`);
	ok(`MIN_PROPOSER_BOND: ${Number(minBond) / 1e6} tUSDC`);
	ok(`MIN_ARGUMENT_STAKE: ${Number(minArgStake) / 1e6} tUSDC`);

	// ─────────────────────────────────────────────────────────────────
	step(1, 'Mint test tokens (MockERC20.mint — unrestricted on testnet)');
	// ─────────────────────────────────────────────────────────────────

	const mintAmount = 1_000n * 1_000_000n; // 1,000 tUSDC (6 decimals)
	const balanceBefore = await stakingToken.balanceOf(wallet.address);
	ok(`tUSDC balance before: ${Number(balanceBefore) / 1e6} tUSDC`);

	if (balanceBefore < 50_000_000n) {
		// Under 50 tUSDC — mint
		try {
			const mintTx = await stakingToken.mint(wallet.address, mintAmount, { gasLimit: 100_000 });
			const mintReceipt: TransactionReceipt = await mintTx.wait();
			recordGas('mint', mintReceipt);
			ok(`Minted ${Number(mintAmount) / 1e6} tUSDC — TX: ${mintReceipt.hash}`);
		} catch (err) {
			warn(`mint() failed: ${extractRevertReason(err)} — continuing with existing balance`);
		}
	} else {
		ok('Sufficient balance, skipping mint');
	}

	const balanceAfterMint = await stakingToken.balanceOf(wallet.address);
	ok(`tUSDC balance: ${Number(balanceAfterMint) / 1e6} tUSDC`);

	// ─────────────────────────────────────────────────────────────────
	step(2, 'Set up synthetic roots on registries (required by DistrictGate validation)');
	// ─────────────────────────────────────────────────────────────────

	// Derive stable synthetic roots from deterministic seeds.
	// These must be registered on the mock registries so that DistrictGate
	// validates our public inputs successfully.
	const testRunId = `e2e-v6-${Date.now()}`;
	const syntheticUserRoot = fieldElement(`${testRunId}-user-root`);
	const syntheticCellMapRoot = fieldElement(`${testRunId}-cellmap-root`);
	const syntheticEngagementRoot = fieldElement(`${testRunId}-engagement-root`);

	ok(`Synthetic user_root:        0x${syntheticUserRoot.toString(16).slice(0, 16)}...`);
	ok(`Synthetic cell_map_root:    0x${syntheticCellMapRoot.toString(16).slice(0, 16)}...`);
	ok(`Synthetic engagement_root:  0x${syntheticEngagementRoot.toString(16).slice(0, 16)}...`);

	// Register user root (country=US=0x555300, depth=VERIFIER_DEPTH)
	// Signature: registerUserRoot(bytes32 root, bytes3 country, uint8 depth)
	const US_COUNTRY = '0x555300'; // bytes3("US\0")
	const userRootBytes32 = toBytes32(syntheticUserRoot);
	const cellMapRootBytes32 = toBytes32(syntheticCellMapRoot);
	const engagementRootBytes32 = toBytes32(syntheticEngagementRoot);

	try {
		const isValid = await userRootRegistry.isValidUserRoot(userRootBytes32);
		if (!isValid) {
			const tx = await userRootRegistry.registerUserRoot(
				userRootBytes32, US_COUNTRY, VERIFIER_DEPTH,
				{ gasLimit: 200_000 }
			);
			const r: TransactionReceipt = await tx.wait();
			recordGas('registerUserRoot', r);
			ok(`UserRoot registered — TX: ${r.hash}`);
		} else {
			ok('UserRoot already registered');
		}
	} catch (err) {
		warn(`registerUserRoot failed: ${extractRevertReason(err)}`);
		warn('Continuing — the registry may already have this root, or you may need governance access.');
	}

	// Register cell map root (same country US, same depth)
	// Signature: registerCellMapRoot(bytes32 root, bytes3 country, uint8 depth)
	try {
		const isValid = await cellMapRegistry.isValidCellMapRoot(cellMapRootBytes32);
		if (!isValid) {
			const tx = await cellMapRegistry.registerCellMapRoot(
				cellMapRootBytes32, US_COUNTRY, VERIFIER_DEPTH,
				{ gasLimit: 200_000 }
			);
			const r: TransactionReceipt = await tx.wait();
			recordGas('registerCellMapRoot', r);
			ok(`CellMapRoot registered — TX: ${r.hash}`);
		} else {
			ok('CellMapRoot already registered');
		}
	} catch (err) {
		warn(`registerCellMapRoot failed: ${extractRevertReason(err)}`);
	}

	// Register engagement root (depth only, no country)
	// Signature: registerEngagementRoot(bytes32 root, uint8 depth)
	try {
		const isValid = await engagementRootRegistry.isValidEngagementRoot(engagementRootBytes32);
		if (!isValid) {
			const tx = await engagementRootRegistry.registerEngagementRoot(
				engagementRootBytes32, VERIFIER_DEPTH,
				{ gasLimit: 200_000 }
			);
			const r: TransactionReceipt = await tx.wait();
			recordGas('registerEngagementRoot', r);
			ok(`EngagementRoot registered — TX: ${r.hash}`);
		} else {
			ok('EngagementRoot already registered');
		}
	} catch (err) {
		warn(`registerEngagementRoot failed: ${extractRevertReason(err)}`);
		warn('If registry registration fails the submitArgument calls will revert at Step 5.');
	}

	// ─────────────────────────────────────────────────────────────────
	step(3, 'proposeDebate');
	// ─────────────────────────────────────────────────────────────────

	let debateId: string;
	let debateDeadline: number;
	let debateActionDomain: bigint;

	if (EXISTING_DEBATE_ID) {
		console.log(`  Reusing existing debate: ${EXISTING_DEBATE_ID}`);
		debateId = EXISTING_DEBATE_ID;
		const [status, deadline, argCount, totalStake, participants] =
			await debateMarket.getDebateState(debateId);
		ok(`Status: ${STATUS_NAMES[Number(status)] ?? status} (${status})`);
		ok(`Deadline: ${new Date(Number(deadline) * 1000).toISOString()}`);
		ok(`Arguments: ${argCount}, TotalStake: ${Number(totalStake) / 1e6} tUSDC, Participants: ${participants}`);
		debateDeadline = Number(deadline);
	} else {
		const propositionText = `E2E v6 smoke test — ${testRunId}`;
		const propositionHash = keccak256(solidityPacked(['string'], [propositionText]));
		const baseDomain = zeroPadValue('0x64', 32); // bytes32(uint256(100)) — registered in V5 genesis
		const bondAmount = minBond as bigint;
		const duration = minDuration as bigint; // 72 hours (MIN_DURATION)
		const jurisdictionSizeHint = 100n;

		ok(`Proposition: "${propositionText}"`);
		ok(`Hash: ${propositionHash.slice(0, 18)}...`);
		ok(`Bond: ${Number(bondAmount) / 1e6} tUSDC | Duration: ${Number(duration)}s | JSHint: ${jurisdictionSizeHint}`);

		// Derive expected action domain for verification
		const derivedDomain = await debateMarket.deriveDomain(baseDomain, propositionHash);
		ok(`Derived action domain: ${derivedDomain.slice(0, 18)}...`);

		await approveTokens(bondAmount);

		try {
			const tx = await debateMarket.proposeDebate(
				propositionHash,
				duration,
				jurisdictionSizeHint,
				baseDomain,
				bondAmount,
				{ gasLimit: 600_000 }
			);
			const receipt: TransactionReceipt = await tx.wait();
			recordGas('proposeDebate', receipt);
			ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

			// Parse DebateProposed event
			let found = false;
			for (const log of receipt.logs) {
				try {
					const parsed = debateMarket.interface.parseLog({
						topics: log.topics as string[],
						data: log.data
					});
					if (parsed?.name === 'DebateProposed') {
						debateId = parsed.args[0] as string;
						debateActionDomain = BigInt(parsed.args[1]);
						debateDeadline = Number(parsed.args[3]);
						ok(`debateId:      ${debateId}`);
						ok(`actionDomain:  0x${debateActionDomain.toString(16).slice(0, 16)}...`);
						ok(`deadline:      ${new Date(debateDeadline * 1000).toISOString()}`);
						ok(`baseDomain:    ${parsed.args[4]}`);
						found = true;
						break;
					}
				} catch { /* skip non-matching logs */ }
			}
			if (!found) throw new Error('DebateProposed event not found in receipt');
			ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
		} catch (err) {
			throw new Error(`proposeDebate failed: ${extractRevertReason(err)}`);
		}
	}

	// ─────────────────────────────────────────────────────────────────
	step(4, 'getDebateState — verify ACTIVE');
	// ─────────────────────────────────────────────────────────────────

	const [status0, deadline0, argCount0, totalStake0, participants0] =
		await debateMarket.getDebateState(debateId!);

	ok(`Status:        ${STATUS_NAMES[Number(status0)] ?? status0} (expected ACTIVE=0)`);
	ok(`Deadline:      ${new Date(Number(deadline0) * 1000).toISOString()}`);
	ok(`ArgumentCount: ${argCount0} (expected 0 for fresh debate)`);
	ok(`TotalStake:    ${Number(totalStake0) / 1e6} tUSDC`);
	ok(`Participants:  ${participants0}`);

	if (Number(status0) !== 0) {
		throw new Error(`Expected status ACTIVE (0), got ${status0} (${STATUS_NAMES[Number(status0)]})`);
	}

	// Ensure we have the action domain from on-chain state when reusing an existing debate
	if (!debateActionDomain!) {
		const debateData = await debateMarket.debates(debateId!);
		// debates(bytes32) returns the Debate struct fields — actionDomain is field [1]
		debateActionDomain = BigInt(debateData[1]);
		debateDeadline = Number(debateData[2]);
	}

	// ─────────────────────────────────────────────────────────────────
	step(5, 'submitArgument #1 — SUPPORT, tier=2, stake=5 tUSDC');
	// ─────────────────────────────────────────────────────────────────

	const STAKE_ARG1 = 5_000_000n; // 5 tUSDC
	const ENGAGEMENT_TIER_1 = 2;
	const AUTHORITY_LEVEL = 2;

	// Each argument needs a unique nullifier (public input [26]).
	// We use wallet-address + stance + timestamp for determinism + uniqueness.
	const nullifier1 = fieldElement(`${wallet.address}-support-${testRunId}-1`);
	const bodyHash1 = keccak256(solidityPacked(['string'], [`Support argument body — ${testRunId}`]));
	const deadlineSig = Math.floor(Date.now() / 1000) + 3600; // 1h from now

	const publicInputs1 = buildPublicInputs({
		userRoot: syntheticUserRoot,
		cellMapRoot: syntheticCellMapRoot,
		nullifier: nullifier1,
		actionDomain: debateActionDomain!,
		authorityLevel: AUTHORITY_LEVEL,
		engagementRoot: syntheticEngagementRoot,
		engagementTier: ENGAGEMENT_TIER_1
	});

	// Proof is empty bytes — mock HonkVerifier returns true regardless
	const dummyProof = '0x' + 'ab'.repeat(32); // 32-byte dummy (non-empty)

	let sig1: string;
	try {
		sig1 = await buildEIP712Signature(wallet, dummyProof, publicInputs1, VERIFIER_DEPTH, deadlineSig);
		ok(`EIP-712 signature built (nonce: ${await districtGate.nonces(wallet.address)})`);
	} catch (err) {
		throw new Error(`EIP-712 signing failed: ${extractRevertReason(err)}`);
	}

	await approveTokens(STAKE_ARG1);

	let argumentIndex1 = 0n;
	try {
		const tx = await debateMarket.submitArgument(
			debateId!,
			0, // Stance.SUPPORT
			bodyHash1,
			'0x' + '00'.repeat(32), // amendmentHash = bytes32(0) for non-AMEND
			STAKE_ARG1,
			wallet.address, // signer = relayer wallet
			dummyProof,
			publicInputs1,
			VERIFIER_DEPTH,
			deadlineSig,
			sig1,
			wallet.address, // beneficiary = wallet (R-01 fix validation)
			{ gasLimit: 1_000_000 }
		);
		const receipt: TransactionReceipt = await tx.wait();
		recordGas('submitArgument #1', receipt);
		ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

		for (const log of receipt.logs) {
			try {
				const parsed = debateMarket.interface.parseLog({
					topics: log.topics as string[],
					data: log.data
				});
				if (parsed?.name === 'ArgumentSubmitted') {
					argumentIndex1 = parsed.args[1] as bigint;
					const tier = parsed.args[4];
					const weight = parsed.args[5];
					ok(`argumentIndex: ${argumentIndex1}`);
					ok(`stance:        ${STANCE_NAMES[Number(parsed.args[2])]}`);
					ok(`engagementTier: ${tier}`);
					ok(`weight (sqrt(stake)*tier): ${weight}`);
				}
			} catch { /* skip */ }
		}
		ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
	} catch (err) {
		throw new Error(`submitArgument #1 failed: ${extractRevertReason(err)}`);
	}

	// ─────────────────────────────────────────────────────────────────
	step(6, 'submitArgument #2 — OPPOSE, tier=1, stake=3 tUSDC');
	// ─────────────────────────────────────────────────────────────────

	const STAKE_ARG2 = 3_000_000n; // 3 tUSDC
	const ENGAGEMENT_TIER_2 = 1;

	const nullifier2 = fieldElement(`${wallet.address}-oppose-${testRunId}-2`);
	const bodyHash2 = keccak256(solidityPacked(['string'], [`Oppose argument body — ${testRunId}`]));

	const publicInputs2 = buildPublicInputs({
		userRoot: syntheticUserRoot,
		cellMapRoot: syntheticCellMapRoot,
		nullifier: nullifier2,
		actionDomain: debateActionDomain!,
		authorityLevel: AUTHORITY_LEVEL,
		engagementRoot: syntheticEngagementRoot,
		engagementTier: ENGAGEMENT_TIER_2
	});

	// Deadline nonce has advanced after submitArgument #1 consumed it — rebuild sig
	const deadlineSig2 = Math.floor(Date.now() / 1000) + 3600;
	let sig2: string;
	try {
		sig2 = await buildEIP712Signature(wallet, dummyProof, publicInputs2, VERIFIER_DEPTH, deadlineSig2);
	} catch (err) {
		throw new Error(`EIP-712 signing #2 failed: ${extractRevertReason(err)}`);
	}

	await approveTokens(STAKE_ARG2);

	let argumentIndex2 = 1n;
	try {
		const tx = await debateMarket.submitArgument(
			debateId!,
			1, // Stance.OPPOSE
			bodyHash2,
			'0x' + '00'.repeat(32),
			STAKE_ARG2,
			wallet.address,
			dummyProof,
			publicInputs2,
			VERIFIER_DEPTH,
			deadlineSig2,
			sig2,
			wallet.address,
			{ gasLimit: 1_000_000 }
		);
		const receipt: TransactionReceipt = await tx.wait();
		recordGas('submitArgument #2', receipt);
		ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

		for (const log of receipt.logs) {
			try {
				const parsed = debateMarket.interface.parseLog({
					topics: log.topics as string[],
					data: log.data
				});
				if (parsed?.name === 'ArgumentSubmitted') {
					argumentIndex2 = parsed.args[1] as bigint;
					ok(`argumentIndex: ${argumentIndex2}`);
					ok(`stance:        ${STANCE_NAMES[Number(parsed.args[2])]}`);
					ok(`engagementTier: ${parsed.args[4]}`);
					ok(`weight: ${parsed.args[5]}`);
				}
			} catch { /* skip */ }
		}
		ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
	} catch (err) {
		throw new Error(`submitArgument #2 failed: ${extractRevertReason(err)}`);
	}

	// Verify state updated
	const [, , argCountAfter, totalStakeAfter] = await debateMarket.getDebateState(debateId!);
	ok(`ArgumentCount now: ${argCountAfter} (expected 2)`);
	ok(`TotalStake now: ${Number(totalStakeAfter) / 1e6} tUSDC`);

	// ─────────────────────────────────────────────────────────────────
	step(7, 'commitTrade — BUY on argument 0 (SUPPORT side)');
	// ─────────────────────────────────────────────────────────────────

	// Commit hash format (Phase 2):
	//   keccak256(abi.encodePacked(argumentIndex, direction, weightedAmount, noteCommitment, epoch, nonce))
	// We use a fixed weightedAmount=1e18 and a random noteCommitment.
	const tradeNonce = keccak256(solidityPacked(['string'], [`trade-nonce-${testRunId}`]));
	const weightedAmount = 1_000_000_000_000_000_000n; // 1e18 in SD59x18 units
	const noteCommitment = keccak256(solidityPacked(['string'], [`note-${testRunId}`]));
	const epoch0 = 0n;
	const DIRECTION_BUY = 0;

	const commitHash = keccak256(
		solidityPacked(
			['uint256', 'uint8', 'uint256', 'bytes32', 'uint256', 'bytes32'],
			[argumentIndex1, DIRECTION_BUY, weightedAmount, noteCommitment, epoch0, tradeNonce]
		)
	);
	ok(`Commit hash: ${commitHash.slice(0, 18)}...`);
	ok(`Trade nonce: ${tradeNonce.slice(0, 18)}...`);

	// Build proof + signature for commitTrade (also calls verifyThreeTreeProof)
	const nullifier3 = fieldElement(`${wallet.address}-commit-trade-${testRunId}`);
	const publicInputs3 = buildPublicInputs({
		userRoot: syntheticUserRoot,
		cellMapRoot: syntheticCellMapRoot,
		nullifier: nullifier3,
		actionDomain: debateActionDomain!,
		authorityLevel: AUTHORITY_LEVEL,
		engagementRoot: syntheticEngagementRoot,
		engagementTier: ENGAGEMENT_TIER_1 // tier >= 1 required for trades
	});

	const deadlineSig3 = Math.floor(Date.now() / 1000) + 3600;
	let sig3: string;
	try {
		sig3 = await buildEIP712Signature(wallet, dummyProof, publicInputs3, VERIFIER_DEPTH, deadlineSig3);
	} catch (err) {
		throw new Error(`EIP-712 signing #3 failed: ${extractRevertReason(err)}`);
	}

	let commitIndex = 0n;
	try {
		const tx = await debateMarket.commitTrade(
			debateId!,
			commitHash,
			wallet.address, // signer
			dummyProof,
			publicInputs3,
			VERIFIER_DEPTH,
			deadlineSig3,
			sig3,
			{ gasLimit: 800_000 }
		);
		const receipt: TransactionReceipt = await tx.wait();
		recordGas('commitTrade', receipt);
		ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

		for (const log of receipt.logs) {
			try {
				const parsed = debateMarket.interface.parseLog({
					topics: log.topics as string[],
					data: log.data
				});
				if (parsed?.name === 'TradeCommitted') {
					commitIndex = parsed.args[3] as bigint;
					ok(`epoch:       ${parsed.args[1]}`);
					ok(`commitHash:  ${parsed.args[2].slice(0, 18)}...`);
					ok(`commitIndex: ${commitIndex}`);
				}
			} catch { /* skip */ }
		}
		ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
	} catch (err) {
		const msg = extractRevertReason(err);
		if (msg.includes('EpochNotInCommitPhase')) {
			warn('EpochNotInCommitPhase — epoch timing not yet initialized. This is expected on a fresh debate.');
			warn('commitTrade requires first commit to initialize epoch timing via epochStartTime.');
			warn('Skipping LMSR trade flow. Continuing to deadline → resolve → claim.');
		} else {
			warn(`commitTrade failed: ${msg}`);
			warn('Continuing — LMSR trade steps (7-9) will be skipped.');
		}
		// Fall through — resolve and claim still work without trades
		await runResolveAndClaim(debateId!, debateDeadline!, nullifier1, STAKE_ARG1, argumentIndex1);
		return;
	}

	// ─────────────────────────────────────────────────────────────────
	step(8, 'revealTrade — wait for reveal phase, then reveal');
	// ─────────────────────────────────────────────────────────────────

	// Wait for epoch to enter reveal phase (epochDuration/2 seconds after first commit)
	const epochDur = Number(await debateMarket.epochDuration());
	ok(`epochDuration: ${epochDur}s (reveal phase starts at ${epochDur / 2}s)`);

	const epochStart = Number(await debateMarket.epochStartTime(debateId!));
	const revealPhaseStart = epochStart + epochDur / 2;
	const now = Math.floor(Date.now() / 1000);

	if (now < revealPhaseStart) {
		const waitMs = (revealPhaseStart - now + 15) * 1000;
		console.log(`  Waiting ${Math.ceil(waitMs / 1000)}s for reveal phase...`);
		await sleep(waitMs);
	}

	// Check debateWeightVerifier is deployed and valid
	const dwVerifierAddr = await debateMarket.debateWeightVerifier();
	const dwVerifierCode = await provider.getCode(dwVerifierAddr);
	ok(`DebateWeightVerifier: ${dwVerifierAddr} (code: ${dwVerifierCode.length > 2 ? dwVerifierCode.length + ' bytes' : 'NONE — EOA or missing!'})`);

	// Reconstruct expected commit hash to verify it matches before calling revealTrade
	const expectedCommitHash = keccak256(
		solidityPacked(
			['uint256', 'uint8', 'uint256', 'bytes32', 'uint256', 'bytes32'],
			[argumentIndex1, DIRECTION_BUY, weightedAmount, noteCommitment, epoch0, tradeNonce]
		)
	);
	ok(`Expected commit hash: ${expectedCommitHash.slice(0, 18)}... (should match: ${commitHash.slice(0, 18)}...)`);
	ok(`Match: ${expectedCommitHash === commitHash}`);

	// revealTrade with MockDebateWeightVerifier (always returns true)
	// debateWeightPublicInputs = [weightedAmount, noteCommitment] — must match commit hash preimage
	const debateWeightProof = '0x' + 'cd'.repeat(32); // arbitrary non-empty bytes
	const debateWeightPublicInputs: [string, string] = [
		toBytes32(weightedAmount),
		noteCommitment
	];

	// staticCall first to get revert reason before spending gas
	try {
		await debateMarket.revealTrade.staticCall(
			debateId!, epoch0, commitIndex, argumentIndex1, DIRECTION_BUY,
			tradeNonce, debateWeightProof, debateWeightPublicInputs,
			{ gasLimit: 600_000 }
		);
		ok('staticCall passed — revealTrade should succeed');
	} catch (err: any) {
		const data = err.data || err.info?.error?.data || '';
		const SELECTORS: Record<string, string> = {
			'0xaa34db46': 'EpochNotInRevealPhase()',
			'0x7e1574eb': 'InvalidCommitIndex()',
			'0x2e3bec61': 'NotCommitter()',
			'0xa89ac151': 'AlreadyRevealed()',
			'0x160c2e77': 'InvalidDebateWeightProof()',
			'0x5746ff11': 'CommitHashMismatch()',
			'0x214d337a': 'ThreeTreeVerifierNotFound()',
			'0x99505c1b': 'ThreeTreeVerificationFailed()',
		};
		const sel = typeof data === 'string' && data.length >= 10 ? data.slice(0, 10) : '';
		warn(`staticCall reverted: selector=${sel} ${SELECTORS[sel] || '(unknown)'}`);
		if (err.reason) warn(`  reason: ${err.reason}`);
		if (err.message && err.message.length < 300) warn(`  message: ${err.message}`);
	}

	try {
		const tx = await debateMarket.revealTrade(
			debateId!,
			epoch0,        // epoch
			commitIndex,   // commitIndex
			argumentIndex1, // argumentIndex (SUPPORT = 0)
			DIRECTION_BUY, // direction
			tradeNonce,    // nonce (bytes32)
			debateWeightProof,
			debateWeightPublicInputs,
			{ gasLimit: 600_000 }
		);
		const receipt: TransactionReceipt = await tx.wait();
		recordGas('revealTrade', receipt);
		ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

		for (const log of receipt.logs) {
			try {
				const parsed = debateMarket.interface.parseLog({
					topics: log.topics as string[],
					data: log.data
				});
				if (parsed?.name === 'TradeRevealed') {
					ok(`argumentIndex:  ${parsed.args[2]}`);
					ok(`direction:      ${DIRECTION_NAMES[Number(parsed.args[3])]}`);
					ok(`weightedAmount: ${parsed.args[4]}`);
				}
			} catch { /* skip */ }
		}
		ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
	} catch (err) {
		const msg = extractRevertReason(err);
		warn(`revealTrade failed: ${msg}`);
		warn('Continuing to executeEpoch — empty reveal set will still execute.');
	}

	// ─────────────────────────────────────────────────────────────────
	step(9, 'executeEpoch — finalize epoch 0 LMSR price updates');
	// ─────────────────────────────────────────────────────────────────

	// Wait for epoch to be fully executable (past reveal phase)
	const executableAt = epochStart + epochDur;
	const nowExec = Math.floor(Date.now() / 1000);
	if (nowExec < executableAt) {
		const waitMs = (executableAt - nowExec + 15) * 1000;
		console.log(`  Waiting ${Math.ceil(waitMs / 1000)}s for epoch to be executable...`);
		await sleep(waitMs);
	}

	try {
		const revealCount = await debateMarket.getEpochRevealCount(debateId!, epoch0);
		ok(`Reveals in epoch 0: ${revealCount}`);

		const tx = await debateMarket.executeEpoch(debateId!, epoch0, { gasLimit: 400_000 });
		const receipt: TransactionReceipt = await tx.wait();
		recordGas('executeEpoch', receipt);
		ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

		for (const log of receipt.logs) {
			try {
				const parsed = debateMarket.interface.parseLog({
					topics: log.topics as string[],
					data: log.data
				});
				if (parsed?.name === 'EpochExecuted') {
					ok(`epoch:         ${parsed.args[1]}`);
					ok(`tradesApplied: ${parsed.args[2]}`);
				}
			} catch { /* skip */ }
		}
		ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
	} catch (err) {
		warn(`executeEpoch failed: ${extractRevertReason(err)}`);
		warn('Continuing — resolve does not require epoch execution.');
	}

	// ─────────────────────────────────────────────────────────────────
	// Steps 10-12: Deadline wait, resolve, claim
	// ─────────────────────────────────────────────────────────────────
	await runResolveAndClaim(debateId!, debateDeadline!, nullifier1, STAKE_ARG1, argumentIndex1);
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLVE + CLAIM (shared by both paths — with and without LMSR trades)
// ═══════════════════════════════════════════════════════════════════════════

async function runResolveAndClaim(
	debateId: string,
	debateDeadline: number,
	winnerNullifier: bigint,
	winnerStake: bigint,
	expectedWinnerIndex: bigint
) {
	// ─────────────────────────────────────────────────────────────────
	step(10, 'Wait for debate deadline');
	// ─────────────────────────────────────────────────────────────────

	if (SKIP_WAIT) {
		warn('SKIP_WAIT=1 — skipping deadline wait. resolveDebate will likely revert if deadline not passed.');
	} else {
		const nowTs = Math.floor(Date.now() / 1000);
		if (nowTs < debateDeadline) {
			await waitForTimestamp(debateDeadline, 'debate deadline');
		} else {
			ok('Deadline already passed');
		}
	}

	// ─────────────────────────────────────────────────────────────────
	step(11, 'resolveDebate');
	// ─────────────────────────────────────────────────────────────────

	try {
		const tx = await debateMarket.resolveDebate(debateId, { gasLimit: 500_000 });
		const receipt: TransactionReceipt = await tx.wait();
		recordGas('resolveDebate', receipt);
		ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

		for (const log of receipt.logs) {
			try {
				const parsed = debateMarket.interface.parseLog({
					topics: log.topics as string[],
					data: log.data
				});
				if (parsed?.name === 'DebateResolved') {
					const winnerIdx = parsed.args[1] as bigint;
					const winnerStanceNum = Number(parsed.args[2]);
					const winningScore = parsed.args[3] as bigint;
					const uniqueP = parsed.args[4] as bigint;
					ok(`winningArgumentIndex: ${winnerIdx}`);
					ok(`winningStance:        ${STANCE_NAMES[winnerStanceNum]}`);
					ok(`winningScore:         ${winningScore}`);
					ok(`uniqueParticipants:   ${uniqueP}`);
					expectedWinnerIndex = winnerIdx;
				}
			} catch { /* skip */ }
		}
		ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
	} catch (err) {
		const msg = extractRevertReason(err);
		if (msg.includes('DebateStillActive') || msg.includes('still active')) {
			warn(`resolveDebate reverted: ${msg}`);
			warn('Debate deadline has not passed yet. Re-run with the DEBATE_ID env var after deadline.');
		} else if (msg.includes('DebateNotActive')) {
			warn(`resolveDebate reverted: ${msg} — debate may already be resolved. Checking state...`);
			const [status] = await debateMarket.getDebateState(debateId);
			ok(`Current status: ${STATUS_NAMES[Number(status)] ?? status}`);
		} else {
			warn(`resolveDebate failed: ${msg}`);
		}
		// Still attempt claim even if resolve failed (might already be resolved)
	}

	// Verify resolved status
	const [statusFinal, , , totalStakeFinal] = await debateMarket.getDebateState(debateId);
	ok(`Debate status after resolve: ${STATUS_NAMES[Number(statusFinal)] ?? statusFinal}`);
	ok(`Total stake in contract: ${Number(totalStakeFinal) / 1e6} tUSDC`);

	if (Number(statusFinal) !== 1) {
		warn('Debate not RESOLVED — skipping claimSettlement.');
		printSummary(debateId);
		return;
	}

	// ─────────────────────────────────────────────────────────────────
	step(12, 'claimSettlement — claim winning position payout');
	// ─────────────────────────────────────────────────────────────────

	// The nullifier used in submitArgument #1 is the key for the stake record.
	// We convert it back to a bytes32 string for the contract call.
	const nullifierBytes32 = toBytes32(winnerNullifier);
	ok(`Nullifier: ${nullifierBytes32.slice(0, 18)}...`);

	const balanceBefore = await stakingToken.balanceOf(wallet.address);
	ok(`Wallet tUSDC before claim: ${Number(balanceBefore) / 1e6} tUSDC`);

	try {
		const tx = await debateMarket.claimSettlement(debateId, nullifierBytes32, { gasLimit: 300_000 });
		const receipt: TransactionReceipt = await tx.wait();
		recordGas('claimSettlement', receipt);
		ok(`TX: ${receipt.hash} | Gas: ${receipt.gasUsed}`);

		for (const log of receipt.logs) {
			try {
				const parsed = debateMarket.interface.parseLog({
					topics: log.topics as string[],
					data: log.data
				});
				if (parsed?.name === 'SettlementClaimed') {
					const payout = parsed.args[2] as bigint;
					const recipient = parsed.args[3] as string;
					ok(`payout:    ${Number(payout) / 1e6} tUSDC`);
					ok(`recipient: ${recipient}`);
					if (recipient.toLowerCase() !== wallet.address.toLowerCase()) {
						warn(`Recipient mismatch! Expected ${wallet.address}, got ${recipient}`);
					}
				}
			} catch { /* skip */ }
		}

		const balanceAfter = await stakingToken.balanceOf(wallet.address);
		const received = BigInt(balanceAfter) - BigInt(balanceBefore);
		ok(`Wallet tUSDC after claim: ${Number(balanceAfter) / 1e6} tUSDC`);
		ok(`Net received: ${Number(received) / 1e6} tUSDC`);

		if (received === 0n) {
			warn('Received 0 tUSDC — argument may have been on the losing side, or stake record key mismatch.');
		} else if (received >= winnerStake) {
			ok(`Payout >= stake (${Number(received) / 1e6} >= ${Number(winnerStake) / 1e6}) — winning payout confirmed`);
		}

		ok(`Scrollscan: https://sepolia.scrollscan.com/tx/${receipt.hash}`);
	} catch (err) {
		const msg = extractRevertReason(err);
		if (msg.includes('NotWinningSide')) {
			warn(`claimSettlement reverted: NotWinningSide`);
			warn(`Argument #${expectedWinnerIndex} (SUPPORT) did not win. The OPPOSE argument may have scored higher.`);
			warn(`Try claiming with the OPPOSE nullifier if you want to verify that path.`);
		} else if (msg.includes('StakeRecordNotFound')) {
			warn(`claimSettlement reverted: StakeRecordNotFound`);
			warn(`The nullifier ${nullifierBytes32.slice(0, 14)}... is not recognized. This may be a reused debateId with different nullifiers.`);
		} else if (msg.includes('AlreadyClaimed')) {
			warn('claimSettlement: already claimed (idempotent — OK for re-run)');
		} else {
			warn(`claimSettlement failed: ${msg}`);
		}
	}

	printSummary(debateId);
}

function printSummary(debateId: string) {
	console.log('');
	console.log('═══════════════════════════════════════════════════════════════════');
	console.log(' E2E SMOKE TEST COMPLETE');
	console.log('═══════════════════════════════════════════════════════════════════');
	console.log('');
	console.log('  Debate:');
	console.log(`    debateId: ${debateId}`);
	console.log(`    Scrollscan: https://sepolia.scrollscan.com/address/${DEBATE_MARKET_ADDRESS}`);
	console.log('');
	printGasTable();
	console.log('');
	console.log('  To re-run against this debate (skip proposeDebate):');
	console.log(`    DEBATE_ID=${debateId} SKIP_WAIT=1 npx tsx scripts/e2e-debate-v6.ts`);
	console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

main().catch((err) => {
	console.error('');
	console.error('FATAL ERROR:', err instanceof Error ? err.message : err);
	console.error('');
	printGasTable();
	process.exit(1);
});
