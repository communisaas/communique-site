# Senate CWC Worker Lambda Function

AWS Lambda function for processing Senate Congressional Web Communication (CWC) submissions from SQS FIFO queues. This worker integrates with the existing Communique infrastructure to handle asynchronous Senate message submissions with rate limiting, error handling, and job status tracking.

## 🏗️ Architecture Overview

```
SQS FIFO Queue (senate-submissions.fifo)
    ↓
Lambda Function (senate-worker)
    ↓
- Rate Limit Check (DynamoDB)
- CWC API Submission (Senate endpoint)
- Job Status Update (Communique API)
    ↓
Success: Complete, Failure: Retry → DLQ
```

## 📦 Features

- **SQS FIFO Processing**: Ordered message processing with MessageGroupId = `senator-{bioguideId}`
- **Rate Limiting**: DynamoDB-based rate limiting (10 submissions per hour per user)
- **Idempotency**: Duplicate message handling and retry protection
- **Partial Batch Processing**: Individual message failures don't block the entire batch
- **Comprehensive Logging**: Structured logging for monitoring and debugging
- **Error Recovery**: Intelligent retry logic with exponential backoff to DLQ
- **Job Status Integration**: Real-time updates to Communique job status API

## 🚀 Deployment

### Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Node.js 18+** installed locally
3. **DynamoDB table** for rate limiting (see configuration below)
4. **SQS FIFO queue** configured with appropriate DLQ
5. **IAM role** with necessary permissions

### Build and Deploy

```bash
# Install dependencies
npm install

# Build the Lambda package
npm run build

# Create deployment package
npm run package

# Deploy to AWS Lambda (requires function to exist)
npm run deploy

# Or deploy manually
aws lambda update-function-code \
  --function-name communique-senate-worker \
  --zip-file fileb://senate-worker.zip
```

### Lambda Configuration

```yaml
Function Name: communique-senate-worker
Runtime: Node.js 18.x
Handler: index.handler
Memory: 512 MB
Timeout: 60 seconds
Reserved Concurrency: 5
Architecture: x86_64

Dead Letter Queue:
  Target ARN: arn:aws:sqs:region:account:senate-submissions-dlq
```

## 🔧 Environment Variables

| Variable                     | Required | Description                      | Example                          |
| ---------------------------- | -------- | -------------------------------- | -------------------------------- |
| `CWC_API_KEY`                | ✅       | Senate CWC API key               | `abc123...`                      |
| `CWC_API_BASE_URL`           | ✅       | CWC API base URL                 | `https://soapbox.senate.gov/api` |
| `DYNAMO_TABLE_NAME`          | ✅       | DynamoDB table for rate limiting | `communique-rate-limits`         |
| `JOB_STATUS_API_URL`         | ✅       | Communique job status API URL    | `https://app.communique.com`     |
| `LAMBDA_WEBHOOK_SECRET`      | ✅       | Secret for job status API auth   | `secret123...`                   |
| `MAX_RETRIES`                | ❌       | Maximum retry attempts           | `3`                              |
| `RATE_LIMIT_WINDOW_SECONDS`  | ❌       | Rate limit window in seconds     | `3600`                           |
| `RATE_LIMIT_COUNT`           | ❌       | Max submissions per window       | `10`                             |
| `VISIBILITY_TIMEOUT_SECONDS` | ❌       | SQS visibility timeout           | `300`                            |

## 🗄️ DynamoDB Table Configuration

### Table: communique-rate-limits

```yaml
Partition Key: userId (String)
Sort Key: action (String)
Billing Mode: On-Demand
TTL Attribute: ttl

GSI (Optional): action-timestamp-index
  Partition Key: action (String)
  Sort Key: timestamp (Number)
```

### Sample Item Structure

```json
{
	"userId": "user_12345",
	"action": "senate_submission",
	"count": 3,
	"timestamp": 1701234567,
	"ttl": 1701238167
}
```

### IAM Permissions

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

## 📨 SQS Configuration

### Queue: senate-submissions.fifo

```yaml
Queue Type: FIFO
Content-Based Deduplication: Enabled
MessageGroupId: senator-{bioguideId}
VisibilityTimeout: 300 seconds
MessageRetentionPeriod: 1209600 seconds (14 days)
ReceiveMessageWaitTime: 20 seconds (long polling)

Dead Letter Queue:
  Queue: senate-submissions-dlq
  MaxReceiveCount: 3
```

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

