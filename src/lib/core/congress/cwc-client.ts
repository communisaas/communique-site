/**
 * CWC (Communicating With Congress) API Client
 *
 * Handles submission of citizen messages to congressional offices
 * via the official CWC system.
 *
 * Senate: Direct API access with API key
 * House: Requires proxy server with whitelisted IPs (not implemented)
 */

import { CWCGenerator } from './cwc-generator';
import type { Template } from '$lib/types/template';

interface CongressionalOffice {
	bioguideId: string;
	name: string;
	chamber: 'house' | 'senate';
	officeCode: string;
	state: string;
	district: string;
	party: string;
}

interface User {
	id: string;
	name: string;
	email: string;
	phone?: string;
	street?: string;
	city?: string;
	state?: string;
	zip?: string;
}

interface CWCResponse {
	messageId?: string;
	id?: string;
	status?: string;
	raw?: string;
	[key: string]: unknown;
}

interface CWCSubmissionResult {
	success: boolean;
	messageId?: string;
	status: 'submitted' | 'queued' | 'failed' | 'rejected';
	office: string;
	timestamp: string;
	error?: string;
	cwcResponse?: CWCResponse;
}

export class CWCClient {
	private apiKey: string;
	private baseUrl: string;

	constructor() {
		this.apiKey = process.env.CWC_API_KEY || '';
		this.baseUrl = process.env.CWC_API_BASE_URL || 'https://soapbox.senate.gov/api';

		if (!this.apiKey) {
			console.warn('CWC_API_KEY not configured - congressional submissions will be simulated');
		}
	}

