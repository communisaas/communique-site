# VOTER Protocol Blockchain Integration

**How Communique connects to VOTER Protocol smart contracts for rewards and reputation.**

## Architecture Overview

```
Communique Frontend
        ↓
Communique Backend (Proxy)
        ↓
VOTER Protocol Smart Contracts (Ronin)
```

**Key principle**: Users never need wallets. We handle all blockchain complexity server-side.

## Core Components

### Deterministic Address Generation
Each user gets a blockchain address without a wallet:
```typescript
const userBlockchainAddress = generateDeterministicAddress(
  userId,
  process.env.PRIVATE_KEY_ENCRYPTION_KEY
);
```

### Smart Contract Integration

**Primary Contracts**:
- `CommuniqueCore`: Central coordination and reward distribution
- `VOTERToken`: ERC-20 governance token with staking
- `VOTERRegistry`: Identity and action verification

**Key Functions**:
```typescript
// Process civic action and mint rewards
await communiqueCore.processCivicAction({
  user: userAddress,
  actionType: 'congressional_contact',
  verificationProof: cwcReceipt,
  rewardAmount: calculatedReward
});

// Update reputation
await voterRegistry.updateReputation(
  userAddress,
  reputationScore,
  actionContext
);
```

## Server Proxy Architecture

All blockchain operations go through our backend:

1. **User Action** → Frontend calls Communique API
2. **Validation** → Backend verifies action completion
3. **Blockchain Call** → Backend interacts with smart contracts
4. **Response** → User sees results without knowing blockchain was involved

### API Endpoints

```typescript
// Process completed civic action
POST /api/civic/process-action
{
  templateId: string,
  actionProof: string, // CWC receipt or equivalent
  userId: string
}

// Check user's VOTER balance
GET /api/civic/balance/:userId

// Get reputation score
GET /api/civic/reputation/:userId
```

## Security Model

### Private Key Management
- Master key encrypted and stored securely
- Per-user deterministic derivation
- Keys never exposed to frontend
- All signing happens server-side

### Transaction Security
```typescript
// Server-side transaction signing
const tx = await contract.populateTransaction.processCivicAction(...);
const signedTx = await wallet.signTransaction(tx);
const receipt = await provider.sendTransaction(signedTx);
```

## Reward Calculation

Rewards determined by VOTER Protocol agents:

```typescript
const context = {
  actionType: 'congressional_contact',
  templateQuality: moderationScore,
  userReputation: reputationScore,
  marketConditions: currentSupply
};

const reward = await supplyAgent.calculateReward(context);
// Returns amount in VOTER tokens
```

## Error Handling

### Blockchain Failures
- Automatic retry with exponential backoff
- Fallback to queue for later processing
- User sees success immediately (optimistic UI)
- Background reconciliation

### Gas Management
- Platform pays all gas fees
- Batched transactions for efficiency
- Gas price monitoring and limits

## Monitoring

Track key metrics:
- Transaction success rate
- Gas costs per action
- Reward distribution
- Smart contract events
- User balance changes

## Development Setup

### Local Testing
```bash
# Use local Anvil node
anvil --fork-url https://ronin-mainnet.com

# Deploy contracts locally
forge script DeployLocal

# Set environment variables
BLOCKCHAIN_RPC_URL=http://localhost:8545
CONTRACT_ADDRESS=0x...
```

### Integration Testing
```typescript
// Mock blockchain in tests
vi.mock('$lib/server/blockchain', () => ({
  processCivicAction: vi.fn().mockResolvedValue({
    success: true,
    txHash: '0x123...',
    reward: 100
  })
}));
```

## Common Issues

**"User has no blockchain address"**
- Check deterministic address generation
- Verify encryption key is set

**"Transaction failed"**
- Check gas limits
- Verify contract state
- Review error logs

**"Rewards not showing"**
- Check block confirmations
- Verify event indexing
- Review reward calculation

## Future Enhancements

- Multi-chain deployment (Ethereum L2s)
- Real-time reward streaming
- Delegation mechanisms
- Cross-chain reputation bridges

For smart contract details, see the [VOTER Protocol repository](https://github.com/communique/voter-protocol).