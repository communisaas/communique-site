/**
 * API CLIENT - BACKWARD COMPATIBILITY LAYER
 *
 * This file now re-exports from the unified API client in core/api
 * to maintain backward compatibility with existing imports.
 *
 * @deprecated Import directly from '$lib/core/api' instead
 */

// Import for use in wrapper functions
import { api, type ApiResponse } from '$lib/core/api';

// Re-export everything from the unified core API client
export { api, ApiClient, ApiClientError, type ApiResponse, type ApiOptions } from '$lib/core/api';

// Re-export toast integration for components that expect it here
export { toast } from '$lib/stores/toast.svelte';

// Templates API wrapper
export const templatesApi = {
	async list<T = any>(): Promise<ApiResponse<T>> {
		return api.get('/templates');
	},

	async create<T = any>(template: any): Promise<ApiResponse<T>> {
		const res = await api.post('/templates', template);
		if (
			res.success &&
			res.data &&
			typeof res.data === 'object' &&
			'template' in (res.data as any)
		) {
			return { success: true, data: (res.data as any).template as T, status: res.status };
		}
		return res as ApiResponse<T>;
	},

	async update<T = any>(id: string, template: any): Promise<ApiResponse<T>> {
		const res = await api.put(`/templates/${id}`, template);
		if (
			res.success &&
			res.data &&
			typeof res.data === 'object' &&
			'template' in (res.data as any)
		) {
			return { success: true, data: (res.data as any).template as T, status: res.status };
		}
		return res as ApiResponse<T>;
	},

	async delete<T = any>(id: string): Promise<ApiResponse<T>> {
		return api.delete(`/templates/${id}`);
	}
};

// Analytics API wrapper
export const analyticsApi = {
	async track<T = any>(event: string, data?: any): Promise<ApiResponse<T>> {
		return api.post('/civic/analytics', { event, ...data }, { skipErrorLogging: true });
	}
};

// Congress API wrapper
export const congressApi = {
	async lookup<T = any>(address: string): Promise<ApiResponse<T>> {
		return api.post('/address/lookup', { address });
	}
};

// Legacy compatibility message
if (typeof window !== 'undefined' && window.console) {
	console.debug(
		'[Deprecation Notice] $lib/services/apiClient is deprecated. ' +
			'Please update imports to use $lib/core/api directly.'
	);
}
