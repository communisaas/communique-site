# Agent System Implementation Guide

## Overview

This guide provides detailed technical implementation for Communique's agent-agnostic template processing system. All code is TypeScript, designed for production deployment with comprehensive error handling and monitoring.

## Project Structure

```
src/lib/agents/
├── base/
│   └── universal-agent.ts         # Base classes and interfaces
├── registry/
│   └── agent-registry.ts          # Agent discovery and management
├── orchestrator/
│   └── task-orchestrator.ts       # Pipeline coordination
├── consensus/
│   └── consensus-engine.ts        # Multi-agent consensus
├── economics/
│   └── budget-manager.ts          # Cost optimization
├── providers/
│   └── agent-factory.ts           # Provider-specific implementations
└── moderation-consensus.ts        # Main entry point
```

## Core Interfaces

### Base Agent Interface

```typescript
// src/lib/agents/base/universal-agent.ts

export interface AgentResponse {
  agentId: string;
  success: boolean;
  result: unknown;
  confidence: number;        // 0-1 confidence score
  reasoning: string;          // Explanation of decision
  cost: number;              // Actual cost in USD
  tokensUsed: {
    input: number;
    output: number;
    thinking?: number;        // For o1-style models
    cached?: number;
  };
  cacheHit: boolean;
  processingTime: number;     // milliseconds
  error?: string;
}

export abstract class BaseAgent {
  protected capability: AgentCapability;
  protected credentials: ProviderCredentials;
  
  constructor(capability: AgentCapability, credentials: ProviderCredentials) {
    this.capability = capability;
    this.credentials = credentials;
  }
  
  abstract execute(input: AgentInput): Promise<AgentResponse>;
  abstract healthCheck(): Promise<boolean>;
  abstract getCurrentPricing(): Promise<CostStructure>;
  
  protected calculateCost(tokens: TokenUsage): number {
    const inputCost = (tokens.input / 1_000_000) * this.capability.costPerMToken.input;
    const outputCost = (tokens.output / 1_000_000) * this.capability.costPerMToken.output;
    const cachedDiscount = tokens.cached ? 0.9 : 0;
    return (inputCost + outputCost) * (1 - cachedDiscount);
  }
}
```

### Specialized Agent Types

```typescript
// Screening agents for quick toxicity/spam detection
export abstract class ScreeningAgent extends BaseAgent {
  abstract classifyToxicity(content: string): Promise<ToxicityScore>;
  abstract quickApproval(content: string): Promise<boolean>;
}

// Enhancement agents for content improvement
export abstract class EnhancementAgent extends BaseAgent {
  abstract enhanceContent(content: string, style: EnhancementStyle): Promise<string>;
  abstract explainChanges(original: string, enhanced: string): Promise<ChangeLog>;
}

// Reasoning agents for deep analysis
export abstract class ReasoningAgent extends BaseAgent {
  abstract analyzeContent(content: string): Promise<ContentAnalysis>;
  abstract resolveConflict(votes: AgentVote[]): Promise<Resolution>;
}

// Consensus agents for final decisions
export abstract class ConsensusAgent extends BaseAgent {
  abstract makeConsensusDecision(votes: AgentVote[]): Promise<ConsensusResult>;
  abstract validateIntentPreservation(original: string, enhanced: string): Promise<boolean>;
}
```

## Agent Registry Implementation

