# Senate CWC Worker

AWS Lambda function for processing Senate Congressional Web Communication submissions.

## Documentation

See [AWS Lambda Workers Documentation](../../../../docs/development/integrations/aws-lambda-workers.md) for complete documentation including:

- Architecture and configuration
- Senate-specific settings (direct CWC API, 10 req/hour rate limits, bioguideId)
- Deployment procedures
- Monitoring and troubleshooting
- Security best practices

## Quick Reference

- **Rate Limit**: 10 requests per hour per user
- **Identifier**: `bioguideId` (e.g., "S000033")
- **Delivery**: Direct CWC API submission
- **Reserved Concurrency**: 5

For detailed information, see the unified documentation linked above.
