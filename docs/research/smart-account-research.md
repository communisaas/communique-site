# Smart Account (ERC-4337) Research — Cycle 54

**Date**: 2026-03-10
**Status**: BLOCKED — viem dependency conflict
**Scope**: Gasless transactions via Pimlico bundler + paymaster on Scroll Sepolia

---

## 1. Research Summary

### 1.1 Pimlico Scroll Sepolia Support — CONFIRMED

Pimlico operates a bundler and verifying paymaster on Scroll Sepolia (chain ID 534351).

- **Bundler URL**: `https://api.pimlico.io/v2/534351/rpc?apikey=<KEY>`
- **Alt URL**: `https://api.pimlico.io/v2/scroll-sepolia-testnet/rpc?apikey=<KEY>`
- **EntryPoint v0.6**: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
- **EntryPoint v0.7**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- **SimpleAccount factory (v0.6)**: `0x9406Cc6185a346906296840746125a0E44976454`
- **Verifying Paymaster**: `pm_sponsorUserOperation` endpoint, 10-minute inclusion window
- **Sponsorship**: Deducted from Pimlico dashboard balance. Supports policy-based sponsorship.

### 1.2 permissionless.js SDK — REQUIRES VIEM

permissionless.js is the canonical TypeScript SDK for ERC-4337 account abstraction. It is built on and requires viem as a peer dependency.

**API for SimpleAccount creation:**
```typescript
import { toSimpleSmartAccount } from "permissionless/accounts"
import { createSmartAccountClient } from "permissionless"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createPublicClient, http } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"

const simpleAccount = await toSimpleSmartAccount({
  client: publicClient,          // viem PublicClient
  owner: privateKeyToAccount("0x..."),  // viem LocalAccount | EIP1193Provider | WalletClient
  entryPoint: { address: entryPoint07Address, version: "0.7" },
})

const smartAccountClient = createSmartAccountClient({
  account: simpleAccount,
  chain: scrollSepolia,
  paymaster: paymasterClient,
  bundlerTransport: http("https://api.pimlico.io/v2/534351/rpc?apikey=<KEY>"),
})

// Transactions are bundled as UserOperations — gas paid by paymaster
const txHash = await smartAccountClient.sendTransaction({ to, value, data })
```

**Owner parameter types**: `LocalAccount | EIP1193Provider | WalletClient` — all viem types.

### 1.3 Ethers v6 vs viem — THE BLOCKER

The commons project uses ethers v6 exclusively for all Ethereum interactions:
- `EVMWalletProvider` — wraps ethers `BrowserProvider` + `Signer`
- `NEARWalletProvider` — uses ethers `TypedDataEncoder`, `hashMessage`
- `OperatorWallet` — uses ethers `Wallet`, `JsonRpcProvider`, `NonceManager`, `Contract`
- All EIP-712 signing, transaction submission, and chain interaction goes through ethers

permissionless.js requires viem. The two libraries:
- Have incompatible type systems (`ethers.BrowserProvider` vs `viem.PublicClient`)
- Both bundle ~150KB of Ethereum primitives (ABI encoding, RLP, keccak256, etc.)
- Use different patterns (ethers: OOP classes, viem: functional composition)
- Both define `Eip1193Provider` but with different shapes

Adding viem would mean:
- ~150KB additional bundle size (browser)
- Two parallel type systems for the same concepts
- Adapter glue between ethers types and viem types in the smart account provider
- Ongoing maintenance burden of two Ethereum libraries

### 1.4 EIP-7702 — EMERGING ALTERNATIVE

EIP-7702 (Pectra upgrade, May 2025) lets EOAs delegate execution to smart contracts without deploying a separate smart account. Scroll Sepolia has EIP-7702 support.

**Advantages over ERC-4337:**
- No separate smart account address (user keeps their EOA)
- No factory contract deployment
- Compatible with ERC-4337 infrastructure (can delegate to 4337 accounts)
- Simpler mental model for users

**Current limitations:**
- Browser wallet support is inconsistent (MetaMask support is recent/experimental)
- Paymaster integration patterns are still maturing
- Fewer production examples than ERC-4337

---

## 2. Blockers

### B1: viem Dependency Conflict (CRITICAL)

permissionless.js requires viem. The project uses ethers v6. Adding both creates:
- Duplicate Ethereum library code (~150KB wasted)
- Type system conflicts (every function touching the smart account needs adapters)
- Ongoing dual-library maintenance