```typescript
// src/lib/agents/registry/agent-registry.ts

export class AgentRegistry {
  private agents: Map<string, AgentCapability> = new Map();
  private performanceMetrics: Map<string, AgentMetrics> = new Map();
  
  constructor() {
    this.initializeSeptember2025Models();
    this.startPerformanceTracking();
  }
  
  private initializeSeptember2025Models(): void {
    // GPT-5 Series
    this.registerAgent({
      id: 'gpt-5-nano-screening',
      provider: 'openai',
      model: 'gpt-5-nano',
      costPerMToken: {
        input: 0.05,
        output: 0.15,
        cached: 0.005  // 90% discount
      },
      capabilities: ['screening'],
      reliability: 0.95,
      speed: 500,
      contextWindow: 200000,
      cachingSupport: true,
      expertiseDomains: ['toxicity', 'spam', 'quick-classification']
    });
    
    this.registerAgent({
      id: 'gpt-5-mini-enhancement',
      provider: 'openai',
      model: 'gpt-5-mini',
      costPerMToken: {
        input: 0.25,
        output: 0.75,
        cached: 0.025
      },
      capabilities: ['enhancement', 'reasoning'],
      reliability: 0.98,
      speed: 1000,
      contextWindow: 200000,
      cachingSupport: true,
      expertiseDomains: ['grammar', 'clarity', 'professionalism']
    });
    
    // Gemini 2.5 Series
    this.registerAgent({
      id: 'gemini-2.5-flash-validation',
      provider: 'google',
      model: 'gemini-2.5-flash',
      costPerMToken: {
        input: 0.075,
        output: 0.30,
        cached: 0.0075
      },
      capabilities: ['reasoning', 'consensus'],
      reliability: 0.96,
      speed: 800,
      contextWindow: 1000000,
      cachingSupport: true,
      expertiseDomains: ['fact-checking', 'policy-analysis', 'grounding']
    });
  }
  
  async selectBestAgent(
    capability: AgentCapability,
    constraints: SelectionConstraints
  ): Promise<AgentCapability | null> {
    const candidates = this.getAgentsForCapability(capability);
    
    if (candidates.length === 0) return null;
    
    // Score each candidate
    const scored = candidates.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent, constraints)
    }));
    
    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score);
    
    const selected = scored[0].agent;
    
    // Track selection for analytics
    this.trackAgentSelection(selected.id, constraints);
    
    return selected;
  }
  
  private calculateAgentScore(
    agent: AgentCapability,
    constraints: SelectionConstraints
  ): number {
    let score = 0;
    
    // Reliability weight: 40%
    score += agent.reliability * 0.4;
    
    // Cost efficiency weight: 30%
    const costScore = Math.max(0, 1 - (agent.costPerMToken.input / constraints.maxCostPerMToken));
    score += costScore * 0.3;
    
    // Speed weight: 20%
    const speedScore = Math.max(0, 1 - (agent.speed / constraints.maxLatency));
    score += speedScore * 0.2;
    
    // Expertise match weight: 10%
    const expertiseScore = this.calculateExpertiseMatch(agent, constraints.task);
    score += expertiseScore * 0.1;
    
    // Apply penalties
    if (agent.speed > constraints.maxLatency) score *= 0.5;
    if (agent.costPerMToken.input > constraints.maxCostPerMToken) score *= 0.3;
    
    return score;
  }
}
```

## Task Orchestrator Implementation

