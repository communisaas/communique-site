# Communique CWC Integration - AWS CDK Infrastructure

This directory contains the complete AWS CDK infrastructure for deploying the Communique CWC (Correspond with Congress) integration system. The infrastructure supports asynchronous processing of congressional message submissions using Lambda functions, SQS queues, DynamoDB tables, and comprehensive monitoring.

## 🏗️ Architecture Overview

The infrastructure is organized into five main CDK stacks:

### 1. NetworkingStack

- **VPC** with public/private subnets across 2 AZs
- **Security Groups** for Lambda functions and VPC endpoints
- **VPC Endpoints** for AWS services (optional, cost-optimized)
- **VPC Flow Logs** for network monitoring (production/staging)

### 2. StorageStack

- **Rate Limiting Table** (DynamoDB) - Tracks API rate limits per user
- **Job Tracking Table** (DynamoDB) - Monitors submission status and progress
- **KMS Encryption** for data at rest (configurable)
- **Point-in-Time Recovery** for production environments
- **Automated Backups** with cross-region replication options

### 3. QueueStack

- **Senate Submissions Queue** (SQS FIFO) with dead letter queue
- **House Submissions Queue** (SQS FIFO) with dead letter queue
- **Content-based deduplication** to prevent duplicate submissions
- **Configurable retention periods** per environment

### 4. ComputeStack

- **Senate Worker Lambda** - Processes Senate CWC submissions
- **House Worker Lambda** - Processes House CWC submissions
- **IAM Roles** with least-privilege permissions
- **VPC Configuration** for secure networking
- **Reserved Concurrency** to control costs and prevent throttling

### 5. MonitoringStack

- **CloudWatch Dashboard** with comprehensive metrics
- **CloudWatch Alarms** for error rates, latencies, and queue depths
- **SNS Topic** for alarm notifications
- **AWS Budgets** for cost monitoring and alerts
- **Composite Alarms** for system health monitoring

## 📁 Directory Structure

```
infrastructure/aws/cdk/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   ├── networking-stack.ts # VPC and networking resources
│   ├── storage-stack.ts    # DynamoDB tables and encryption
│   ├── queue-stack.ts      # SQS queues and dead letter queues
│   ├── compute-stack.ts    # Lambda functions and IAM roles
│   ├── monitoring-stack.ts # CloudWatch resources and alarms
│   └── config/
│       ├── types.ts        # TypeScript interfaces
│       ├── dev.ts          # Development environment config
│       ├── staging.ts      # Staging environment config
│       ├── production.ts   # Production environment config
│       └── index.ts        # Configuration loader
├── package.json            # CDK dependencies
├── tsconfig.json           # TypeScript configuration
├── cdk.json                # CDK configuration
├── deploy.sh               # Deployment script
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js 18+** installed
3. **AWS CDK CLI** installed globally:
   ```bash
   npm install -g aws-cdk
   ```
4. **Docker** installed (for Lambda function bundling)

### Installation

1. **Clone and navigate to the CDK directory:**

   ```bash
   cd communique/infrastructure/aws/cdk
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the CDK code:**
   ```bash
   npm run build
   ```

### First-Time Setup (Bootstrap)

Before deploying, you need to bootstrap CDK in your AWS account:

```bash
# Bootstrap for development
./deploy.sh --bootstrap-only -e development

# Bootstrap for production (different account)
./deploy.sh --bootstrap-only -e production -p production-profile
```

### Deployment

#### Development Environment

```bash
# Deploy everything
./deploy.sh -e development

# Show diff without deploying
./deploy.sh --diff -e development

# Verbose deployment
./deploy.sh -e development -v
```

#### Staging Environment

```bash
./deploy.sh -e staging -p staging-profile
```

#### Production Environment

```bash
# Production requires additional confirmation
./deploy.sh -e production -p production-profile
```

### Monitoring Deployment

After deployment, you can monitor the system using:

```bash
# View CloudWatch dashboard
aws cloudwatch get-dashboard \
  --dashboard-name Communique-Dev-CWC \
  --region us-east-1

# Check Lambda function logs
aws logs tail /aws/lambda/communique-dev-senate-worker \
  --region us-east-1 --follow

# Monitor SQS queue
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url \
    --queue-name communique-dev-senate-submissions.fifo \
    --query QueueUrl --output text) \
  --attribute-names All
```

## ⚙️ Configuration

### Environment-Specific Configuration

Each environment has its own configuration file in `lib/config/`:

- **Development** (`dev.ts`): Minimal resources, cost-optimized
- **Staging** (`staging.ts`): Production-like with reduced limits
- **Production** (`production.ts`): Full monitoring, backups, encryption

### Key Configuration Options

#### Cost Optimization

```typescript
// Development: Minimal NAT, no VPC endpoints
enableNatGateway: false,
enableVpcEndpoints: false,

// Production: Full redundancy
enableNatGateway: true,
enableVpcEndpoints: true,
```

#### Security Settings

```typescript
security: {
  enableKmsEncryption: true,    // Customer-managed encryption
  kmsKeyRotation: true,         // Annual key rotation
  enableVpcEndpoints: true      // Private AWS service access
}
```

#### Monitoring Configuration

```typescript
monitoring: {
  enableXray: true,             // Distributed tracing
  enableDetailedMonitoring: true, // Enhanced metrics
  alarmEmail: 'alerts@communique.app',
  dashboardName: 'Communique-Production-CWC'
}
```

### Lambda Configuration

Lambda functions are configured with environment-specific settings:

```typescript
lambda: {
  timeout: 900,                 // 15 minutes max
  memorySize: 2048,            // 2GB for production
  reservedConcurrency: 50,     // Prevent runaway costs
  environment: {
    NODE_ENV: 'production',
    LOG_LEVEL: 'warn',
    RATE_LIMIT_TABLE: 'communique-rate-limits',
    JOB_TRACKING_TABLE: 'communique-job-tracking'
  }
}
```

