/**
 * Identity Verification Type Definitions
 *
 * Comprehensive TypeScript types for the identity verification system.
 * Ensures type safety across all verification components and API integrations.
 */

// ============================================================================
// Verification Methods
// ============================================================================

/**
 * Available identity verification methods
 */
export type VerificationMethod = 'nfc-passport' | 'government-id' | 'mdl';

/**
 * Verification provider types
 */
export type VerificationProvider = 'self.xyz' | 'didit.me' | 'digital-credentials-api';

/**
 * Verification status states
 */
export type VerificationStatus =
	| 'not-started'
	| 'initializing'
	| 'pending'
	| 'qr-ready'
	| 'waiting'
	| 'verified'
	| 'failed'
	| 'expired';

// ============================================================================
// Verification Session
// ============================================================================

/**
 * Verification session data structure
 */
export interface VerificationSession {
	/** Unique session identifier */
	sessionId: string;

	/** User identifier */
	userId: string;

	/** Template context (optional) */
	templateSlug?: string;

	/** Verification method being used */
	method: VerificationMethod;

	/** Provider handling verification */
	provider: VerificationProvider;

	/** Current session status */
	status: VerificationStatus;

	/** QR code data URL (for Self.xyz) */
	qrCode?: string;

	/** Verification redirect URL (for Didit) */
	verificationUrl?: string;

	/** Session creation timestamp */
	createdAt: Date;

	/** Session expiration timestamp */
	expiresAt: Date;

	/** Error message (if failed) */
	error?: string;
}

// ============================================================================
// Verification Result
// ============================================================================

/**
 * Verification completion result
 */
export interface VerificationResult {
	/** Whether verification succeeded */
	verified: boolean;

	/** Verification method used */
	method: VerificationMethod;

	/** User identifier */
	userId: string;

	/** Verification timestamp */
	verifiedAt: Date;

	/** Congressional district extracted from verification */
	district?: string;

	/** Verification confidence score (0-1) */
	confidence?: number;

	/** Provider metadata */
	metadata?: VerificationMetadata;
}

/**
 * Provider-specific verification metadata
 */
export interface VerificationMetadata {
	/** Provider name */
	provider: VerificationProvider;

	/** Provider session ID */
	providerSessionId: string;

	/** Document type verified (for government ID) */
	documentType?: 'drivers-license' | 'state-id' | 'passport';

	/** Issuing country/state */
	issuingAuthority?: string;

	/** Verification attempt count */
	attempts?: number;

	/** Additional provider data */
	[key: string]: unknown;
}

// ============================================================================
// User Verification State
// ============================================================================

/**
 * User verification status stored in database
 */
export interface UserVerification {
	/** User identifier */
	userId: string;

	/** Whether user is verified */
	verified: boolean;

	/** Verification method used */
	verificationMethod: VerificationMethod | null;

	/** Verification provider */
	verificationProvider: VerificationProvider | null;

	/** Verification timestamp */
	verifiedAt: Date | null;

	/** Verification expiration (if applicable) */
	expiresAt: Date | null;

	/** Congressional district */
	congressionalDistrict: string | null;

	/** Verification confidence score */
	confidenceScore: number | null;

	/** Last verification attempt */
	lastAttemptAt: Date | null;

	/** Total verification attempts */
	totalAttempts: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Self.xyz verification initialization request
 */
export interface SelfXyzInitRequest {
	userId: string;
	templateSlug?: string;
}

/**
 * Self.xyz verification initialization response
 */
export interface SelfXyzInitResponse {
	sessionId: string;
	qrCode: string;
	expiresAt: string;
}

/**
 * Self.xyz verification status response
 */
export interface SelfXyzStatusResponse {
	sessionId: string;
	status: VerificationStatus;
	verified?: boolean;
	district?: string;
	error?: string;
}

/**
 * Didit verification initialization request
 */
export interface DiditInitRequest {
	userId: string;
	templateSlug?: string;
}

/**
 * Didit verification initialization response
 */
export interface DiditInitResponse {
	sessionId: string;
	verificationUrl: string;
	expiresAt: string;
}

/**
 * Didit webhook payload
 */
export interface DiditWebhookPayload {
	sessionId: string;
	userId: string;
	status: 'verified' | 'failed';
	timestamp: string;
	documentType?: string;
	district?: string;
	error?: string;
	signature: string;
}

// ============================================================================
// Component Props & Events
// ============================================================================

/**
 * IdentityVerificationFlow component props
 */
export interface IdentityVerificationFlowProps {
	userId: string;
	templateSlug?: string;
	skipValueProp?: boolean;
	defaultMethod?: VerificationMethod | null;
}

/**
 * IdentityVerificationFlow component events
 */
export interface IdentityVerificationFlowEvents {
	complete: VerificationResult;
	cancel: void;
	back: void;
}

/**
 * VerificationChoice component props
 */
export interface VerificationChoiceProps {
	compact?: boolean;
	defaultMethod?: VerificationMethod | null;
}

/**
 * VerificationChoice component events
 */
export interface VerificationChoiceEvents {
	select: { method: VerificationMethod };
}

/**
 * VerificationValueProp component props
 */
export interface VerificationValuePropProps {
	variant?: 'full' | 'compact' | 'inline';
	showStats?: boolean;
	showPrivacy?: boolean;
}

/**
 * SelfXyzVerification component props
 */
export interface SelfXyzVerificationProps {
	userId: string;
	templateSlug?: string;
	isLoading?: boolean;
}

/**
 * SelfXyzVerification component events
 */
export interface SelfXyzVerificationEvents {
	complete: { verified: boolean; method: string };
	error: { message: string };
}

/**
 * DiditVerification component props
 */
export interface DiditVerificationProps {
	userId: string;
	templateSlug?: string;
	isLoading?: boolean;
}

/**
 * DiditVerification component events
 */
export interface DiditVerificationEvents {
	complete: { verified: boolean; method: string };
	error: { message: string };
}

// ============================================================================
// Analytics & Tracking
// ============================================================================

/**
 * Verification analytics event types
 */
export type VerificationEventType =
	| 'verification_started'
	| 'verification_method_selected'
	| 'verification_qr_generated'
	| 'verification_qr_scanned'
	| 'verification_redirect_initiated'
	| 'verification_completed'
	| 'verification_failed'
	| 'verification_abandoned'
	| 'verification_retry';

/**
 * Verification analytics event payload
 */
export interface VerificationAnalyticsEvent {
	/** Event type */
	event: VerificationEventType;

