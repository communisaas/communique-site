# AWS Lambda CWC Workers

**Unified documentation for House and Senate Congressional Web Contact (CWC) Lambda workers.**

---

## Overview

AWS Lambda functions for processing Congressional Web Contact submissions from SQS FIFO queues. These workers integrate with the Communique infrastructure to handle asynchronous message delivery to Congress with rate limiting, error handling, and job status tracking.

### Architecture

```
SQS FIFO Queue → Lambda Function → CWC API / GCP Proxy → Congressional Offices
                      ↓
                 DynamoDB Rate Limiter
                      ↓
                 Job Status API
```

### Shared Features

- **SQS FIFO Processing**: Ordered message processing with per-office/senator grouping
- **Rate Limiting**: DynamoDB-based throttling (office-specific limits)
- **Circuit Breaker Protection**: Prevents cascading failures during outages
- **Comprehensive Monitoring**: CloudWatch metrics, alarms, and structured logging
- **Partial Batch Failure Handling**: Selective message retry without full batch reprocessing
- **Idempotency**: Duplicate message handling and retry protection
- **Job Status Integration**: Real-time updates to Communique job status API

---

## House Worker

### Key Differences

- **Target**: House of Representatives offices
- **Rate Limit**: 2 requests per minute per House office
- **Identifier**: `officeCode` (e.g., "CA01")
- **Delivery**: Routes through GCP proxy to maintain IP whitelist compliance with House.gov
- **Reserved Concurrency**: 2 (strict limit for House processing)

### Architecture

```
SQS FIFO Queue → Lambda Function → GCP Proxy → House.gov CWC API
                      ↓
                 DynamoDB Rate Limiter
                      ↓
                 Job Status API
```

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
- **Reserved Concurrency**: 2
- **SQS Batch Size**: 1 (process one message at a time)

### Message Format

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

---

## Senate Worker

### Key Differences

- **Target**: Senate offices
- **Rate Limit**: 10 requests per hour per user
- **Identifier**: `bioguideId` (e.g., "S000033")
- **Delivery**: Direct CWC API submission (no proxy)
- **Reserved Concurrency**: 5

### Architecture

```
SQS FIFO Queue → Lambda Function → Senate CWC API → Senate Offices
                      ↓
                 DynamoDB Rate Limiter
                      ↓
                 Job Status API
```

### Environment Variables

| Variable                     | Description                      | Required | Default                          |
| ---------------------------- | -------------------------------- | -------- | -------------------------------- |
| `CWC_API_KEY`                | Senate CWC API key               | Yes      | -                                |
| `CWC_API_BASE_URL`           | CWC API base URL                 | Yes      | `https://soapbox.senate.gov/api` |
| `DYNAMO_TABLE_NAME`          | DynamoDB table for rate limiting | Yes      | `communique-rate-limits`         |
| `JOB_STATUS_API_URL`         | Communique job status API URL    | Yes      | -                                |
| `LAMBDA_WEBHOOK_SECRET`      | Secret for job status API auth   | Yes      | -                                |
| `MAX_RETRIES`                | Maximum retry attempts           | No       | `3`                              |
| `RATE_LIMIT_WINDOW_SECONDS`  | Rate limit window in seconds     | No       | `3600`                           |
| `RATE_LIMIT_COUNT`           | Max submissions per window       | No       | `10`                             |
| `VISIBILITY_TIMEOUT_SECONDS` | SQS visibility timeout           | No       | `300`                            |

### Lambda Configuration

- **Runtime**: Node.js 18.x
- **Memory**: 512MB
- **Timeout**: 60 seconds
- **Reserved Concurrency**: 5
- **Architecture**: x86_64

### Message Format

```json
{
	"jobId": "job_uuid_here",
	"templateId": "template_123",
	"userId": "user_456",
	"messageId": "unique_message_id",
	"template": {
		"id": "template_123",
		"title": "Support Climate Action",
		"message_body": "Dear Senator...",
		"subject": "Climate Action Needed"
	},
	"user": {
		"id": "user_456",
		"name": "John Doe",
		"email": "john@example.com",
		"street": "123 Main St",
		"city": "Anytown",
		"state": "CA",
		"zip": "12345"
	},
	"senator": {
		"bioguideId": "S000033",
		"name": "Bernie Sanders",
		"chamber": "senate",
		"officeCode": "SANDERS",
		"state": "VT",
		"district": "00",
		"party": "I"
	},
	"personalizedMessage": "Dear Senator Sanders, I urge you to...",
	"retryCount": 0
}
```

### SQS Configuration

- **Message Group ID**: `senator-{bioguideId}` (ensures per-senator ordering)
- **Message Deduplication**: Content-based deduplication enabled
- **Visibility Timeout**: 5 minutes
- **Max Receive Count**: 3 (before moving to DLQ)

---

## Common Configuration

### DynamoDB Rate Limiting

#### Table Structure

```yaml
Table Name: communique-rate-limits (Senate) / cwc-rate-limits (House)
Partition Key: userId (String) OR pk (String)
Sort Key: action (String) OR sk (String)
Billing Mode: On-Demand
TTL Attribute: ttl
```

