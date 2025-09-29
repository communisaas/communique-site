# VOTER Protocol Blockchain Integration

## Overview

VOTER Protocol provides on-chain infrastructure for democratic participation through smart contracts on Ronin (production) and Monad (future). This document covers the blockchain integration layer that connects Communique's off-chain template system with VOTER's on-chain settlement.

## Smart Contract Architecture

### Core Contracts

#### CommuniqueCore (`0x...`)
Main orchestration contract handling civic actions and rewards.

```solidity
contract CommuniqueCore {
    // Register new user with identity verification
    function registerUser(
        address user,
        bytes32 phoneHash,
        bytes memory selfProof
    ) external;
    
    // Process civic action and distribute rewards
    function processCivicAction(
        address participant,
        uint8 actionType,
        bytes32 actionHash,
        string memory metadataUri,
        uint256 rewardOverride
    ) external;
    
    // Query user statistics
    function getUserStats(address user) view returns (
        uint256 actionCount,
        uint256 civicEarned,
        uint256 lastActionTime
    );
}
```

#### VOTERToken (`0x...`)
ERC-20 governance token with staking and delegation.

```solidity
contract VOTERToken is ERC20, ERC20Permit, ERC20Votes {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function delegate(address delegatee) external;
}
```

#### VOTERRegistry (`0x...`)
On-chain registry of civic participation records (non-transferable).

```solidity
contract VOTERRegistry {
    struct CivicRecord {
        address participant;
        ActionType actionType;
        bytes32 actionHash;
        string metadataUri;
        uint256 timestamp;
        uint256 rewardAmount;
    }
    
    function getCitizenRecords(address citizen) 
        view returns (CivicRecord[] memory);
}
```

## Blockchain Client Implementation

### VOTERBlockchainClient (`/src/lib/core/blockchain/voter-client.ts`)

TypeScript client for smart contract interaction:

```typescript
class VOTERBlockchainClient {
    private provider: ethers.JsonRpcProvider;
    private contracts: {
        communiqueCore: ethers.Contract;
        voterToken: ethers.Contract;
        voterRegistry: ethers.Contract;
    };
    
    // Process civic action on-chain
    async processCivicAction(
        action: VOTERAction
    ): Promise<VOTERActionResult> {
        const tx = await this.contracts.communiqueCore.processCivicAction(
            action.userAddress,
            this.getActionType(action.actionType),
            this.hashAction(action),
            action.metadataUri || '',
            action.rewardOverride || 0
        );
        
        const receipt = await tx.wait();
        return this.parseReceipt(receipt);
    }
    
    // Get user's VOTER token balance
    async getUserBalance(address: string): Promise<string> {
        const balance = await this.contracts.voterToken.balanceOf(address);
        return balance.toString();
    }
}
```

## Certification Flow

### 1. Template Approval
```typescript
// Template approved by AI agents
const approved = await moderationConsensus.evaluateTemplate(templateId);
```

### 2. Delivery Confirmation
```typescript
// CWC delivery returns confirmation
const cwcResult = await cwcClient.submitMessage(template);
```

### 3. VOTER Certification
```typescript
// Certify with VOTER Protocol
const certification = await voterClient.certifyDelivery({
    templateData: template,
    userProfile: user,
    cwcResult: {
        submissionId: cwcResult.id,
        receiptHash: cwcResult.hash
    }
});
```

### 4. Reward Calculation
```typescript
// SupplyAgent calculates dynamic reward
const reward = await supplyAgent.makeDecision({
    userId: user.id,
    actionType: 'cwc_message',
    templateId: template.id,
    networkConditions: await getNetworkStats()
});
```

### 5. Blockchain Settlement
```typescript
// Process on-chain with calculated reward
const txResult = await voterBlockchain.processCivicAction({
    userAddress: user.wallet_address,
    actionType: 'CWC_MESSAGE',
    templateId: template.id,
    deliveryConfirmation: cwcResult.id,
    rewardAmount: reward.decision.finalRewardWei
});
```

