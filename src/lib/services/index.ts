// Services Module - Barrel Export
export * from './channelResolver';
export * from './emailService';
export * from './zipDistrictLookup';

// Convenience exports
export { analyzeEmailFlow, launchEmail } from './emailService';
export { resolveChannel } from './channelResolver';
