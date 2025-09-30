# CWC Submit API - Async Response Examples

## Overview

The CWC submit endpoint (`/api/cwc/submit`) has been updated to use async SQS queuing instead of direct CWC submission. This document shows the new response format and behavior.

## New Response Format

```typescript
{
  success: boolean;
  jobId: string;
  queuedSubmissions: number;
  rateLimitedRecipients: string[];
  duplicateSubmissions: string[];
  errors?: string[];
  timestamp: string;
}
```

## Response Examples

### Successful Async Submission

```json
{
	"success": true,
	"jobId": "job-a1b2c3d4-1696089600000",
	"queuedSubmissions": 3,
	"rateLimitedRecipients": [],
	"duplicateSubmissions": [],
	"timestamp": "2024-09-30T12:00:00.000Z"
}
```

### Partial Success with Rate Limiting

```json
{
	"success": true,
	"jobId": "job-e5f6g7h8-1696089660000",
	"queuedSubmissions": 1,
	"rateLimitedRecipients": ["Sen. John Smith", "Rep. Jane Doe"],
	"duplicateSubmissions": [],
	"errors": [],
	"timestamp": "2024-09-30T12:01:00.000Z"
}
```

### Rate Limited Response (HTTP 429)

```json
{
	"success": false,
	"jobId": "job-i9j0k1l2-1696089720000",
	"queuedSubmissions": 0,
	"rateLimitedRecipients": ["Sen. John Smith", "Rep. Jane Doe", "Rep. Bob Wilson"],
	"duplicateSubmissions": [],
	"message": "All submissions were rate limited. Please try again later.",
	"details": {
		"rateLimited": ["Sen. John Smith", "Rep. Jane Doe", "Rep. Bob Wilson"],
		"duplicates": [],
		"errors": []
	},
	"timestamp": "2024-09-30T12:02:00.000Z"
}
```

### Duplicate Submissions (HTTP 409)

```json
{
	"success": false,
	"jobId": "job-m3n4o5p6-1696089780000",
	"queuedSubmissions": 0,
	"rateLimitedRecipients": [],
	"duplicateSubmissions": ["Sen. John Smith", "Rep. Jane Doe"],
	"message": "All submissions were duplicates of previous submissions.",
	"details": {
		"rateLimited": [],
		"duplicates": ["Sen. John Smith", "Rep. Jane Doe"],
		"errors": []
	},
	"timestamp": "2024-09-30T12:03:00.000Z"
}
```

### Error Response (HTTP 500)

```json
{
	"success": false,
	"jobId": "error-q7r8-1696089840000",
	"queuedSubmissions": 0,
	"rateLimitedRecipients": [],
	"duplicateSubmissions": [],
	"errors": ["CWC async submission failed: SQS service unavailable"],
	"timestamp": "2024-09-30T12:04:00.000Z"
}
```

## Key Changes from Original API

### Before (Synchronous)

- Direct CWC API calls
- Response contained delivery confirmations
- Blocking operation (slow)
- `submissions` array with delivery details
- `confirmationNumber` for N8N integration

### After (Asynchronous)

- SQS queue submissions
- Immediate response with job ID
- Non-blocking operation (fast)
- `queuedSubmissions` count instead of details
- Job ID for tracking instead of confirmation numbers

## Backward Compatibility for N8N

The API maintains the core contract:

- ✅ **POST method** - unchanged
- ✅ **Request format** - unchanged
- ✅ **Webhook secret validation** - unchanged
- ✅ **Success/failure indication** - via `success` boolean
- ✅ **Error handling** - improved with detailed error arrays
- ⚠️ **Response format** - updated (see migration guide below)

## N8N Integration Migration

### Old N8N Workflow Check

```javascript
// OLD: Check confirmation number
if (response.confirmationNumber) {
	// Success
}
```

### New N8N Workflow Check

```javascript
// NEW: Check job ID and queued count
if (response.success && response.queuedSubmissions > 0) {
	// Success - messages queued
	const jobId = response.jobId;
	// Store jobId for status tracking if needed
}
```

## Configuration Check

### GET /api/cwc/submit Response

```json
{
	"status": "async_configured",
	"configured": true,
	"mode": "async_sqs_queuing",
	"sqs": {
		"region": "us-east-1",
		"senateQueue": true,
		"houseQueue": true,
		"credentialsConfigured": true
	},
	"rateLimiting": {
		"environment": "development",
		"enabled": true,
		"tableName": "development-communique-rate-limits"
	},
	"idempotency": {
		"enabled": true,
		"tableName": "development-communique-idempotency"
	},
	"message": "CWC async SQS integration is configured and ready",
	"timestamp": "2024-09-30T12:00:00.000Z"
}
```

## Environment Variables Required

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# SQS Queue URLs (must be FIFO queues)
CWC_SENATE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/senate-cwc-submissions.fifo
CWC_HOUSE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/house-cwc-submissions.fifo

# N8N Integration (unchanged)
N8N_WEBHOOK_SECRET=your_webhook_secret
```

## Benefits of Async Architecture

1. **Performance**: Immediate response (~50ms vs ~5s+)
2. **Reliability**: Queue persistence handles service outages
3. **Scalability**: Parallel processing of multiple submissions
4. **Rate Limiting**: Distributed rate limiting prevents API abuse
5. **Idempotency**: Prevents duplicate submissions automatically
6. **Observability**: Comprehensive logging for debugging
7. **Resilience**: Graceful degradation during AWS service issues