```typescript
// src/lib/agents/orchestrator/task-orchestrator.ts

export class TaskOrchestrator {
  private registry: AgentRegistry;
  private budgetManager: BudgetManager;
  private consensusEngine: ConsensusEngine;
  
  async processTemplate(
    templateId: string,
    submissionFlow: 'voter-protocol' | 'direct-delivery',
    userBudget: number = 0.10
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const stages: StageResult[] = [];
    
    try {
      // Load template
      const template = await this.loadTemplate(templateId);
      
      // Determine pipeline based on flow
      const pipeline = this.designPipeline(template, submissionFlow, userBudget);
      
      // Stage 1: Screening
      if (pipeline.includes('screening')) {
        const screeningResult = await this.runScreeningStage(template);
        stages.push(screeningResult);
        
        if (screeningResult.decision === 'reject') {
          return this.buildRejectionResult(screeningResult, stages);
        }
      }
      
      // Stage 2: Enhancement
      let enhancedContent = template.message_body;
      if (pipeline.includes('enhancement')) {
        const enhancementResult = await this.runEnhancementStage(template, submissionFlow);
        stages.push(enhancementResult);
        enhancedContent = enhancementResult.output;
      }
      
      // Stage 3: Validation
      if (pipeline.includes('validation')) {
        const validationResult = await this.runValidationStage(enhancedContent);
        stages.push(validationResult);
      }
      
      // Stage 4: Consensus
      const consensusResult = await this.runConsensusStage(stages);
      
      return {
        templateId,
        finalDecision: consensusResult.decision,
        confidence: consensusResult.confidence,
        enhancedContent,
        stages,
        consensus: consensusResult,
        totalCost: stages.reduce((sum, s) => sum + s.cost, 0),
        totalTime: Date.now() - startTime,
        submissionFlow
      };
      
    } catch (error) {
      console.error('Template processing failed:', error);
      throw new ProcessingError('Failed to process template', { templateId, error });
    }
  }
  
  private async runScreeningStage(template: Template): Promise<StageResult> {
    // Select cheapest screening agent
    const agent = await this.registry.selectBestAgent(
      'screening',
      { 
        maxCostPerMToken: 0.10,
        maxLatency: 1000,
        task: 'toxicity-screening'
      }
    );
    
    if (!agent) throw new Error('No screening agent available');
    
    const factory = new AgentFactory();
    const screeningAgent = await factory.createAgent(agent) as ScreeningAgent;
    
    const toxicity = await screeningAgent.classifyToxicity(template.message_body);
    const quickApproval = await screeningAgent.quickApproval(template.message_body);
    
    return {
      stage: 'screening',
      agentId: agent.id,
      decision: toxicity.level > 3 ? 'reject' : 'continue',
      confidence: toxicity.confidence,
      cost: this.calculateStageCost(agent, template.message_body),
      reasoning: toxicity.reasoning,
      output: template.message_body
    };
  }
  
  private async runEnhancementStage(
    template: Template,
    flow: 'voter-protocol' | 'direct-delivery'
  ): Promise<StageResult> {
    const style = flow === 'voter-protocol' ? 'professional-legislative' : 'clear-direct';
    
    const agent = await this.registry.selectBestAgent(
      'enhancement',
      {
        maxCostPerMToken: 0.50,
        maxLatency: 3000,
        task: 'content-enhancement'
      }
    );
    
    if (!agent) throw new Error('No enhancement agent available');
    
    const factory = new AgentFactory();
    const enhancementAgent = await factory.createAgent(agent) as EnhancementAgent;
    
    const enhanced = await enhancementAgent.enhanceContent(template.message_body, style);
    const changes = await enhancementAgent.explainChanges(template.message_body, enhanced);
    
    return {
      stage: 'enhancement',
      agentId: agent.id,
      decision: 'continue',
      confidence: 0.95,
      cost: this.calculateStageCost(agent, template.message_body + enhanced),
      reasoning: changes.summary,
      output: enhanced,
      metadata: { changes }
    };
  }
}
```

## Consensus Engine Implementation

```typescript
// src/lib/agents/consensus/consensus-engine.ts

export class ConsensusEngine {
  async generateConsensus(input: ConsensusInput): Promise<ConsensusResult> {
    const { agentVotes, riskAssessment, economicFactors } = input;
    
    // Calculate weighted consensus
    const weightedVotes = this.applyVoteWeights(agentVotes);
    
    // Calculate diversity bonus
    const diversityScore = this.calculateDiversityScore(agentVotes);
    
    // Assess risk factors
    const riskMultiplier = this.calculateRiskMultiplier(riskAssessment);
    
    // Economic considerations
    const economicAdjustment = this.applyEconomicFactors(economicFactors);
    
    // Final consensus calculation
    const baseScore = this.calculateWeightedAverage(weightedVotes);
    const adjustedScore = baseScore * riskMultiplier * economicAdjustment + diversityScore * 0.1;
    
    const finalScore = Math.max(0, Math.min(1, adjustedScore));
    
    return {
      decision: this.makeDecision(finalScore, riskAssessment),
      confidence: finalScore,
      agentVotes: weightedVotes,
      diversityScore,
      riskFactors: riskAssessment,
      reasoning: this.generateReasoning(weightedVotes, finalScore)
    };
  }
  
  private applyVoteWeights(votes: AgentVote[]): WeightedVote[] {
    return votes.map(vote => {
      let weight = vote.agent.reliability;
      
      // Boost weight for specialized expertise
      if (this.hasRelevantExpertise(vote.agent, vote.context)) {
        weight *= 1.2;
      }
      
      // Reduce weight for outliers
      if (this.isOutlier(vote, votes)) {
        weight *= 0.8;
      }
      
      return { ...vote, weight };
    });
  }
  
  private calculateDiversityScore(votes: AgentVote[]): number {
    const providers = new Set(votes.map(v => v.agent.provider));
    const models = new Set(votes.map(v => v.agent.model));
    
    const providerDiversity = providers.size / 3; // Max 3 providers
    const modelDiversity = models.size / votes.length;
    
    return (providerDiversity * 0.6 + modelDiversity * 0.4);
  }
  
  private makeDecision(
    score: number,
    risk: RiskAssessment
  ): 'approved' | 'rejected' | 'needs_review' {
    // High-risk content needs higher confidence
    const threshold = risk.politicalSensitivity === 'high' ? 0.8 : 0.6;
    
    if (score >= threshold) return 'approved';
    if (score < 0.3) return 'rejected';
    return 'needs_review';
  }
}
```

