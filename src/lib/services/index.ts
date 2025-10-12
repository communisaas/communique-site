// Services Module - Barrel Export
export * from './apiClient';
export * from './aws/dynamodb-rate-limiter';
export * from './aws/sqs-client';
export * from './channelResolver';
export * from './emailService';
export * from './geolocation';
export * from './jurisdictionProvider';
export * from './personalization';
export * from './zipDistrictLookup';

// Convenience exports
export { api, analyticsApi } from './apiClient';
export {
	DynamoDBRateLimiter,
	createRateLimiter,
	extractChamber,
	createRateLimitError
} from './aws/dynamodb-rate-limiter';
export { cwcSQSClient } from './aws/sqs-client';
export { analyzeEmailFlow, launchEmail } from './emailService';
export { resolveChannel } from './channelResolver';
export { geolocateFromAddress } from './geolocation';