#### Sample Item

```json
{
	"userId": "user_12345",
	"action": "senate_submission",
	"count": 3,
	"timestamp": 1701234567,
	"ttl": 1701238167
}
```

#### IAM Permissions

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
			"Resource": "arn:aws:dynamodb:region:account:table/communique-rate-limits"
		}
	]
}
```

### Error Handling

#### Rate Limiting

When an office/user exceeds rate limits:

1. Message processing is temporarily suspended
2. Job status is updated to `rate_limited`
3. Message remains in queue for automatic retry
4. Extended visibility timeout prevents immediate reprocessing

#### Circuit Breaker (House Worker)

Protects against GCP proxy failures:

- **Closed State**: Normal operation, all requests pass through
- **Open State**: After 5 failures, requests fail fast for 30 seconds
- **Half-Open State**: Test requests to check if service recovered

#### Retry Logic

- **Network Errors**: Exponential backoff with jitter (1s, 2s, 4s)
- **Rate Limiting (429)**: Retryable with backoff
- **Server Errors (5xx)**: Retryable with backoff
- **Client Errors (4xx)**: Non-retryable (except 429)

#### Error Categories

1. **Retryable Errors**: Network issues, HTTP 5xx, rate limits
   - Action: Return to SQS for retry with exponential backoff
   - Max Retries: 3 attempts before DLQ

2. **Non-Retryable Errors**: Invalid JSON, XML validation, authentication
   - Action: Send immediately to DLQ with error details

3. **Rate Limit Errors**: User/office exceeded submission limits
   - Action: Extend visibility timeout, retry later

#### Partial Batch Failures

Lambda returns `batchItemFailures` for selective retry:

```json
{
	"batchItemFailures": [{ "itemIdentifier": "message-id-that-failed" }]
}
```

---

## Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js 18+ or 20+** for local development and testing
3. **GCP Proxy** infrastructure (House worker only)
4. **VPC Configuration** with private subnets for Lambda deployment (optional)

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

# Deploy via CloudFormation (House Worker)
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
  --function-name [house|senate]-cwc-worker-production \
  --zip-file fileb://dist/[house|senate]-worker.zip
```

### Infrastructure Resources

The CloudFormation template creates:

- **Lambda Function** with VPC configuration (optional)
- **SQS FIFO Queue** with dead letter queue
- **DynamoDB Table** for rate limiting
- **IAM Roles and Policies** with least privilege
- **CloudWatch Alarms** for monitoring
- **Security Groups** for network access (if VPC-deployed)

### Lambda IAM Role

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
			"Resource": "arn:aws:logs:*:*:*"
		},
		{
			"Effect": "Allow",
			"Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
			"Resource": "arn:aws:sqs:region:account:[house|senate]-submissions.fifo"
		},
		{
			"Effect": "Allow",
			"Action": ["sqs:SendMessage"],
			"Resource": "arn:aws:sqs:region:account:[house|senate]-submissions-dlq"
		},
		{
			"Effect": "Allow",
			"Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
			"Resource": "arn:aws:dynamodb:region:account:table/cwc-rate-limits"
		}
	]
}
```

---

## Monitoring

### CloudWatch Metrics

- **Lambda Errors**: Function execution errors
- **Lambda Duration**: Execution time monitoring
- **SQS Queue Depth**: Backlog monitoring
- **DLQ Depth**: Failed message monitoring
- **Throttles**: Concurrency throttling events

### CloudWatch Alarms

- **Error Rate**: > 5 errors in 10 minutes
- **High Duration**: Average > 60 seconds (House) / 45 seconds (Senate)
- **Queue Backlog**: > 10 messages waiting
- **DLQ Messages**: Any messages in dead letter queue

### Structured Logging

```json
{
	"timestamp": "2024-01-15T10:30:00.000Z",
	"level": "INFO",
	"message": "Processing CWC submission",
	"requestId": "abc-123-def",
	"jobId": "job-12345",
	"messageId": "msg-12345",
	"officeCode": "CA01",
	"bioguideId": "S000033",
	"circuitBreakerState": "CLOSED",
	"processingTimeMs": 1500
}
```

---

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

Test with actual CWC API endpoints (staging environment):

```bash
# Set staging environment variables
export CWC_API_BASE_URL=https://staging-api.senate.gov/api
export CWC_API_KEY=staging-key

# Run integration tests
npm run test:integration
```

### Load Testing

Simulate rate limiting scenarios:

```bash
# Send multiple messages for same office/senator
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/house-cwc-queue.fifo \
  --message-body file://test-message.json \
  --message-group-id office-CA01 \
  --message-deduplication-id $(uuidgen)
