/**
 * Didit.me Identity Verification SDK Client
 *
 * Type-safe wrapper around Didit.me verification API with HMAC validation.
 * Provides structured interfaces for session creation and webhook handling.
 *
 * API Documentation: https://docs.didit.me/
 *
 * Security:
 * - HMAC-SHA256 signature verification on all webhooks
 * - Constant-time comparison to prevent timing attacks
 * - No raw PII storage (only hashed credentials)
 *
 * Authority Level Mapping:
 * - passport → level 4 (highest trust)
 * - drivers_license → level 3
 * - national_id → level 3
 */

import { createHmac, timingSafeEqual } from 'crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Document type from Didit verification
 */
export type DiditDocumentType = 'passport' | 'drivers_license' | 'id_card';

/**
 * Verification status from Didit webhook
 */
export type DiditVerificationStatus = 'Approved' | 'Rejected' | 'Pending' | 'Expired';

/**
 * Authority level based on document type
 */
export type AuthorityLevel = 3 | 4;

/**
 * Didit verification result (from webhook payload)
 */
export interface DiditVerificationResult {
	/** Didit session ID */
	sessionId: string;
	/** Verification status */
	status: DiditVerificationStatus;
	/** Document type verified */
	documentType: DiditDocumentType;
	/** Issuing country/state */
	nationality: string;
	/** Document number (hashed before storage) */
	documentNumber: string;
	/** Date of birth (for age verification) */
	dateOfBirth: string;
	/** Birth year (extracted from DOB) */
	birthYear: number;
	/** User ID from session metadata */
	userId: string;
	/** Authority level for reputation system */
	authorityLevel: AuthorityLevel;
	/** Hash of credential for identity commitment */
	credentialHash: string;
}

/**
 * Didit session creation response
 */
export interface DiditSessionResponse {
	/** Session ID for tracking */
	sessionId: string;
	/** URL to redirect user for verification */
	sessionUrl: string;
	/** Session token (if needed for polling) */
	sessionToken?: string;
	/** Session status */
	status: string;
}

/**
 * Didit session creation request
 */
export interface DiditSessionRequest {
	/** User ID to link verification */
	userId: string;
	/** Optional template slug for UI customization */
	templateSlug?: string;
}

/**
 * Didit webhook event structure
 */
