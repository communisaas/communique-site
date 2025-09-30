# AWS Services for Communique CWC Integration

This directory contains AWS service integrations for the Communique platform, specifically designed to replace direct CWC (Communicating With Congress) API calls with asynchronous queue-based processing and distributed rate limiting.

## Overview

The AWS services provide reliable, scalable infrastructure for congressional messaging by:

- **Decoupling submission processing** from user-facing requests
- **Providing message durability** through AWS SQS FIFO queues
- **Implementing distributed rate limiting** using DynamoDB
- **Enabling batch processing** of congressional messages
- **Supporting retry mechanisms** for failed submissions
- **Improving system reliability** during high traffic periods
- **Preventing spam and gaming** through sophisticated rate controls

## Files

### `sqs-client.ts`

The main SQS client service that handles:

- Message queuing to separate Senate and House FIFO queues
- Message deduplication and ordering
- Environment-based AWS configuration
- Comprehensive error handling and logging
- Connection testing and monitoring

### `dynamodb-rate-limiter.ts`

Production-ready distributed rate limiting service that provides:

- **Multi-tier rate limiting** for Congressional chambers and offices
- **Token bucket algorithm** with DynamoDB atomic operations
- **Idempotency tracking** to prevent duplicate submissions
- **Automatic cleanup** with TTL for old rate limit records
- **Thread-safe operations** using DynamoDB conditional writes
- **Structured error handling** and observability logging

### `example-usage.ts`

Comprehensive examples demonstrating:

- How to send messages to individual senators
- How to send to all user representatives
- Connection testing and configuration validation
- Error handling patterns

## Environment Configuration

Required environment variables:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key    # Optional if using IAM roles
AWS_SECRET_ACCESS_KEY=your-secret    # Optional if using IAM roles

# SQS Queue URLs (must be FIFO queues)
CWC_SENATE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/cwc-senate-submissions.fifo
CWC_HOUSE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/cwc-house-submissions.fifo

# DynamoDB Tables for Rate Limiting
DYNAMODB_RATE_LIMIT_TABLE=prod-communique-rate-limits
DYNAMODB_IDEMPOTENCY_TABLE=prod-communique-idempotency

# Optional: Local DynamoDB for development
DYNAMODB_ENDPOINT=http://localhost:8000  # For local development only
```

## Queue Design

### FIFO Queue Configuration

Both Senate and House queues are FIFO (First-In-First-Out) queues with:

- **Message Grouping**:
  - Senate: `senator-{bioguideId}` (e.g., `senator-D000563`)
  - House: `office-{officeCode}` (e.g., `office-IL07`)

- **Deduplication**: Based on `templateId-userId-bioguideId-YYYYMMDD`
  - Prevents duplicate submissions per user per template per representative per day

- **Message Attributes**: For filtering and monitoring
  - `messageType`: Always 'cwc_submission'
  - `chamber`: 'house' or 'senate'
  - `priority`: 'normal' or 'high'
  - `templateId`: Template identifier
  - `userId`: User identifier
  - `state`: Representative's state
  - `district`: Representative's district

### Message Payload Structure

```typescript
interface CWCSubmissionMessage {
	messageType: 'cwc_submission';
	timestamp: string;
	submissionId: string;
	template: {
		id: string;
		slug: string;
		title: string;
		messageBody: string;
		category?: string;
		subject?: string;
	};
	user: {
		id: string;
		name: string;
		email: string;
		phone?: string;
		address?: {
			street: string;
			city: string;
			state: string;
			zip: string;
			zip4?: string;
		};
	};
	office: {
		bioguideId: string;
		name: string;
		chamber: 'house' | 'senate';
		officeCode: string;
		state: string;
		district: string;
		party: string;
	};
	personalizedMessage?: string;
	priority: 'normal' | 'high';
	retryCount: number;
}
```

## Usage Examples

### Basic Senate Submission

```typescript
import { cwcSQSClient } from '$lib/services/aws/sqs-client';

const result = await cwcSQSClient.sendToSenateQueue(
	template,
	user,
	senator,
	personalizedMessage,
	'high' // priority
);

if (result.success) {
	console.log('Queued successfully:', result.messageId);
} else {
	console.error('Queue failed:', result.error);
}
```

### Bulk Submission to All Representatives

```typescript
const results = await cwcSQSClient.sendToAllRepresentatives(
	template,
	user,
	representatives,
	personalizedMessage
);

