/**
 * Unified API Client for Communique
 *
 * Consolidated API client combining the best features from both implementations:
 * - Comprehensive error handling with typed errors
 * - Automatic retries with exponential backoff
 * - Request timeout support
 * - Toast notifications (optional)
 * - Loading state callbacks
 * - Standardized response format
 */

import { browser } from '$app/environment';
import { toast } from '$lib/stores/toast.svelte';
import type { ApiError } from '$lib/types/errors';

export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	errors?: ApiError[];
	status?: number;
}

export interface ApiOptions extends RequestInit {
	timeout?: number;
	retries?: number;
	retryDelay?: number;
	showToast?: boolean;
	skipErrorLogging?: boolean;
	onLoadingChange?: (loading: boolean) => void;
}

export class ApiClientError extends Error {
	constructor(
		message: string,
		public readonly status?: number,
		public readonly response?: Response,
		public readonly errors?: ApiError[]
	) {
		super(message);
		this.name = 'ApiClientError';
	}
}

class UnifiedApiClient {
	private baseURL = '';
	private defaultTimeout = 10000; // 10 seconds
	private defaultRetries = 2;
	private defaultRetryDelay = 1000; // 1 second

	constructor(baseURL: string = '') {
		this.baseURL = baseURL;
	}

	/**
	 * Make an API request with automatic error handling and retries
	 */
	async request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
		const {
			timeout = this.defaultTimeout,
			retries = this.defaultRetries,
			retryDelay = this.defaultRetryDelay,
			showToast = true,
			skipErrorLogging = false,
			onLoadingChange,
			...fetchOptions
		} = options;

		// Ensure proper path joining
		const normalizedBase = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
		const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
		const url = `${normalizedBase}${normalizedEndpoint}`;

		// Set default headers
		const headers = new Headers(fetchOptions.headers);
		if (!headers.has('Content-Type') && fetchOptions.body) {
			headers.set('Content-Type', 'application/json');
		}

		// Prepare fetch options
		const config: RequestInit = {
			...fetchOptions,
			headers,
			body: fetchOptions.body
				? typeof fetchOptions.body === 'string'
					? fetchOptions.body
					: JSON.stringify(fetchOptions.body)
				: undefined
		};

		// Start loading
		onLoadingChange?.(true);

		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				// Create abort controller for timeout
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				const response = await fetch(url, {
					...config,
					signal: controller.signal
				});

				clearTimeout(timeoutId);

				// Handle response
				const result = await this.handleResponse<T>(response);

				// Show success toast if enabled
				if (
					showToast &&
					result.success &&
					fetchOptions.method &&
					['POST', 'PUT', 'DELETE'].includes(fetchOptions.method)
				) {
					toast.success('Operation completed successfully');
				}

				onLoadingChange?.(false);
				return result;
			} catch (_error) {
				lastError = _error as Error;

				// Don't retry on abort errors
				if (_error instanceof Error && _error.name === 'AbortError') {
					break;
				}

				// Wait before retrying (exponential backoff)
				if (attempt < retries) {
					await this.sleep(retryDelay * Math.pow(2, attempt));
				}
			}
		}

		// All retries failed
		onLoadingChange?.(false);

		const errorMessage = lastError?.message || 'Request failed';

		if (!skipErrorLogging && browser) {
			console.error(`API Error: ${errorMessage}`, { url, error: lastError });
		}

		if (showToast) {
			toast.error(errorMessage);
		}

		return {
			success: false,
			error: errorMessage,
			status: 0
		};
	}

	/**
	 * Handle API response and extract data
	 */
	private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
		let data: unknown;

		try {
			const contentType = response.headers.get('content-type');
			if (contentType?.includes('application/json')) {
				data = await response.json();
			} else {
				data = await response.text();
			}
		} catch (e) {
			// Response might be empty
			data = null;
		}

		if (!response.ok) {
			const error = data?.error || data?.message || `HTTP ${response.status}`;
			const errors = data?.errors;

			throw new ApiClientError(error, response.status, response, errors);
		}

		// Check if response has standard format
		if (data && typeof data === 'object' && 'success' in data) {
			return data;
		}

		// Wrap non-standard responses
		return {
			success: true,
			data,
			status: response.status
		};
	}

	/**
	 * Convenience methods
	 */
	async get<T = any>(
		endpoint: string,
		options?: Omit<ApiOptions, 'method'>
	): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { ...options, method: 'GET' });
	}

	async post<T = any>(
		endpoint: string,
		body?: unknown,
		options?: Omit<ApiOptions, 'method' | 'body'>
	): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { ...options, method: 'POST', body });
	}

	async put<T = any>(
		endpoint: string,
		body?: unknown,
		options?: Omit<ApiOptions, 'method' | 'body'>
	): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { ...options, method: 'PUT', body });
	}

	async patch<T = any>(
		endpoint: string,
		body?: unknown,
		options?: Omit<ApiOptions, 'method' | 'body'>
	): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
	}

	async delete<T = any>(
		endpoint: string,
		options?: Omit<ApiOptions, 'method'>
	): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { ...options, method: 'DELETE' });
	}

	/**
	 * Utility: Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// Export singleton instance
export const api = new UnifiedApiClient('/api');

// Export class for custom instances
export { UnifiedApiClient as ApiClient };
