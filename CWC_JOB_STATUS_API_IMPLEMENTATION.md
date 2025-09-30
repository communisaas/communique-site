# CWC Job Status Tracking API Implementation

## Overview

A comprehensive job status tracking API endpoint has been implemented for the async CWC (Communicating With Congress) submission system. This system allows N8N workflows and frontend applications to monitor the progress of queued congressional message submissions in real-time.

## Implementation Details

### 1. Database Schema

Added `CWCJob` model to the Prisma schema (`/Users/noot/Documents/communique/prisma/schema.prisma`):

```prisma
model CWCJob {
  id            String   @id @default(cuid())
  templateId    String   @map("template_id")
  userId        String   @map("user_id")
  status        String   @default("queued") // 'queued', 'processing', 'completed', 'partial', 'failed'
  messageIds    Json     @default("[]") @map("message_ids") // SQS message IDs array
  results       Json?    @default("{}") @map("results") // Submission results from Lambda workers
  submissionCount Int    @default(0) @map("submission_count")
  createdAt     DateTime @default(now()) @map("created_at")
  completedAt   DateTime? @map("completed_at")

  @@map("cwc_job")
  @@index([templateId])
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}
```

### 2. API Endpoint

Created `/Users/noot/Documents/communique/src/routes/api/cwc/jobs/[id]/+server.ts` with the following features:

#### GET Endpoint - Job Status Query

- **URL**: `/api/cwc/jobs/{jobId}`
- **Method**: `GET`
- **Headers**: Optional `x-webhook-secret` for N8N authentication
- **Query Parameters**:
  - `batch=true` (placeholder for future batch queries)

#### POST Endpoint - Status Updates (Lambda Workers)

- **URL**: `/api/cwc/jobs/{jobId}`
- **Method**: `POST`
- **Headers**: Required `x-webhook-secret` for security
- **Body**: Status update data from Lambda workers

#### Response Format

```typescript
interface CWCJobStatusResponse {
	jobId: string;
	status: 'queued' | 'processing' | 'completed' | 'partial' | 'failed';
	submissionCount: number;
	submissions: Array<{
		recipient: {
			name: string;
			chamber: 'senate' | 'house';
			bioguideId: string;
		};
		status: 'queued' | 'processing' | 'submitted' | 'failed' | 'rate_limited';
		messageId?: string;
		cwcConfirmation?: string;
		error?: string;
		submittedAt?: string;
	}>;
	createdAt: string;
	completedAt?: string;
	metadata: {
		templateId: string;
		userId: string;
	};
}
```

### 3. Submit Endpoint Integration

Updated `/Users/noot/Documents/communique/src/routes/api/cwc/submit/+server.ts` to:

1. **Create CWCJob records** when new submissions are initiated
2. **Collect SQS message IDs** as messages are queued
3. **Update job status** based on queuing results
4. **Track submission counts** and overall job state

#### Job ID Format

```
job-{8-char-hex}-{timestamp}
```

### 4. Status Flow

#### Job Status Progression:

1. **`queued`** - Initial state when job is created
2. **`processing`** - All messages successfully queued to SQS
3. **`partial`** - Some messages queued, some failed/rate-limited
4. **`completed`** - All submissions successfully delivered
5. **`failed`** - All submissions failed

#### Individual Submission Status:

1. **`queued`** - Message in SQS queue
2. **`processing`** - Lambda worker processing message
3. **`submitted`** - Successfully delivered to CWC
4. **`failed`** - Delivery failed with error
5. **`rate_limited`** - Delayed due to rate limits

### 5. Database Integration

The system uses two complementary database tables:

1. **`cwc_job`** - High-level job tracking with aggregate status
2. **`template_campaign`** - Individual submission records with detailed metadata

#### Relationship:

- `template_campaign.metadata.job_id` links to `cwc_job.id`
- Query both tables to provide complete status information
- Support legacy submissions without CWCJob records

