/**
 * CWC (Congressional Web Contact) API Integration
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { CWCSubmissionData, CWCSubmissionResult } from '@/types';
import { getConfig } from '$lib/services/delivery/utils/config';

export class CWCClient {
	private client: AxiosInstance;
	private config = getConfig();

	constructor() {
		this.client = axios.create({
			baseURL: this.config.api.cwcUrl,
			timeout: 30000,
			headers: {
				Authorization: `Bearer ${this.config.api.cwcApiKey}`,
				'Content-Type': 'application/json',
				'User-Agent': 'Delivery-Platform/2.0'
			}
		});

		// Add request interceptor for logging
		if (this.config.nodeEnv === 'development') {
			this.client.interceptors.request.use(
				(config) => {
					console.log(`[CWC] ${config.method?.toUpperCase()} ${config.url}`);
					return config;
				},
				(error) => {
					console.error('[CWC] Request error:', error);
					return Promise.reject(error);
				}
			);
		}

		// Add response interceptor for error handling
		this.client.interceptors.response.use(
			(response) => response,
			(error: AxiosError) => {
				const errorMessage = this.extractErrorMessage(error);
				console.error(`[CWC] API Error: ${errorMessage}`);
				throw new IntegrationError('CWC', errorMessage, error.response?.data);
			}
		);
	}

	/**
	 * Submit a message to congressional offices via CWC API
	 */
	public async submitMessage(data: CWCSubmissionData): Promise<CWCSubmissionResult> {
		try {
			console.log(`[CWC] Submitting message for template ${data.templateId}`);

			// Validate required fields
			this.validateSubmissionData(data);

			// Prepare the API payload
			const payload = this.preparePayload(data);

			// Submit to CWC API
			const response = await this.client.post<{
				submission_id: string;
				receipt_hash: string;
				status: string;
				message?: string;
			}>('/submit', payload);

			// Parse and return the result
			return {
				success: true,
				submissionId: response.data.submission_id,
				receiptHash: response.data.receipt_hash,
				timestamp: new Date()
			};
		} catch (_error) {
			if (_error instanceof IntegrationError) {
				return {
					success: false,
					error: _error.message,
					timestamp: new Date()
				};
			}

			console.error('[CWC] Unexpected error:', error);
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Unknown error',
				timestamp: new Date()
			};
		}
	}

	/**
	 * Check the status of a submitted message
	 */
	public async checkStatus(submissionId: string): Promise<{
		status: 'pending' | 'delivered' | 'failed';
		details?: Record<string, unknown>;
	}> {
		try {
			const response = await this.client.get<{
				status: string;
				delivered_at?: string;
				error?: string;
			}>(`/status/${submissionId}`);

			return {
				status: this.mapStatus(response.data.status),
				details: response.data
			};
		} catch (_error) {
			console.error(`[CWC] Failed to check status for ${submissionId}:`, error);
			return {
				status: 'failed',
				details: { error: _error instanceof Error ? _error.message : 'Unknown error' }
			};
		}
	}

	/**
	 * Validate a congressional district
	 */
	public async validateDistrict(
		state: string,
		district: string
	): Promise<{
		valid: boolean;
		representative?: string;
		officeCode?: string;
	}> {
		try {
			const response = await this.client.get<{
				valid: boolean;
				representative?: string;
				office_code?: string;
			}>(`/validate/district/${state}/${district}`);

			return {
				valid: response.data.valid,
				representative: response.data.representative,
				officeCode: response.data.office_code
			};
		} catch (_error) {
			console.error(`[CWC] Failed to validate district ${state}-${district}:`, error);
			return { valid: false };
		}
	}

	/**
	 * Get available office codes for a state
	 */
	public async getOffices(state: string): Promise<
		Array<{
			code: string;
			name: string;
			type: 'house' | 'senate';
		}>
	> {
		try {
			const response = await this.client.get<
				Array<{
					office_code: string;
					representative_name: string;
					chamber: string;
				}>
			>(`/offices/${state}`);

			return response.data.map((office) => ({
				code: office.office_code,
				name: office.representative_name,
				type: office.chamber === 'senate' ? 'senate' : 'house'
			}));
		} catch (_error) {
			console.error(`[CWC] Failed to get offices for ${state}:`, error);
			return [];
		}
	}

	/**
	 * Validate submission data
	 */
	private validateSubmissionData(data: CWCSubmissionData): void {
		const required: Array<keyof CWCSubmissionData> = [
			'templateId',
			'userId',
			'subject',
			'text',
			'userProfile',
			'recipientOffice'
		];

		for (const field of required) {
			if (!data[field]) {
				throw new Error(`Missing required field: ${field}`);
			}
		}

		// Validate user profile fields
		const profileRequired: Array<keyof CWCSubmissionData['userProfile']> = [
			'firstName',
			'lastName',
			'email',
			'address1',
			'city',
			'state',
			'zip'
		];

		for (const field of profileRequired) {
			if (!data.userProfile[field]) {
				throw new Error(`Missing required user profile field: ${field}`);
			}
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(data.userProfile.email)) {
			throw new Error('Invalid email format');
		}

		// Validate ZIP code format
		const zipRegex = /^\d{5}(-\d{4})?$/;
		if (!zipRegex.test(data.userProfile.zip)) {
			throw new Error('Invalid ZIP code format');
		}
	}

	/**
	 * Prepare the API payload
	 */
	private preparePayload(data: CWCSubmissionData): Record<string, unknown> {
		return {
			campaign_id: data.templateId,
			recipient: {
				office_code: data.recipientOffice,
				// Some CWC APIs require specific targeting
				target_bioguide_id: this.extractBioguideId(data.recipientOffice)
			},
			constituent: {
				prefix: '',
				first_name: data.userProfile.firstName,
				last_name: data.userProfile.lastName,
				email: data.userProfile.email,
				phone: '',
				address_1: data.userProfile.address1,
				address_2: data.userProfile.address2 || '',
				city: data.userProfile.city,
				state: data.userProfile.state,
				zip: data.userProfile.zip,
				country: 'US'
			},
			message: {
				subject: data.subject,
				body: this.formatMessageBody(data.text, data.personalConnection),
				is_response: false,
				newsletter_opt_in: false
			},
			metadata: {
				source: 'delivery_platform',
				message_id: data.messageId,
				timestamp: new Date().toISOString()
			}
		};
	}

	/**
	 * Format the message body with personal connection
	 */
	private formatMessageBody(text: string, personalConnection?: string): string {
		if (!personalConnection) {
			return text;
		}

		// Add personal connection as a prefixed section
		return `[Personal Connection]\n${personalConnection}\n\n---\n\n${text}`;
	}

	/**
	 * Extract Bioguide ID from office code if present
	 */
	private extractBioguideId(officeCode: string): string | undefined {
		// Pattern: STATE_BIOGUIDE (e.g., "CA_P000608")
		const match = officeCode.match(/^[A-Z]{2}_([A-Z]\d{6})$/);
		return match?.[1];
	}

	/**
	 * Map CWC status to our status enum
	 */
	private mapStatus(cwcStatus: string): 'pending' | 'delivered' | 'failed' {
		switch (cwcStatus.toLowerCase()) {
			case 'delivered':
			case 'success':
			case 'completed':
				return 'delivered';
			case 'pending':
			case 'processing':
			case 'queued':
				return 'pending';
			default:
				return 'failed';
		}
	}

	/**
	 * Extract error message from Axios error
	 */
	private extractErrorMessage(error: AxiosError): string {
		if (error.response) {
			const data = error.response.data as Record<string, unknown>;
			return (
				(data?.message as string) ||
				(data?.error as string) ||
				`HTTP ${error.response.status}: ${error.response.statusText}`
			);
		}

		if (error.request) {
			return 'No response from CWC API';
		}

		return _error.message || 'Unknown error';
	}
}

// Custom Integration Error
class IntegrationError extends Error {
	constructor(
		public service: string,
		message: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'IntegrationError';
	}
}
