import { setTimeout } from 'timers/promises';

export interface GcpProxyClientConfig {
	baseUrl: string;
	authToken?: string;
	timeout: number;
	maxRetries?: number;
	retryDelayMs?: number;
	retryBackoffMultiplier?: number;
}

export interface HouseCwcSubmission {
	jobId: string;
	officeCode: string;
	recipientName: string;
	recipientEmail: string;
	subject: string;
	message: string;
	senderName: string;
	senderEmail: string;
	senderAddress: string;
	senderPhone?: string;
	priority: 'normal' | 'high';
	metadata?: Record<string, unknown>;
}

export interface GcpProxyResponse {
	success: boolean;
	message: string;
	submissionId?: string;
	timestamp: string;
	processingTimeMs: number;
}

export class GcpProxyError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly retryable: boolean = false
	) {
		super(message);
		this.name = 'GcpProxyError';
	}
}

export class GcpProxyClient {
	private readonly config: Required<GcpProxyClientConfig>;

	constructor(config: GcpProxyClientConfig) {
		this.config = {
			maxRetries: 3,
			retryDelayMs: 1000,
			retryBackoffMultiplier: 2.0,
			...config
		};

		if (!this.config.baseUrl) {
			throw new Error('GCP proxy base URL is required');
		}

		if (!this.config.authToken) {
			console.warn('GCP proxy auth token not provided - authentication may fail');
		}
	}

	/**
	 * Submit a House CWC message through the GCP proxy
	 */
	async submitToHouse(submission: HouseCwcSubmission): Promise<GcpProxyResponse> {
		const startTime = Date.now();

		console.log(
			`Submitting to House via GCP proxy: job ${submission.jobId}, office ${submission.officeCode}`
		);

		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
			try {
				if (attempt > 0) {
					const delay =
						this.config.retryDelayMs * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
					const jitter = Math.random() * 0.1 * delay; // 10% jitter
					const totalDelay = delay + jitter;

					console.log(
						`Retrying submission attempt ${attempt + 1}/${this.config.maxRetries + 1} after ${Math.round(totalDelay)}ms`
					);
					await setTimeout(totalDelay);
				}

				const response = await this.makeRequest(submission);

				console.log(
					`GCP proxy submission successful for job ${submission.jobId} in ${Date.now() - startTime}ms`
				);

				return response;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('Unknown error');

				console.error(`GCP proxy submission attempt ${attempt + 1} failed:`, lastError.message);

				// Don't retry on non-retryable errors
				if (error instanceof GcpProxyError && !error.retryable) {
					console.log('Non-retryable error, giving up');
					break;
				}

				// Don't retry on the last attempt
				if (attempt === this.config.maxRetries) {
					console.log('Max retries exceeded, giving up');
					break;
				}
			}
		}

		const totalTime = Date.now() - startTime;
		const errorMessage = `GCP proxy submission failed after ${this.config.maxRetries + 1} attempts in ${totalTime}ms: ${lastError?.message}`;