const successful = results.filter((r) => r.success).length;
console.log(`${successful}/${representatives.length} messages queued`);
```

### Connection Testing

```typescript
const status = await cwcSQSClient.testConnection();
console.log('SQS Status:', {
	connected: status.connected,
	senateQueue: status.senateQueue,
	houseQueue: status.houseQueue
});
```

## Error Handling

The SQS client implements comprehensive error handling:

### Client-Side Errors

- **Configuration validation** on startup
- **Input validation** for all parameters
- **AWS SDK error handling** with structured logging

### Queue-Side Considerations

- **Dead Letter Queues** should be configured for failed messages
- **Message retention** should be set appropriately (default: 14 days)
- **Visibility timeout** should accommodate processing time

### Monitoring and Observability

The client provides structured logging for:

- Successful message submissions with metadata
- Failed submissions with error details
- Queue connectivity status
- Configuration validation results

## AWS Infrastructure Requirements

### IAM Permissions

The service requires the following IAM permissions:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["sqs:SendMessage", "sqs:GetQueueAttributes"],
			"Resource": [
				"arn:aws:sqs:us-east-1:123456789012:cwc-senate-submissions.fifo",
				"arn:aws:sqs:us-east-1:123456789012:cwc-house-submissions.fifo"
			]
		}
	]
}
```

### Queue Configuration

Both queues should be configured with:

- **Queue Type**: FIFO
- **Content-Based Deduplication**: Disabled (we provide explicit deduplication IDs)
- **Message Retention**: 14 days
- **Visibility Timeout**: 30 seconds (adjust based on processing needs)
- **Dead Letter Queue**: Recommended for error handling

## Integration with Existing CWC System

This SQS client is designed to replace direct calls in:

- `src/lib/core/congress/cwc-client.ts`
- `src/lib/services/delivery/integrations/cwc.ts`
- Congressional submission API endpoints

### Migration Strategy

1. **Phase 1**: Deploy SQS infrastructure and client
2. **Phase 2**: Create queue processors (Lambda functions)
3. **Phase 3**: Replace direct API calls with queue submissions
4. **Phase 4**: Monitor and optimize queue performance

## Security Considerations

- **No PII in queue names** or message attributes
- **Encrypted queues** recommended for sensitive data
- **IAM role-based access** preferred over access keys
- **VPC endpoints** for private network access
- **Message retention** should comply with data retention policies

## Performance Characteristics

