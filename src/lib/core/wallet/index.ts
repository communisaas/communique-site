/**
 * Wallet Provider Abstraction — unified signing for all entry paths.
 *
 * CLIENT-SAFE EXPORTS (types.ts, eip712.ts):
 *   - WalletProvider interface and related types
 *   - Pure EIP-712 hash construction (no signing, no env vars)
 *   - Proof validation helpers
 *
 * SERVER-ONLY EXPORTS (operator.ts):
 *   - OperatorWallet — system operations key
 *   - Must not be imported in client/browser code
 *
 * BROWSER-ONLY EXPORTS (evm-provider.ts):
 *   - EVMWalletProvider — MetaMask/injected wallet signing
 *   - connectInjectedWallet(), switchToScrollSepolia(), etc.
 *   - Must only be imported in browser/client code
 *
 * BROWSER-ONLY EXPORTS (near-provider.ts):
 *   - NEARWalletProvider — Chain Signatures MPC signing (Paths 1+3)
 *   - createNEARWalletProvider() — async factory with address derivation
 *   - Must only be imported in browser/client code
 *
 * BARREL SPLIT TRIGGER (F-10):
 *   This barrel mixes 3 runtime environments. SvelteKit's tree-shaker handles
 *   targeted imports correctly today. Split into wallet/client.ts + wallet/server.ts
 *   if: (a) a second server-only module is added beyond operator.ts, OR
 *   (b) tree-shaking fails to eliminate server imports in client bundles.
 */

// ── Client-safe types and utilities ──────────────────────────────────────
export type {
	WalletProvider,
	WalletProviderType,
	EIP712Domain,
	EIP712TypeField,
	ProofAuthorizationParams,
	ProofAuthorizationResult,
	TxResult,
	WalletEntryPath,
	UserWalletState
} from './types';

export { DISTRICT_GATE_EIP712_TYPES } from './types';

export {
	buildProofAuthorizationData,
	validateProofInputs,
	defaultDeadline,
	publicInputsToBigInt,
	THREE_TREE_PUBLIC_INPUT_COUNT,
	VALID_VERIFIER_DEPTHS,
	PUBLIC_INPUT_INDEX
} from './eip712';

// ── Browser-only EVM wallet (DO NOT import in server code) ───────────────
// These use BrowserProvider (window.ethereum) and will fail server-side.
// Import directly from './evm-provider' in components to enable tree-shaking,
// or use these re-exports for convenience.
export {
	EVMWalletProvider,
	connectInjectedWallet,
	getInjectedProvider,
	switchToScrollSepolia,
	subscribeToWalletEvents,
	WalletConnectionError,
	WALLET_ERROR_CODES,
	SCROLL_SEPOLIA_CHAIN_ID,
	SCROLL_MAINNET_CHAIN_ID,
	SCROLL_SEPOLIA_CONFIG,
	SCROLL_MAINNET_CONFIG,
	DISCONNECTED_STATE
} from './evm-provider';
export type { Eip1193Provider, EVMConnectionState } from './evm-provider';

// ── Browser-only NEAR wallet (DO NOT import in server code) ──────────────
// Uses NEAR Chain Signatures MPC for threshold ECDSA signing on Scroll.
// Import directly from './near-provider' in components to enable tree-shaking,
// or use these re-exports for convenience.
export {
	NEARWalletProvider,
	createNEARWalletProvider,
	NEAR_DISCONNECTED_STATE
} from './near-provider';
export type {
	NEARWalletProviderParams,
	CreateNEARWalletProviderParams,
	NEARConnectionState
} from './near-provider';

// ── Browser-only Smart Account (DO NOT import in server code) ────────────
// EIP-7702 delegation wrapper for EOA wallets. Transparent to consumers —
// msg.sender stays the EOA. Feature-flagged via PUBLIC_ENABLE_SMART_ACCOUNTS.
export {
	SmartAccountProvider,
	createSmartAccountProvider,
	SIMPLE_ACCOUNT_ADDRESS
} from './smart-account-provider';

// ── Server-only (DO NOT import in client code) ──────────────────────────
// These are re-exported for convenience but will fail at build time if
// imported in a client-side module (SvelteKit enforces the boundary).
export { OperatorWallet, getOperatorWallet } from './operator';
export type { OperatorHealth } from './operator';