## User Address Management

### Deterministic Address Generation

Users don't need wallets initially. We generate deterministic addresses:

```typescript
function generateVOTERAddress(userId: string): string {
    // Create deterministic address from user ID
    const userSeed = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(userId + PLATFORM_SALT)
    );
    
    // Generate address (user doesn't have private key yet)
    const address = ethers.utils.getAddress(
        '0x' + userSeed.slice(-40)
    );
    
    return address;
}
```

### Progressive Decentralization

1. **Start**: User has deterministic address, no wallet
2. **Earn**: VOTER tokens accumulate at their address
3. **Connect**: User creates/connects wallet when ready
4. **Claim**: User claims accumulated tokens

## Action Types

```typescript
enum ActionType {
    CWC_MESSAGE = 0,      // Congressional message via CWC
    LOCAL_ACTION = 1,     // State/local government action
    DIRECT_ACTION = 2,    // Direct democracy participation
    TOWN_HALL = 3,        // Town hall attendance
    PUBLIC_COMMENT = 4,   // Public comment submission
    CHALLENGE_MARKET = 5, // Challenge market participation
    TEMPLATE_CREATION = 6 // Creating civic templates
}
```

## Gas Management

### Sponsored Transactions

Platform pays gas for users without wallets:

```typescript
async function sponsoredTransaction(
    userAction: VOTERAction
): Promise<TransactionReceipt> {
    // Platform wallet signs and pays gas
    const signer = new ethers.Wallet(PLATFORM_PRIVATE_KEY, provider);
    
    // Execute on behalf of user
    const tx = await communiqueCore.connect(signer).processCivicAction(
        userAction.userAddress,
        userAction.actionType,
        // ... other params
        { gasLimit: 200000 }
    );
    
    return await tx.wait();
}
```

### Gas Optimization

- Batch multiple actions in single transaction
- Use merkle trees for bulk certifications
- Cache frequently accessed data
- Optimize contract storage patterns

## Event Monitoring

### Listen for On-Chain Events

```typescript
// Monitor civic action events
communiqueCore.on('CivicActionProcessed', 
    async (participant, actionType, reward, event) => {
        await db.civicAction.create({
            data: {
                userId: await getUserByAddress(participant),
                actionType: actionType.toString(),
                rewardAmount: reward.toString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            }
        });
    }
);

// Monitor token transfers
voterToken.on('Transfer', async (from, to, amount, event) => {
    await trackTokenTransfer(from, to, amount, event);
});
```

## Challenge Market Integration

### Stake Calculation

```typescript
interface ChallengeStake {
    baseAmount: bigint;       // Base stake in wei
    reputationMultiplier: number;
    finalAmount: bigint;
}

async function calculateChallengeStake(
    challenger: string,
    template: Template
): Promise<ChallengeStake> {
    // Get user's reputation
    const reputation = await getReputationScore(challenger);
    
    // Calculate base stake (quadratic)
    const baseAmount = BigInt(template.quality_score) ** 2n * BASE_STAKE;
    
    // Apply reputation discount
    const multiplier = Math.max(0.1, 1 - reputation / 1000);
    const finalAmount = baseAmount * BigInt(Math.floor(multiplier * 100)) / 100n;
    
    return { baseAmount, reputationMultiplier: multiplier, finalAmount };
}
```

### Challenge Resolution

```typescript
async function resolveChallenge(
    challengeId: string,
    outcome: 'upheld' | 'rejected'
): Promise<void> {
    const challenge = await db.challenge.findUnique({ 
        where: { id: challengeId }
    });
    
    if (outcome === 'upheld') {
        // Challenger wins, gets stake back + reward
        await voterToken.transfer(
            challenge.challenger,
            challenge.stake + challenge.reward
        );
    } else {
        // Template creator wins, gets challenger's stake
        await voterToken.transfer(
            challenge.templateCreator,
            challenge.stake
        );
    }
    
    // Update on-chain reputation
    await updateReputationRegistry(
        outcome === 'upheld' ? challenge.challenger : challenge.templateCreator,
        outcome === 'upheld' ? 10 : -5
    );
}
```