## 📊 Monitoring and Alerting

### CloudWatch Dashboard

The system includes a comprehensive CloudWatch dashboard with:

- **Lambda Function Metrics**: Invocations, errors, duration, throttles
- **SQS Queue Metrics**: Message depth, age, throughput
- **DynamoDB Metrics**: Read/write capacity, throttling
- **Custom Business Metrics**: Success rates, API response times

### Alarms and Notifications

#### Automatic Alarms

- Lambda error rates above threshold
- Queue message age exceeding limits
- DLQ messages indicating failures
- High Lambda duration (approaching timeout)
- DynamoDB throttling events

#### Composite Alarms

- **System Health**: Overall system status
- **High Latency**: Performance degradation alerts

#### Budget Alerts

- 80% of monthly budget consumed
- Forecasted to exceed budget

### SNS Notifications

All alarms send notifications via SNS to configured email addresses:

```bash
# Subscribe to alarm notifications
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:communique-alarms \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## 🛡️ Security

### IAM Roles and Policies

Lambda functions use least-privilege IAM roles with:

- **DynamoDB**: Read/write access to specific tables only
- **SQS**: Consume messages from designated queues only
- **CloudWatch**: Log writing permissions
- **SSM/Secrets Manager**: Access to configuration secrets
- **KMS**: Encryption/decryption for data at rest

### Network Security

- **VPC Isolation**: Lambda functions run in private subnets
- **Security Groups**: Restrict network access to required services
- **VPC Endpoints**: Private access to AWS services (no internet)
- **NAT Gateway**: Controlled internet access for CWC API calls

### Data Encryption

- **In Transit**: TLS 1.2+ for all connections
- **At Rest**: KMS encryption for DynamoDB and SQS
- **Key Management**: Customer-managed KMS keys with rotation

## 💰 Cost Optimization

### Development Environment

- **Single NAT Gateway**: Reduces networking costs
- **No VPC Endpoints**: Eliminates interface endpoint charges
- **Reduced Lambda Memory**: 512MB vs 2GB production
- **Shorter Log Retention**: 7 days vs 30 days production
- **Pay-per-Request DynamoDB**: No provisioned capacity

### Production Environment

- **Reserved Concurrency**: Prevents runaway Lambda costs
- **VPC Endpoints**: Reduces NAT Gateway data transfer costs
- **CloudWatch Log Retention**: Balanced retention periods
- **Budget Alerts**: Proactive cost monitoring

### Monthly Cost Estimates

| Environment | Estimated Monthly Cost |
| ----------- | ---------------------- |
| Development | $25-50                 |
| Staging     | $75-150                |
| Production  | $200-500               |

_Costs depend on usage volume and may vary_

## 🔧 Maintenance

### Regular Tasks

#### Weekly

- Review CloudWatch alarms and metrics
- Check budget alerts and cost trends
- Monitor DLQ messages for failed submissions

#### Monthly

- Review and rotate access keys
- Update Lambda function dependencies
- Analyze performance metrics and optimize

#### Quarterly

- Review and update security groups
- Update CDK and AWS CLI versions
- Conduct disaster recovery testing

### Troubleshooting

#### Common Issues

**Lambda Function Timeouts**

```bash
# Check function duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=communique-senate-worker \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum
```

**High SQS Queue Depth**

```bash
# Check queue attributes
aws sqs get-queue-attributes \
  --queue-url YOUR_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages,ApproximateAgeOfOldestMessage
```

**DynamoDB Throttling**

```bash
# Check throttle metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=communique-rate-limits \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-02T00:00:00Z \
  --period 300 \
  --statistics Sum
```

### Backup and Recovery

#### DynamoDB Backups

- **Point-in-Time Recovery**: Enabled for production/staging
- **Daily Backups**: Automated via AWS Backup service
- **Cross-Region Backup**: Available for disaster recovery

#### Lambda Function Recovery

- **Source Code**: Stored in Git repository
- **Environment Variables**: Managed via CDK configuration
- **IAM Roles**: Automatically recreated during deployment

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy CWC Infrastructure

on:
  push:
    branches: [main]
    paths: ['infrastructure/aws/cdk/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy Infrastructure
        run: |
          cd infrastructure/aws/cdk
          npm install
          npm run build
          ./deploy.sh -e staging --skip-bootstrap
```

## 📞 Support

### Getting Help

1. **Documentation**: Check this README and AWS CDK documentation
2. **Logs**: Review CloudWatch logs for detailed error information
3. **Metrics**: Use CloudWatch dashboard for system health
4. **Issues**: Report issues via the project's issue tracker

### Emergency Procedures

#### System Down

1. Check CloudWatch dashboard for system health
2. Review recent alarm notifications
3. Check DLQ messages for failed submissions
4. Review Lambda function logs for errors

#### High Costs

1. Check AWS Billing dashboard
2. Review Budget alerts
3. Check Lambda concurrent executions
4. Review NAT Gateway data transfer costs

#### Security Incident

1. Review CloudTrail logs for unauthorized access
2. Rotate access keys and secrets
3. Review IAM role permissions
4. Check VPC flow logs for suspicious traffic

---

## 📝 License

This infrastructure code is part of the Communique project and is licensed under the MIT License. See the main project LICENSE file for details.

## 🤝 Contributing

Contributions to improve the infrastructure are welcome! Please:

1. Follow the existing code structure and patterns
2. Update configuration for all environments
3. Add appropriate monitoring and alarms
4. Test changes in development environment first
5. Update documentation for any changes

---

_For more information about the Communique project, see the main project README._