```

### Sample Test Event

```json
{
	"Records": [
		{
			"messageId": "test-message-id",
			"receiptHandle": "test-receipt-handle",
			"body": "{\"jobId\":\"test-job\",\"officeCode\":\"CA01\"}",
			"attributes": {
				"ApproximateReceiveCount": "1",
				"SentTimestamp": "1701234567000",
				"MessageGroupId": "office-CA01",
				"MessageDeduplicationId": "test-dedup-id"
			},
			"messageAttributes": {},
			"md5OfBody": "test-md5",
			"eventSource": "aws:sqs",
			"eventSourceARN": "arn:aws:sqs:region:account:house-submissions.fifo",
			"awsRegion": "us-east-1"
		}
	]
}
```

---

## Security

### Security Best Practices

1. **Least Privilege IAM**: Functions only have required permissions
2. **Encrypted Environment Variables**: Sensitive values encrypted at rest
3. **VPC Configuration**: Optional VPC deployment for additional isolation
4. **Input Validation**: All input data validated before processing
5. **Rate Limiting**: Protection against abuse and spam
6. **Authentication**: Bearer token authentication for proxy and APIs
7. **Data Protection**: No PII in CloudWatch logs

### Secrets Management

Store sensitive configuration in AWS Systems Manager Parameter Store or AWS Secrets Manager:

```bash
# Store CWC API key
aws ssm put-parameter \
  --name "/communique/lambda/cwc-api-key" \
  --value "your-api-key" \
  --type "SecureString"

# Store webhook secret
aws ssm put-parameter \
  --name "/communique/lambda/webhook-secret" \
  --value "your-webhook-secret" \
  --type "SecureString"
```

---

## Troubleshooting

### Common Issues

#### Messages stuck in queue

```bash
# Check queue attributes
aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names All

# Check Lambda function logs
aws logs tail /aws/lambda/[house|senate]-cwc-worker-production --follow
```

#### Rate limiting not working

```bash
# Check DynamoDB rate limit records
aws dynamodb scan \
  --table-name cwc-rate-limits-production \
  --filter-expression "begins_with(pk, :office)" \
  --expression-attribute-values '{":office": {"S": "office-"}}'
```

#### Circuit breaker stuck open (House Worker)

```bash
# Check function logs for circuit breaker state changes
aws logs filter-log-events \
  --log-group-name /aws/lambda/house-cwc-worker-production \
  --filter-pattern "Circuit breaker"
```

#### GCP proxy connectivity issues (House Worker)

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
  --log-group-name /aws/lambda/[house|senate]-cwc-worker-production \
  --filter-pattern "Rate limit exceeded"

# Find circuit breaker activations (House)
aws logs filter-log-events \
  --log-group-name /aws/lambda/house-cwc-worker-production \
  --filter-pattern "Circuit breaker state transition"

# Find CWC API errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/[house|senate]-cwc-worker-production \
  --filter-pattern "CWC API"
```

### DLQ Processing

Messages in the DLQ require manual intervention:

1. **Investigation**: Review CloudWatch logs for error details
2. **Correction**: Fix data issues or configuration problems
3. **Reprocessing**: Move corrected messages back to main queue

---

## Performance Optimization

### Cold Start Reduction

- **Provisioned Concurrency**: Consider for high-volume periods
- **Bundle Optimization**: Webpack configuration minimizes package size
- **Connection Reuse**: HTTP clients reuse connections where possible

### Memory Optimization

- **Current**: 512MB (balance between performance and cost)
- **Monitoring**: Watch for memory usage patterns
- **Adjustment**: Increase if processing time vs memory cost warrants

### Concurrency Management

- **House Worker**: Reserved Concurrency = 2 (protects House.gov from overload)
- **Senate Worker**: Reserved Concurrency = 5 (CWC API capacity)
- **SQS Integration**: Automatic scaling within concurrency limits
- **Circuit Breaker**: Prevents resource waste during outages (House)

---

## Operational Procedures

### Deployment Checklist

- [ ] Environment variables configured
- [ ] DynamoDB table created and accessible
- [ ] SQS queue and DLQ configured
- [ ] IAM permissions verified
- [ ] Lambda function tests passing
- [ ] CloudWatch alarms configured
- [ ] Job status API integration tested
- [ ] GCP proxy connectivity verified (House only)

### Rollback Procedure

1. **Immediate**: Update Lambda alias to previous version
2. **Verification**: Test with sample messages
3. **Monitoring**: Watch metrics for 30 minutes
4. **Communication**: Notify team of rollback completion

### Maintenance

#### Regular Tasks

1. **Monitor Alarms**: Review CloudWatch alarms weekly
2. **Review Logs**: Check for patterns in error logs
3. **Update Dependencies**: Monthly security updates
4. **Performance Review**: Quarterly optimization assessment

#### Scaling Considerations

- **Reserved Concurrency**: Adjust based on CWC API capacity
- **SQS Batch Size**: Default 1 (House) / 10 (Senate), adjust for throughput
- **Rate Limits**: Coordinate with CWC API capacity changes
- **DynamoDB**: Auto-scaling enabled for increased load

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

---

## Support

### Contact

- **Development Team**: `dev@communique.com`
- **Operations**: `ops@communique.com`
- **Emergency**: Use AWS Support for critical infrastructure issues

---

*AWS Lambda CWC Workers are part of the Communique advocacy platform's infrastructure for scalable congressional message delivery.*
