# Production Deployment Checklist

## Pre-Deployment Requirements

### ✅ Environment Variables

#### Required API Keys
```bash
# OpenAI (GPT-5 Series)
OPENAI_API_KEY=sk-...
OPENAI_ORGANIZATION=org-... # Optional but recommended

# Google AI (Gemini 2.5)
GOOGLE_AI_API_KEY=...

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Communique Core
NODE_ENV=production
PORT=3001
```

#### Optional Configuration
```bash
# Anthropic (Future)
ANTHROPIC_API_KEY=... # For Q4 2025

# Monitoring
METRICS_ENDPOINT=https://metrics.communique.ai/ingest
SENTRY_DSN=...
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW=60000 # 1 minute
RATE_LIMIT_MAX_REQUESTS=100

# Budget Limits
DEFAULT_USER_DAILY_LIMIT=10.00 # USD
SYSTEM_HOURLY_LIMIT=100.00 # USD
EMERGENCY_SHUTDOWN_THRESHOLD=500.00 # USD
```

### ✅ Infrastructure Setup

#### 1. Database Migration
```bash
# Run Prisma migrations
npx prisma migrate deploy

# Verify agent-agnostic fields exist
npx prisma studio # Check Template model
```

#### 2. Redis Configuration
```bash
# Verify Redis connection
redis-cli ping # Should return PONG

# Set cache TTLs
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb
```

#### 3. API Key Validation
```bash
# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Google AI connection
curl "https://generativelanguage.googleapis.com/v1/models?key=$GOOGLE_AI_API_KEY"
```

## Deployment Steps

### 1. Build Application

```bash
# Install dependencies
npm ci --production

# Build TypeScript
npm run build

# Run tests
npm run test

# Type checking
npm run typecheck
```

### 2. Docker Deployment

```bash
# Build Docker image
docker build -t communique/agents:latest .

# Run locally to test
docker run -p 3001:3001 \
  --env-file .env.production \
  communique/agents:latest

# Push to registry
docker push communique/agents:latest
```

### 3. Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: communique-agents
spec:
  replicas: 3
  selector:
    matchLabels:
      app: communique-agents
  template:
    metadata:
      labels:
        app: communique-agents
    spec:
      containers:
      - name: agents
        image: communique/agents:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: agent-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 4. Load Balancer Configuration

