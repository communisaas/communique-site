# Agent Architecture

**Clear separation: Off-chain content moderation today, on-chain rewards tomorrow.**

## Two Distinct Systems

### 1. Content Moderation (Off-chain MVP)

**Purpose**: Template safety and quality  
**Location**: `/src/lib/agents/content/`  
**When**: Every template submission

**Multi-Agent Consensus System** (Following VOTER Protocol principles):

#### The Three Agents

1. **OpenAI (Primary - 40% weight)**
   - FREE Moderation API: 95% accuracy in 40 languages
   - GPT-5 enhancement: $0.001/template when needed
   - Handles toxicity, violence, hate speech detection

2. **Gemini 2.5 Flash-Lite (Verification - 35% weight)**
   - Ultra-cheap: $0.00005/template
   - Checks: Actionable requests, respectful tone
   - Second opinion to prevent single-model bias

3. **Claude 3.5 Haiku (Tie-breaker - 25% weight)**
   - Only invoked when agents disagree (~10% of cases)
   - Cost: $0.0004/template when needed
   - Provides nuanced analysis of disagreements

#### Consensus Mechanism

```typescript
// Multi-agent voting (no single point of failure)
const result = await moderationConsensus.evaluateTemplate(templateId);

// Result includes:
// - approved: boolean
// - consensusType: 'unanimous' | 'majority' | 'tie-breaker'
// - votes: AgentVote[] with confidence scores
// - totalCost: ~$0.00105 per template
// - dissent: recorded for learning

if (result.approved) {
	// Send to CWC or direct outreach
}
```

#### Cost Structure

- **Unanimous (90% of cases)**: $0.00105
- **Split decision (10% of cases)**: $0.00145
- **Monthly (10K templates)**: ~$11.60

### 2. VOTER Protocol Agents (Future On-chain)

**Purpose**: Rewards, reputation, economic incentives  
**Location**: `/src/lib/agents/voter-protocol/`  
**When**: After on-chain integration

Five specialized agents:

- **VerificationAgent**: User identity verification
- **SupplyAgent**: Dynamic reward calculation
- **MarketAgent**: Challenge market management
- **ImpactAgent**: Legislative outcome tracking
- **ReputationAgent**: ERC-8004 reputation scores

```typescript
// Future on-chain flow
if (templateApproved && onChainEnabled) {
	await voterProtocolCoordinator.processCivicAction({
		userAddress,
		template,
		actionType: 'cwc_message'
	});
}
```

## File Structure

```
/src/lib/agents/
├── content/                        # Off-chain template processing
│   ├── ai-moderation.ts           # 3-agent voting system
│   └── consensus-coordinator.ts   # Orchestration & cost tracking
├── voter-protocol/                 # Future on-chain agents
│   ├── verification-agent.ts       # User identity (not content)
│   ├── supply-agent.ts             # Token rewards
│   ├── market-agent.ts             # Challenge markets
│   ├── impact-agent.ts             # Impact tracking
│   └── reputation-agent.ts         # ERC-8004 reputation
├── shared/                         # Common code
│   ├── base-agent.ts              # Shared interfaces
│   └── type-guards.ts             # Type safety
└── moderation-consensus.ts        # Main entry point
```

## Why Two Systems?

### Different Requirements

- **Content needs**: LLM analysis, subjective quality, fast response
- **Economic needs**: Deterministic math, cryptographic proofs, blockchain

### Different Timelines

- **Content**: Real-time (seconds)
- **Blockchain**: Batch settlement (minutes)

### Different Costs

- **Content**: Optimize for cheap AI calls
- **Blockchain**: Security more important than cost

## N8N Workflow Integration

### Today (Off-chain MVP)

```typescript
// N8N orchestrates multi-agent consensus
template → N8N webhook → consensus voting → approve/reject → CWC/email
```

**N8N calls these endpoints**:

- `/api/n8n/process-template?stage=consensus` - Triggers multi-agent voting
- `/api/webhooks/n8n/status` - Receives workflow progress updates

See `docs/integrations.md#n8n-workflow-orchestration` for full N8N integration details.

### Tomorrow (On-chain Integration)

```typescript
// Add VOTER Protocol after approval
template → safety check → enhancement → approve → VOTER agents → blockchain → rewards
```

### Clean Handoff

- Template approval triggers database event
- VOTER agents process asynchronously
- User sees immediate feedback, rewards settle later

## What Changed

### Before (Regex-based)

- Dangerous regex patterns for toxicity detection
- No real AI moderation
- Single point of failure
- template-processor.ts with hardcoded patterns

### After (Multi-Agent Consensus)

- Real AI with 95% accuracy (OpenAI FREE API)
- Three independent agents voting
- No single point of failure
- Cost-effective: $11.60/month for 10K templates
- Dissent recording for continuous improvement

### Database Support

```prisma
model CostTracking {
  date          String   @unique  // Daily tracking
  totalCost     Float
  requestCount  Int
}

model AgentDissent {
  templateId     String
  votes          Json     // Agent disagreements
  finalDecision  Boolean
  userFeedback   String?  // For learning
}
```

## Key Principles

1. **Don't mix concerns**: Content moderation ≠ User verification
2. **Start simple**: 2 stages are enough for MVP
3. **Clear migration**: Off-chain today, easy on-chain tomorrow
4. **No confusion**: Each agent has one clear purpose

The architecture is now optimized for:

- **Today**: Fast, cheap template moderation
- **Tomorrow**: Secure on-chain rewards
- **Always**: Clear separation of concerns
