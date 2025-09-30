/**
 * Utility for properly formatting error messages for user display
 */

/**
 * Extract a user-friendly error message from various error types
 */
export function formatErrorMessage(
	error: unknown,
	fallback = 'An unexpected error occurred'
): string {
	// If it's already a string, return it
	if (typeof error === 'string') {
		return error;
	}

	// Handle null/undefined
	if (!error) {
		return fallback;
	}

	// Handle error objects with common patterns
	if (typeof error === 'object') {
		const errorObj = error as Record<string, unknown>;

		// Check for common error message patterns
		if (typeof errorObj.message === 'string' && errorObj.message.trim()) {
			return errorObj.message;
		}

		// Check for nested error with message
		if (typeof errorObj.error === 'object' && errorObj.error) {
			const nestedError = errorObj.error as Record<string, unknown>;
			if (typeof nestedError.message === 'string' && nestedError.message.trim()) {
				return nestedError.message;
			}
		}

		// Check for response with error message
		if (typeof errorObj.response === 'object' && errorObj.response) {
			const responseError = errorObj.response as Record<string, unknown>;
			if (typeof responseError.message === 'string' && responseError.message.trim()) {
				return responseError.message;
			}
		}

		// Check for API error patterns
		if (typeof errorObj.url === 'string' && typeof errorObj.error === 'object') {
			// This is likely an API client error object
			const apiError = errorObj.error as Record<string, unknown>;
			if (typeof apiError.name === 'string') {
				// Return a user-friendly message based on the error type
				switch (apiError.name) {
					case 'ApiClientError':
						return 'Network error - please check your connection and try again';
					case 'ValidationError':
						return 'Invalid data provided';
					case 'AuthenticationError':
						return 'Authentication required';
					default:
						return 'Request failed - please try again';
				}
			}
		}

		// Last resort: try to stringify if it looks like a simple object
		try {
			const str = JSON.stringify(error);
			if (str !== '{}' && str !== 'null') {
				// Don't return raw JSON, but we can at least avoid [object Object]
				return 'Request failed - please try again';
			}
		} catch {
			// JSON.stringify failed, ignore
		}
	}

	// Final fallback
	return fallback;
}

/**
 * Safely display an error in a toast notification
 */
export function toastError(
	toast: { error: (message: string) => void },
	error: unknown,
	fallback?: string
) {
	const message = formatErrorMessage(error, fallback);
	toast.error(message);
}