```nginx
# nginx.conf
upstream agents {
    least_conn;
    server agent-1:3001 max_fails=3 fail_timeout=30s;
    server agent-2:3001 max_fails=3 fail_timeout=30s;
    server agent-3:3001 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.communique.ai;
    
    location /agents/ {
        proxy_pass http://agents;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running agent processes
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Monitoring Setup

### 1. Health Checks

```typescript
// Health check endpoints
GET /health - Basic health check
GET /ready - Readiness check (DB + Redis + APIs)
GET /metrics - Prometheus metrics
```

### 2. Alerts Configuration

```yaml
# alerts.yaml
groups:
  - name: agent_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(agent_errors_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High agent error rate"
          
      - alert: BudgetExceeded
        expr: hourly_spending > 100
        for: 1m
        annotations:
          summary: "Hourly spending limit exceeded"
          
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.3
        for: 10m
        annotations:
          summary: "Cache hit rate below 30%"
```

### 3. Dashboard Metrics

Key metrics to monitor:
- **Processing Speed**: p50, p95, p99 latencies
- **Cost Tracking**: Hourly spend by provider
- **Error Rates**: By agent and stage
- **Cache Performance**: Hit rate, eviction rate
- **User Metrics**: Daily active users, templates processed

## Security Checklist

### ✅ API Security
- [ ] Rate limiting enabled
- [ ] API keys rotated monthly
- [ ] CORS properly configured
- [ ] Request signing for webhooks
- [ ] IP allowlisting for admin endpoints

### ✅ Data Protection
- [ ] PII stripped before AI processing
- [ ] Template anonymization working
- [ ] Audit logs configured
- [ ] Encryption at rest enabled
- [ ] TLS 1.3 for all connections

### ✅ Access Control
- [ ] Admin endpoints protected
- [ ] Service accounts with minimal permissions
- [ ] MFA for production access
- [ ] Secrets in secure vault (not env files)

## Performance Optimization

### 1. Caching Configuration

```typescript
// Redis cache settings
const cacheConfig = {
  // Agent responses
  agentResponse: {
    ttl: 3600, // 1 hour
    keyPrefix: 'agent:response:',
    maxSize: 10000
  },
  
  // Cost predictions
  costPrediction: {
    ttl: 1800, // 30 minutes
    keyPrefix: 'cost:predict:',
    maxSize: 5000
  },
  
  // User spending
  userSpending: {
    ttl: 300, // 5 minutes
    keyPrefix: 'user:spend:',
    maxSize: 10000
  }
};
```

### 2. Connection Pooling

```typescript
// Database connection pool
const dbPool = {
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

// Redis connection pool
const redisPool = {
  min: 2,
  max: 10,
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
};
```

### 3. Request Batching

```typescript
// Batch similar requests
const batchConfig = {
  maxBatchSize: 10,
  maxWaitTime: 100, // ms
  enabledForProviders: ['openai', 'google']
};
```

## Rollback Plan

### 1. Feature Flags

```typescript
const features = {
  'agent-consensus': true,
  'gpt-5-models': true,
  'gemini-2.5': true,
  'enhanced-caching': true,
  'budget-management': true
};
```

### 2. Rollback Procedure

```bash
# 1. Disable feature flag
curl -X POST https://api.communique.ai/admin/features \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"feature": "agent-consensus", "enabled": false}'

# 2. Revert to previous version
kubectl set image deployment/communique-agents \
  agents=communique/agents:v0.9.0

# 3. Clear cache if needed
redis-cli FLUSHDB

# 4. Verify rollback
curl https://api.communique.ai/agents/health
```

## Testing in Production

### 1. Canary Deployment

```yaml
# 10% traffic to new version
apiVersion: v1
kind: Service
metadata:
  name: agents-canary
spec:
  selector:
    app: communique-agents
    version: canary
  ports:
    - port: 3001
```

### 2. A/B Testing

```typescript
// A/B test configuration
const abTests = {
  'gpt5-vs-gemini': {
    enabled: true,
    trafficSplit: 0.5,
    metrics: ['cost', 'quality', 'speed']
  }
};
```

### 3. Smoke Tests

```bash
# Run smoke tests after deployment
npm run test:smoke

# Specific agent tests
npm run test:agents:screening
npm run test:agents:enhancement
npm run test:agents:consensus
```

## Emergency Procedures

### 🚨 High Cost Alert

1. **Immediate Actions**:
   ```bash
   # Pause all processing
   curl -X POST https://api.communique.ai/admin/agents/pause \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Investigation**:
   - Check `/metrics` for cost breakdown
   - Review recent high-cost templates
   - Verify no infinite loops in processing

3. **Recovery**:
   ```bash
   # Reset to safe defaults
   curl -X POST https://api.communique.ai/admin/agents/reset
   ```

### 🚨 API Provider Outage

1. **Automatic Fallback**:
   - System auto-switches to alternate providers
   - Check `/health` for provider status

2. **Manual Override**:
   ```bash
   # Force specific provider
   curl -X POST https://api.communique.ai/admin/agents/override \
     -d '{"provider": "google", "exclusive": true}'
   ```

### 🚨 Database Connection Issues

1. **Check Connection Pool**:
   ```bash
   # View pool stats
   curl https://api.communique.ai/admin/db/pool
   ```

2. **Reset Connections**:
   ```bash
   # Reset pool
   curl -X POST https://api.communique.ai/admin/db/reset-pool
   ```

## Post-Deployment Verification

### ✅ Functional Tests
- [ ] Process sample template through each flow
- [ ] Verify cost tracking accurate
- [ ] Check enhanced content quality
- [ ] Test rejection of toxic content
- [ ] Verify cache working

### ✅ Performance Tests
- [ ] Response time <3s for standard templates
- [ ] Can handle 100 req/min
- [ ] Cache hit rate >60%
- [ ] No memory leaks after 1 hour

### ✅ Integration Tests
- [ ] Database writes successful
- [ ] Redis caching functional
- [ ] API providers responding
- [ ] Webhook delivery working
- [ ] Monitoring data flowing

## Maintenance Schedule

### Daily
- Review error logs
- Check cost metrics
- Monitor cache performance

### Weekly
- Analyze agent performance metrics
- Review user feedback
- Update agent reliability scores

### Monthly
- Rotate API keys
- Review and optimize costs
- Update model configurations
- Security audit

## Support Contacts

- **On-Call Engineer**: oncall@communique.ai
- **Security Team**: security@communique.ai
- **Infrastructure**: infra@communique.ai
- **Product Team**: product@communique.ai

## Documentation

- [Architecture Guide](../agents/AGENT_ARCHITECTURE_2025.md)
- [Implementation Guide](../agents/IMPLEMENTATION_GUIDE.md)
- [API Reference](../agents/API_REFERENCE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

*Last Updated: September 2025*
*Checklist Version: 1.0.0*