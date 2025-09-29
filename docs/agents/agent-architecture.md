# Dual Agent Architecture - Communique + VOTER Protocol

## Executive Summary

Communique implements **two complementary agent systems** that work together:

1. **VOTER Protocol Agents** - On-chain reward calculation, identity verification, and reputation management
2. **Template Processing Agents** - AI-powered content moderation and enhancement using GPT-5/Gemini

These systems integrate to provide end-to-end civic engagement: from template creation through blockchain settlement.

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Submission                       │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           TEMPLATE PROCESSING AGENTS                     │
│         (GPT-5/Gemini Multi-Agent System)               │
│                                                          │
│  • Screening: Toxicity/spam detection                   │
│  • Enhancement: Grammar/clarity improvement             │  
│  • Validation: Fact-checking                            │
│  • Consensus: Multi-agent voting                        │
└────────────────────────┬─────────────────────────────────┘
                         │
                    [If Approved]
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              VOTER PROTOCOL AGENTS                       │
│            (Blockchain Settlement System)                │
│                                                          │
│  • VerificationAgent: Identity verification             │
│  • SupplyAgent: Dynamic reward calculation              │
│  • MarketAgent: Challenge market management             │
│  • ImpactAgent: Legislative outcome tracking            │
│  • ReputationAgent: ERC-8004 reputation                 │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              BLOCKCHAIN SETTLEMENT                       │
│                                                          │
│  • Smart Contracts: CommuniqueCore, VOTERToken          │
│  • User receives VOTER tokens                           │
│  • Reputation updated on-chain                          │
└──────────────────────────────────────────────────────────┘
```

## Part 1: VOTER Protocol Agents

These agents handle blockchain integration and economic incentives.

### SupplyAgent (`/src/lib/agents/supply-agent.ts`)

Calculates dynamic rewards based on network activity and user reputation.

```typescript
interface RewardParameters {
  baseRewardUSD: number;        // $0.01 - $1.00
  multipliers: {
    activity: number;          // Network effect
    action: number;            // Action type
    reputation: number;        // User reputation
    complexity: number;        // Template complexity
    time: number;             // Time decay
    urgency: number;          // Political calendar
  };
  finalRewardETH: number;
  finalRewardWei: string;
}
```

**Key Features:**
- Prevents inflation through daily caps
- Adapts to political calendar events
- Applies reputation multipliers
- Safety bounds prevent manipulation

### VerificationAgent (`/src/lib/agents/verification-agent.ts`)

Handles identity verification and trust scoring.

```typescript
interface VerificationAssessment {
  userId: string;
  verificationLevel: 'unverified' | 'partial' | 'verified' | 'high_assurance';
  trustScore: number; // 0-1000
  zkProofHash?: string;
  districtVerification?: {
    congressionalDistrict: string;
    confidence: number;
  };
}
```

**Integrations:**
- Didit.me for zero-knowledge identity
- Congressional district verification
- Multi-source trust scoring
- Privacy-preserving attestations

### MarketAgent (`/src/lib/agents/market-agent.ts`)

Manages challenge markets and stake calculations.

```typescript
interface StakeCalculation {
  baseStake: number;
  multipliers: {
    reputation: number;
    historicalAccuracy: number;
    contentSeverity: number;
  };
  finalStakeRequired: number;
}
```

**Features:**
- Contextual stake requirements
- Reputation-based adjustments
- Quadratic scaling for fairness
- Gaming prevention

### ImpactAgent (`/src/lib/agents/impact-agent.ts`)

Tracks legislative outcomes and causal chains.

```typescript
interface ImpactScore {
  directCitations: number;      // Template quoted in testimony
  positionChanges: number;      // Votes changed after campaign
  mediaPickup: number;          // News coverage of template
  causalConfidence: number;     // 0-1 confidence in causation
}
```

### ReputationAgent (`/src/lib/agents/reputation-agent.ts`)

Manages ERC-8004 portable reputation.

```typescript
interface ReputationUpdate {
  challengeScore: number;        // Challenge market performance
  civicScore: number;           // Civic action quality
  discourseScore: number;       // Discussion contribution
  attestations: string[];       // ERC-8004 attestation hashes
}
```

## Part 2: Template Processing Agents

These agents handle AI-powered content processing using GPT-5 and Gemini 2.5.

### Agent Registry (`/src/lib/agents/registry/agent-registry.ts`)

Maintains catalog of available AI models.

```typescript
interface AgentCapability {
  id: string;
  provider: 'openai' | 'google' | 'anthropic';
  model: string;                // 'gpt-5-nano', 'gemini-2.5-flash', etc.
  costPerMToken: {
    input: number;
    output: number;
    cached?: number;             // 90% discount with caching
  };
  capabilities: ('screening' | 'enhancement' | 'reasoning' | 'consensus')[];
  reliability: number;           // 0-1
  speed: number;                // avg ms
}
```

### Task Orchestrator (`/src/lib/agents/orchestrator/task-orchestrator.ts`)

Coordinates multi-stage processing pipeline.

```typescript
async processTemplate(
  templateId: string,
  submissionFlow: 'voter-protocol' | 'direct-delivery',
  userBudget: number
): Promise<ProcessingResult>
```

**Processing Pipeline:**
1. **Screening** - Quick toxicity check (GPT-5 Nano)
2. **Enhancement** - Grammar/clarity improvements (GPT-5 Mini)
3. **Validation** - Fact-checking (Gemini 2.5)
4. **Consensus** - Multi-agent voting

### Consensus Engine (`/src/lib/agents/consensus/consensus-engine.ts`)

Aggregates decisions from multiple AI agents.

```typescript
interface ConsensusResult {
  decision: 'approved' | 'rejected' | 'needs_review';
  confidence: number;
  agentVotes: WeightedVote[];
  riskFactors: {
    toxicity: number;
    political_sensitivity: number;
    adversarial: number;
  };
}
```

### Budget Manager (`/src/lib/agents/economics/budget-manager.ts`)

Optimizes AI model selection for cost/quality.

```typescript
interface CostOptimizationResult {
  selectedAgents: AgentCapability[];
  estimatedCost: number;
  strategy: 'cheapest' | 'quality' | 'speed' | 'balanced';
}
```

## Part 3: Integration Points

### Template Approval Flow

```typescript
// 1. User submits template
const template = await createTemplate(userData);

