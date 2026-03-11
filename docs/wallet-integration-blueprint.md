# Wallet Integration Blueprint

> STATUS: Active blueprint for flipping `FEATURES.WALLET = true`.

## 1. Flag Flip Impacts

Setting `WALLET: true` in `src/lib/config/features.ts` activates:

| Location | What activates |
|---|---|
| `HeaderAvatar.svelte:139` | Wallet section in user dropdown (connected address or "Connect Wallet" button) |
| `IdentityStrip.svelte:121` | Balance display + WalletStatus pill (or "Connect" pill) in 48px header |
| `ModalRegistry.svelte:172` | WalletConnect modal (SIWE-adjacent flow: connect -> nonce -> sign -> verify) |

**Already wired and requires no changes:**
- `+layout.svelte:51-53` -- `walletState.initFromPageData(data.user)` runs in `$effect` on every navigation
- `+layout.server.ts:95-98` -- Returns `wallet_address`, `wallet_type`, `near_account_id`, `near_derived_scroll_address` from DB
- Campaign page `DebateMarketCard` (read-only, gated by `FEATURES.DEBATE`, independent of wallet)

## 2. App Shell Integration Checklist

- [x] `walletState.initFromPageData()` called in root `+layout.svelte` (line 51)
- [x] Layout server returns wallet fields (lines 95-98, 122-125)
- [x] Header dropdown shows connected wallet or connect button
- [x] IdentityStrip shows balance + status when connected
- [x] WalletConnect modal registered with close-on-connect callback
- [x] `walletState.connectEVM()` triggers MetaMask popup, subscribes to events
- [x] `walletState.disconnect()` calls `/api/wallet/disconnect` then resets client state
- [x] Balance refresh via `/api/wallet/balance?address=...`
- [ ] **Campaign page debate participation UI** -- MISSING (task #5)
- [ ] **Chain switching prompt** -- `switchToScrollSepolia()` exists in `evm-provider.ts` but is never called from the connect flow; should be called after `connectInjectedWallet()` if `chainId !== 534351`

## 3. Debate Participation Components (TO BUILD -- Task #5)

### 3a. DebateParticipationPanel

Container that renders below `DebateMarketCard` on `/c/[slug]` when `FEATURES.WALLET && FEATURES.DEBATE && data.debateSignal`.

**Props:**
- `debateId: string` (bytes32)
- `debateStatus: 'active' | 'resolved'`
- `arguments: Array<{index, stance, bodyHash, cosigners}>` (from page data)
- `walletConnected: boolean` (from `walletState.connected`)
- `walletAddress: string | null`

**State machine:** `idle -> composing -> signing -> submitting -> confirmed | error`

**Renders:**
- Wallet gate: if not connected, show "Connect wallet to participate" with connect button
- If connected + debate active: show argument list with co-sign buttons + "New Argument" button
- If connected + debate resolved: read-only, no actions

### 3b. SubmitArgumentForm

**Props:**
- `debateId: string`
- `districtGateAddress: string` (from `DISTRICT_GATE_ADDRESS` constant)
- `chainId: number` (from `SCROLL_CHAIN_ID`)
- `onsubmitted: (txHash: string) => void`

**State machine:** `drafting -> signing -> submitting -> confirmed | error`

**Flow:**
1. User selects stance (SUPPORT/OPPOSE/AMEND), writes body text, sets stake amount
2. Client computes `bodyHash = keccak256(body)`, `amendmentHash`
3. ZK proof generation (deferred -- for MVP, use mock proof or skip if no identity commitment)
4. Calls `clientSubmitArgument(walletState.provider, params)` for EVM users
5. Or `gaslessSubmitArgument(walletProvider, params)` for NEAR users
6. Shows tx confirmation with link to block explorer

**Error handling:**
- User rejection (code 4001): "Transaction cancelled. Try again when ready."
- Insufficient balance: Pre-check via `getTokenBalance()` before signing
- Contract revert: Display revert reason from receipt

### 3c. CoSignButton

**Props:**
- `debateId: string`, `argumentIndex: number`, `onCosigned: (txHash: string) => void`

**Flow:** Same as SubmitArgument minus stance/body selection. Calls `clientCoSignArgument()` or `gaslessCoSignArgument()`.

## 4. Wiring Diagram

```
Campaign Page (/c/[slug]/+page.svelte)
  |
  +-- DebateMarketCard (read-only signals, no wallet)
  |
  +-- DebateParticipationPanel (FEATURES.WALLET && walletState.connected)
        |
        +-- walletState.provider (EVMWalletProvider from store)
        |
        +-- SubmitArgumentForm
        |     |-- debate-client.ts::clientSubmitArgument(wallet, params)
        |     |     |-- eip712.ts::buildProofAuthorizationData()
        |     |     |-- wallet.signTypedData() [MetaMask popup]
        |     |     |-- token.ts::ensureTokenApproval()
        |     |     |-- Contract.submitArgument() [user pays gas]
        |     |     +-- tx.wait() -> { txHash }
        |     |
        |     +-- debate-client.ts::gaslessSubmitArgument(wallet, params)
        |           |-- eip712.ts::buildProofAuthorizationData()
        |           |-- wallet.signTypedData() [MPC or MetaMask]
        |           |-- gas/user-operation.ts::buildSubmitArgumentUserOp()
        |           |-- POST /api/wallet/sponsor-userop
        |           |     |-- gas/pimlico.ts::sponsorUserOperation()
        |           |     |-- gas/pimlico.ts::sendUserOperation()
        |           |     +-- gas/pimlico.ts::waitForUserOperationReceipt()
        |           +-- { txHash }
        |
        +-- CoSignButton
              +-- (same two paths as above, using coSign variants)
```

**Key decision point:** `walletState.isEVM` -> direct submission (user pays gas) vs `walletState.isNEAR` -> gasless ERC-4337 path.

## 5. Sponsor-UserOp Gap Analysis

The `/api/wallet/sponsor-userop/+server.ts` endpoint is **complete and production-ready**:

- [x] Auth required (locals.user)
- [x] Per-user rate limit: 5 ops/24h (in-memory, hard-blocked with 429)
- [x] Wire format deserialization (hex strings -> bigint)
- [x] Pimlico client creation with `PIMLICO_API_KEY`
- [x] Sponsorship policy: `allowedTargets = [DEBATE_MARKET_ADDRESS]`, `maxGasPerOp = 0.005 ETH`
- [x] 3-step sponsorship: stub -> estimate -> final paymaster data
- [x] UserOp submission to bundler
- [x] Receipt polling with timeout (60s)
- [x] Error handling: 401, 400, 429, 502, 503, 402, 422, 202

**Gaps / TODOs (non-blocking for launch):**
1. **Batch approve + submit in single UserOp** -- Currently requires separate ERC-20 approve tx. Noted as TODO in debate-client.ts. Not blocking: first-time users do one approve tx, then subsequent submissions are pre-approved.
2. **SimpleAccount factory deployment** -- Gasless path assumes sender has a deployed SimpleAccount. Factory/factoryData fields are NOT populated. For NEAR-path users, this means the first gasless submission will fail unless the smart account is pre-deployed.
3. **Rate limit durability** -- In-memory Map resets on Worker isolate recycle. Fine for launch; move to KV/D1 for production.
4. **Policy: callData target extraction** -- Currently does substring match for DEBATE_MARKET_ADDRESS in callData (best-effort). Full ABI decoding would be more robust but not required.

## 6. Environment Variables

### Required for wallet functionality:
| Variable | Context | Description |
|---|---|---|
| `PIMLICO_API_KEY` | Server (private) | Pimlico bundler/paymaster API key |
| `DEBATE_MARKET_ADDRESS` | Server (private) | DebateMarket contract for sponsor-userop policy |
| `SCROLL_NETWORK` | Server (private) | `scroll-sepolia` or `scroll` (default: scroll-sepolia) |

### Already configured (public, in contracts.ts):
| Variable | Default | Description |
|---|---|---|
| `PUBLIC_DEBATE_MARKET_ADDRESS` | `0xAa1e...B751` | DebateMarket address |
| `PUBLIC_DISTRICT_GATE_ADDRESS` | `0xC5ef...684f` | DistrictGate verifier |
| `PUBLIC_STAKING_TOKEN_ADDRESS` | `0x0000...0000` | ERC-20 staking token (USDC) -- **MUST SET for production** |
| `PUBLIC_SCROLL_RPC_URL` | `https://sepolia-rpc.scroll.io` | Scroll RPC for read-only calls |
| `PUBLIC_SCROLL_CHAIN_ID` | `534351` | Target chain ID |
| `PUBLIC_ENABLE_SMART_ACCOUNTS` | `false` | Enable EIP-7702 delegation UI |

### NEAR-specific (not needed for EVM-only launch):
| Variable | Context | Description |
|---|---|---|
| `NEAR_ACCOUNT_ID` | Server | NEAR relayer account |
| `NEAR_PRIVATE_KEY` | Server | NEAR relayer key |

## 7. Cloudflare Workers Constraints

1. **No Node.js `Buffer`** -- All code uses `Uint8Array` and hex string manipulation. ethers v6 is Worker-compatible. Confirmed: no `Buffer` usage in wallet code.

2. **No `fs` module** -- All wallet code is pure computation + fetch. IndexedDB used only in browser (trade-preimage-store.ts).

3. **BigInt serialization** -- `JSON.stringify` cannot serialize BigInt. All wire formats use `toHexString()` helper (`0x` + value.toString(16)). The sponsor-userop endpoint deserializes with `BigInt(hexString)`. This is correctly handled end-to-end.

4. **Module-scoped state** -- `PimlicoClient` is created per-request (not cached). The rate limit `opsWindowMap` is module-scoped (acceptable: CF isolate lifetimes are short). The balance endpoint caches `JsonRpcProvider` in module scope (acceptable: stateless, cheap to recreate).

5. **ethers v6** -- Uses `ethers` (not viem). Compatible with Workers via `BrowserProvider` (client) and `JsonRpcProvider` (server). No WASM compilation issues at this version.

6. **`$env/dynamic/private`** -- pimlico.ts and sponsor-userop use server-only env. The `handlePlatformEnv` shim in `db.ts` copies platform.env to process.env; wallet endpoints access env through SvelteKit's `$env/dynamic/private` which works natively on Workers.

## 8. Implementation Order

1. **Flip `FEATURES.WALLET = true`** (task #4) -- Activates header UI, modal, balance display
2. **Build DebateParticipationPanel** (task #5) -- New component for `/c/[slug]`
3. **Add chain switching** -- Call `switchToScrollSepolia()` in `connectEVM()` flow
4. **Set `PUBLIC_STAKING_TOKEN_ADDRESS`** -- Deploy or identify USDC on Scroll Sepolia
5. **Test gasless path** -- Requires deployed SimpleAccount for NEAR users (can defer)