	/**
	 * Submit message to Senate office (direct API access)
	 */
	async submitToSenate(
		template: Template,
		user: User,
		senator: CongressionalOffice,
		personalizedMessage: string
	): Promise<CWCSubmissionResult> {
		if (senator.chamber !== 'senate') {
			throw new Error('This method is only for Senate offices');
		}

		if (!this.apiKey) {
			return this.simulateSubmission(senator, 'no_api_key');
		}

		try {
			// Generate CWC XML
			const cwcMessage = {
				template,
				user: {
					...user,
					address: {
						street: user.street || '',
						city: user.city || '',
						state: user.state || '',
						zip: user.zip || ''
					},
					representatives: {
						house: {} as any, // Not needed for single senator submission
						senate: [senator] as any
					}
				},
				targetRep: senator
			};

			const cwcXml = CWCGenerator.generateUserAdvocacyXML(cwcMessage);

			// Validate XML before submission
			const validation = CWCGenerator.validateXML(cwcXml);
			if (!validation.valid) {
				console.error('CWC XML validation failed:', validation.errors);
				return {
					success: false,
					status: 'failed',
					office: senator.name,
					timestamp: new Date().toISOString(),
					error: `XML validation failed: ${validation.errors.join(', ')}`
				};
			}

			// Submit to Senate CWC endpoint (testing for now)
			const endpoint = `${this.baseUrl}/testing-messages/?apikey=${this.apiKey}`;

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/xml',
					'User-Agent': 'Communique-Advocacy-Platform/1.0'
				},
				body: cwcXml
			});

			const result = await this.parseResponse(response, senator);

			// Log submission for debugging
			console.log('Senate CWC submission:', {
				office: senator.name,
				state: senator.state,
				success: result.success,
				status: result.status,
				messageId: result.messageId
			});

			return result;
		} catch (_error) {
			console.error('Senate CWC submission error:', _error);
			return {
				success: false,
				status: 'failed',
				office: senator.name,
				timestamp: new Date().toISOString(),
				error: _error instanceof Error ? _error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Submit message to House office (requires proxy - not implemented)
	 * This is a placeholder for future House integration
	 */
	async submitToHouse(
		template: Template,
		user: User,
		representative: CongressionalOffice,
		personalizedMessage: string
	): Promise<CWCSubmissionResult> {
		if (representative.chamber !== 'house') {
			throw new Error('This method is only for House offices');
		}

		// House requires proxy server with whitelisted IPs
		// For now, simulate the submission
		console.log('House CWC submission (simulated - proxy not implemented):', {
			office: representative.name,
			district: representative.district,
			state: representative.state
		});

		return {
			success: true,
			status: 'queued',
			office: representative.name,
			timestamp: new Date().toISOString(),
			messageId: `HOUSE-SIM-${Date.now()}`,
			error: 'House submissions require proxy server - currently simulated'
		};
	}

	/**
	 * Submit to all of a user's representatives
	 */
	async submitToAllRepresentatives(
		template: Template,
		user: User,
		representatives: CongressionalOffice[],
		personalizedMessage: string
	): Promise<CWCSubmissionResult[]> {
		const results: CWCSubmissionResult[] = [];

		for (const rep of representatives) {
			try {
				let result: CWCSubmissionResult;

				if (rep.chamber === 'senate') {
					result = await this.submitToSenate(template, user, rep, personalizedMessage);
				} else {
					result = await this.submitToHouse(template, user, rep, personalizedMessage);
				}

				results.push(result);

				// Add delay between submissions to avoid rate limiting
				await this.delay(1000);
			} catch (_error) {
				console.error(`Failed to submit to ${rep.name}:`, _error);
				results.push({
					success: false,
					status: 'failed',
					office: rep.name,
					timestamp: new Date().toISOString(),
					error: _error instanceof Error ? _error.message : 'Unknown error'
				});
			}
		}

		return results;
	}

	/**
	 * Parse CWC API response
	 */
	private async parseResponse(
		response: Response,
		office: CongressionalOffice
	): Promise<CWCSubmissionResult> {
		const timestamp = new Date().toISOString();
		const baseResult = {
			office: office.name,
			timestamp
		};

		try {
			if (!response.ok) {
				const errorText = await response.text();
				console.error(`CWC API error (${response.status}):`, errorText);

				return {
					...baseResult,
					success: false,
					status: 'failed' as const,
					error: `HTTP ${response.status}: ${errorText}`
				};
			}

			// Try to parse JSON response
			const contentType = response.headers.get('content-type');
			let cwcResponse: CWCResponse;

			if (contentType?.includes('application/json')) {
				cwcResponse = await response.json() as CWCResponse;
			} else {
				cwcResponse = { raw: await response.text() };
			}

			// Determine success based on response
			const success = response.status === 200 || response.status === 202;
			const messageId = cwcResponse?.messageId || cwcResponse?.id || `CWC-${Date.now()}`;
			const status = cwcResponse?.status || (success ? 'submitted' : 'failed');

			return {
				...baseResult,
				success,
				status: status as CWCSubmissionResult['status'],
				messageId,
				cwcResponse
			};
		} catch (_error) {
			console.error('Failed to parse CWC response:', _error);
			return {
				...baseResult,
				success: false,
				status: 'failed',
				error: 'Failed to parse CWC response'
			};
		}
	}

	/**
	 * Simulate submission when API key is not available
	 */
	private simulateSubmission(office: CongressionalOffice, reason: string): CWCSubmissionResult {
		return {
			success: true,
			status: 'queued',
			office: office.name,
			timestamp: new Date().toISOString(),
			messageId: `SIM-${Date.now()}`,
			error: `Simulated submission: ${reason}`
		};
	}

	/**
	 * Add delay between API calls
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get list of active Senate offices
	 * This should be called regularly to ensure we only send to participating offices
	 */
	async getActiveOffices(): Promise<{ success: boolean; offices?: unknown[]; error?: string }> {
		if (!this.apiKey) {
			return { success: false, error: 'No API key configured' };
		}

		try {
			const response = await fetch(`${this.baseUrl}/active_offices?apikey=${this.apiKey}`);

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP ${response.status}: ${await response.text()}`
				};
			}

			const offices = await response.json();

			console.log('Active Senate offices retrieved:', {
				count: Array.isArray(offices) ? offices.length : 'unknown',
				timestamp: new Date().toISOString()
			});

			return {
				success: true,
				offices: Array.isArray(offices) ? offices : [offices]
			};
		} catch (_error) {
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Failed to retrieve offices'
			};
		}
	}

	/**
	 * Test connectivity to CWC API
	 */
	async testConnection(): Promise<{ connected: boolean; error?: string }> {
		if (!this.apiKey) {
			return { connected: false, error: 'No API key configured' };
		}

		try {
			// Test connection by getting active offices
			const result = await this.getActiveOffices();
			return {
				connected: result.success,
				error: result.error
			};
		} catch (_error) {
			return {
				connected: false,
				error: _error instanceof Error ? _error.message : 'Connection failed'
			};
		}
	}
}

// Singleton instance
export const cwcClient = new CWCClient();
