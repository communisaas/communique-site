/**
 * COMPREHENSIVE API RESPONSE INTERFACES
 *
 * Standardized response types for consistent API design across all endpoints
 */

// Standard Error Response
export interface ErrorResponse {
	success: false;
	error: string;
	details?: unknown;
	code?: string;
}

// Standard Success Response
export interface SuccessResponse<T = unknown> {
	success: true;
	data?: T;
	message?: string;
}

// Combined API Response Type
export type StandardAPIResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Identity Verification Responses
export interface IdentityInitResponse {
	success: boolean;
	qrCodeData?: string;
	sessionId?: string;
	config?: unknown;
	error?: string;
}

export interface IdentityStatusResponse {
	success: boolean;
	status?: 'pending' | 'verified' | 'expired' | 'failed';
	data?: unknown;
	error?: string;
}

// Challenge System Responses
export interface ChallengeResponse {
	success: boolean;
	challengeId?: string;
	status?: string;
	resolution?: string;
	payouts?: {
		challenger?: {
			amount: string;
			formatted: string;
			reputationChange: number;
		};
		creator?: {
			amount: string;
			formatted: string;
			reputationChange: number;
		};
		treasury?: {
			amount: string;
			formatted: string;
		};
	};
	error?: string;
}

// Agent Decision Responses
export interface AgentResponse<T = unknown> {
	success: boolean;
	agentId?: string;
	agentType?: string;
	decision?: T;
	confidence?: number;
	reasoning?: string;
	timestamp?: string;
	error?: string;
}

// Civic System Responses
export interface CivicRoutingResponse {
	success: boolean;
	recipients?: {
		id: string;
		name: string;
		title: string;
		contact: {
			email?: string;
			phone?: string;
			address?: string;
		};
	}[];
	district?: string;
	error?: string;
}

export interface AnalyticsResponse {
	success: boolean;
	eventId?: string;
	message?: string;
	error?: string;
}

// User Profile Responses
export interface UserProfileResponse {
	success: boolean;
	user?: {
		id: string;
		name: string | null;
		email: string;
		role?: string;
		connection?: string;
		verification?: {
			status: string;
			trust_score: number;
			verified_at?: string;
		};
	};
	error?: string;
}

// Template Responses
export interface TemplateResponse {
	success: boolean;
	template?: {
		id: string;
		title: string;
		category: string;
		usage_count: number;
		verification_status?: string;
	};
	templates?: Array<{
		id: string;
		title: string;
		category: string;
		usage_count: number;
	}>;
	error?: string;
}

// Utility functions for standardized responses
export function createSuccessResponse<T>(data?: T, message?: string): SuccessResponse<T> {
	return {
		success: true,
		...(data !== undefined && { data }),
		...(message && { message })
	};
}

export function createErrorResponse(
	error: string,
	details?: unknown,
	code?: string
): ErrorResponse {
	return {
		success: false,
		error,
		...(details !== undefined && { details }),
		...(code && { code })
	};
}
