/**
 * Communiqué API Integration
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
	UserProfile,
	UserResolutionResult,
	TemplateData,
	DeliveryNotification,
	APIResponse
} from '@/types';
import { getConfig } from '$lib/services/delivery/utils/config';

export class CommuniqueClient {
	private client: AxiosInstance;
	private config = getConfig();

	constructor() {
		this.client = axios.create({
			baseURL: this.config.api.communiqueUrl,
			timeout: 15000,
			headers: {
				Authorization: `Bearer ${this.config.api.communiqueApiKey}`,
				'Content-Type': 'application/json',
				'User-Agent': 'Delivery-Platform/2.0'
			}
		});

		// Add response interceptor for error handling
		this.client.interceptors.response.use(
			(response) => response,
			(error: AxiosError) => {
				const errorMessage = this.extractErrorMessage(error);
				console.error(`[Communiqué] API Error: ${errorMessage}`);
				throw new Error(errorMessage);
			}
		);
	}

	/**
	 * Resolve user by email address
	 */
	public async resolveUserByEmail(email: string): Promise<UserResolutionResult | null> {
		try {
			const response = await this.client.post<
				APIResponse<{
					user: UserProfile;
					emailType: 'primary' | 'secondary';
					isVerified: boolean;
				}>
			>('/api/users/resolve', { email });

			if (response.data.success && response.data.data) {
				return response.data.data;
			}

			return null;
		} catch (_error) {
			console.error(`[Communiqué] Failed to resolve user by email ${email}:`, error);
			return null;
		}
	}

	/**
	 * Fetch template by slug
	 */
	public async fetchTemplateBySlug(slug: string): Promise<TemplateData | null> {
		try {
			const response = await this.client.get<APIResponse<TemplateData>>(
				`/api/templates/slug/${slug}`
			);

			if (response.data.success && response.data.data) {
				return response.data.data;
			}

			return null;
		} catch (_error) {
			console.error(`[Communiqué] Failed to fetch template ${slug}:`, error);
			return null;
		}
	}

	/**
	 * Fetch template by ID
	 */
	public async fetchTemplateById(id: string): Promise<TemplateData | null> {
		try {
			const response = await this.client.get<APIResponse<TemplateData>>(`/api/templates/${id}`);

			if (response.data.success && response.data.data) {
				return response.data.data;
			}

			return null;
		} catch (_error) {
			console.error(`[Communiqué] Failed to fetch template ${id}:`, error);
			return null;
		}
	}

	/**
	 * Notify delivery result
	 */
	public async notifyDeliveryResult(notification: DeliveryNotification): Promise<void> {
		try {
			await this.client.post('/api/delivery/notify', notification);
			console.log(
				`[Communiqué] Delivery notification sent for template ${notification.templateId}`
			);
		} catch (_error) {
			console.error('[Communiqué] Failed to send delivery notification:', error);
			// Don't throw - this is a best-effort notification
		}
	}

	/**
	 * Get user's congressional district
	 */
	public async getCongressionalDistrict(userId: string): Promise<{
		state: string;
		district: string;
		representatives: Array<{
			name: string;
			party: string;
			bioguideId: string;
		}>;
	} | null> {
		try {
			const response = await this.client.get<
				APIResponse<{
					state: string;
					district: string;
					representatives: Array<{
						name: string;
						party: string;
						bioguide_id: string;
					}>;
				}>
			>(`/api/users/${userId}/district`);

			if (response.data.success && response.data.data) {
				return {
					state: response.data.data.state,
					district: response.data.data.district,
					representatives: response.data.data.representatives.map((rep) => ({
						name: rep.name,
						party: rep.party,
						bioguideId: rep.bioguide_id
					}))
				};
			}

			return null;
		} catch (_error) {
			console.error(`[Communiqué] Failed to get district for user ${userId}:`, error);
			return null;
		}
	}

	/**
	 * Verify secondary email
	 */
	public async verifySecondaryEmail(
		userId: string,
		email: string,
		verificationCode: string
	): Promise<boolean> {
		try {
			const response = await this.client.post<APIResponse<{ verified: boolean }>>(
				'/api/users/verify-email',
				{
					userId,
					email,
					code: verificationCode
				}
			);

			return response.data.success && response.data.data?.verified === true;
		} catch (_error) {
			console.error('[Communiqué] Failed to verify secondary email:', error);
			return false;
		}
	}

	/**
	 * Record template usage
	 */
	public async recordTemplateUsage(
		templateId: string,
		userId: string,
		metadata?: Record<string, unknown>
	): Promise<void> {
		try {
			await this.client.post('/api/templates/usage', {
				templateId,
				userId,
				timestamp: new Date().toISOString(),
				metadata
			});
		} catch (_error) {
			console.error('[Communiqué] Failed to record template usage:', error);
			// Don't throw - this is analytics, not critical
		}
	}

	/**
	 * Get template statistics
	 */
	public async getTemplateStats(templateId: string): Promise<{
		totalUses: number;
		uniqueUsers: number;
		successRate: number;
		lastUsed?: Date;
	} | null> {
		try {
			const response = await this.client.get<
				APIResponse<{
					total_uses: number;
					unique_users: number;
					success_rate: number;
					last_used?: string;
				}>
			>(`/api/templates/${templateId}/stats`);

			if (response.data.success && response.data.data) {
				return {
					totalUses: response.data.data.total_uses,
					uniqueUsers: response.data.data.unique_users,
					successRate: response.data.data.success_rate,
					lastUsed: response.data.data.last_used
						? new Date(response.data.data.last_used)
						: undefined
				};
			}

			return null;
		} catch (_error) {
			console.error(`[Communiqué] Failed to get stats for template ${templateId}:`, error);
			return null;
		}
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<boolean> {
		try {
			const response = await this.client.get<{ status: string }>('/health');
			return response.data.status === 'ok';
		} catch (_error) {
			console.error('[Communiqué] Health check failed:', error);
			return false;
		}
	}

	/**
	 * Extract error message from Axios error
	 */
	private extractErrorMessage(error: AxiosError): string {
		if (error.response) {
			const data = error.response.data as Record<string, unknown>;
			const apiResponse = data as APIResponse;

			if (apiResponse?.error?.message) {
				return apiResponse._error.message;
			}

			return (
				(data?.message as string) ||
				(data?.error as string) ||
				`HTTP ${error.response.status}: ${error.response.statusText}`
			);
		}

		if (error.request) {
			return 'No response from Communiqué API';
		}

		return _error.message || 'Unknown error';
	}
}
