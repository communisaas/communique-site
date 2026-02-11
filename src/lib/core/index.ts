// Core Module - Barrel Export
export * from './analytics';
export * from './api';
export * from './server';

// Selective exports to avoid naming conflicts
export { addressLookup, cwcClient, CWCGenerator } from './congress';
export type { CongressionalOffice } from './congress/cwc-client';

export {
	adapterRegistry,
	deliveryPipeline,
	variableResolver,
	USCongressAdapter
} from './legislative';
export type {
	LegislativeJurisdiction,
	Office,
	ContactMethod,
	Representative,
	Chamber,
	LegislativeSystem,
	DeliveryCapability,
	Jurisdiction,
	JurisdictionType
} from './legislative/models';
export type {
	Address as LegislativeAddress,
	DeliveryRequest,
	DeliveryResult,
	LegislativeAdapter
} from './legislative/adapters/base';

// Auth exports (selective to avoid User type conflicts)
export {
	createSession,
	validateSession,
	invalidateSession,
	sessionCookieName,
	type Session,
	type User
} from './auth/auth';
export {
	oauthCallbackHandler,
	type OAuthProvider,
	type UserData,
	type TokenData,
	type DatabaseUser,
	type OAuthCallbackConfig
} from './auth/oauth-callback-handler';
export { generateState, generateCodeVerifier } from './auth/oauth';
export { validateOAuthSession, checkAnalyticsPermission } from './auth/oauth-security';

// Direct exports for commonly used items
export { db } from './db';
