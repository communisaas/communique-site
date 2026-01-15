# House CWC Worker

AWS Lambda function for processing House of Representatives CWC submissions through GCP proxy infrastructure.

## Documentation

See [AWS Lambda Workers Documentation](../../../../docs/development/integrations/aws-lambda-workers.md) for complete documentation including:

- Architecture and configuration
- House-specific settings (GCP proxy, 2 req/min rate limits, officeCode)
- Deployment procedures
- Monitoring and troubleshooting
- Security best practices

## Quick Reference

- **Rate Limit**: 2 requests per minute per House office
- **Identifier**: `officeCode` (e.g., "CA01")
- **Delivery**: Routes through GCP proxy for IP whitelist compliance
- **Reserved Concurrency**: 2

For detailed information, see the unified documentation linked above.