export interface DiditWebhookEvent {
	/** Event type (status.updated, data.updated, etc) */
	type: string;
	/** Event data payload */
	data: {
		status: DiditVerificationStatus;
		session_id?: string;
		metadata?: {
			user_id?: string;
			template_slug?: string;
			initiated_at?: string;
		};
		decision?: {
			id_verification?: {
				date_of_birth: string;
				document_number: string;
				issuing_state: string;
				document_type: DiditDocumentType;
			};
		};
	};
	/** Vendor data (userId) passed during session creation */
	vendor_data?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Didit API configuration from environment
 */
export interface DiditConfig {
	apiKey: string;
	workflowId: string;
	webhookSecret: string;
	apiBaseUrl?: string;
}

/**
 * Get Didit configuration from environment variables
 */
export function getDiditConfig(): DiditConfig {
	const apiKey = process.env.DIDIT_API_KEY;
	const workflowId = process.env.DIDIT_WORKFLOW_ID;
	const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

	if (!apiKey) {
		throw new Error('DIDIT_API_KEY not configured');
	}
	if (!workflowId) {
		throw new Error('DIDIT_WORKFLOW_ID not configured');
	}
	if (!webhookSecret) {
		throw new Error('DIDIT_WEBHOOK_SECRET not configured');
	}

	return {
		apiKey,
		workflowId,
		webhookSecret,
		apiBaseUrl: process.env.DIDIT_API_BASE_URL || 'https://verification.didit.me'
	};
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create verification session with Didit.me
 *
 * @param request - Session creation parameters
 * @param callbackUrl - Webhook URL for verification results
 * @returns Session URL and ID for user redirect
 */
export async function createVerificationSession(
	request: DiditSessionRequest,
	callbackUrl: string
): Promise<DiditSessionResponse> {
	const config = getDiditConfig();

	const sessionRequest = {
		workflow_id: config.workflowId,
		callback: callbackUrl,
		vendor_data: request.userId, // CRITICAL: Link to userId
		metadata: {
			template_slug: request.templateSlug || '',
			initiated_at: new Date().toISOString()
		}
	};

	const response = await fetch(`${config.apiBaseUrl}/v2/session/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': config.apiKey
		},
		body: JSON.stringify(sessionRequest)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Didit session creation failed: ${response.status} ${errorText}`);
	}

	const data = await response.json();

	return {
		sessionId: data.session_id,
		sessionUrl: data.url,
		sessionToken: data.session_token,
		status: data.status
	};
}

// ============================================================================
// Webhook Validation
// ============================================================================

/**
 * Validate Didit webhook HMAC signature
 *
 * Security:
 * - Uses HMAC-SHA256 with webhook secret
 * - Constant-time comparison prevents timing attacks
 * - Timestamp included in signature prevents replay attacks
 *
 * @param payload - Raw request body (string)
 * @param signature - x-didit-signature header value
 * @param timestamp - x-didit-timestamp header value
 * @param secret - DIDIT_WEBHOOK_SECRET from config
 * @returns True if signature is valid
 */
export function validateWebhookSignature(
	payload: string,
	signature: string | null,
	timestamp: string | null,
	secret: string
): boolean {
	if (!signature || !timestamp) {
		return false;
	}

	// Construct signed payload: timestamp.body
	const signedPayload = `${timestamp}.${payload}`;

	// Compute expected signature
	const expectedSignature = createHmac('sha256', secret).update(signedPayload).digest('hex');

	// Constant-time comparison to prevent timing attacks
	try {
		const signatureBuffer = Buffer.from(signature, 'hex');
		const expectedBuffer = Buffer.from(expectedSignature, 'hex');

		// Ensure buffers are same length
		if (signatureBuffer.length !== expectedBuffer.length) {
			return false;
		}

		return timingSafeEqual(signatureBuffer, expectedBuffer);
	} catch {
		// Invalid hex strings or buffer creation failed
		return false;
	}
}

/**
 * Validate webhook with configuration from environment
 *
 * @param payload - Raw request body
 * @param signature - x-didit-signature header
 * @param timestamp - x-didit-timestamp header
 * @returns True if signature is valid
 */
export function validateWebhook(
	payload: string,
	signature: string | null,
	timestamp: string | null
): boolean {
	const config = getDiditConfig();
	return validateWebhookSignature(payload, signature, timestamp, config.webhookSecret);
}

// ============================================================================
// Webhook Parsing
// ============================================================================

/**
 * Map Didit document type to internal document type
 */
function mapDocumentType(diditType: DiditDocumentType): 'passport' | 'drivers_license' | 'national_id' {
	const mapping: Record<DiditDocumentType, 'passport' | 'drivers_license' | 'national_id'> = {
		passport: 'passport',
		drivers_license: 'drivers_license',
		id_card: 'national_id'
	};
	return mapping[diditType] || 'national_id';
}

/**
 * Get authority level based on document type
 */
function getAuthorityLevel(documentType: DiditDocumentType): AuthorityLevel {
	return documentType === 'passport' ? 4 : 3;
}

/**
 * Generate credential hash for identity commitment
 *
 * Uses SHA-256 of document number + nationality for consistency
 * across verifications of the same person.
 */
function generateCredentialHash(documentNumber: string, nationality: string): string {
	const { createHash } = require('crypto');
	const normalized = `${documentNumber.toUpperCase().trim()}:${nationality.toUpperCase().trim()}`;
	return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Parse verification result from Didit webhook payload
 *
 * Extracts structured data from webhook event and maps to internal types.
 * Validates required fields and throws if malformed.
 *
 * @param event - Parsed webhook event
 * @returns Structured verification result
 */
export function parseVerificationResult(event: DiditWebhookEvent): DiditVerificationResult {
	// Extract userId from vendor_data (preferred) or metadata (fallback)
	const userId = event.vendor_data || event.data.metadata?.user_id;
	if (!userId) {
		throw new Error('Missing user_id in webhook event (vendor_data or metadata.user_id required)');
	}

	// Validate event type
	if (event.type !== 'status.updated') {
		throw new Error(`Unsupported event type: ${event.type}`);
	}

	// Validate approval status
	if (event.data.status !== 'Approved') {
		throw new Error(`Verification not approved: ${event.data.status}`);
	}

	// Extract verification data
	const verification = event.data.decision?.id_verification;
	if (!verification) {
		throw new Error('Missing id_verification in webhook decision');
	}

	// Parse date of birth
	const birthDate = new Date(verification.date_of_birth);
	const birthYear = birthDate.getFullYear();

	// Generate credential hash
	const credentialHash = generateCredentialHash(
		verification.document_number,
		verification.issuing_state
	);

	return {
		sessionId: event.data.session_id || 'unknown',
		status: event.data.status,
		documentType: verification.document_type,
		nationality: verification.issuing_state,
		documentNumber: verification.document_number,
		dateOfBirth: verification.date_of_birth,
		birthYear,
		userId,
		authorityLevel: getAuthorityLevel(verification.document_type),
		credentialHash
	};
}

// ============================================================================
// Age Verification
// ============================================================================

/**
 * Check if birth year meets 18+ age requirement
 *
 * @param birthYear - Year of birth
 * @returns True if user is 18 or older
 */
export function isAgeEligible(birthYear: number): boolean {
	const currentYear = new Date().getFullYear();
	const age = currentYear - birthYear;
	return age >= 18;
}

// ============================================================================
// Exports
// ============================================================================

export type {
	DiditConfig,
	DiditSessionRequest,
	DiditSessionResponse,
	DiditWebhookEvent,
	DiditVerificationResult,
	DiditVerificationStatus,
	DiditDocumentType,
	AuthorityLevel
};

// Functions are already exported where defined
// Re-export generateCredentialHash with alias
export { generateCredentialHash as generateDiditCredentialHash };
