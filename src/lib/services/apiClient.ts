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
	async list<T = unknown>(): Promise<ApiResponse<T>> {
		return api.get('/templates');
	},

	async create<T = unknown>(template: Record<string, unknown>): Promise<ApiResponse<T>> {
		// Disable automatic toast - let caller handle success/error messaging
		const res = await api.post('/templates', template, { showToast: false });
		if (
			res.success &&
			res.data &&
			typeof res.data === 'object' &&
			res.data !== null &&
			'template' in res.data
		) {
			const templateData = (res.data as { template: T }).template;
			return { success: true, data: templateData, status: res.status };
		}
		return res as ApiResponse<T>;
	},

	async update<T = unknown>(
		id: string,
		template: Record<string, unknown>
	): Promise<ApiResponse<T>> {
		const res = await api.put(`/templates/${id}`, template);
		if (
			res.success &&
			res.data &&
			typeof res.data === 'object' &&
			res.data !== null &&
			'template' in res.data
		) {
			const templateData = (res.data as { template: T }).template;
			return { success: true, data: templateData, status: res.status };
		}
		return res as ApiResponse<T>;
	},

	async delete<T = unknown>(id: string): Promise<ApiResponse<T>> {
		return api.delete(`/templates/${id}`);
	}
};

// Analytics API wrapper
export const analyticsApi = {
	async track<T = unknown>(
		_event: string,
		data?: Record<string, unknown>
	): Promise<ApiResponse<T>> {
		return api.post('/civic/analytics', { _event, ...(data ?? {}) }, { skipErrorLogging: true });
	}
};

// Congress API wrapper
export const congressApi = {
	async lookup<T = unknown>(address: string): Promise<ApiResponse<T>> {
		return api.post('/address/lookup', { address });
	}
};

// Legacy compatibility message removed (console cleanup)
