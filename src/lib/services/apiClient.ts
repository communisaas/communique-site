/**
 * API Client for Communique
 * Handles all API requests with proper error handling and types
 */

import { toast } from '$lib/stores/toast';
import type { ApiResponse, ApiError } from '$lib/types/errors';

// Custom error class for API errors
export class ApiClientError extends Error {
  constructor(
    public readonly error: ApiError,
    public readonly status: number,
    public readonly errors?: ApiError[]
  ) {
    super(error.message);
    this.name = 'ApiClientError';
  }
}

// Request options with loading callback
interface RequestOptions extends RequestInit {
  showToast?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { onLoadingChange, showToast = true, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    };

    const config = { ...defaultOptions, ...fetchOptions };

    // Start loading
    onLoadingChange?.(true);

    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json();

      // Handle API response format
      if (!data.success) {
        const primaryError = data.error || (data.errors && data.errors[0]);
        if (primaryError) {
          // Show toast for user-facing errors
          if (showToast && primaryError.type !== 'validation') {
            toast.error(primaryError.message);
          }
          throw new ApiClientError(primaryError, response.status, data.errors);
        } else {
          // Fallback for malformed error responses
          const fallbackError: ApiError = {
            type: 'server',
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred'
          };
          if (showToast) {
            toast.error(fallbackError.message);
          }
          throw new ApiClientError(fallbackError, response.status);
        }
      }

      return data.data as T;

    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError: ApiError = {
          type: 'network',
          code: 'NETWORK_CONNECTION',
          message: 'Network connection failed. Please check your internet connection and try again.'
        };
        if (showToast) {
          toast.error(networkError.message);
        }
        throw new ApiClientError(networkError, 0);
      }
      
      // Re-throw ApiClientError as-is
      if (error instanceof ApiClientError) {
        throw error;
      }
      
      // Handle other unexpected errors
      const unexpectedError: ApiError = {
        type: 'server',
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred'
      };
      if (showToast) {
        toast.error(unexpectedError.message);
      }
      throw new ApiClientError(unexpectedError, 500);

    } finally {
      // Stop loading
      onLoadingChange?.(false);
    }
  }

  async get<T = any>(
    endpoint: string, 
    params?: Record<string, string>,
    options: RequestOptions = {}
  ): Promise<T> {
    const searchParams = params ? `?${new URLSearchParams(params)}` : '';
    return this.request<T>(`${endpoint}${searchParams}`, {
      ...options,
      method: 'GET',
    });
  }

  async post<T = any>(
    endpoint: string, 
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(
    endpoint: string, 
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  async patch<T = any>(
    endpoint: string, 
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();