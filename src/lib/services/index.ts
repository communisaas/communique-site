// Services Module - Barrel Export
export * from './apiClient';
export * from './channelResolver';
export * from './emailService';
export * from './geolocation';
export * from './jurisdictionProvider';
export * from './personalization';
export * from './viral-pattern-generator';
export * from './zipDistrictLookup';

// Convenience exports
export { api, analyticsApi } from './apiClient';
export { analyzeEmailFlow, launchEmail } from './emailService';
export { resolveChannel } from './channelResolver';
export { geolocateFromAddress } from './geolocation';
