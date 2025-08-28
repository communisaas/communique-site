export type ErrorType = 'validation' | 'network' | 'server' | 'authentication' | 'authorization';

export interface ApiError {
	type: ErrorType;
	code: string;
	message: string;
	details?: Record<string, unknown>;
	field?: string; // For field-specific validation errors
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: ApiError;
	errors?: ApiError[]; // For multiple validation errors
}

// Predefined error codes and messages
export const ERROR_CODES = {
	// Validation errors
	VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
	VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
	VALIDATION_TOO_LONG: 'VALIDATION_TOO_LONG',
	VALIDATION_TOO_SHORT: 'VALIDATION_TOO_SHORT',
	VALIDATION_DUPLICATE: 'VALIDATION_DUPLICATE',
	
	// Network errors
	NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
	NETWORK_OFFLINE: 'NETWORK_OFFLINE',
	NETWORK_CONNECTION: 'NETWORK_CONNECTION',
	
	// Server errors
	SERVER_INTERNAL: 'SERVER_INTERNAL',
	SERVER_DATABASE: 'SERVER_DATABASE',
	SERVER_RATE_LIMIT: 'SERVER_RATE_LIMIT',
	
	// Auth errors
	AUTH_REQUIRED: 'AUTH_REQUIRED',
	AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
	AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
} as const;

export const ERROR_MESSAGES = {
	[ERROR_CODES.VALIDATION_REQUIRED]: 'This field is required',
	[ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Invalid format',
	[ERROR_CODES.VALIDATION_TOO_LONG]: 'Text is too long',
	[ERROR_CODES.VALIDATION_TOO_SHORT]: 'Text is too short',
	[ERROR_CODES.VALIDATION_DUPLICATE]: 'This value already exists',
	
	[ERROR_CODES.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
	[ERROR_CODES.NETWORK_OFFLINE]: 'You appear to be offline. Please check your connection.',
	[ERROR_CODES.NETWORK_CONNECTION]: 'Connection error. Please try again.',
	
	[ERROR_CODES.SERVER_INTERNAL]: 'Something went wrong on our end. Please try again.',
	[ERROR_CODES.SERVER_DATABASE]: 'Database error. Please try again later.',
	[ERROR_CODES.SERVER_RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
	
	[ERROR_CODES.AUTH_REQUIRED]: 'Please sign in to continue',
	[ERROR_CODES.AUTH_INVALID_TOKEN]: 'Your session has expired. Please sign in again.',
	[ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action',
} as const;

// Helper functions for creating errors
export function createApiError(
	type: ErrorType,
	code: keyof typeof ERROR_CODES,
	message?: string,
	field?: string,
	details?: Record<string, unknown>
): ApiError {
	return {
		type,
		code: ERROR_CODES[code],
		message: message || ERROR_MESSAGES[ERROR_CODES[code]],
		field,
		details
	};
}

export function createValidationError(
	field: string,
	code: keyof typeof ERROR_CODES,
	message?: string
): ApiError {
	return createApiError('validation', code, message, field);
}

export class AppError extends Error {
	constructor(
		public readonly apiError: ApiError
	) {
		super(apiError.message);
		this.name = 'AppError';
	}
}