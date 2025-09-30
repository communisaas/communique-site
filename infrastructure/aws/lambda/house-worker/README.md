# House CWC Worker Lambda Function

AWS Lambda function for processing House of Representatives CWC (Congressional Web Contact) submissions through an existing GCP proxy infrastructure. This worker maintains the whitelisted IP address requirements for House.gov while providing reliable, rate-limited message processing.

## Overview

The House Worker processes SQS FIFO messages containing civic engagement submissions to House representatives. All submissions are routed through an existing GCP VM proxy to maintain IP whitelist compliance with House.gov systems.

### Key Features

- **SQS FIFO Processing**: Ordered message processing with per-office grouping
- **GCP Proxy Integration**: Routes all requests through whitelisted IP infrastructure
- **Rate Limiting**: 2 requests/minute per House office via DynamoDB
- **Circuit Breaker Protection**: Prevents cascading failures when proxy is unavailable
- **Comprehensive Monitoring**: CloudWatch metrics, alarms, and structured logging
- **Partial Batch Failure Handling**: Selective message retry without full batch reprocessing

## Architecture

```
SQS FIFO Queue → Lambda Function → GCP Proxy → House.gov CWC API
                      ↓
                 DynamoDB Rate Limiter
                      ↓
                 Job Status API
```

### Components

- **Main Handler** (`index.ts`): SQS event processing and orchestration
- **GCP Proxy Client** (`gcp-proxy-client.ts`): HTTP client with retry logic and authentication
- **Circuit Breaker** (`circuit-breaker.ts`): Failure protection and automatic recovery
- **Rate Limiter**: DynamoDB-based per-office request throttling
- **Infrastructure**: CloudFormation templates for AWS resources

## Configuration

### Environment Variables

| Variable               | Description                             | Required | Default           |
| ---------------------- | --------------------------------------- | -------- | ----------------- |
| `RATE_LIMIT_TABLE`     | DynamoDB table for rate limiting        | Yes      | `cwc-rate-limits` |
| `JOB_STATUS_API_URL`   | Job status update endpoint              | Yes      | -                 |
| `GCP_PROXY_URL`        | GCP proxy submission endpoint           | Yes      | -                 |
| `GCP_PROXY_AUTH_TOKEN` | Authentication token for GCP proxy      | Yes      | -                 |
| `API_AUTH_TOKEN`       | Authentication token for job status API | Yes      | -                 |
| `AWS_REGION`           | AWS region                              | No       | `us-east-1`       |

### Lambda Configuration

- **Runtime**: Node.js 20.x
- **Memory**: 512MB
- **Timeout**: 120 seconds
- **Reserved Concurrency**: 2 (strict limit for House processing)
- **SQS Batch Size**: 1 (process one message at a time)

### Rate Limiting

- **Per-Office Limit**: 2 requests per minute per House office
- **Implementation**: DynamoDB with TTL for automatic cleanup
- **Enforcement**: Pre-submission check with graceful retry handling

## Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js 20+** for local development and testing
3. **GCP Proxy** infrastructure already deployed and configured
4. **VPC Configuration** with private subnets for Lambda deployment

### Build and Deploy

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check and lint
npm run validate

# Build for deployment
npm run build

# Package for Lambda
npm run package

# Deploy via CloudFormation
aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name house-cwc-worker-production \
  --parameter-overrides \
    Environment=production \
    VpcId=vpc-12345678 \
    SubnetIds=subnet-12345678,subnet-87654321 \
    GcpProxyUrl=https://your-gcp-proxy.com/submit \
    GcpProxyAuthToken=your-auth-token \
    ApiAuthToken=your-api-token \
  --capabilities CAPABILITY_IAM

# Update Lambda function code
aws lambda update-function-code \
  --function-name house-cwc-worker-production \
  --zip-file fileb://dist/house-worker.zip
```

### Infrastructure Resources

The CloudFormation template creates:

- **Lambda Function** with VPC configuration
- **SQS FIFO Queue** with dead letter queue
- **DynamoDB Table** for rate limiting
- **IAM Roles and Policies** with least privilege
- **CloudWatch Alarms** for monitoring
- **Security Groups** for network access

## Message Format

### Input (SQS Message Body)

```json
{
	"jobId": "job-12345",
	"officeCode": "CA01",
	"recipientName": "Rep. John Doe",
	"recipientEmail": "rep.doe@house.gov",
	"subject": "Healthcare Policy Feedback",
	"message": "I am writing to express my views on...",
	"senderName": "Jane Smith",
	"senderEmail": "jane@example.com",
	"senderAddress": "123 Main St, Anytown, CA 90210",
	"senderPhone": "+1-555-123-4567",
	"priority": "normal",
	"metadata": {
		"source": "web",
		"userAgent": "Mozilla/5.0..."
	}
}
```

### SQS Configuration

- **Message Group ID**: `office-{officeCode}` (ensures per-office ordering)
- **Message Deduplication**: Content-based deduplication enabled
- **Visibility Timeout**: 6 minutes (3x Lambda timeout)
- **Max Receive Count**: 3 (before moving to DLQ)

## Error Handling

### Rate Limiting

When an office exceeds the 2 requests/minute limit:

1. Message processing is temporarily suspended
2. Job status is updated to `rate_limited`
3. Message remains in queue for automatic retry
4. Extended visibility timeout prevents immediate reprocessing

### GCP Proxy Failures

The circuit breaker pattern protects against proxy failures:

- **Closed State**: Normal operation, all requests pass through
- **Open State**: After 5 failures, requests fail fast for 30 seconds
- **Half-Open State**: Test requests to check if service recovered

### Retry Logic

- **Network Errors**: Exponential backoff with jitter (1s, 2s, 4s)
- **Rate Limiting (429)**: Retryable with backoff
- **Server Errors (5xx)**: Retryable with backoff
- **Client Errors (4xx)**: Non-retryable (except 429)

### Partial Batch Failures

Lambda returns `batchItemFailures` for selective retry:

```json
{
	"batchItemFailures": [{ "itemIdentifier": "message-id-that-failed" }]
}
```

## Monitoring

### CloudWatch Metrics

- **Lambda Errors**: Function execution errors
- **Lambda Duration**: Execution time monitoring
- **SQS Queue Depth**: Backlog monitoring
- **DLQ Depth**: Failed message monitoring

### CloudWatch Alarms

- **Error Rate**: > 5 errors in 10 minutes
- **High Duration**: Average > 60 seconds
- **Queue Backlog**: > 10 messages waiting
- **DLQ Messages**: Any messages in dead letter queue

### Structured Logging

```json
{
	"timestamp": "2024-01-15T10:30:00.000Z",
	"level": "INFO",
	"message": "Processing House CWC submission",
	"jobId": "job-12345",
	"officeCode": "CA01",
	"circuitBreakerState": "CLOSED",
	"processingTimeMs": 1500
}
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Integration Testing

