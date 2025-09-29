# Understanding Communique's Two Agent Systems

## Quick Reference

**Got confused about which agent does what? This doc is for you.**

## The Two Systems

### 🤖 System 1: Template Processing Agents (AI/LLM)
**Purpose**: Content moderation and enhancement  
**Technology**: GPT-5, Gemini 2.5, Claude (future)  
**Location**: `/src/lib/agents/{registry, orchestrator, consensus, economics}`  
**When Active**: When users submit templates for review  

### ⛓️ System 2: VOTER Protocol Agents (Blockchain/Economic)  
**Purpose**: Reward calculation, identity verification, reputation  
**Technology**: TypeScript business logic, smart contracts  
**Location**: `/src/lib/agents/{supply-agent, verification-agent, market-agent, etc}`  
**When Active**: After template approval, during blockchain settlement  

## Why Two Systems?

### They Solve Different Problems

**Template Processing** needs:
- Natural language understanding
- Subjective quality assessment  
- Flexible, fast responses
- Cost-optimized AI selection

**VOTER Protocol** needs:
- Deterministic calculations
- Cryptographic proofs
- Economic modeling
- Blockchain integration

### They Run at Different Times

```
User Journey:
1. Submit template → Template Processing Agents
2. Get approval → Bridge between systems
3. Send message → VOTER Protocol Agents  
4. Earn tokens → Blockchain settlement
```

## System 1: Template Processing Agents

### What They Do
- **Screen** for toxicity, spam, threats
- **Enhance** grammar, clarity, professionalism
- **Validate** facts, check claims
- **Consensus** from multiple AI models

### Key Classes
```typescript
// Manages available AI models
class AgentRegistry {
  registerAgent(capability: AgentCapability)
  selectBestAgent(task, constraints)
}

// Coordinates processing pipeline
class TaskOrchestrator {
  processTemplate(templateId, flow, budget)
}

// Generates multi-agent consensus
class ConsensusEngine {
  generateConsensus(agentVotes)
}

// Optimizes for cost/quality
class BudgetManager {
  optimizeForBudget(task, constraints)
}
```

### When They Run
- User submits template
- User requests enhancement
- System needs content validation
- Before VOTER Protocol certification

## System 2: VOTER Protocol Agents

### What They Do
- **Calculate** dynamic token rewards
- **Verify** user identity (Didit.me integration)
- **Manage** challenge markets and stakes
- **Track** legislative impact
- **Build** portable reputation (ERC-8004)

### Key Classes
```typescript
// Calculates rewards based on network activity
class SupplyAgent extends BaseAgent {
  makeDecision(context): RewardParameters
}

// Verifies identity and trust
class VerificationAgent extends BaseAgent {
  makeDecision(context): VerificationAssessment
}

// Manages challenge stakes
class MarketAgent extends BaseAgent {
  makeDecision(context): StakeCalculation
}

// Tracks causal impact
class ImpactAgent extends BaseAgent {
  makeDecision(context): ImpactScore
}

// Manages ERC-8004 reputation
class ReputationAgent extends BaseAgent {
  makeDecision(context): ReputationUpdate
}
```

### When They Run
- After template approval
- During civic action certification
- When calculating rewards
- During challenge market operations
- When updating on-chain reputation

## How They Work Together

### Integration Flow

```typescript
// 1. Template Processing (System 1)
const result = await moderationConsensus.evaluateTemplate(
  templateId,
  'voter-protocol',
  budget
);

if (result.finalDecision === 'approved') {
  // 2. Bridge to VOTER Protocol (System 2)
  
  // Verification Agent checks identity
  const verification = await verificationAgent.makeDecision({
    userId: user.id
  });
  
  // Supply Agent calculates reward
  const reward = await supplyAgent.makeDecision({
    userId: user.id,
    actionType: 'cwc_message',
    templateId: templateId
  });
  
  // 3. Blockchain settlement
  await voterBlockchain.processCivicAction({
    userAddress: user.wallet_address,
    rewardAmount: reward.decision.finalRewardWei
  });
}
```

### Data Flow