- **Throughput**: Up to 300 messages/second per FIFO queue
- **Latency**: Typically <10ms for message submission
- **Durability**: 99.999999999% (11 9's) message durability
- **Availability**: 99.95% availability SLA

## Troubleshooting

### Common Issues

1. **Queue URL not found**: Check environment variables
2. **Access denied**: Verify IAM permissions
3. **Duplicate messages**: Check deduplication ID generation
4. **Message not received**: Verify queue configuration and processor

### Debug Tools

```typescript
// Check configuration
const config = cwcSQSClient.getConfiguration();
console.log('Config:', config);

// Test connectivity
const status = await cwcSQSClient.testConnection();
console.log('Status:', status);
```

## DynamoDB Rate Limiting

### Overview

The DynamoDB rate limiter implements sophisticated multi-tier rate limiting for CWC submissions using:

- **Token bucket algorithm** with atomic DynamoDB operations
- **Hierarchical rate limits** for global, chamber, and office-specific controls
- **Idempotency tracking** to prevent duplicate submissions
- **Automatic cleanup** using DynamoDB TTL features

### Rate Limit Configuration

The system enforces the following rate limits:

- **Global**: 60 requests/minute total across all chambers
- **Senate**: 30 requests/minute for all Senate offices combined
- **House Global**: 20 requests/minute for all House offices combined
- **House Per-Office**: 2 requests/minute per individual House office
- **Idempotency**: Track submissions for 24 hours to prevent duplicates

### DynamoDB Schema

#### Rate Limits Table

```typescript
{
  PK: "rate#{chamber}#{officeId}",     // Partition key
  SK: "window#{timestamp}",            // Sort key (time window)
  tokens: number,                      // Available tokens
  lastRefill: number,                  // Last refill timestamp
  resetAt: number,                     // Window reset time
  TTL: number                          // Auto-cleanup timestamp
}
```

#### Idempotency Table

```typescript
{
  PK: "idem#{templateId}#{recipientId}#{userId}#{date}",  // Partition key
  messageId: string,                   // Original message ID
  submittedAt: number,                 // Submission timestamp
  TTL: number                          // 24-hour expiry
}
```

### Usage Examples

#### Basic Rate Limit Check

```typescript
import { createRateLimiter, extractChamber } from '$lib/services/aws/dynamodb-rate-limiter';

const rateLimiter = createRateLimiter('production');

const chamber = extractChamber(officeId);
const result = await rateLimiter.checkRateLimit(chamber, officeId, userId);

if (!result.allowed) {
	throw createRateLimitError(chamber, result, officeId);
}
```

#### Idempotency Check

```typescript
const idempotencyKey = {
	templateId: template.id,
	recipientOfficeId: office.id,
	userId: user.id,
	date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
};

const idempotencyResult = await rateLimiter.checkIdempotency(idempotencyKey);

if (idempotencyResult.isDuplicate) {
	throw new Error(
		`Duplicate submission detected. Original: ${idempotencyResult.originalMessageId}`
	);
}

// After successful submission
await rateLimiter.recordSubmission(idempotencyKey, messageId);
```

#### Complete Integration Example

```typescript
import {
	createRateLimiter,
	extractChamber,
	createRateLimitError
} from '$lib/services/aws/dynamodb-rate-limiter';

async function submitCWCMessage(template, user, office, personalizedMessage) {
	const rateLimiter = createRateLimiter('production');
	const chamber = extractChamber(office.id);

	// Check rate limits
	const rateLimitResult = await rateLimiter.checkRateLimit(chamber, office.id, user.id);
	if (!rateLimitResult.allowed) {
		throw createRateLimitError(chamber, rateLimitResult, office.id);
	}

	// Check for duplicates
	const idempotencyKey = {
		templateId: template.id,
		recipientOfficeId: office.id,
		userId: user.id,
		date: new Date().toISOString().split('T')[0]
	};

	const idempotencyResult = await rateLimiter.checkIdempotency(idempotencyKey);
	if (idempotencyResult.isDuplicate) {
		throw new Error(`Message already submitted today`);
	}

	// Proceed with message submission
	const messageId = await submitToQueue(template, user, office, personalizedMessage);

	// Record successful submission
	await rateLimiter.recordSubmission(idempotencyKey, messageId);

	return { messageId, rateLimitResult };
}
```

### DynamoDB Table Configuration

#### Rate Limits Table

```bash
# Table creation (via AWS CLI or CDK)
aws dynamodb create-table \
  --table-name prod-communique-rate-limits \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --stream-specification StreamEnabled=false \
  --time-to-live-specification \
    AttributeName=TTL,Enabled=true
```

#### Idempotency Table

```bash
aws dynamodb create-table \
  --table-name prod-communique-idempotency \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --time-to-live-specification \
    AttributeName=TTL,Enabled=true
```

### Required IAM Permissions

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"dynamodb:GetItem",
				"dynamodb:PutItem",
				"dynamodb:UpdateItem",
				"dynamodb:TransactWriteItems"
			],
			"Resource": [
				"arn:aws:dynamodb:us-east-1:123456789012:table/prod-communique-rate-limits",
				"arn:aws:dynamodb:us-east-1:123456789012:table/prod-communique-idempotency"
			]
		}
	]
}
```

### Performance Characteristics

- **Latency**: ~5-15ms per rate limit check
- **Throughput**: Up to 4,000 RCU/WCU per table
- **Consistency**: Strong consistency for rate limit operations
- **Durability**: 99.999999999% (11 9's) data durability
- **Availability**: 99.99% availability SLA

### Error Handling

The rate limiter implements graceful degradation:

- **DynamoDB unavailable**: Allows requests with logging
- **Rate limit exceeded**: Returns structured error with retry timing
- **Configuration errors**: Fails fast with clear error messages
- **Network timeouts**: Retries with exponential backoff

### Monitoring and Observability

Built-in structured logging for:

- Rate limit violations with chamber/office details
- Successful token consumption events
- Idempotency violations with original submission details
- DynamoDB operation performance metrics
- Configuration validation results

### Future Enhancements

- **Batch message sending** for improved throughput
- **Message compression** for large payloads
- **Dead letter queue handling** with retry logic
- **Metrics and alerting** integration
- **Cross-region replication** for disaster recovery
- **Advanced rate limiting** with burst allowances and user-specific limits
- **Real-time rate limit monitoring** dashboard
