import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

// No need for @selfxyz/qrcode mock - we removed the dependency

vi.mock('$lib/server/selfxyz-config', () => ({
	SELF_XYZ_CONFIG: {
		appName: "Communiqué",
		scope: "communique-congressional",
		endpoint: "http://localhost:5173/api/identity/verify",
		version: 2,
		disclosures: {
			nationality: true,
			issuing_state: true,
			name: true,
			minimumAge: 18,
			ofac: true
		}
	},
	createUserConfig: vi.fn().mockImplementation((userId, templateSlug) => ({
		appName: "Communiqué",
		scope: "communique-congressional",
		endpoint: "http://localhost:5173/api/identity/verify",
		version: 2,
		userId,
		userIdType: 'uuid',
		userDefinedData: JSON.stringify({
			templateSlug,
			requireAddress: true,
			timestamp: Date.now()
		}),
		disclosures: {
			nationality: true,
			issuing_state: true,
			name: true,
			minimumAge: 18,
			ofac: true
		}
	}))
}));

describe('Self.xyz Initialization API', () => {
	let mockRequest: RequestEvent;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRequest = {
			request: {
				json: vi.fn()
			}
		} as any;
	});

	it('should initialize Self.xyz verification session with valid data', async () => {
		// Arrange
		const requestData = {
			userId: 'test-user-123',
			templateSlug: 'climate-action',
			requireAddress: true,
			disclosures: {
				nationality: true,
				name: true
			}
		};

		mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

		// Act
		const response = await POST(mockRequest);
		const result = await response.json();

		// Assert
		expect(response.status).toBe(200);
		expect(result.success).toBe(true);
		expect(result.qrCodeData).toBeDefined();
		expect(result.sessionId).toBe(requestData.userId);
		expect(typeof result.qrCodeData).toBe('string');
		
		// Verify QR code data is valid JSON
		const qrData = JSON.parse(result.qrCodeData);
		expect(qrData.userId).toBe(requestData.userId);
		expect(qrData.appName).toBe("Communiqué");
		expect(qrData.scope).toBe("communique-congressional");
	});

	it('should fail when userId is missing', async () => {
		// Arrange
		const requestData = {
			templateSlug: 'climate-action',
			requireAddress: true
		};

		mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

		// Act
		const response = await POST(mockRequest);
		const result = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Missing required fields');
	});

	it('should fail when templateSlug is missing', async () => {
		// Arrange
		const requestData = {
			userId: 'test-user-123',
			requireAddress: true
		};

		mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

		// Act
		const response = await POST(mockRequest);
		const result = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Missing required fields');
	});

	it('should handle configuration errors gracefully', async () => {
		// Arrange - Mock the config to throw an error
		const { createUserConfig } = await import('$lib/server/selfxyz-config');
		vi.mocked(createUserConfig).mockImplementationOnce(() => {
			throw new Error('Invalid configuration');
		});

		const requestData = {
			userId: 'test-user-123',
			templateSlug: 'climate-action',
			requireAddress: true
		};

		mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

		// Act
		const response = await POST(mockRequest);
		const result = await response.json();

		// Assert
		expect(response.status).toBe(500);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Failed to initialize Self.xyz verification');
	});

	it('should validate required fields', async () => {
		// Arrange - Missing userId
		const requestData = {
			templateSlug: 'voting-rights',
			requireAddress: false
		};

		mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

		// Act
		const response = await POST(mockRequest);
		const result = await response.json();

		// Assert
		expect(response.status).toBe(400);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Missing required fields');
	});

	it('should validate template slug requirement', async () => {
		// Arrange - Missing templateSlug
		const requestData = {
			userId: 'test-user-789',
			requireAddress: true
		};

		mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

		// Act
		const response = await POST(mockRequest);
		const result = await response.json();

		// Assert - Should fail validation
		expect(response.status).toBe(400);
		expect(result.success).toBe(false);
		expect(result.error).toBe('Missing required fields');
	});
});