### 6. Security Features

- **Webhook Secret Validation**: Optional for GET, required for POST
- **Input Validation**: Strong TypeScript typing and runtime validation
- **Error Handling**: Comprehensive error responses with timestamps
- **SQL Injection Protection**: Prisma ORM prevents injection attacks

### 7. API Usage Examples

#### Check Job Status (N8N Workflow)

```bash
curl -H "x-webhook-secret: $N8N_WEBHOOK_SECRET" \
     https://communique.app/api/cwc/jobs/job-1a2b3c4d-1759224654713
```

#### Update Job Status (Lambda Worker)

```bash
curl -X POST \
     -H "x-webhook-secret: $LAMBDA_WEBHOOK_SECRET" \
     -H "Content-Type: application/json" \
     -d '{
       "status": "completed",
       "submissionResults": [
         {
           "messageId": "msg-001",
           "status": "submitted",
           "cwcConfirmation": "CWC-12345",
           "submittedAt": "2025-09-30T09:30:00Z"
         }
       ],
       "completedAt": "2025-09-30T09:30:00Z"
     }' \
     https://communique.app/api/cwc/jobs/job-1a2b3c4d-1759224654713
```

### 8. Error Handling

The API provides comprehensive error responses:

```typescript
interface CWCJobError {
	error: string;
	jobId?: string;
	timestamp: string;
}
```

#### Error Scenarios:

- **400**: Invalid job ID format or parameters
- **401**: Invalid/missing webhook secret
- **404**: Job not found
- **500**: Database or server errors

### 9. Testing Validation

Successfully tested with:

- ✅ CWCJob record creation and updates
- ✅ Template_campaign record integration
- ✅ Status mapping and aggregation logic
- ✅ Foreign key constraint handling
- ✅ Database query performance
- ✅ Error handling and cleanup

### 10. Performance Considerations

- **Indexed Queries**: Database indexes on jobId, templateId, userId, status, createdAt
- **Minimal Data Transfer**: Only essential fields in API responses
- **Efficient JSON Queries**: Use Prisma's JSON path queries for metadata filtering
- **Batch Query Support**: Architecture supports future batch operations

### 11. Integration Points

#### N8N Workflow Integration:

1. Submit messages via `/api/cwc/submit`
2. Receive job ID in response
3. Poll `/api/cwc/jobs/{jobId}` for status updates
4. Process completion when `status` is `completed`, `partial`, or `failed`

#### Lambda Worker Integration:

1. Process SQS messages
2. Submit to CWC endpoints
3. POST status updates to `/api/cwc/jobs/{jobId}`
4. Include detailed submission results

#### Frontend Integration:

1. Query job status for real-time progress displays
2. Show individual submission status per representative
3. Display error messages and retry options
4. Track completion rates and analytics

## Deployment Checklist

- ✅ Database schema updated (`npx prisma db push`)
- ✅ TypeScript interfaces defined
- ✅ API endpoint implemented with security
- ✅ Submit endpoint updated for job creation
- ✅ Error handling and logging implemented
- ✅ Integration testing completed
- ✅ Documentation provided

## Environment Variables Required

```bash
# Required for webhook security
N8N_WEBHOOK_SECRET=your-n8n-secret
LAMBDA_WEBHOOK_SECRET=your-lambda-secret

# Database connection (existing)
DATABASE_URL=your-postgres-url
```

## Next Steps

1. **Lambda Worker Updates**: Update CWC processing Lambda functions to POST status updates
2. **N8N Workflow Updates**: Modify N8N workflows to poll job status endpoint
3. **Frontend Integration**: Add real-time job status displays to user interface
4. **Monitoring**: Add CloudWatch/observability for job completion rates
5. **Batch Operations**: Implement batch status queries for dashboard analytics

The implementation provides a robust, secure, and scalable solution for tracking CWC submission jobs across the entire async processing pipeline.
