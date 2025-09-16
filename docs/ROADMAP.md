# Template Variable Resolution Roadmap

## The Demon We Face

Our templates contain aspirational variables that require:

- **Geographic intelligence**: `[Hospital System]`, `[Mayor Name]`
- **Real-time economic data**: `[Local Rent Data]`, `[Living Wage Calculation]`
- **Entity resolution**: `[Company]`, `[Platform]`, `[University]`
- **Dynamic calculations**: `[Current Calculation]` based on context

These aren't simple string replacements. They require agent-orchestrated data pipelines from trusted sources.

## Current Reality

### Variables in Production Templates:

```
[Hospital System]—Major healthcare provider by location
[Local Rent Data]—Median 1BR rent for user's area
[Current Calculation]—Minimum wage × hours calculation
[Living Wage Calculation]—MIT calculator for family size
[Company]—Corporate entity from context
[Platform]—Tech company identification
[University]—Educational institution
[Mayor Name]—City-specific elected official
[Your Connection to the University]—User-specific context
```

### Resolution Challenge:

Each variable requires:

1. **Context extraction** (where is user? what company?)
2. **Data source query** (trusted APIs only)
3. **Fallback strategy** (when data unavailable)
4. **Citation requirement** (source attribution)

## Architecture

### Phase 1: Data Provider Registry

Create extensible system for verified data sources:

```typescript
interface DataProvider {
	id: string;
	type: 'api' | 'database' | 'agent';
	trustScore: number;
	capabilities: string[];
	rateLimit: RateLimitConfig;
	authenticate(): Promise<void>;
	query(params: QueryParams): Promise<DataResult>;
}
```

**Providers needed:**

- Census/ACS (demographics, income)
- BLS (wages, employment)
- HUD (housing costs)
- CMS (healthcare providers)
- Google Civic (elected officials)
- SEC EDGAR (corporate data)
- IPEDS (universities)
- MIT Living Wage (calculations)

### Phase 2: Variable Resolution Engine

```typescript
interface VariableResolver {
  pattern: RegExp
  requiredContext: string[]
  dataProviders: DataProvider[]

  async resolve(context: UserContext): Promise<{
    value: string | null
    source: string
    confidence: number
    timestamp: Date
  }>
}
```

**Resolution pipeline:**

1. Parse template → identify variables
2. Extract user context (location, target entity)
3. Query appropriate data providers
4. Agent orchestrates multiple sources if needed
5. Return resolved value with citation

### Phase 3: Agent-Safe Orchestration

Agent can:

- **Analyze** template to identify data needs
- **Query** verified providers only
- **Compose** multiple data points
- **Cannot** generate/hallucinate data

```typescript
class AgentResolver {
	async resolveTemplate(template: Template, user: User) {
		// Agent identifies needed data
		const variables = this.extractVariables(template);

		// Query trusted sources only
		const resolved = await Promise.all(variables.map((v) => this.resolveVariable(v, user)));

		// No hallucination - only real data or explicit "unavailable"
		return this.applyResolutions(template, resolved);
	}
}
```

### Phase 4: Trust & Verification

Every resolved value includes:

```typescript
interface ResolvedValue {
  variable: string
  value: string
  source: {
    provider: string
    url?: string
    timestamp: Date
    confidence: 0-1
  }
  userEditable: boolean
}
```

UI shows sources:

```
Average rent: $2,850/month
Source: HUD Fair Market Rent, San Francisco MSA, 2024
[Edit]
```

## Implementation Strategy

### Core Infrastructure

**Files to create:**

- `src/lib/server/data-providers/`
  - `census.ts`—Census/ACS API
  - `bls.ts`—Bureau of Labor Statistics
  - `hud.ts`—HUD housing data
  - `civic.ts`—Google Civic Information
  - `cms.ts`—Healthcare provider data
  - `sec.ts`—Corporate information
  - `mit-living-wage.ts`: Living wage calculator

- `src/lib/server/variable-resolver.ts`: Main resolution engine
- `src/lib/server/agent-resolver.ts`: AI orchestration layer
- `src/lib/server/resolution-cache.ts`: Cache expensive API calls

### Database Schema Updates

```prisma
model ResolvedVariable {
  id            String   @id @default(cuid())
  templateId    String
  userId        String
  variable      String
  value         String
  source        Json
  confidence    Float
  resolvedAt    DateTime @default(now())
  expiresAt     DateTime

  @@index([templateId, userId, variable])
  @@map("resolved_variable")
}
```

### Testing Strategy

- Mock data providers for unit tests
- Integration tests with real APIs (rate limited)
- Agent safety tests (no hallucination)
- Fallback scenario coverage

## Priority Order

1. **Census/BLS integration**—Core economic data
2. **Google Civic API**—Elected officials
3. **HUD data**—Housing costs
4. **Healthcare providers**—CMS integration
5. **Corporate data**—SEC EDGAR
6. **University data**—IPEDS
7. **Living wage**—MIT calculator API
8. **Agent orchestration**—Tie it all together

## Success Metrics

- All template variables resolve or explicitly fail
- Every value has source attribution
- No hallucinated data ever
- Cache hit rate > 80% for common queries
- Resolution time < 2s for full template

## The Vision

User clicks "Send Message" and in milliseconds:

- Location determines relevant data sources
- Real rent prices, real wages, real officials
- Every number cited and verified
- Template becomes powerful truth-telling tool
- No bullshit, only facts

This is how we transform templates from aspirational placeholders into weapons of verified truth.

## Clojure-Inspired Functional Paradigm

The resolution system follows functional programming principles inspired by Clojure:

### Pure Functions

Each resolver is a pure function with no side effects:

```typescript
const rentResolver = compose(extractLocation, queryHUDData, formatCurrency, addSourceAttribution);
```

### Immutable Data Flow

Template resolution creates new data structures, never mutates:

```typescript
const resolved = template
  |> parseVariables
  |> mapResolvers
  |> awaitResolution
  |> applyToTemplate
```

### Lazy Evaluation

Variables resolve on-demand, not eagerly:

```typescript
const lazyResolvers = new Map(variables.map((v) => [v, () => resolveVariable(v)]));
```

### Composable Transformations

Complex resolutions built from simple functions:

```typescript
const livingWageResolver = pipe(
	getUserLocation,
	getFamilySize,
	queryMITCalculator,
	adjustForLocalCost,
	formatWithSource
);
```

This functional approach ensures:

- Predictable resolution behavior
- Easy testing of individual components
- Safe agent composition
- No hidden state or side effects