## Security Considerations

### Private Key Management

```typescript
// NEVER store user private keys
// Only platform operational wallet has private key
const PLATFORM_WALLET = new ethers.Wallet(
    process.env.VOTER_PRIVATE_KEY!,
    provider
);

// User addresses are deterministic, not wallets
const userAddress = generateVOTERAddress(userId); // No private key
```

### Transaction Security

- All transactions require multi-sig for amounts >$1000
- Rate limiting on civic actions (max 10/day per user)
- Merkle proof verification for batch operations
- Emergency pause mechanism for contract upgrades

## Error Handling

```typescript
async function safeProcessAction(
    action: VOTERAction
): Promise<VOTERActionResult> {
    try {
        return await voterBlockchain.processCivicAction(action);
    } catch (error) {
        if (error.code === 'INSUFFICIENT_FUNDS') {
            // Platform wallet needs refill
            await notifyOps('Platform wallet low on gas');
            return { success: false, error: 'System maintenance' };
        }
        
        if (error.code === 'NONCE_EXPIRED') {
            // Retry with new nonce
            return await retryWithNewNonce(action);
        }
        
        // Log and return user-friendly error
        logger.error('Blockchain error:', error);
        return { 
            success: false, 
            error: 'Temporary blockchain issue. Your action was saved and will be processed soon.'
        };
    }
}
```

## Monitoring & Analytics

### Key Metrics

```typescript
interface BlockchainMetrics {
    totalCivicActions: number;
    totalRewardsDistributed: string; // Wei
    averageGasPrice: string;
    averageConfirmationTime: number; // ms
    failureRate: number;
    pendingTransactions: number;
}

async function getBlockchainMetrics(): Promise<BlockchainMetrics> {
    const stats = await communiqueCore.getPlatformStats();
    const gasPrice = await provider.getGasPrice();
    
    return {
        totalCivicActions: stats.totalActions.toNumber(),
        totalRewardsDistributed: stats.totalCivicMinted.toString(),
        averageGasPrice: gasPrice.toString(),
        averageConfirmationTime: await getAvgConfirmationTime(),
        failureRate: await getTransactionFailureRate(),
        pendingTransactions: await provider.getTransactionCount(PLATFORM_WALLET)
    };
}
```

## Configuration

### Environment Variables

```bash
# Blockchain RPC
VOTER_RPC_URL=https://api.roninchain.com/rpc  # Ronin mainnet
VOTER_CHAIN_ID=2020

# Smart Contracts (Ronin addresses)
VOTER_COMMUNIQUE_CORE=0x...
VOTER_TOKEN_ADDRESS=0x...
VOTER_REGISTRY_ADDRESS=0x...

# Platform Wallet (for gas sponsorship)
VOTER_PRIVATE_KEY=0x...  # KEEP SECURE!
VOTER_WALLET_ADDRESS=0x...

# Gas Settings
VOTER_GAS_LIMIT=200000
VOTER_MAX_GAS_PRICE=20  # Gwei

# Features
ENABLE_BLOCKCHAIN_SETTLEMENT=true
ENABLE_GAS_SPONSORSHIP=true
```

## Testing

### Local Blockchain Testing

```bash
# Run local Hardhat node
npx hardhat node

# Deploy contracts locally
npx hardhat run scripts/deploy.js --network localhost

# Run integration tests
npm run test:blockchain
```

### Testnet Deployment

```bash
# Deploy to Saigon testnet (Ronin)
npx hardhat run scripts/deploy.js --network saigon

# Verify contracts
npx hardhat verify --network saigon DEPLOYED_ADDRESS
```

---

*Last Updated: September 2025*
*Blockchain Version: 1.0.0*