// 2. AI agents process template
const processingResult = await moderationConsensus.evaluateTemplate(
  template.id,
  'voter-protocol',
  0.10 // budget
);

// 3. If approved, certify with VOTER Protocol
if (processingResult.finalDecision === 'approved') {
  const certification = await voterClient.certifyDelivery({
    templateData: template,
    userProfile: user,
    cwcResult: deliveryResult
  });
  
  // 4. SupplyAgent calculates reward
  const reward = await supplyAgent.makeDecision({
    userId: user.id,
    actionType: 'cwc_message',
    templateId: template.id
  });
  
  // 5. Blockchain settlement
  const txResult = await voterBlockchain.processCivicAction({
    userAddress: user.wallet_address,
    actionType: 'CWC_MESSAGE',
    rewardAmount: reward.decision.finalRewardWei
  });
}
```

### Blockchain Integration (`/src/lib/core/blockchain/voter-client.ts`)

Direct smart contract interaction:

```typescript
// Smart contract ABIs
const COMMUNIQUE_CORE_ABI = [
  'function processCivicAction(address participant, uint8 actionType, bytes32 actionHash, string metadataUri, uint256 rewardOverride)',
  'function getUserStats(address user) view returns (uint256 actionCount, uint256 civicEarned, uint256 lastActionTime)'
];

const VOTER_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];
```

### User Address Generation (`/src/lib/services/addressGeneration.ts`)

Deterministic blockchain addresses from user IDs:

```typescript
function generateVOTERAddress(userId: string): string {
  // Cryptographically derive address from user ID
  // User controls private keys only when ready
}
```

## Key Design Decisions

### Why Two Agent Systems?

1. **Separation of Concerns**
   - Template processing needs fast, flexible AI
   - Blockchain settlement needs deterministic, auditable logic

2. **Different Requirements**
   - AI agents: Handle natural language, subjective quality
   - VOTER agents: Handle economics, cryptographic proofs

3. **Independent Scaling**
   - Template processing scales with user submissions
   - Blockchain agents scale with on-chain capacity

### Security Considerations

- **No PII in AI prompts** - Templates anonymized before processing
- **No private keys in Communique** - Users control their own wallets
- **Audit trails** - All agent decisions logged
- **Circuit breakers** - Emergency stops for runaway costs

## Configuration

### Environment Variables

```bash
# AI Providers
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...

# Blockchain
VOTER_CONTRACT_ADDRESS=0x...
VOTER_RPC_URL=https://...
VOTER_PRIVATE_KEY=... # Server wallet only

# Feature Flags
ENABLE_VOTER_CERTIFICATION=true
ENABLE_AI_ENHANCEMENT=true
```

## Performance Metrics

### Template Processing
- **Speed**: <3 seconds average
- **Cost**: $0.002 per template (with caching)
- **Approval rate**: 85% first-pass

### Blockchain Settlement
- **Gas cost**: ~100,000 gas per certification
- **Confirmation time**: ~2 seconds (Ronin)
- **Success rate**: 99.9%

## Future Enhancements

### Q4 2025
- Anthropic Claude integration for constitutional AI
- Cross-chain deployment (Base, Arbitrum)
- Automated A/B testing of agent combinations

### 2026
- Fully autonomous agent governance
- Decentralized agent marketplace
- Zero-knowledge template processing

---

*Last Updated: September 2025*
*Architecture Version: 2.0.0 - Dual Agent System*