		console.error(errorMessage);
		throw new GcpProxyError(errorMessage, undefined, false);
	}

	/**
	 * Make HTTP request to GCP proxy
	 */
	private async makeRequest(submission: HouseCwcSubmission): Promise<GcpProxyResponse> {
		const requestPayload = {
			target: 'house',
			submission: {
				officeCode: submission.officeCode,
				recipient: {
					name: submission.recipientName,
					email: submission.recipientEmail
				},
				sender: {
					name: submission.senderName,
					email: submission.senderEmail,
					address: submission.senderAddress,
					phone: submission.senderPhone
				},
				content: {
					subject: submission.subject,
					message: submission.message,
					priority: submission.priority
				},
				metadata: {
					jobId: submission.jobId,
					timestamp: new Date().toISOString(),
					...submission.metadata
				}
			}
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': 'Communique-House-Worker/1.0',
			'X-Request-ID': submission.jobId
		};

		if (this.config.authToken) {
			headers['Authorization'] = `Bearer ${this.config.authToken}`;
		}

		try {
			console.log(`Making HTTP request to GCP proxy: ${this.config.baseUrl}`);

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

			const response = await fetch(this.config.baseUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(requestPayload),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			const responseText = await response.text();

			console.log(`GCP proxy response: ${response.status} ${response.statusText}`);

			// Parse response
			let responseData: unknown;
			try {
				responseData = JSON.parse(responseText);
			} catch (parseError) {
				throw new GcpProxyError(
					`Invalid JSON response from GCP proxy: ${responseText.substring(0, 200)}`,
					response.status,
					this.isRetryableStatusCode(response.status)
				);
			}

			// Handle HTTP errors
			if (!response.ok) {
				const errorMessage = this.extractErrorMessage(responseData, response.status);
				const retryable = this.isRetryableStatusCode(response.status);

				throw new GcpProxyError(errorMessage, response.status, retryable);
			}

			// Validate and return response
			return this.validateResponse(responseData);
		} catch (error) {
			if (error instanceof GcpProxyError) {
				throw error;
			}

			// Handle fetch errors (network, timeout, etc.)
			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new GcpProxyError(
						`GCP proxy request timeout after ${this.config.timeout}ms`,
						undefined,
						true
					);
				}

				if (error.message.includes('fetch')) {
					throw new GcpProxyError(
						`Network error connecting to GCP proxy: ${error.message}`,
						undefined,
						true
					);
				}
			}

			throw new GcpProxyError(
				`Unexpected error during GCP proxy request: ${error instanceof Error ? error.message : 'Unknown error'}`,
				undefined,
				true
			);
		}
	}

	/**
	 * Extract error message from response data
	 */
	private extractErrorMessage(responseData: unknown, statusCode: number): string {
		if (typeof responseData === 'object' && responseData !== null) {
			const data = responseData as Record<string, unknown>;

			if (typeof data.error === 'string') {
				return `GCP proxy error (${statusCode}): ${data.error}`;
			}

			if (typeof data.message === 'string') {
				return `GCP proxy error (${statusCode}): ${data.message}`;
			}
		}

		return `GCP proxy HTTP error: ${statusCode}`;
	}

	/**
	 * Determine if HTTP status code is retryable
	 */
	private isRetryableStatusCode(statusCode: number): boolean {
		// Retry on server errors and rate limiting
		if (statusCode >= 500) return true;
		if (statusCode === 429) return true; // Too Many Requests
		if (statusCode === 408) return true; // Request Timeout

		// Don't retry on client errors (4xx except rate limiting)
		return false;
	}

	/**
	 * Validate and normalize response data
	 */
	private validateResponse(responseData: unknown): GcpProxyResponse {
		if (typeof responseData !== 'object' || responseData === null) {
			throw new GcpProxyError('Invalid response format from GCP proxy');
		}

		const data = responseData as Record<string, unknown>;

		// Check for success flag
		const success = Boolean(data.success);

		// Extract message
		const message =
			typeof data.message === 'string'
				? data.message
				: success
					? 'Submission completed successfully'
					: 'Submission failed';

		// Extract optional fields
		const submissionId = typeof data.submissionId === 'string' ? data.submissionId : undefined;
		const processingTimeMs = typeof data.processingTimeMs === 'number' ? data.processingTimeMs : 0;

		return {
			success,
			message,
			submissionId,
			timestamp: new Date().toISOString(),
			processingTimeMs
		};
	}

	/**
	 * Get client configuration (for monitoring/debugging)
	 */
	getConfig(): Readonly<GcpProxyClientConfig> {
		return { ...this.config };
	}

	/**
	 * Health check for GCP proxy
	 */
	async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
		const startTime = Date.now();

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

			const response = await fetch(`${this.config.baseUrl}/health`, {
				method: 'GET',
				headers: {
					'User-Agent': 'Communique-House-Worker/1.0',
					...(this.config.authToken && { Authorization: `Bearer ${this.config.authToken}` })
				},
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			const latencyMs = Date.now() - startTime;

			if (response.ok) {
				return { healthy: true, latencyMs };
			} else {
				return {
					healthy: false,
					latencyMs,
					error: `HTTP ${response.status} ${response.statusText}`
				};
			}
		} catch (error) {
			const latencyMs = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			return { healthy: false, latencyMs, error: errorMessage };
		}
	}
}