## Budget Manager Implementation

```typescript
// src/lib/agents/economics/budget-manager.ts

export class BudgetManager {
  private userSpending: Map<string, UserSpendingPattern> = new Map();
  
  async optimizeForBudget(
    task: AgentTask,
    constraints: BudgetConstraints
  ): Promise<CostOptimizationResult> {
    const strategy = this.selectStrategy(task, constraints);
    
    switch (strategy) {
      case 'cheapest':
        return this.optimizeForCost(task, constraints);
      case 'quality':
        return this.optimizeForQuality(task, constraints);
      case 'speed':
        return this.optimizeForSpeed(task, constraints);
      default:
        return this.balancedOptimization(task, constraints);
    }
  }
  
  private selectStrategy(
    task: AgentTask,
    constraints: BudgetConstraints
  ): OptimizationStrategy {
    // High-stakes content always gets quality
    if (task.politicalSensitivity === 'high') return 'quality';
    
    // Time-sensitive gets speed
    if (constraints.maxLatency < 1000) return 'speed';
    
    // Limited budget gets cheapest
    if (constraints.budget < 0.01) return 'cheapest';
    
    // Default to balanced
    return 'balanced';
  }
  
  async trackUserSpending(userId: string, amount: number): Promise<void> {
    const pattern = this.userSpending.get(userId) || this.createNewPattern(userId);
    
    pattern.dailySpent += amount;
    pattern.weeklySpent += amount;
    pattern.monthlySpent += amount;
    pattern.lastActivity = new Date();
    pattern.transactionCount++;
    
    // Check for suspicious patterns
    if (this.isSuspiciousActivity(pattern)) {
      await this.flagForReview(userId, pattern);
    }
    
    this.userSpending.set(userId, pattern);
  }
  
  private isSuspiciousActivity(pattern: UserSpendingPattern): boolean {
    // Sudden spike in spending
    if (pattern.dailySpent > pattern.averageDaily * 10) return true;
    
    // Too many transactions
    if (pattern.transactionCount > 100) return true;
    
    // Unusual hours
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5 && pattern.transactionCount > 10) return true;
    
    return false;
  }
  
  async predictTemplateCost(
    content: string,
    flow: 'voter-protocol' | 'direct-delivery',
    reputation?: number
  ): Promise<CostPrediction> {
    const complexity = this.analyzeComplexity(content);
    const stages = this.determinePipelineStages(complexity, flow);
    
    let estimatedCost = 0;
    const breakdown: CostBreakdown[] = [];
    
    for (const stage of stages) {
      const stageCost = this.estimateStageCost(stage, content.length);
      estimatedCost += stageCost.average;
      breakdown.push(stageCost);
    }
    
    // Apply reputation discount
    if (reputation && reputation > 0.8) {
      estimatedCost *= 0.8; // 20% discount for high reputation
    }
    
    return {
      estimatedCost,
      range: {
        min: estimatedCost * 0.7,
        max: estimatedCost * 1.5
      },
      breakdown,
      recommendations: this.generateCostRecommendations(estimatedCost, flow)
    };
  }
}
```

## Provider Factory Pattern

```typescript
// src/lib/agents/providers/agent-factory.ts

export class AgentFactory {
  private credentials: Map<string, ProviderCredentials> = new Map();
  
  constructor() {
    this.loadCredentials();
  }
  
  async createAgent(capability: AgentCapability): Promise<BaseAgent> {
    const credentials = this.getCredentials(capability.provider);
    if (!credentials) {
      throw new Error(`No credentials for provider: ${capability.provider}`);
    }
    
    const primaryCapability = capability.capabilities[0];
    
    switch (primaryCapability) {
      case 'screening':
        return this.createScreeningAgent(capability, credentials);
      case 'enhancement':
        return this.createEnhancementAgent(capability, credentials);
      case 'reasoning':
        return this.createReasoningAgent(capability, credentials);
      case 'consensus':
        return this.createConsensusAgent(capability, credentials);
      default:
        return this.createGenericAgent(capability, credentials);
    }
  }
  
  private loadCredentials(): void {
    // OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.credentials.set('openai', {
        apiKey: openaiKey,
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        organization: process.env.OPENAI_ORGANIZATION
      });
    }
    
    // Google
    const googleKey = process.env.GOOGLE_AI_API_KEY;
    if (googleKey) {
      this.credentials.set('google', {
        apiKey: googleKey,
        baseUrl: process.env.GOOGLE_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1'
      });
    }
    
    // Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.credentials.set('anthropic', {
        apiKey: anthropicKey,
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
      });
    }
  }
}
```