	/** User identifier */
	userId: string;

	/** Session identifier */
	sessionId?: string;

	/** Verification method */
	method?: VerificationMethod;

	/** Context where verification initiated */
	context?: 'onboarding' | 'template_submission' | 'settings' | 'modal';

	/** Event timestamp */
	timestamp: Date;

	/** Duration in seconds (for completion/abandonment) */
	duration?: number;

	/** Number of retry attempts */
	retries?: number;

	/** Error message (for failures) */
	error?: string;

	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Verification error types
 */
export type VerificationErrorType =
	| 'initialization_failed'
	| 'session_expired'
	| 'qr_generation_failed'
	| 'verification_timeout'
	| 'verification_rejected'
	| 'invalid_document'
	| 'network_error'
	| 'provider_error'
	| 'unknown_error';

/**
 * Verification error structure
 */
export interface VerificationError {
	/** Error type */
	type: VerificationErrorType;

	/** Human-readable error message */
	message: string;

	/** Technical error details */
	details?: string;

	/** Verification method that failed */
	method?: VerificationMethod;

	/** Provider that returned error */
	provider?: VerificationProvider;

	/** Whether error is retryable */
	retryable: boolean;

	/** Error timestamp */
	timestamp: Date;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Verification method display information
 */
export interface VerificationMethodInfo {
	method: VerificationMethod;
	provider: VerificationProvider;
	displayName: string;
	description: string;
	estimatedTime: string;
	recommended: boolean;
	requiresDevice: 'mobile' | 'any';
	iconName: string;
}

/**
 * Verification statistics for value proposition
 */
export interface VerificationStats {
	responseRateMultiplier: number;
	officesPrioritizePercent: number;
	averageResponseTime: string;
	userTrustScore: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard: Check if value is VerificationMethod
 */
export function isVerificationMethod(value: unknown): value is VerificationMethod {
	return value === 'nfc-passport' || value === 'government-id' || value === 'mdl';
}

/**
 * Type guard: Check if value is VerificationStatus
 */
export function isVerificationStatus(value: unknown): value is VerificationStatus {
	return [
		'not-started',
		'initializing',
		'pending',
		'qr-ready',
		'waiting',
		'verified',
		'failed',
		'expired'
	].includes(value as string);
}

/**
 * Type guard: Check if value is VerificationResult
 */
export function isVerificationResult(value: unknown): value is VerificationResult {
	if (typeof value !== 'object' || value === null) return false;

	const result = value as Partial<VerificationResult>;

	return (
		typeof result.verified === 'boolean' &&
		isVerificationMethod(result.method) &&
		typeof result.userId === 'string' &&
		result.verifiedAt instanceof Date
	);
}

/**
 * Type guard: Check if value is VerificationError
 */
export function isVerificationError(value: unknown): value is VerificationError {
	if (typeof value !== 'object' || value === null) return false;

	const error = value as Partial<VerificationError>;

	return (
		typeof error.type === 'string' &&
		typeof error.message === 'string' &&
		typeof error.retryable === 'boolean' &&
		error.timestamp instanceof Date
	);
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Verification method metadata
 */
export const VERIFICATION_METHODS: Record<VerificationMethod, VerificationMethodInfo> = {
	'nfc-passport': {
		method: 'nfc-passport',
		provider: 'self.xyz',
		displayName: 'NFC Passport',
		description: 'Tap your passport with your phone for instant verification',
		estimatedTime: '30 seconds',
		recommended: true,
		requiresDevice: 'mobile',
		iconName: 'Shield'
	},
	'government-id': {
		method: 'government-id',
		provider: 'didit.me',
		displayName: 'Government ID',
		description: "Use your driver's license or state ID",
		estimatedTime: '2-3 minutes',
		recommended: false,
		requiresDevice: 'any',
		iconName: 'FileText'
	},
	mdl: {
		method: 'mdl',
		provider: 'digital-credentials-api',
		displayName: 'Digital ID',
		description: 'Use your state-issued digital driver\'s license — fastest, most private',
		estimatedTime: '10 seconds',
		recommended: false,
		requiresDevice: 'any',
		iconName: 'Smartphone'
	}
};

/**
 * Verification statistics (for value proposition)
 */
export const VERIFICATION_STATISTICS: VerificationStats = {
	responseRateMultiplier: 3.0,
	officesPrioritizePercent: 87,
	averageResponseTime: '2-3 business days',
	userTrustScore: 94
};

/**
 * Session expiration times (in seconds)
 */
export const SESSION_EXPIRATION = {
	'self.xyz': 15 * 60, // 15 minutes
	'didit.me': 30 * 60 // 30 minutes
} as const;

/**
 * Polling intervals (in milliseconds)
 */
export const POLLING_INTERVALS = {
	'self.xyz': 2000, // 2 seconds
	'didit.me': 5000 // 5 seconds
} as const;
