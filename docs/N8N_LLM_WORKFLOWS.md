# N8N LLM Workflow Patterns for VOTER Protocol Agents

## Overview

All VOTER Protocol agents now use N8N workflows for LLM orchestration instead of direct API calls. This provides:

- **Centralized LLM management**: All API calls, rate limiting, and error handling in N8N
- **Cost optimization**: Unified billing and usage tracking
- **Model flexibility**: Easy A/B testing and model upgrades
- **Workflow observability**: All LLM interactions logged and monitorable
- **Robust error handling**: Workflow-based retries and fallbacks

## Workflow Naming Convention

```
{agent_prefix}-{operation_type}
```

Examples:
- `verification-comprehensive` - Complete template verification
- `verification-grammar` - Grammar-only checking
- `moderation-openai` - OpenAI-based content moderation
- `moderation-gemini` - Gemini-based content moderation
- `supply-calculation` - Token supply optimization
- `impact-assessment` - Civic impact prediction

## Standard Workflow Input Schema

All agent workflows receive this standard input:

```json
{
  "agent_name": "verification_agent",
  "model": "gpt-4-turbo-preview",
  "temperature": 0.1,
  "max_tokens": 500,
  "input": {
    // Agent-specific input data
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Agent-Specific Workflow Patterns

### 1. Verification Workflows

#### `verification-comprehensive`
**Purpose**: Complete template verification (grammar, policy, factuality)

**Input**:
```json
{
  "template": {
    "id": "template_123",
    "subject": "Infrastructure Investment",
    "message_body": "Dear Representative..."
  },
  "checks": {
    "grammar": true,
    "policy": true,
    "factuality": false
  },
  "criteria": {
    "grammar_threshold": 3,
    "policy_threshold": 7,
    "auto_approve_below": 7
  }
}
```

**Output**:
```json
{
  "approved": true,
  "confidence": 0.85,
  "reasoning": ["No severe violations found"],
  "corrections": {
    "subject": "Infrastructure Investment Act",
    "body": "Corrected grammar..."
  },
  "severity_level": 3,
  "violations": []
}
```

### 2. Moderation Workflows

#### `moderation-openai` / `moderation-gemini`
**Purpose**: Multi-model content moderation consensus

**Input**:
```json
{
  "template": {
    "id": "template_123",
    "subject": "Policy Position",
    "message_body": "Message content..."
  },
  "agent_config": {
    "weight": 0.5,
    "model": "gpt-4-turbo-preview"
  },
  "prompt_context": {
    "system_message": "You are a content moderator...",
    "evaluation_criteria": [
      "hate_speech",
      "threats",
      "malicious_content"
    ]
  }
}
```

**Output**:
```json
{
  "contains_violations": false,
  "confidence": 0.8,
  "violations": [],
  "reasons": ["Content appears legitimate"]
}
```

### 3. Supply Calculation Workflows

#### `supply-calculation`
**Purpose**: Dynamic token supply optimization

**Input**:
```json
{
  "action_type": "cwc_message",
  "current_supply": "1000000000000000000000",
  "participation_metrics": {
    "daily_active_users": 1500,
    "weekly_actions": 10000
  },
  "market_conditions": {
    "volatility": 0.15,
    "price_trend": "stable"
  }
}
```

**Output**:
```json
{
  "recommended_reward": "50000000000000000000",
  "multipliers": {
    "participation": 1.2,
    "supply": 0.9,
    "market": 1.0
  },
  "confidence": 0.9,
  "rationale": "Increased participation warrants higher rewards"
}
```

### 4. Impact Assessment Workflows

#### `impact-assessment`
**Purpose**: Predict civic action effectiveness

**Input**:
```json
{
  "action_type": "cwc_message",
  "recipients": ["rep_smith", "sen_jones"],
  "template_content": {
    "subject": "Healthcare Access",
    "key_points": ["rural hospitals", "medicare expansion"]
  },
  "historical_data": {
    "previous_campaigns": 5,
    "response_rate": 0.3
  },
  "district_metrics": {
    "population": 700000,
    "engagement_rate": 0.12
  }
}
```

**Output**:
```json
{
  "impact_score": 75,
  "impact_category": "high",
  "predicted_outcomes": {
    "response_chance": 0.35,
    "policy_influence": 0.2,
    "community_reach": 0.15
  },
  "confidence": 0.8,
  "reasoning": ["High engagement district", "Relevant local issue"]
}
```

## Error Handling Patterns

### Workflow Failure Response
```json
{
  "success": false,
  "error": "Model API rate limit exceeded",
  "fallback_used": true,
  "retry_after": 60
}
```

### Agent Fallback Strategy
1. **Try primary N8N workflow**
2. **On failure**: Use local fallback methods
3. **Log error** for monitoring
4. **Return result** with fallback indicator

## Monitoring and Observability

### Key Metrics to Track
- **Workflow execution time**
- **LLM API cost per workflow**
- **Success/failure rates**
- **Fallback usage frequency**
- **Model performance comparison**

### N8N Workflow Monitoring
```typescript
// Check workflow health
const isHealthy = await n8nClient.healthCheck();

// List active workflows
const workflows = await n8nClient.listWorkflows();

// Monitor specific execution
const status = await n8nClient.checkExecutionStatus(executionId);
```

## Migration Benefits

### Before (Direct LLM Calls)
```typescript
// Scattered API calls
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({ model, messages, temperature })
});
```

### After (N8N Orchestration)
```typescript
// Centralized workflow call
const result = await this.callLLMWorkflow('comprehensive', {
  template: templateData,
  checks: verificationChecks
});
```

### Benefits Realized
- ✅ **Centralized error handling**
- ✅ **Unified rate limiting**
- ✅ **Cost tracking and optimization**
- ✅ **Model A/B testing capability**
- ✅ **Workflow observability**
- ✅ **Robust retry mechanisms**

## Implementation Status

- ✅ **ModerationConsensus**: Migrated to N8N workflows
- ✅ **BaseAgent**: Added N8N client integration
- ✅ **VerificationAgent**: Updated to use workflows
- 🔄 **SupplyAgent**: Migration in progress
- 🔄 **ImpactAgent**: Migration in progress
- 🔄 **ReputationAgent**: Migration in progress

## Next Steps

1. **Complete agent migrations**
2. **Implement N8N workflows in N8N server**
3. **Add comprehensive monitoring**
4. **Performance testing and optimization**
5. **Production deployment**

This N8N-first architecture provides the foundation for scalable, observable, and cost-effective LLM orchestration across all VOTER Protocol agents.