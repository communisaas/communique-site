/**
 * UNIFIED API CLIENT
 * 
 * Centralized fetch wrapper with consistent error handling,
 * retries, timeouts, and response standardization
 */

import { browser } from '$app/environment';

export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	status?: number;
}

export interface ApiOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string>;
	body?: any;
	timeout?: number;
	retries?: number;
	retryDelay?: number;
	skipErrorLogging?: boolean;
}

export class ApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public response?: Response
	) {
		super(message);
		this.name = 'ApiError';
	}
}

class ApiClient {
	private baseURL = '';
	private defaultTimeout = 10000; // 10 seconds
	private defaultRetries = 2;
	private defaultRetryDelay = 1000; // 1 second

	/**
	 * Make an API request with automatic error handling and retries
	 */
	async request<T = any>(
		url: string,
		options: ApiOptions = {}
	): Promise<ApiResponse<T>> {
		const {
			method = 'GET',
			headers = {},
			body,
			timeout = this.defaultTimeout,
			retries = this.defaultRetries,
			retryDelay = this.defaultRetryDelay,
			skipErrorLogging = false
		} = options;

		// Ensure we're in browser environment for client-side calls
		if (!browser && !url.startsWith('http')) {
			console.log('ApiClient: Not in browser, URL:', url, 'Browser:', browser);
			return {
				success: false,
				error: 'Client-side API calls only work in browser environment'
			};
		}

		const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const fetchOptions: RequestInit = {
			method,
			headers: {
				'Content-Type': 'application/json',
				...headers
			},
			signal: controller.signal
		};

		if (body && method !== 'GET') {
			fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
		}

		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const response = await fetch(fullUrl, fetchOptions);
				clearTimeout(timeoutId);

				// Handle non-JSON responses (like redirects)
				const contentType = response.headers.get('content-type');
				const isJson = contentType?.includes('application/json');

				if (!response.ok) {
					let errorMessage = `HTTP ${response.status}`;
					
					if (isJson) {
						try {
							const errorData = await response.json();
							errorMessage = errorData.message || errorData.error || errorMessage;
						} catch {
							errorMessage = await response.text() || errorMessage;
						}
					} else {
						errorMessage = await response.text() || errorMessage;
					}

					const apiError = new ApiError(errorMessage, response.status, response);
					
					// Don't retry 4xx errors (client errors)
					if (response.status >= 400 && response.status < 500) {
						if (!skipErrorLogging) {
							console.error('API Client Error:', {
								url: fullUrl,
								status: response.status,
								error: errorMessage
							});
						}
						return {
							success: false,
							error: errorMessage,
							status: response.status
						};
					}

					throw apiError;
				}

				// Parse response
				let data: T;
				if (isJson) {
					data = await response.json();
				} else {
					data = (await response.text()) as unknown as T;
				}

				return {
					success: true,
					data,
					status: response.status
				};

			} catch (error) {
				clearTimeout(timeoutId);
				lastError = error as Error;

				// Don't retry on abort (timeout) or network errors on last attempt
				if (attempt === retries || error instanceof DOMException) {
					break;
				}

				// Wait before retry
				await new Promise(resolve => setTimeout(resolve, retryDelay));
			}
		}

		// All retries exhausted
		const errorMessage = lastError?.message || 'Network request failed';
		if (!skipErrorLogging) {
			console.error('API Client Failed:', {
				url: fullUrl,
				attempts: retries + 1,
				error: errorMessage
			});
		}

		return {
			success: false,
			error: errorMessage,
			status: lastError instanceof ApiError ? lastError.status : undefined
		};
	}

	/**
	 * GET request
	 */
	async get<T = any>(url: string, options: Omit<ApiOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(url, { ...options, method: 'GET' });
	}

	/**
	 * POST request
	 */
	async post<T = any>(url: string, body?: any, options: Omit<ApiOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(url, { ...options, method: 'POST', body });
	}

	/**
	 * PUT request
	 */
	async put<T = any>(url: string, body?: any, options: Omit<ApiOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(url, { ...options, method: 'PUT', body });
	}

	/**
	 * DELETE request
	 */
	async delete<T = any>(url: string, options: Omit<ApiOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(url, { ...options, method: 'DELETE' });
	}

	/**
	 * PATCH request
	 */
	async patch<T = any>(url: string, body?: any, options: Omit<ApiOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(url, { ...options, method: 'PATCH', body });
	}

	/**
	 * Set base URL for relative requests
	 */
	setBaseURL(url: string): void {
		this.baseURL = url.endsWith('/') ? url.slice(0, -1) : url;
	}

	/**
	 * Set default timeout
	 */
	setTimeout(ms: number): void {
		this.defaultTimeout = ms;
	}

	/**
	 * Set default retry configuration
	 */
	setRetryConfig(retries: number, delay: number): void {
		this.defaultRetries = retries;
		this.defaultRetryDelay = delay;
	}
}

// Singleton instance
export const apiClient = new ApiClient();

// Convenience exports for common patterns
export const api = {
	get: apiClient.get.bind(apiClient),
	post: apiClient.post.bind(apiClient),
	put: apiClient.put.bind(apiClient),
	delete: apiClient.delete.bind(apiClient),
	patch: apiClient.patch.bind(apiClient)
};

// Analytics API wrapper
export const analyticsApi = {
	async track<T = any>(event: string, data?: any): Promise<ApiResponse<T>> {
		return api.post('/api/analytics', { event, ...data }, { skipErrorLogging: true });
	}
};

// Congress API wrapper  
export const congressApi = {
	async lookup<T = any>(address: string): Promise<ApiResponse<T>> {
		return api.post('/api/congress/lookup', { address });
	}
};

// Templates API wrapper
export const templatesApi = {
	async list<T = any>(): Promise<ApiResponse<T>> {
		return api.get('/api/templates');
	},
	
	async create<T = any>(template: any): Promise<ApiResponse<T>> {
		return api.post('/api/templates', template);
	},
	
	async update<T = any>(id: string, template: any): Promise<ApiResponse<T>> {
		return api.put(`/api/templates/${id}`, template);
	},
	
	async delete<T = any>(id: string): Promise<ApiResponse<T>> {
		return api.delete(`/api/templates/${id}`);
	}
};

// ApiError already exported above as class declaration