Test with actual GCP proxy (staging environment):

```bash
# Set staging environment variables
export GCP_PROXY_URL=https://staging-proxy.com/submit
export GCP_PROXY_AUTH_TOKEN=staging-token

# Run integration tests
npm run test:integration
```

### Load Testing

Simulate rate limiting scenarios:

```bash
# Send multiple messages for same office
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/house-cwc-queue-staging.fifo \
  --message-body file://test-message.json \
  --message-group-id office-CA01 \
  --message-deduplication-id $(uuidgen)
```

## Security

### Network Security

- **VPC Deployment**: Lambda runs in private subnets
- **Security Groups**: Outbound HTTPS only to GCP proxy and APIs
- **KMS Encryption**: SQS messages and DynamoDB data encrypted

### Authentication

- **GCP Proxy**: Bearer token authentication
- **Job Status API**: Bearer token authentication
- **AWS Services**: IAM role-based access

### Data Protection

- **Sensitive Data**: Auth tokens stored as SecureString parameters
- **Logging**: No PII in CloudWatch logs
- **Transit**: All communication over HTTPS

## Troubleshooting

### Common Issues

#### Messages stuck in queue

```bash
# Check queue attributes
aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names All

# Check Lambda function logs
aws logs tail /aws/lambda/house-cwc-worker-production --follow
```

#### Rate limiting not working

```bash
# Check DynamoDB rate limit records
aws dynamodb scan \
  --table-name cwc-rate-limits-production \
  --filter-expression "begins_with(pk, :office)" \
  --expression-attribute-values '{":office": {"S": "office-"}}'
```

#### Circuit breaker stuck open

```bash
# Check function logs for circuit breaker state changes
aws logs filter-log-events \
  --log-group-name /aws/lambda/house-cwc-worker-production \
  --filter-pattern "Circuit breaker"
```

#### GCP proxy connectivity issues

```bash
# Test proxy health from Lambda
aws lambda invoke \
  --function-name house-cwc-worker-production \
  --payload '{"test": "health-check"}' \
  response.json
```

### Log Analysis

Search CloudWatch logs for specific patterns:

```bash
# Find rate limit violations
aws logs filter-log-events \
  --log-group-name /aws/lambda/house-cwc-worker-production \
  --filter-pattern "Rate limit exceeded"

# Find circuit breaker activations
aws logs filter-log-events \
  --log-group-name /aws/lambda/house-cwc-worker-production \
  --filter-pattern "Circuit breaker state transition"

# Find GCP proxy errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/house-cwc-worker-production \
  --filter-pattern "GCP proxy"
```

## Performance Optimization

### Cold Start Reduction

- **Provisioned Concurrency**: Consider for high-volume periods
- **Bundle Optimization**: Webpack configuration minimizes package size
- **Connection Reuse**: HTTP client reuses connections where possible

### Memory Optimization

- **Current**: 512MB (balance between performance and cost)
- **Monitoring**: Watch for memory usage patterns
- **Adjustment**: Increase if processing time vs memory cost warrants

### Concurrency Management

- **Reserved Concurrency**: 2 (protects House.gov from overload)
- **SQS Integration**: Automatic scaling within concurrency limits
- **Circuit Breaker**: Prevents resource waste during proxy outages

## Maintenance

### Regular Tasks

1. **Monitor Alarms**: Review CloudWatch alarms weekly
2. **Review Logs**: Check for patterns in error logs
3. **Update Dependencies**: Monthly security updates
4. **Performance Review**: Quarterly optimization assessment

### Deployment Pipeline

1. **Development**: Local testing and validation
2. **Staging**: Full integration testing with staging proxy
3. **Production**: Blue-green deployment with monitoring
4. **Rollback**: Automatic rollback on alarm triggers

---

## Contributing

### Development Workflow

1. **Fork and Clone**: Standard GitHub workflow
2. **Install Dependencies**: `npm install`
3. **Run Tests**: `npm test` before commits
4. **Lint Code**: `npm run lint:fix`
5. **Submit PR**: Include test coverage for new features

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Zero tolerance for errors
- **Test Coverage**: >80% for all new code
- **Documentation**: Update README for public interfaces

For questions or support, contact the Communique infrastructure team.
