# Required Dependencies for DynamoDB Rate Limiter

The newly created DynamoDB rate limiting service requires the AWS SDK v3 DynamoDB client to be added to the project dependencies.

## Required Package

Add the following to your `package.json`:

```bash
npm install @aws-sdk/client-dynamodb
```

Or add to the dependencies section:

```json
{
	"dependencies": {
		"@aws-sdk/client-dynamodb": "^3.899.0"
	}
}
```

## Why This Dependency is Required

The DynamoDB rate limiter (`src/lib/services/aws/dynamodb-rate-limiter.ts`) uses AWS SDK v3 for:

- **DynamoDBClient**: Core client for connecting to DynamoDB
- **PutItemCommand**: Creating new rate limit records and idempotency entries
- **UpdateItemCommand**: Atomic token consumption operations
- **GetItemCommand**: Reading current rate limit state and checking idempotency
- **TransactWriteItemsCommand**: Atomic multi-bucket token consumption
- **ConditionalCheckFailedException**: Handling conditional write failures

## AWS SDK v3 Benefits

- **Modular imports**: Only import the specific commands you need
- **Better performance**: Smaller bundle size and faster cold starts in Lambda
- **Modern TypeScript**: Full TypeScript support with proper types
- **Improved error handling**: Better structured error objects

## Alternative Approaches

If you prefer not to add the DynamoDB dependency immediately, you can:

1. **Mock the service** for development and testing
2. **Use a different rate limiting approach** (Redis, in-memory)
3. **Implement the dependency injection pattern** to swap implementations

The rate limiter is designed to be easily swappable with other implementations if needed.