**Resolution paths:**
1. Migrate the project from ethers v6 to viem (large, separate effort)
2. Wait for an ethers-native ERC-4337 library (none exists)
3. Write a minimal ERC-4337 client directly on ethers v6 (high effort, fragile)
4. Use EIP-7702 when wallet support matures (avoids the library issue entirely)

### B2: Pimlico API Key (MINOR)

Requires a Pimlico dashboard account and API key. Free tier exists for testnets.
Not a real blocker — just requires account setup.

### B3: Smart Account Address Divergence (DESIGN)

With ERC-4337, the user's on-chain address changes from their EOA to a counterfactual smart account address. This affects:
- `WalletProvider.address` — which address do we return?
- Contract access control — `msg.sender` becomes the smart account, not the EOA
- Existing debate market positions are tied to EOA addresses

The contracts (DebateMarket, DistrictGate) check `msg.sender` or `ECDSA.recover` against the signer. A smart account changes `msg.sender` to the smart account address, but EIP-712 signatures still recover to the EOA owner. This mismatch requires careful analysis per contract function.

---

## 3. WalletProvider Interface Assessment

**Can SmartAccountProvider implement WalletProvider?** Yes, with caveats.

```
interface WalletProvider {
  readonly address: string;        // Smart account address (not EOA)
  readonly providerType: WalletProviderType;  // 'smart-account'
  signTypedData(domain, types, value): Promise<string>;  // Owner EOA signs
  signMessage(message): Promise<string>;  // Owner EOA signs
}
```

- `address` — Would return the smart account's counterfactual address
- `signTypedData` — The owner EOA signs the UserOperation; the smart account validates it on-chain. This is conceptually different from the current flow where the signer IS the sender.
- `signMessage` — Same as signTypedData: owner signs, smart account wraps

**Missing from WalletProvider**: `sendTransaction()`. The current interface is signing-only. Smart accounts need transaction submission (via bundler). This would require either:
- Extending WalletProvider with `sendTransaction()`
- Adding a separate `SmartAccountClient` abstraction

---

## 4. Recommended Path Forward

### Option A: Wait for EIP-7702 Maturity (RECOMMENDED)

**Timeline**: 3-6 months from now (mid-2026)

EIP-7702 is the cleanest path because:
- No new smart account address (user keeps their EOA)
- Works with ethers v6 (standard transaction with `authorizationList`)
- Scroll Sepolia already supports the EVM-level opcode
- Compatible with the existing WalletProvider interface (no address change)
- Paymaster sponsorship works the same way (paymaster pays for the tx)

**What needs to happen first:**
- MetaMask/browser wallets need stable EIP-7702 support (in progress)
- Pimlico or similar provider needs a 7702-compatible paymaster on Scroll
- One production reference implementation to validate the pattern

### Option B: Minimal ethers-native ERC-4337 Client

If gasless transactions are needed before EIP-7702 matures, we could:
1. Build a thin UserOperation builder on ethers v6 (no permissionless.js)
2. Talk directly to Pimlico's JSON-RPC bundler endpoint
3. Use `eth_sendUserOperation`, `eth_estimateUserOperationGas` directly

This avoids the viem dependency but requires:
- ~500 lines of UserOperation construction/signing code
- ABI encoding the initCode, callData, and paymasterAndData manually
- Testing against Pimlico's bundler validation rules

**Rough effort**: 2-3 cycles. Fragile without the SDK's validation logic.

### Option C: Full viem Migration

Migrate the entire wallet layer from ethers v6 to viem. This is the "right" long-term answer but:
- Touches every file in `src/lib/core/wallet/`
- Requires updating `OperatorWallet`, `EVMWalletProvider`, `NEARWalletProvider`
- ethers `TypedDataEncoder` and `hashMessage` would need viem equivalents
- All tests need updating
- **Effort**: 3-5 cycles

---

## 5. Appendix: Key URLs

- Pimlico supported chains: https://docs.pimlico.io/guides/supported-chains
- permissionless.js: https://github.com/pimlicolabs/permissionless.js
- toSimpleSmartAccount API: https://docs.pimlico.io/permissionless/reference/accounts/toSimpleSmartAccount
- SimpleAccount guide: https://docs.pimlico.io/guides/how-to/accounts/use-simple-account
- Verifying paymaster: https://docs.pimlico.io/references/paymaster/verifying-paymaster/endpoints
- EIP-7702 overview: https://eip7702.io/
- viem EIP-7702: https://viem.sh/docs/eip7702
