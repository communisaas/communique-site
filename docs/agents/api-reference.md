# Agent System API Reference

## Table of Contents
- [ModerationConsensus](#moderationconsensus)
- [TaskOrchestrator](#taskorchestrator)
- [BudgetManager](#budgetmanager)
- [ConsensusEngine](#consensusengine)
- [AgentRegistry](#agentregistry)
- [Types and Interfaces](#types-and-interfaces)

## ModerationConsensus

Main entry point for template moderation and enhancement.

### Class: `ModerationConsensus`

```typescript
import { moderationConsensus } from '$lib/agents/moderation-consensus';
```

#### Methods

##### `evaluateTemplate(templateId, submissionFlow?, userBudget?)`

Evaluates and processes a template through the agent consensus system.

**Parameters:**
- `templateId` (string): Unique identifier of the template
- `submissionFlow` ('voter-protocol' | 'direct-delivery'): Processing flow type (default: 'direct-delivery')
- `userBudget` (number): Maximum budget in USD (default: 0.10)

**Returns:** `Promise<ProcessingResult>`

**Example:**
```typescript
const result = await moderationConsensus.evaluateTemplate(
  'template_123',
  'voter-protocol',
  0.15
);

console.log(result.finalDecision); // 'approved' | 'rejected' | 'needs_review'
console.log(result.enhancedContent); // AI-improved content
console.log(result.totalCost); // $0.003
```

##### `predictCost(content, submissionFlow?, userReputation?)`

Predicts the cost of processing a template before submission.

**Parameters:**
- `content` (string): Template content to analyze
- `submissionFlow` ('voter-protocol' | 'direct-delivery'): Processing flow type
- `userReputation` (number): User reputation score (0-1)

**Returns:** `Promise<CostPrediction>`

**Example:**
```typescript
const prediction = await moderationConsensus.predictCost(
  "Dear Representative, I am writing about...",
  'voter-protocol',
  0.85
);

console.log(prediction.estimatedCost); // 0.0025
console.log(prediction.range); // { min: 0.002, max: 0.003 }
```

##### `checkUserBudget(userId, estimatedCost)`

Checks if a user has sufficient budget for processing.

**Parameters:**
- `userId` (string): User identifier
- `estimatedCost` (number): Estimated processing cost

**Returns:** `Promise<BudgetCheck>`

**Example:**
```typescript
const budgetCheck = await moderationConsensus.checkUserBudget(
  'user_456',
  0.005
);

if (!budgetCheck.canAfford) {
  console.log('Daily limit exceeded:', budgetCheck.currentSpending);
}
```

## TaskOrchestrator

Coordinates multi-stage template processing pipeline.

### Class: `TaskOrchestrator`

```typescript
import { taskOrchestrator } from '$lib/agents/orchestrator/task-orchestrator';
```

#### Methods

##### `processTemplate(templateId, submissionFlow, userBudget)`

Main processing method that orchestrates all stages.

**Parameters:**
- `templateId` (string): Template identifier
- `submissionFlow` ('voter-protocol' | 'direct-delivery'): Processing flow
- `userBudget` (number): Budget constraint

**Returns:** `Promise<ProcessingResult>`

```typescript
interface ProcessingResult {
  templateId: string;
  finalDecision: 'approved' | 'rejected' | 'needs_review';
  confidence: number; // 0-1
  enhancedContent?: string;
  stages: StageResult[];
  consensus: ConsensusResult;
  totalCost: number;
  totalTime: number; // milliseconds
  submissionFlow: string;
  metadata?: {
    riskAssessment?: RiskAssessment;
    qualityScore?: number;
    cacheHits?: number;
  };
}
```

##### `designPipeline(template, flow, budget)`

Determines which processing stages to run.

**Parameters:**
- `template` (Template): Template object
- `flow` ('voter-protocol' | 'direct-delivery'): Submission flow
- `budget` (number): Available budget

**Returns:** `string[]` - Array of stage names

**Example:**
```typescript
const pipeline = orchestrator.designPipeline(
  template,
  'voter-protocol',
  0.10
);
// ['screening', 'enhancement', 'validation', 'consensus']
```

##### `runStageWithFallback(stage, input, options)`

Runs a processing stage with automatic fallback on failure.

**Parameters:**
- `stage` (string): Stage name
- `input` (StageInput): Stage input data
- `options` (StageOptions): Processing options

**Returns:** `Promise<StageResult>`

## BudgetManager

Manages cost optimization and user spending.

### Class: `BudgetManager`

```typescript
import { budgetManager } from '$lib/agents/economics/budget-manager';
```

#### Methods

##### `optimizeForBudget(task, constraints)`

Optimizes agent selection based on budget constraints.

**Parameters:**
- `task` (AgentTask): Task requirements
- `constraints` (BudgetConstraints): Budget and performance constraints

**Returns:** `Promise<CostOptimizationResult>`

```typescript
interface CostOptimizationResult {
  selectedAgents: AgentCapability[];
  estimatedCost: number;
  estimatedTime: number;
  strategy: 'cheapest' | 'quality' | 'speed' | 'balanced';
  alternativeOptions?: AlternativeOption[];
}
```

**Example:**
```typescript
const optimization = await budgetManager.optimizeForBudget(
  {
    capability: 'enhancement',
    complexity: 'medium',
    contentLength: 500
  },
  {
    budget: 0.05,
    maxLatency: 3000,
    minQuality: 0.8
  }
);
```

##### `trackUserSpending(userId, amount, metadata?)`

Records user spending for analytics and limits.

**Parameters:**
- `userId` (string): User identifier
- `amount` (number): Amount spent in USD
- `metadata` (object): Optional transaction metadata

**Returns:** `Promise<void>`

##### `getUserSpendingSummary(userId)`

Gets spending summary for a user.

**Parameters:**
- `userId` (string): User identifier

**Returns:** `Promise<UserSpendingPattern | null>`

```typescript
interface UserSpendingPattern {
  userId: string;
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
  transactionCount: number;
  averageTransaction: number;
  lastActivity: Date;
  tier: 'free' | 'standard' | 'premium';
  suspicious: boolean;
}
```

##### `predictTemplateCost(content, flow, reputation?)`

Predicts processing cost based on content analysis.

**Parameters:**
- `content` (string): Template content
- `flow` ('voter-protocol' | 'direct-delivery'): Processing flow
- `reputation` (number): User reputation (0-1)

**Returns:** `Promise<CostPrediction>`

```typescript
interface CostPrediction {
  estimatedCost: number;
  range: { min: number; max: number };
  breakdown: CostBreakdown[];
  recommendations: string[];
  complexityScore: number;
}
```

## ConsensusEngine

Generates multi-agent consensus decisions.

### Class: `ConsensusEngine`

```typescript
import { consensusEngine } from '$lib/agents/consensus/consensus-engine';
```

#### Methods

##### `generateConsensus(input)`

Generates weighted consensus from agent votes.

**Parameters:**
- `input` (ConsensusInput): Consensus input data

```typescript
interface ConsensusInput {
  agentVotes: AgentVote[];
  templateContext: {
    type: string;
    sensitivity: 'low' | 'medium' | 'high';
    targetAudience: string;
  };
  riskAssessment?: RiskAssessment;
  economicFactors?: EconomicFactors;
}
```

**Returns:** `Promise<ConsensusResult>`

```typescript
interface ConsensusResult {
  decision: 'approved' | 'rejected' | 'needs_review';
  confidence: number; // 0-1
  agentVotes: WeightedVote[];
  diversityScore: number;
  riskFactors?: RiskAssessment;
  reasoning: string;
  dissent?: DissentAnalysis;
}
```

**Example:**
```typescript
const consensus = await consensusEngine.generateConsensus({
  agentVotes: [
    { agentId: 'gpt-5-mini', decision: 'approve', confidence: 0.9 },
    { agentId: 'gemini-2.5', decision: 'approve', confidence: 0.85 }
  ],
  templateContext: {
    type: 'legislative',
    sensitivity: 'high',
    targetAudience: 'congress'
  }
});
```

##### `resolveConflict(votes, context)`

Resolves conflicts when agents disagree.

**Parameters:**
- `votes` (AgentVote[]): Conflicting agent votes
- `context` (ConflictContext): Context for resolution

**Returns:** `Promise<Resolution>`

## AgentRegistry

Manages agent discovery and selection.

### Class: `AgentRegistry`

```typescript
import { agentRegistry } from '$lib/agents/registry/agent-registry';
```

#### Methods

##### `registerAgent(capability)`

Registers a new agent capability.

**Parameters:**
- `capability` (AgentCapability): Agent capability definition

```typescript
interface AgentCapability {
  id: string;
  provider: 'openai' | 'google' | 'anthropic' | 'custom';
  model: string;
  costPerMToken: {
    input: number;
    output: number;
    cached?: number;
    thinking?: number;
  };
  capabilities: ('screening' | 'enhancement' | 'reasoning' | 'consensus')[];
  reliability: number; // 0-1
  speed: number; // avg ms
  contextWindow: number;
  cachingSupport: boolean;
  expertiseDomains?: string[];
  isActive: boolean;
  lastUpdated: Date;
}
```

##### `selectBestAgent(capability, constraints)`

Selects optimal agent for a task.

**Parameters:**
- `capability` (string): Required capability
- `constraints` (SelectionConstraints): Selection constraints

**Returns:** `Promise<AgentCapability | null>`

```typescript
interface SelectionConstraints {
  maxCostPerMToken: number;
  maxLatency: number;
  minReliability?: number;
  requiredDomains?: string[];
  preferredProvider?: string;
  task: string;
}
```

##### `getAgentMetrics(agentId)`

Gets performance metrics for an agent.

**Parameters:**
- `agentId` (string): Agent identifier

**Returns:** `Promise<AgentMetrics>`

```typescript
interface AgentMetrics {
  agentId: string;
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  p95Latency: number;
  costPerRequest: number;
  cacheHitRate: number;
  errorRate: number;
  qualityScore: number;
  lastHourRequests: number;
  lastDayRequests: number;
}
```

##### `updateAgentStatus(agentId, status)`

Updates agent availability status.

**Parameters:**
- `agentId` (string): Agent identifier
- `status` (AgentStatus): New status

**Returns:** `Promise<void>`

## Types and Interfaces

### Core Types

```typescript
type SubmissionFlow = 'voter-protocol' | 'direct-delivery';

type Decision = 'approved' | 'rejected' | 'needs_review';

type OptimizationStrategy = 'cheapest' | 'quality' | 'speed' | 'balanced';

type AgentProvider = 'openai' | 'google' | 'anthropic' | 'custom';

type AgentCapabilityType = 'screening' | 'enhancement' | 'reasoning' | 'consensus';
```

### Request/Response Interfaces

```typescript
interface ProcessingRequest {
  templateId: string;
  content: string;
  userId: string;
  submissionFlow: SubmissionFlow;
  budget?: number;
  priority?: 'low' | 'normal' | 'high';
  options?: ProcessingOptions;
}

interface ProcessingOptions {
  skipEnhancement?: boolean;
  requireFactCheck?: boolean;
  targetStyle?: 'professional' | 'casual' | 'academic';
  preserveVoice?: boolean;
  maxProcessingTime?: number;
}

interface ProcessingResponse {
  success: boolean;
  result?: ProcessingResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metrics?: {
    processingTime: number;
    tokensUsed: number;
    cacheHits: number;
  };
}
```

### Error Types

```typescript
class ProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  );
}

class BudgetExceededError extends ProcessingError {
  constructor(
    userId: string,
    currentSpent: number,
    limit: number
  );
}

class AgentTimeoutError extends ProcessingError {
  constructor(
    agentId: string,
    timeout: number
  );
}

class ConsensusFailureError extends ProcessingError {
  constructor(
    votes: AgentVote[],
    reason: string
  );
}
```

## Usage Examples

### Complete Template Processing

```typescript
import { moderationConsensus } from '$lib/agents/moderation-consensus';

async function processUserTemplate(userId: string, templateId: string) {
  try {
    // Check user budget first
    const costPrediction = await moderationConsensus.predictCost(
      template.content,
      'voter-protocol'
    );
    
    const budgetCheck = await moderationConsensus.checkUserBudget(
      userId,
      costPrediction.estimatedCost
    );
    
    if (!budgetCheck.canAfford) {
      throw new Error('Insufficient budget');
    }
    
    // Process template
    const result = await moderationConsensus.evaluateTemplate(
      templateId,
      'voter-protocol',
      costPrediction.estimatedCost * 1.5 // 50% buffer
    );
    
    // Handle result
    if (result.finalDecision === 'approved') {
      await saveEnhancedTemplate(templateId, result.enhancedContent);
      await submitToVoterProtocol(result);
    } else if (result.finalDecision === 'rejected') {
      await notifyUserOfRejection(userId, result.consensus.reasoning);
    } else {
      await queueForHumanReview(templateId, result);
    }
    
    return result;
    
  } catch (error) {
    console.error('Template processing failed:', error);
    throw error;
  }
}
```

### Custom Agent Selection

```typescript
import { agentRegistry } from '$lib/agents/registry/agent-registry';
import { AgentFactory } from '$lib/agents/providers/agent-factory';

async function processWithCustomAgents(content: string) {
  // Select specific agent
  const screeningAgent = await agentRegistry.selectBestAgent(
    'screening',
    {
      maxCostPerMToken: 0.10,
      maxLatency: 500,
      preferredProvider: 'openai',
      task: 'toxicity-check'
    }
  );
  
  if (!screeningAgent) {
    throw new Error('No suitable screening agent');
  }
  
  // Create agent instance
  const factory = new AgentFactory();
  const agent = await factory.createAgent(screeningAgent);
  
  // Execute screening
  const result = await agent.execute({
    content,
    options: { quick: true }
  });
  
  return result;
}
```

### Budget-Aware Processing

```typescript
import { budgetManager } from '$lib/agents/economics/budget-manager';

async function processWithinBudget(
  templates: Template[],
  totalBudget: number
) {
  const results = [];
  let spentSoFar = 0;
  
  for (const template of templates) {
    // Predict cost
    const prediction = await budgetManager.predictTemplateCost(
      template.content,
      'direct-delivery'
    );
    
    // Check if we can afford it
    if (spentSoFar + prediction.estimatedCost > totalBudget) {
      console.log('Budget exhausted at template', template.id);
      break;
    }
    
    // Optimize for remaining budget
    const optimization = await budgetManager.optimizeForBudget(
      { capability: 'full-pipeline', content: template.content },
      { budget: totalBudget - spentSoFar }
    );
    
    // Process with optimized agents
    const result = await processWithAgents(
      template,
      optimization.selectedAgents
    );
    
    results.push(result);
    spentSoFar += result.totalCost;
  }
  
  return results;
}
```

## WebSocket Events

For real-time processing updates:

```typescript
// Client-side
const ws = new WebSocket('wss://api.communique.ai/agents/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  
  switch (event.type) {
    case 'stage.started':
      console.log(`Stage ${event.stage} started`);
      break;
      
    case 'stage.completed':
      console.log(`Stage ${event.stage} completed in ${event.time}ms`);
      break;
      
    case 'processing.completed':
      console.log('Final result:', event.result);
      break;
      
    case 'processing.error':
      console.error('Processing error:', event.error);
      break;
  }
});

// Send processing request
ws.send(JSON.stringify({
  type: 'process.template',
  templateId: 'template_123',
  flow: 'voter-protocol'
}));
```

## Rate Limits

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| `/evaluate` | 100/min | 10 |
| `/predict-cost` | 1000/min | 50 |
| `/check-budget` | 500/min | 25 |

## HTTP API Endpoints

### POST `/api/agents/evaluate`
Evaluate and process a template.

### POST `/api/agents/predict-cost`
Predict processing cost for content.

### GET `/api/agents/budget/:userId`
Check user's budget status.

### GET `/api/agents/metrics`
Get system-wide agent metrics.

### GET `/api/agents/health`
Health check for agent system.

---

*Last Updated: September 2025*
*API Version: 1.0.0*