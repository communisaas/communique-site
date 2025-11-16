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

export interface CongressionalOffice {
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
	confirmationNumber?: string;
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
		_personalizedMessage: string
	): Promise<CWCSubmissionResult> {
		if (senator.chamber !== 'senate') {
			throw new Error('This method is only for Senate offices');
		}

		if (!this.apiKey) {
			return this.simulateSubmission(senator, 'no_api_key');
		}

		try {
			// Convert CongressionalOffice to UserRepresentative format for CWC Generator
			const targetRep = {
				bioguideId: senator.bioguideId,
				name: senator.name,
				party: senator.party,
				state: senator.state,
				district: senator.district,
				chamber: senator.chamber,
				officeCode: senator.officeCode
			};

			// Create mock house representative for interface compliance
			const mockHouseRep = {
				bioguideId: '',
				name: '',
				party: '',
				state: '',
				district: '',
				chamber: 'house' as const,
				officeCode: ''
			};

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
						house: mockHouseRep,
						senate: [targetRep]
					}
				},
				_targetRep: targetRep,
				personalizedMessage: _personalizedMessage
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
		} catch (error) {
			console.error('Error occurred');
			return {
				success: false,
				status: 'failed',
				office: senator.name,
				timestamp: new Date().toISOString(),
				error: 'Unknown error'
			};
		}
	}

	/**
	 * Submit message to House office via GCP proxy
	 * HACKATHON: Uses GCP proxy server at 34.171.151.252
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
		const proxyUrl = process.env.GCP_PROXY_URL || 'http://34.171.151.252:8080';
		const proxyAuthToken = process.env.GCP_PROXY_AUTH_TOKEN;

		if (!proxyUrl) {
			console.warn('GCP_PROXY_URL not configured - House submissions will be simulated');
			return this.simulateHouseSubmission(representative);
		}

		try {
			console.log('House CWC submission via GCP proxy:', {
				office: representative.name,
				district: representative.district,
				state: representative.state,
				proxyUrl
			});

			// Prepare House CWC submission payload
			const submission = {
				jobId: `house-${Date.now()}-${representative.bioguideId}`,
				officeCode: representative.officeCode,
				recipientName: representative.name,
				recipientEmail: `${representative.bioguideId}@house.gov`, // Mock email
				subject: template.title,
				message: personalizedMessage,
				senderName: user.name,
				senderEmail: user.email,
				senderAddress: `${user.street}, ${user.city}, ${user.state} ${user.zip}`,
				senderPhone: '',
				priority: 'normal' as const,
				metadata: {
					templateId: template.id,
					userId: user.id,
					bioguideId: representative.bioguideId,
					submissionTime: new Date().toISOString()
				}
			};

			// Submit to GCP proxy
			const response = await fetch(`${proxyUrl}/api/house/submit`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': proxyAuthToken ? `Bearer ${proxyAuthToken}` : '',
					'X-Request-ID': submission.jobId
				},
				body: JSON.stringify(submission)
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`House proxy submission failed (${response.status}):`, errorText);
				
				return {
					success: false,
					status: 'failed',
					office: representative.name,
					timestamp: new Date().toISOString(),
					error: `House proxy error: ${response.status} ${errorText}`
				};
			}

			const result = await response.json();
			console.log('House proxy submission successful:', result);

			return {
				success: true,
				status: 'submitted',
				office: representative.name,
				timestamp: new Date().toISOString(),
				messageId: result.submissionId || submission.jobId,
				confirmationNumber: result.submissionId
			};

		} catch (error) {
			console.error('House CWC submission error:', error);
			
			// If proxy fails, fall back to simulation for hackathon demo
			return this.simulateHouseSubmission(representative);
		}
	}

	/**
	 * Simulate House submission when proxy is unavailable
	 */
	private simulateHouseSubmission(representative: CongressionalOffice): CWCSubmissionResult {
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
		_personalizedMessage: string
	): Promise<CWCSubmissionResult[]> {
		const results: CWCSubmissionResult[] = [];

		for (const rep of representatives) {
			try {
				let result: CWCSubmissionResult;

				if (rep.chamber === 'senate') {
					result = await this.submitToSenate(template, user, rep, _personalizedMessage);
				} else {
					result = await this.submitToHouse(template, user, rep, _personalizedMessage);
				}

				results.push(result);

				// Add delay between submissions to avoid rate limiting
				await this.delay(1000);
			} catch (error) {
				console.error('Error occurred');
				results.push({
					success: false,
					status: 'failed',
					office: rep.name,
					timestamp: new Date().toISOString(),
					error: 'Unknown error'
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
				cwcResponse = (await response.json()) as CWCResponse;
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
		} catch (error) {
			console.error('Error occurred');
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
		} catch (error) {
			return {
				success: false,
				error: 'Failed to retrieve offices'
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
		} catch (error) {
			return {
				connected: false,
				error: 'Connection failed'
			};
		}
	}
}

// Singleton instance
export const cwcClient = new CWCClient();