```
Template Processing Agents
         ↓
    [Approved?]
         ↓
  VOTER Protocol Agents
         ↓
  Blockchain Settlement
         ↓
    User Rewards
```

## Common Confusion Points

### ❌ WRONG: "The new AI agents replace the old VOTER agents"
✅ **RIGHT**: They complement each other. AI agents handle content, VOTER agents handle economics.

### ❌ WRONG: "SupplyAgent uses GPT-5 to calculate rewards"  
✅ **RIGHT**: SupplyAgent uses deterministic algorithms. Only template processing uses AI.

### ❌ WRONG: "Both systems run simultaneously"
✅ **RIGHT**: Template processing → approval → VOTER Protocol. Sequential, not parallel.

### ❌ WRONG: "AgentRegistry manages all agents"
✅ **RIGHT**: AgentRegistry only manages AI models. VOTER agents use AgentCoordinator.

## File Organization

```
src/lib/agents/
├── # SYSTEM 1: Template Processing
├── registry/
│   └── agent-registry.ts       # AI model catalog
├── orchestrator/
│   └── task-orchestrator.ts    # Processing pipeline
├── consensus/
│   └── consensus-engine.ts     # Multi-AI voting
├── economics/
│   └── budget-manager.ts       # AI cost optimization
├── base/
│   └── universal-agent.ts      # AI agent interfaces
│
├── # SYSTEM 2: VOTER Protocol
├── base-agent.ts               # VOTER agent base class
├── supply-agent.ts             # Reward calculation
├── verification-agent.ts       # Identity verification
├── market-agent.ts            # Challenge markets
├── impact-agent.ts            # Legislative tracking
├── reputation-agent.ts        # ERC-8004 reputation
│
└── # INTEGRATION
    └── moderation-consensus.ts # Entry point connecting both systems
```

## Environment Configuration

```bash
# SYSTEM 1: Template Processing
OPENAI_API_KEY=sk-...          # GPT-5 access
GOOGLE_AI_API_KEY=...           # Gemini 2.5 access

# SYSTEM 2: VOTER Protocol  
VOTER_CONTRACT_ADDRESS=0x...    # Smart contracts
VOTER_RPC_URL=https://...       # Blockchain RPC
VOTER_PRIVATE_KEY=...           # Platform wallet

# BOTH SYSTEMS
ENABLE_AI_ENHANCEMENT=true      # System 1 feature
ENABLE_VOTER_CERTIFICATION=true # System 2 feature
```

## Quick Debugging Guide

### "Which agent is failing?"

1. **Check the error message for class name**:
   - `ScreeningAgent`, `EnhancementAgent` → System 1 (AI)
   - `SupplyAgent`, `VerificationAgent` → System 2 (VOTER)

2. **Check the file path**:
   - `/registry`, `/orchestrator`, `/consensus` → System 1
   - `supply-agent.ts`, `verification-agent.ts` → System 2

3. **Check the context**:
   - Processing templates → System 1
   - Calculating rewards → System 2
   - Blockchain operations → System 2

### "Where to add new features?"

- **Content-related** → System 1 (Template Processing)
- **Economic/blockchain** → System 2 (VOTER Protocol)
- **User experience** → Could be either, check the flow

## Summary Table

| Aspect | Template Processing (System 1) | VOTER Protocol (System 2) |
|--------|--------------------------------|---------------------------|
| **Purpose** | Content moderation & enhancement | Rewards & blockchain |
| **Technology** | GPT-5, Gemini 2.5 | TypeScript, Smart Contracts |
| **Runs When** | Template submission | After approval |
| **Decisions** | Subjective quality | Deterministic calculations |
| **Cost Model** | Per API call | Gas fees |
| **Scaling** | Horizontal (more API calls) | Vertical (blockchain limits) |
| **Failure Mode** | Returns to queue | Retries with exponential backoff |

## Remember

**Both systems are essential.** They're not competing or replacing each other. They work together to create the complete civic engagement flow from template creation to token rewards.

---

*Last Updated: September 2025*
*Clarification Version: 1.0.0*