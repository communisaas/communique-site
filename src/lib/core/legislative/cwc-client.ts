/**
 * CWC (Communicating With Congress) API Client
 *
 * Delivers constituent messages to US congressional offices via the
 * official CWC system. This is a US-specific adapter — other country
 * adapters would implement their own delivery clients.
 *
 * Two entry points, one delivery path:
 *
 * 1. **Direct delivery** (submitToSenate / submitToHouse)
 *    Used by the delivery-worker after TEE witness decryption. Accepts
 *    complete constituent data (name, address, email), builds CWC XML.
 *    Senate: direct API to soapbox.senate.gov
 *    House:  requires IP-whitelisted GCP proxy (CWC vendor program)
 *
 * 2. **ZK proof delivery** (deliverToOffice)
 *    Used after blockchain verification. Caller resolves constituent
 *    data via ConstituentResolver (TEE abstraction) and passes it in.
 *    Same CWC XML with full constituent data — the ZK proof proves
 *    district membership, the TEE resolves PII ephemerally.
 *
 * PII handling: Constituent data is ephemeral — resolved from encrypted
 * witness at delivery time and never persisted in plaintext. The TEE
 * abstraction (ConstituentResolver) enables swapping in AWS Nitro
 * Enclaves without changing this client.
 *
 * Rate limiting: 10 deliveries/hour per congressional office (ZK path).
 *
 * Env vars (read lazily via process.env, populated by handlePlatformEnv on CF Workers):
 *   CWC_API_KEY         — Senate API key (soapbox.senate.gov)
 *   CWC_API_BASE_URL    — Senate API base (default: https://soapbox.senate.gov/api)
 *   CWC_PRODUCTION      — "true" for production Senate endpoint, otherwise testing
 *   GCP_PROXY_URL       — House CWC proxy server URL
 *   GCP_PROXY_AUTH_TOKEN — Bearer token for GCP proxy auth
 */

import { CWCXmlGenerator } from './cwc-xml';
import type { LegislativeOffice, DeliveryResult, ZkDeliveryResult, ConstituentData } from './types';
import type { CwcTemplate as Template } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';
import { getRateLimiter } from '$lib/core/security/rate-limiter';
import { db } from '$lib/core/db';

// ── Types ──────────────────────────────────────────────────────────────────

type User = EmailServiceUser;

interface CWCResponse {
	messageId?: string;
	id?: string;
	status?: string;
	raw?: string;
	[key: string]: unknown;
}

/** Request for the ZK proof delivery path. Constituent PII is passed separately via ConstituentData. */
export interface ZkDeliveryRequest {
	submissionId: string;
	districtId: string; // e.g., "CA-12" for House, "CA" for Senate
	templateId: string;
	verificationTxHash: string;
}

// ── Client ─────────────────────────────────────────────────────────────────

export class CWCClient {
	// Lazy getters — env vars are read at call time, not import time.
	// Critical for test environments and CF Workers (handlePlatformEnv runs first).
	private get apiKey(): string {
		return process.env.CWC_API_KEY || '';
	}

	private get baseUrl(): string {
		return process.env.CWC_API_BASE_URL || 'https://soapbox.senate.gov/api';
	}

	private readonly DEFAULT_TIMEOUT = 30_000;
	private readonly MAX_RETRIES = 3;
	private readonly RETRY_DELAY = 1_000;

	// ── Full Constituent Delivery ────────────────────────────────────────

	/**
	 * Submit message to a Senate office (direct API access).
	 */
	async submitToSenate(
		template: Template,
		user: User,
		senator: LegislativeOffice,
		personalizedMessage: string
	): Promise<DeliveryResult> {
		if (senator.chamber !== 'senate') {
			throw new Error('submitToSenate requires a senate office');
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
			const cwcMessage = this.buildCwcMessage(template, user, senator, personalizedMessage);
			const cwcXml = CWCXmlGenerator.generateUserAdvocacyXML(cwcMessage);

			const validation = CWCXmlGenerator.validateXML(cwcXml);
			if (!validation.valid) {
				console.error('[CWC Senate] XML validation failed:', validation.errors);
				return {
					success: false,
					status: 'failed',
					office: senator.name,
					timestamp: new Date().toISOString(),
					error: `XML validation failed: ${validation.errors.join(', ')}`
				};
			}

			const path = process.env.CWC_PRODUCTION === 'true' ? '/messages/' : '/testing-messages/';
			const endpoint = `${this.baseUrl}${path}?apikey=${this.apiKey}`;

			const response = await this.fetchWithRetry(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/xml',
					'User-Agent': 'Commons-Advocacy-Platform/1.0'
				},
				body: cwcXml
			});

