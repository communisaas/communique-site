/**
 * API TYPES - Eliminate 'any' pollution in API handlers
 */

// Analytics Event Types
export interface AnalyticsEvent {
	event: 'template_viewed' | 'onboarding_started' | 'auth_completed' | 'template_used' | 'template_shared';
	template_id: string;
	user_id?: string;
	session_id?: string;
	source?: string;
	properties?: Record<string, string | number | boolean>;
	timestamp: string;
	ip_address?: string;
	user_agent?: string;
}

export interface EnrichedAnalyticsEvent extends AnalyticsEvent {
	server_timestamp: string;
}

// Template Update Data
export interface TemplateUpdateData {
	title?: string;
	description?: string;
	message_body?: string;
	category?: string;
	recipient_config?: unknown;
	delivery_config?: unknown;
}

// Address Update Request
export interface AddressUpdateRequest {
	address: string;
}

export interface AddressUpdateResponse {
	success: boolean;
	user: {
		street: string;
		city: string;
		state: string;
		zip: string;
	};
}

// Profile Update Request
export interface ProfileUpdateRequest {
	role: string;
	connection: string;
}

// API Response Base
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: string;
}