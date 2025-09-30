import { GcpProxyClient, GcpProxyError } from '../gcp-proxy-client';

// Mock timers for timeout testing
jest.useFakeTimers();

// Mock global fetch
global.fetch = jest.fn();

describe('GcpProxyClient', () => {
	let client: GcpProxyClient;
	let mockSubmission: any;

	beforeEach(() => {
		jest.clearAllMocks();

		client = new GcpProxyClient({
			baseUrl: 'https://test-proxy.com',
			authToken: 'test-token',
			timeout: 5000,
			maxRetries: 2,
			retryDelayMs: 100
		});

		mockSubmission = {
			jobId: 'test-job-123',
			officeCode: 'CA01',
			recipientName: 'Rep. Test Person',
			recipientEmail: 'rep.test@house.gov',
			subject: 'Test Subject',
			message: 'Test message content',
			senderName: 'John Doe',
			senderEmail: 'john@example.com',
			senderAddress: '123 Main St, City, ST 12345',
			priority: 'normal' as const
		};
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
		jest.useFakeTimers();
	});

	test('should make successful submission', async () => {
		const mockResponse = {
			success: true,
			message: 'Submission successful',
			submissionId: 'sub-123',
			processingTimeMs: 1500
		};

		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve(JSON.stringify(mockResponse))
		});

		const result = await client.submitToHouse(mockSubmission);

		expect(result.success).toBe(true);
		expect(result.message).toBe('Submission successful');
		expect(result.submissionId).toBe('sub-123');
		expect(fetch).toHaveBeenCalledWith(
			'https://test-proxy.com',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					Authorization: 'Bearer test-token',
					'X-Request-ID': 'test-job-123'
				})
			})
		);
	});

	test('should include correct payload structure', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('{"success": true}')
		});

		await client.submitToHouse(mockSubmission);

		const fetchCall = (fetch as jest.Mock).mock.calls[0];
		const requestBody = JSON.parse(fetchCall[1].body);

		expect(requestBody).toEqual({
			target: 'house',
			submission: {
				officeCode: 'CA01',
				recipient: {
					name: 'Rep. Test Person',
					email: 'rep.test@house.gov'
				},
				sender: {
					name: 'John Doe',
					email: 'john@example.com',
					address: '123 Main St, City, ST 12345',
					phone: undefined
				},
				content: {
					subject: 'Test Subject',
					message: 'Test message content',
					priority: 'normal'
				},
				metadata: {
					jobId: 'test-job-123',
					timestamp: expect.any(String)
				}
			}
		});
	});

	test('should handle HTTP errors with retryable status codes', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 500,
			text: () => Promise.resolve('{"error": "Internal server error"}')
		});

		await expect(client.submitToHouse(mockSubmission)).rejects.toThrow(GcpProxyError);

		// Should retry 2 times + initial attempt = 3 total calls
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	test('should not retry on non-retryable status codes', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 400,
			text: () => Promise.resolve('{"error": "Bad request"}')
		});

		await expect(client.submitToHouse(mockSubmission)).rejects.toThrow(GcpProxyError);

		// Should not retry on 400 error
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	test('should retry on rate limiting (429)', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 429,
			text: () => Promise.resolve('{"error": "Too many requests"}')
		});

		await expect(client.submitToHouse(mockSubmission)).rejects.toThrow(GcpProxyError);

		// Should retry on 429 error
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	test('should handle network errors with retry', async () => {
		(fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

		await expect(client.submitToHouse(mockSubmission)).rejects.toThrow(GcpProxyError);

		// Should retry on network errors
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	test('should handle timeout errors', async () => {
		(fetch as jest.Mock).mockImplementation(() => {
			return new Promise((resolve) => {
				// Never resolve to simulate timeout
				setTimeout(resolve, 10000);
			});
		});

		const timeoutPromise = client.submitToHouse(mockSubmission);

		// Advance timers to trigger timeout
		jest.advanceTimersByTime(6000);

		await expect(timeoutPromise).rejects.toThrow(/timeout/);
	});

	test('should handle invalid JSON response', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('invalid json')
		});

		await expect(client.submitToHouse(mockSubmission)).rejects.toThrow(GcpProxyError);
	});

	test('should implement exponential backoff with jitter', async () => {
		const startTime = Date.now();
		jest.useRealTimers();

		(fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

		try {
			await client.submitToHouse(mockSubmission);
		} catch (error) {
			// Expected to fail
		}

		const endTime = Date.now();
		const totalTime = endTime - startTime;

		// Should take at least the base delay time for retries
		// Base: 100ms, with backoff: 100ms + 200ms = 300ms minimum
		expect(totalTime).toBeGreaterThan(250);

		jest.useFakeTimers();
	});

	test('should work without auth token', () => {
		const clientWithoutAuth = new GcpProxyClient({
			baseUrl: 'https://test-proxy.com',
			timeout: 5000
		});

		expect(clientWithoutAuth.getConfig().authToken).toBeUndefined();
	});

	test('should throw on missing base URL', () => {
		expect(() => {
			new GcpProxyClient({
				baseUrl: '',
				timeout: 5000
			});
		}).toThrow('GCP proxy base URL is required');
	});

	test('should perform health check successfully', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200
		});

		const health = await client.healthCheck();

		expect(health.healthy).toBe(true);
		expect(health.latencyMs).toBeGreaterThan(0);
		expect(health.error).toBeUndefined();
		expect(fetch).toHaveBeenCalledWith(
			'https://test-proxy.com/health',
			expect.objectContaining({
				method: 'GET'
			})
		);
	});

	test('should handle health check failure', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error'
		});

		const health = await client.healthCheck();

		expect(health.healthy).toBe(false);
		expect(health.error).toBe('HTTP 500 Internal Server Error');
	});

	test('should handle health check network error', async () => {
		(fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

		const health = await client.healthCheck();

		expect(health.healthy).toBe(false);
		expect(health.error).toBe('Network error');
	});

	test('should validate response format', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('{"success": true, "message": "OK"}')
		});

		const result = await client.submitToHouse(mockSubmission);

		expect(result).toEqual({
			success: true,
			message: 'OK',
			submissionId: undefined,
			timestamp: expect.any(String),
			processingTimeMs: 0
		});
	});

	test('should handle response without success flag', async () => {
		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('{"message": "Processed"}')
		});

		const result = await client.submitToHouse(mockSubmission);

		expect(result.success).toBe(false);
		expect(result.message).toBe('Processed');
	});
});