			const result = await this.parseResponse(response, senator);

			console.debug('[CWC Senate] Submission:', {
				office: senator.name,
				state: senator.state,
				success: result.success,
				status: result.status,
				messageId: result.messageId
			});

			return result;
		} catch (error) {
			return this.handleError(error, 'Senate', senator);
		}
	}

	/**
	 * Submit message to a House office via GCP proxy.
	 *
	 * House CWC API requires IP whitelisting from the House vendor program.
	 * See: https://www.house.gov/doing-business-with-the-house/communicating-with-congress-cwc
	 * Contact: CWCVendors@mail.house.gov
	 *
	 * Fails clearly when GCP proxy is not configured — no silent simulation.
	 */
	async submitToHouse(
		template: Template,
		user: User,
		representative: LegislativeOffice,
		personalizedMessage: string
	): Promise<DeliveryResult> {
		if (representative.chamber !== 'house') {
			throw new Error('submitToHouse requires a house office');
		}

		const timestamp = new Date().toISOString();
		const baseResult = { office: representative.name, timestamp };

		const proxyUrl = process.env.GCP_PROXY_URL;
		const proxyAuthToken = process.env.GCP_PROXY_AUTH_TOKEN;

		if (!proxyUrl) {
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
				error: [
					'House CWC delivery not configured.',
					'House of Representatives requires IP whitelisting for CWC API access.',
					'Configure GCP_PROXY_URL with an approved proxy server.',
					'Apply: https://www.house.gov/doing-business-with-the-house/communicating-with-congress-cwc'
				].join(' ')
			};
		}

		try {
			const cwcMessage = this.buildCwcMessage(template, user, representative, personalizedMessage);
			const cwcXml = CWCXmlGenerator.generateUserAdvocacyXML(cwcMessage);

			const validation = CWCXmlGenerator.validateXML(cwcXml);
			if (!validation.valid) {
				console.error('[CWC House] XML validation failed:', validation.errors);
				return {
					...baseResult,
					success: false,
					status: 'failed',
					error: `XML validation failed: ${validation.errors.join(', ')}`
				};
			}

			const jobId = `house-${Date.now()}-${representative.bioguideId}`;

			// Deployed proxy expects raw XML on /cwc-house-test (UAT) or /cwc-house (prod)
			const isProduction = process.env.CWC_PRODUCTION === 'true';
			const proxyPath = isProduction ? '/cwc-house' : '/cwc-house-test';

			console.debug('[CWC House] Submitting via GCP proxy:', {
				office: representative.name,
				bioguideId: representative.bioguideId,
				district: `${representative.state}-${representative.district}`,
				proxyUrl: proxyUrl.replace(/\/\/.*@/, '//<REDACTED>@'),
				proxyPath,
				hasAuthToken: !!proxyAuthToken,
				timestamp
			});

			const response = await this.fetchWithRetry(`${proxyUrl}${proxyPath}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/xml',
					Authorization: proxyAuthToken ? `Bearer ${proxyAuthToken}` : '',
					'X-Request-ID': jobId
				},
				body: cwcXml
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('[CWC House] Proxy submission failed:', {
					office: representative.name,
					status: response.status,
					errorBody: errorText,
					jobId,
					timestamp
				});

				let msg = `House CWC submission failed (HTTP ${response.status})`;
				if (response.status === 401 || response.status === 403) {
					msg += '. Proxy auth failed — check GCP_PROXY_AUTH_TOKEN.';
				} else if (response.status === 404) {
					msg += '. Proxy endpoint not found — verify GCP_PROXY_URL.';
				} else if (response.status === 429) {
					msg += '. Rate limit exceeded — try again later.';
				} else if (response.status >= 500) {
					msg += '. Proxy server error — may be temporary.';
				}
				msg += ` Details: ${errorText}`;

				return { ...baseResult, success: false, status: 'failed', error: msg };
			}

			const responseText = await response.text();
			console.debug('[CWC House] Submission successful:', {
				office: representative.name,
				status: response.status,
				jobId,
				timestamp
			});

			return {
				...baseResult,
				success: true,
				status: 'submitted',
				messageId: jobId,
				cwcResponse: { raw: responseText }
			};
		} catch (error) {
			return this.handleError(error, 'House', representative);
		}
	}

	/**
	 * Submit to all representatives (Senate + House), sequentially with delay.
	 */
	async submitToAllRepresentatives(
		template: Template,
		user: User,
		representatives: LegislativeOffice[],
		personalizedMessage: string
	): Promise<DeliveryResult[]> {
		const results: DeliveryResult[] = [];

		for (const rep of representatives) {
			try {
				const result = rep.chamber === 'senate'
					? await this.submitToSenate(template, user, rep, personalizedMessage)
					: await this.submitToHouse(template, user, rep, personalizedMessage);
				results.push(result);
				await this.delay(1000);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				console.error('[CWC] submitToAllRepresentatives failed:', { office: rep.name, error: msg });
				results.push({
					success: false,
					status: 'failed',
					office: rep.name,
					timestamp: new Date().toISOString(),
					error: msg
				});
			}
		}

		return results;
	}

	// ── ZK Proof Delivery (with TEE-resolved PII) ──────────────────────

	/**
	 * Deliver a verified ZK proof submission to Congress.
	 *
	 * Called after blockchain verification succeeds. Constituent data is
	 * resolved by the caller via ConstituentResolver (TEE abstraction)
	 * and passed in — this method never touches encrypted witness data.
	 *
	 * Steps:
	 * 1. Fetch template for subject/body
	 * 2. Determine chamber from districtId format
	 * 3. Check per-office rate limit (10/hour)
	 * 4. Build CWC XML with full constituent data
	 * 5. Submit via Senate/House path
	 * 6. Update submission record
	 */
	async deliverToOffice(request: ZkDeliveryRequest, constituent: ConstituentData): Promise<ZkDeliveryResult> {
		const { submissionId, districtId, templateId } = request;
		console.debug('[CWC] Starting delivery:', { submissionId, districtId, templateId });

		try {
			// 1. Fetch template
			const template = await db.template.findUnique({
				where: { id: templateId },
				select: { id: true, title: true, description: true, message_body: true, delivery_config: true, cwc_config: true }
			});

			if (!template) {
				const error = `Template ${templateId} not found`;
				console.error('[CWC]', error);
				await this.updateDeliveryStatus(submissionId, 'delivery_failed', error);
				return { success: false, error };
			}

			// 2. Determine chamber and office code (cwc_config overrides inference)
			const cwcConfig = template.cwc_config as { chamber?: 'house' | 'senate'; officeCode?: string } | null;
			const chamber = cwcConfig?.chamber || this.inferChamber(districtId);
			const officeCode = cwcConfig?.officeCode || this.deriveOfficeCode(districtId);

			// 3. Per-office rate limit (10/hour)
			const rateLimiter = getRateLimiter();
			const rateCheck = await rateLimiter.check(`cwc:office:${officeCode}`, {
				maxRequests: 10,
				windowMs: 60 * 60 * 1000
			});

			if (!rateCheck.allowed) {
				const error = `Per-office rate limit exceeded for ${officeCode}. Retry after ${rateCheck.retryAfter}s`;
				console.warn('[CWC] Rate limited:', { officeCode, retryAfter: rateCheck.retryAfter });
				await this.updateDeliveryStatus(submissionId, 'delivery_failed', error);
				return { success: false, error };
			}

			// 4. Build office + user from resolved constituent data
			const office: LegislativeOffice = {
				bioguideId: officeCode,
				name: officeCode,
				chamber,
				officeCode,
				state: districtId.split('-')[0],
				district: districtId.includes('-') ? districtId.split('-')[1] : '',
				party: ''
			};

			const user: User = {
				id: submissionId,
				name: constituent.name,
				email: constituent.email,
				street: constituent.address.street,
				city: constituent.address.city,
				state: constituent.address.state,
				zip: constituent.address.zip,
				phone: constituent.phone || null,
				congressional_district: constituent.congressionalDistrict || null
			};

			const cwcTemplate: Template = {
				id: template.id,
				title: template.title,
				description: template.description || '',
				message_body: template.message_body,
				delivery_config: template.delivery_config
			};

			// 5. Submit via existing full-constituent path
			const result = chamber === 'house'
				? await this.submitToHouse(cwcTemplate, user, office, template.message_body)
				: await this.submitToSenate(cwcTemplate, user, office, template.message_body);

			// 6. Update submission record
			if (result.success) {
				await this.updateDeliveryStatus(submissionId, 'delivered', undefined, result.messageId);
				console.debug('[CWC] Delivery successful:', { submissionId, messageId: result.messageId });
			} else {
				await this.updateDeliveryStatus(submissionId, 'delivery_failed', result.error);
				console.error('[CWC] Delivery failed:', { submissionId, error: result.error });
			}

			return { success: result.success, cwcSubmissionId: result.messageId, error: result.error };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown delivery error';
			console.error('[CWC] Unexpected error:', { submissionId, error: message });
			await this.updateDeliveryStatus(submissionId, 'delivery_failed', message).catch((e) =>
				console.error('[CWC] Failed to update status:', e)
			);
			return { success: false, error: message };
		}
	}

	// ── Senate Active Offices ───────────────────────────────────────────

	/** Cached set of active Senate CWC office codes (e.g., "SCA03"). TTL: 1 hour. */
	private activeSenateOffices: Set<string> | null = null;
	private activeSenateOfficesFetchedAt = 0;
	private static readonly ACTIVE_OFFICES_TTL = 60 * 60 * 1000; // 1 hour

	/**
	 * Get list of active Senate offices (for verifying delivery targets).
	 */
	async getActiveOffices(): Promise<{ success: boolean; offices?: unknown[]; error?: string }> {
		if (!this.apiKey) {
			return { success: false, error: 'No API key configured' };
		}

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}/active_offices?apikey=${this.apiKey}`,
				{ method: 'GET' }
			);

			if (!response.ok) {
				return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
			}

			const offices = await response.json();
			const officeList = Array.isArray(offices) ? offices : [offices];

			// Cache the office codes for isSenateOfficeActive() lookups
			this.activeSenateOffices = new Set(
				officeList.map((o: { office_code?: string }) => o.office_code).filter(Boolean)
			);
			this.activeSenateOfficesFetchedAt = Date.now();

			console.debug('[CWC] Active offices cached:', {
				count: this.activeSenateOffices.size
			});

			return { success: true, offices: officeList };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('[CWC] getActiveOffices failed:', msg);
			return { success: false, error: 'Failed to retrieve offices: ' + msg };
		}
	}

	/**
	 * Check if a Senate office accepts CWC messages.
	 * Only ~55% of Senate offices are CWC-enabled. All House offices accept CWC.
	 * Returns true for House offices (always CWC-enabled) or unknown (fail-open).
	 */
	async isSenateOfficeActive(officeCode: string): Promise<boolean> {
		// Refresh cache if expired or missing
		if (!this.activeSenateOffices || Date.now() - this.activeSenateOfficesFetchedAt > CWCClient.ACTIVE_OFFICES_TTL) {
			await this.getActiveOffices();
		}
		// Fail-open: if cache failed to load, attempt delivery anyway
		if (!this.activeSenateOffices) return true;
		return this.activeSenateOffices.has(officeCode);
	}

	/**
	 * Test connectivity to CWC API.
	 */
	async testConnection(): Promise<{ connected: boolean; error?: string }> {
		if (!this.apiKey) {
			return { connected: false, error: 'No API key configured' };
		}

		try {
			const result = await this.getActiveOffices();
			return { connected: result.success, error: result.error };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return { connected: false, error: 'Connection failed: ' + msg };
		}
	}

	// ── Private Helpers ────────────────────────────────────────────────

	/**
	 * Build CWC message structure from office + user data.
	 */
	private buildCwcMessage(
		template: Template,
		user: User,
		office: LegislativeOffice,
		personalizedMessage: string
	) {
		const targetRep = {
			bioguideId: office.bioguideId,
			name: office.name,
			party: office.party,
			state: office.state,
			district: office.district,
			chamber: office.chamber,
			officeCode: office.officeCode
		};

		const emptyRep = {
			bioguideId: '',
			name: '',
			party: '',
			state: '',
			district: '',
			chamber: (office.chamber === 'senate' ? 'house' : 'senate') as 'house' | 'senate',
			officeCode: ''
		};

		return {
			template,
			user: {
				id: user.id,
				name: user.name || 'Constituent',
				email: user.email,
				phone: user.phone || undefined,
				address: {
					street: user.street || '',
					city: user.city || '',
					state: user.state || '',
					zip: user.zip || ''
				},
				representatives: office.chamber === 'senate'
					? { house: emptyRep, senate: [targetRep] }
					: { house: targetRep, senate: [emptyRep] }
			},
			_targetRep: targetRep,
			personalizedMessage
		};
	}

	/**
	 * Parse CWC API response into DeliveryResult.
	 */
	private async parseResponse(response: Response, office: LegislativeOffice): Promise<DeliveryResult> {
		const timestamp = new Date().toISOString();
		const baseResult = { office: office.name, timestamp };

		try {
			if (!response.ok) {
				const errorText = await response.text();
				console.error(`CWC API error (${response.status}):`, errorText);
				return { ...baseResult, success: false, status: 'failed', error: `HTTP ${response.status}: ${errorText}` };
			}

			const contentType = response.headers.get('content-type');
			let cwcResponse: CWCResponse;

			if (contentType?.includes('application/json')) {
				cwcResponse = (await response.json()) as CWCResponse;
			} else {
				cwcResponse = { raw: await response.text() };
			}

			const success = response.status === 200 || response.status === 201 || response.status === 202;
			const messageId = cwcResponse?.messageId || cwcResponse?.id || `CWC-${Date.now()}`;
			const status = cwcResponse?.status || (success ? 'submitted' : 'failed');

			return {
				...baseResult,
				success,
				status: status as DeliveryResult['status'],
				messageId,
				cwcResponse
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('[CWC] parseResponse failed:', { office: office.name, error: msg });
			return {
				...baseResult,
				success: false,
				status: 'failed',
				error: `Failed to parse CWC response (HTTP ${response.status}): ${msg}`
			};
		}
	}

	/**
	 * Handle error from Senate/House submission.
	 */
	private handleError(error: unknown, chamber: string, office: LegislativeOffice): DeliveryResult {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const isNetworkError =
			errorMessage.includes('timeout') ||
			errorMessage.includes('ECONNREFUSED') ||
			errorMessage.includes('ENOTFOUND') ||
			errorMessage.includes('fetch failed');

		console.error(`[CWC ${chamber}] Submission failed:`, {
			office: office.name,
			state: office.state,
			error: errorMessage,
			isNetworkError
		});

		let msg = `${chamber} CWC submission failed: ${errorMessage}`;
		if (isNetworkError) {
			msg += '. The CWC API may be unreachable. Check network connectivity and API configuration.';
		}

		return {
			success: false,
			status: 'failed',
			office: office.name,
			timestamp: new Date().toISOString(),
			error: msg
		};
	}

	// ── District Parsing ───────────────────────────────────────────────

	/** "CA-12" → house, "CA" → senate */
	private inferChamber(districtId: string): 'house' | 'senate' {
		return districtId.includes('-') ? 'house' : 'senate';
	}

	/**
	 * Derive CWC office code from district ID.
	 * House: H{STATE}{DISTRICT} (e.g., "CA-12" → "HCA12") — matches CWC 2.0 spec
	 * Senate: {STATE}_SENATE (e.g., "CA" → "CA_SENATE") — ZK path doesn't have bioguide ID
	 */
	private deriveOfficeCode(districtId: string): string {
		const parts = districtId.split('-');
		if (parts.length > 1) {
			const state = parts[0].toUpperCase();
			const district = parts[1].padStart(2, '0');
			return `H${state}${district}`;
		}
		return `${parts[0]}_SENATE`;
	}

	/** Update submission delivery status in database. */
	private async updateDeliveryStatus(
		submissionId: string,
		status: string,
		error?: string,
		cwcSubmissionId?: string
	): Promise<void> {
		await db.submission.update({
			where: { id: submissionId },
			data: {
				delivery_status: status,
				delivery_error: error || null,
				cwc_submission_id: cwcSubmissionId || undefined,
				delivered_at: status === 'delivered' ? new Date() : undefined
			}
		});
	}

	// ── Network ────────────────────────────────────────────────────────

	private async fetchWithTimeout(url: string, options: RequestInit, timeout = this.DEFAULT_TIMEOUT): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, { ...options, signal: controller.signal });
			clearTimeout(timeoutId);
			return response;
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Request timeout after ${timeout}ms: ${url}`);
			}
			throw error;
		}
	}

	private async fetchWithRetry(url: string, options: RequestInit, timeout = this.DEFAULT_TIMEOUT): Promise<Response> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
			try {
				const response = await this.fetchWithTimeout(url, options, timeout);

				if (response.status >= 400 && response.status < 500 && response.status !== 429) {
					return response;
				}

				if (response.status === 429 || response.status >= 500) {
					if (attempt < this.MAX_RETRIES - 1) {
						const d = this.RETRY_DELAY * Math.pow(2, attempt);
						console.warn(`[CWC] Retry ${attempt + 1}/${this.MAX_RETRIES} after ${d}ms (HTTP ${response.status})`);
						await this.delay(d);
						continue;
					}
				}

				return response;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				if (attempt === this.MAX_RETRIES - 1) {
					console.error(`[CWC] Request failed after ${this.MAX_RETRIES} attempts:`, lastError.message);
					throw lastError;
				}

				const d = this.RETRY_DELAY * Math.pow(2, attempt);
				console.warn(`[CWC] Retry ${attempt + 1}/${this.MAX_RETRIES} after ${d}ms: ${lastError.message}`);
				await this.delay(d);
			}
		}

		throw lastError || new Error('Request failed after retries');
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/** Singleton instance. */
export const cwcClient = new CWCClient();

/** @deprecated Use CWCClient */
export type CongressionalOffice = LegislativeOffice;