## 🔍 Lambda IAM Role

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
			"Resource": "arn:aws:sqs:region:account:senate-submissions.fifo"
		},
		{
			"Effect": "Allow",
			"Action": ["sqs:SendMessage"],
			"Resource": "arn:aws:sqs:region:account:senate-submissions-dlq"
		},
		{
			"Effect": "Allow",
			"Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
			"Resource": "arn:aws:dynamodb:region:account:table/communique-rate-limits"
		}
	]
}
```

## 📊 Monitoring and Logging

### CloudWatch Metrics

The Lambda function emits custom metrics and logs:

- **Duration**: Execution time per invocation
- **Errors**: Failed invocations and error rates
- **Throttles**: Concurrency throttling events
- **Dead Letter Errors**: Messages sent to DLQ

### Structured Logging

All logs include structured data for easy querying:

```json
{
	"timestamp": "2024-01-01T12:00:00.000Z",
	"level": "INFO",
	"requestId": "abc-123-def",
	"message": "Processing Senate submission",
	"jobId": "job_uuid",
	"messageId": "msg_uuid",
	"senatorName": "Bernie Sanders",
	"senatorState": "VT",
	"userId": "user_456"
}
```

### Alerts

Recommended CloudWatch alarms:

1. **Error Rate > 5%**: Critical alert for high failure rate
2. **Duration > 45s**: Warning for slow executions
3. **DLQ Messages > 0**: Critical alert for messages in DLQ
4. **Throttles > 0**: Warning for concurrency issues

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

### Integration Testing

1. **Local Testing**: Test with sample SQS events
2. **DynamoDB Local**: Test rate limiting locally
3. **CWC API Testing**: Use testing endpoint for validation

### Sample Test Event

```json
{
	"Records": [
		{
			"messageId": "test-message-id",
			"receiptHandle": "test-receipt-handle",
			"body": "{\"jobId\":\"test-job\",\"messageId\":\"test-msg\",\"templateId\":\"test-template\",\"userId\":\"test-user\",\"template\":{},\"user\":{},\"senator\":{},\"personalizedMessage\":\"Test message\"}",
			"attributes": {
				"ApproximateReceiveCount": "1",
				"SentTimestamp": "1701234567000",
				"MessageGroupId": "senator-S000033",
				"MessageDeduplicationId": "test-dedup-id"
			},
			"messageAttributes": {},
			"md5OfBody": "test-md5",
			"eventSource": "aws:sqs",
			"eventSourceARN": "arn:aws:sqs:region:account:senate-submissions.fifo",
			"awsRegion": "us-east-1"
		}
	]
}
```

## 🛡️ Security

### Security Best Practices

1. **Least Privilege IAM**: Function only has required permissions
2. **Encrypted Environment Variables**: Sensitive values encrypted at rest
3. **VPC Configuration**: Optional VPC deployment for additional isolation
4. **Input Validation**: All input data validated before processing
5. **Rate Limiting**: Protection against abuse and spam

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

## 🚨 Error Handling

### Error Categories

1. **Retryable Errors**: Network issues, HTTP 5xx, rate limits
   - Action: Return to SQS for retry with exponential backoff
   - Max Retries: 3 attempts before DLQ

2. **Non-Retryable Errors**: Invalid JSON, XML validation, authentication
   - Action: Send immediately to DLQ with error details

3. **Rate Limit Errors**: User exceeded submission limits
   - Action: Extend visibility timeout, retry later

### DLQ Processing

Messages in the DLQ require manual intervention:

1. **Investigation**: Review CloudWatch logs for error details
2. **Correction**: Fix data issues or configuration problems
3. **Reprocessing**: Move corrected messages back to main queue

## 🔄 Operational Procedures

### Deployment Checklist

- [ ] Environment variables configured
- [ ] DynamoDB table created and accessible
- [ ] SQS queue and DLQ configured
- [ ] IAM permissions verified
- [ ] Lambda function tests passing
- [ ] CloudWatch alarms configured
- [ ] Job status API integration tested

### Rollback Procedure

1. **Immediate**: Update Lambda alias to previous version
2. **Verification**: Test with sample messages
3. **Monitoring**: Watch metrics for 30 minutes
4. **Communication**: Notify team of rollback completion

### Scaling Considerations

- **Reserved Concurrency**: Set to 5 to prevent overwhelming CWC API
- **SQS Batch Size**: Default 10, can increase for higher throughput
- **Rate Limits**: Adjust based on CWC API capacity
- **DynamoDB**: Auto-scaling enabled for increased load

## 📞 Support

### Troubleshooting

1. **Check CloudWatch Logs**: Search by `requestId` or `jobId`
2. **Review DLQ Messages**: Identify patterns in failed messages
3. **Monitor Metrics**: Look for unusual patterns in execution
4. **Test Connectivity**: Verify CWC API and DynamoDB access

### Contact

- **Development Team**: `dev@communique.com`
- **Operations**: `ops@communique.com`
- **Emergency**: Use AWS Support for critical infrastructure issues

---

_This Lambda function is part of the Communique advocacy platform's infrastructure for scalable congressional message delivery._