## Error Handling

```typescript
export class ProcessingError extends Error {
  constructor(
    message: string,
    public context: {
      templateId?: string;
      stage?: string;
      agentId?: string;
      error?: unknown;
    }
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export class BudgetExceededError extends Error {
  constructor(
    public userId: string,
    public currentSpent: number,
    public limit: number
  ) {
    super(`Budget exceeded: ${currentSpent} > ${limit}`);
    this.name = 'BudgetExceededError';
  }
}

export class AgentTimeoutError extends Error {
  constructor(
    public agentId: string,
    public timeout: number
  ) {
    super(`Agent ${agentId} timed out after ${timeout}ms`);
    this.name = 'AgentTimeoutError';
  }
}
```

## Monitoring and Metrics

```typescript
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  
  recordProcessing(result: ProcessingResult): void {
    this.increment('templates.processed');
    this.recordValue('processing.time', result.totalTime);
    this.recordValue('processing.cost', result.totalCost);
    
    if (result.finalDecision === 'approved') {
      this.increment('templates.approved');
    } else if (result.finalDecision === 'rejected') {
      this.increment('templates.rejected');
    }
    
    // Track per-agent metrics
    for (const stage of result.stages) {
      this.increment(`agent.${stage.agentId}.requests`);
      this.recordValue(`agent.${stage.agentId}.cost`, stage.cost);
    }
  }
  
  async reportMetrics(): Promise<void> {
    const snapshot = this.getSnapshot();
    
    // Send to monitoring service
    await fetch(process.env.METRICS_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    });
    
    // Log locally
    console.log('Metrics snapshot:', snapshot);
  }
}
```

## Testing Strategy

```typescript
// tests/agents/orchestrator.test.ts

describe('TaskOrchestrator', () => {
  let orchestrator: TaskOrchestrator;
  let mockRegistry: jest.Mocked<AgentRegistry>;
  
  beforeEach(() => {
    mockRegistry = createMockRegistry();
    orchestrator = new TaskOrchestrator(mockRegistry);
  });
  
  it('should process voter-protocol templates with enhancement', async () => {
    const template = createMockTemplate();
    const result = await orchestrator.processTemplate(
      template.id,
      'voter-protocol',
      0.10
    );
    
    expect(result.stages).toHaveLength(4);
    expect(result.stages[1].stage).toBe('enhancement');
    expect(result.finalDecision).toBe('approved');
  });
  
  it('should reject high-toxicity content in screening', async () => {
    const toxicTemplate = createToxicTemplate();
    const result = await orchestrator.processTemplate(
      toxicTemplate.id,
      'direct-delivery',
      0.05
    );
    
    expect(result.stages).toHaveLength(1);
    expect(result.finalDecision).toBe('rejected');
  });
  
  it('should respect budget constraints', async () => {
    const template = createMockTemplate();
    const result = await orchestrator.processTemplate(
      template.id,
      'direct-delivery',
      0.001 // Very low budget
    );
    
    expect(result.totalCost).toBeLessThan(0.001);
  });
});
```

## Deployment Configuration

```yaml
# docker-compose.yml
services:
  communique-agents:
    image: communique/agents:latest
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    ports:
      - "3001:3001"
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      
volumes:
  redis-data:
```

## Performance Optimization

### Caching Strategy
- Cache agent responses for identical content (TTL: 1 hour)
- Pre-warm cache with common templates
- Use Redis for distributed caching

### Parallel Processing
- Run independent stages in parallel when possible
- Batch similar requests to reduce API calls
- Use worker queues for high-volume processing

### Cost Optimization
- Track and optimize for 90% caching discount
- Batch API calls where supported
- Use smaller models for simple tasks
- Implement progressive enhancement (start cheap, upgrade if needed)

---

*Last Updated: September 2025*
*Implementation Version: 1.0.0*