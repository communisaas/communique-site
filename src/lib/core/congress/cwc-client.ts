/**
 * CWC (Communicating With Congress) API Client
 *
 * Handles submission of citizen messages to congressional offices
 * via the official CWC system.
 *
 * Senate: Direct API access with API key to soapbox.senate.gov
 * House: Requires IP whitelisting from House CWC vendor program
 *        (https://www.house.gov/doing-business-with-the-house/communicating-with-congress-cwc)
 *        Contact: CWCVendors@mail.house.gov
 *
 * IMPORTANT: House submissions require either:
 * 1. Whitelisted IP address (requires official vendor approval)
 * 2. GCP proxy server with whitelisted IP (configured via GCP_PROXY_URL env var)
 *
 * Without proper configuration, House submissions will FAIL with clear error messages.
 */

import { CWCGenerator } from './cwc-generator';
import type { CwcTemplate as Template } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';

export interface CongressionalOffice {
	bioguideId: string;
	name: string;
	chamber: 'house' | 'senate';
	officeCode: string;
	state: string;
	district: string;
	party: string;
}

// Use EmailServiceUser which properly handles ephemeral delivery address
type User = EmailServiceUser;

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
	// Use lazy getters for env vars to ensure they're read at call time, not import time
	// This is critical for test environments where env vars may be set after module import
	private get apiKey(): string {
		return process.env.CWC_API_KEY || '';
	}

	private get baseUrl(): string {
		return process.env.CWC_API_BASE_URL || 'https://soapbox.senate.gov/api';
	}

	private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
	private readonly MAX_RETRIES = 3;
	private readonly RETRY_DELAY = 1000; // 1 second

	constructor() {
		// Env vars are now read lazily via getters, so no need to check here
	}

	/**
	 * Execute fetch with timeout and retry logic
	 */
	private async fetchWithTimeout(
		url: string,
		options: RequestInit,
		timeout: number = this.DEFAULT_TIMEOUT
	): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			return response;
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === 'AbortError') {
				const timeoutError = new Error(`Request timeout after ${timeout}ms: ${url}`);
				console.error('[CWC Client] Timeout:', timeoutError.message);
				throw timeoutError;
			}
			throw error;
		}
	}

	/**
	 * Execute fetch with retry logic for transient failures
	 */
	private async fetchWithRetry(
		url: string,
		options: RequestInit,
		timeout: number = this.DEFAULT_TIMEOUT
	): Promise<Response> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
			try {
				const response = await this.fetchWithTimeout(url, options, timeout);

				// Don't retry on client errors (4xx except 429)
				if (response.status >= 400 && response.status < 500 && response.status !== 429) {
					return response;
				}

				// Retry on server errors (5xx) or rate limiting (429)
				if (response.status === 429 || response.status >= 500) {
					if (attempt < this.MAX_RETRIES - 1) {
						const delay = this.RETRY_DELAY * Math.pow(2, attempt);
						console.warn(
							`[CWC Client] Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`
						);
						await this.delay(delay);
						continue;
					}
				}

				return response;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Don't retry on timeout if it's the last attempt
				if (attempt === this.MAX_RETRIES - 1) {
					console.error(`[CWC Client] Request failed after ${this.MAX_RETRIES} attempts:`, lastError.message);
					throw lastError;
				}

				// Exponential backoff for retries
				const delay = this.RETRY_DELAY * Math.pow(2, attempt);
				console.warn(
					`[CWC Client] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES}): ${lastError.message}`
				);
				await this.delay(delay);
			}
		}

		throw lastError || new Error('Request failed after retries');
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
			console.error('[CWC Senate] CWC_API_KEY not configured:', {
				office: senator.name,
				state: senator.state
			});
			return {
				success: false,
				status: 'failed',
				office: senator.name,
				timestamp: new Date().toISOString(),
				error: 'Senate CWC delivery not configured. Set CWC_API_KEY environment variable.'
			};
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
					id: user.id,
					name: user.name || 'Constituent',
					email: user.email,
					phone: user.phone || undefined, // Convert null to undefined
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

			// Submit to Senate CWC endpoint
			// CWC_PRODUCTION=true switches from testing to production endpoint
			const path = process.env.CWC_PRODUCTION === 'true' ? '/messages/' : '/testing-messages/';
			const endpoint = `${this.baseUrl}${path}?apikey=${this.apiKey}`;

			const response = await this.fetchWithRetry(endpoint, {
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
	 * Submit message to House office via CWC API
	 *
	 * IMPORTANT: House CWC API requires IP whitelisting from the House vendor program.
	 * See: https://www.house.gov/doing-business-with-the-house/communicating-with-congress-cwc
	 * Contact: CWCVendors@mail.house.gov
	 *
	 * Options for House submission:
	 * 1. Direct API access (requires whitelisted server IP - not available in most deployments)
	 * 2. GCP proxy server (requires GCP_PROXY_URL env var pointing to whitelisted proxy)
	 * 3. Alternative delivery (e.g., email via representative's contact form)
	 *
	 * This method will FAIL CLEARLY if House CWC is not properly configured.
	 * NO SILENT SIMULATION - users must know if their message is not being delivered.
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

		const timestamp = new Date().toISOString();
		const baseResult = {
			office: representative.name,
			timestamp
		};

		// Check for GCP proxy configuration
		const proxyUrl = process.env.GCP_PROXY_URL;
		const proxyAuthToken = process.env.GCP_PROXY_AUTH_TOKEN;

		if (!proxyUrl) {
			const errorMessage = [
				'House CWC delivery not configured.',
				'House of Representatives requires IP whitelisting for CWC API access.',
				'To enable House submissions:',
				'1. Apply for CWC vendor program: https://www.house.gov/doing-business-with-the-house/communicating-with-congress-cwc',
				'2. Contact CWCVendors@mail.house.gov for IP whitelist approval',
				'3. Configure GCP_PROXY_URL environment variable with approved proxy server',
				'Alternative: Use representative contact forms for House members.'
			].join(' ');

			console.error('[CWC House] Configuration missing:', {
				office: representative.name,
				bioguideId: representative.bioguideId,
				district: `${representative.state}-${representative.district}`,
				error: 'GCP_PROXY_URL not configured',
				timestamp
			});

			return {
				...baseResult,
				success: false,
				status: 'failed',
				error: errorMessage
			};
		}

		try {
			console.log('[CWC House] Attempting submission via GCP proxy:', {
				office: representative.name,
				bioguideId: representative.bioguideId,
				district: `${representative.state}-${representative.district}`,
				proxyUrl: proxyUrl.replace(/\/\/.*@/, '//<REDACTED>@'), // Redact auth in URL if present
				hasAuthToken: !!proxyAuthToken,
				timestamp
			});

			// Prepare House CWC submission payload
			const jobId = `house-${Date.now()}-${representative.bioguideId}`;
			const submission = {
				jobId,
				officeCode: representative.officeCode,
				recipientName: representative.name,
				recipientEmail: `${representative.bioguideId}@house.gov`,
				subject: template.title,
				message: personalizedMessage,
				senderName: user.name,
				senderEmail: user.email,
				senderAddress: `${user.street}, ${user.city}, ${user.state} ${user.zip}`,
				senderPhone: user.phone || '',
				priority: 'normal' as const,
				metadata: {
					templateId: template.id,
					userId: user.id,
					bioguideId: representative.bioguideId,
					submissionTime: timestamp
				}
			};

			// Submit to GCP proxy with timeout and retry
			const response = await this.fetchWithRetry(`${proxyUrl}/api/house/submit`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: proxyAuthToken ? `Bearer ${proxyAuthToken}` : '',
					'X-Request-ID': jobId
				},
				body: JSON.stringify(submission)
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('[CWC House] Proxy submission failed:', {
					office: representative.name,
					bioguideId: representative.bioguideId,
					status: response.status,
					statusText: response.statusText,
					errorBody: errorText,
					jobId,
					timestamp
				});

				// Provide specific error messages based on status code
				let userErrorMessage = `House CWC submission failed (HTTP ${response.status})`;
				if (response.status === 401 || response.status === 403) {
					userErrorMessage += '. Proxy authentication failed. Check GCP_PROXY_AUTH_TOKEN configuration.';
				} else if (response.status === 404) {
					userErrorMessage += '. Proxy endpoint not found. Verify GCP_PROXY_URL is correct.';
				} else if (response.status === 429) {
					userErrorMessage += '. Rate limit exceeded. Please try again later.';
				} else if (response.status >= 500) {
					userErrorMessage += '. Proxy server error. This may be temporary.';
				}
				userErrorMessage += ` Error details: ${errorText}`;

				return {
					...baseResult,
					success: false,
					status: 'failed',
					error: userErrorMessage
				};
			}

			const result = await response.json();
			console.log('[CWC House] Submission successful:', {
				office: representative.name,
				bioguideId: representative.bioguideId,
				submissionId: result.submissionId,
				jobId,
				timestamp
			});

			return {
				...baseResult,
				success: true,
				status: 'submitted',
				messageId: result.submissionId || jobId,
				confirmationNumber: result.submissionId
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('[CWC House] Submission error:', {
				office: representative.name,
				bioguideId: representative.bioguideId,
				error: errorMessage,
				errorType: error instanceof Error ? error.constructor.name : typeof error,
				stack: error instanceof Error ? error.stack : undefined,
				timestamp
			});

			// Determine if this is a network/timeout error
			const isNetworkError =
				errorMessage.includes('timeout') ||
				errorMessage.includes('ECONNREFUSED') ||
				errorMessage.includes('ENOTFOUND') ||
				errorMessage.includes('fetch failed');

			let userErrorMessage = `House CWC submission failed: ${errorMessage}`;
			if (isNetworkError) {
				userErrorMessage += '. The proxy server may be unreachable or down. Please verify GCP_PROXY_URL configuration and network connectivity.';
			}

			return {
				...baseResult,
				success: false,
				status: 'failed',
				error: userErrorMessage
			};
		}
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
			const response = await this.fetchWithRetry(`${this.baseUrl}/active_offices?apikey=${this.apiKey}`, {
				method: 'GET'
			});

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
