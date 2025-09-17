/**
 * TYPES MODULE - Centralized Type System
 *
 * Single source of truth for all application types.
 * Organized by domain with clear separation of concerns.
 */

// API & Network Types
export * from './api';
export * from './errors';

// Analytics & Metrics Types
export * from './analytics';

// N8N Integration Types
export * from './n8n';

// Core Domain Types
export * from './template';
export * from './templateConfig';
export * from './user';

// Geographic & Location Types
export * from './location';
export * from './jurisdiction';

// UI Component Types
export * from './modal';
export * from './popover';

// Convenience re-exports for commonly used types
export type {
	ApiResponse,
	AnalyticsEvent,
	AddressUpdateRequest,
	ProfileUpdateRequest
} from './api';
export type { ApiError, ErrorType, AppError } from './errors';
export type { PercolationData, FusionData, AnalyticsError } from './analytics';
export type { Template, TemplateFormData, MinimalUser } from './template';
export type { EmailServiceUser, UserProfile, UserAddress, Representative, PrismaUserForEmail } from './user';
export { toEmailServiceUser } from './user';
export type { Jurisdiction, Office, JurisdictionType, TemplateScope } from './jurisdiction';
export type { NormalizedAddress, GeoFence } from './location';
export type { ModalScrollState } from './modal';
export type { PopoverSlots, TriggerAction } from './popover';
export type {
	N8NWebhookPayload,
	N8NWorkflowResult,
	VerificationResult,
	ConsensusResult,
	ReputationUpdate
} from './n8n';

// Error helper functions
export { createApiError, createValidationError, ERROR_CODES, ERROR_MESSAGES } from './errors';
