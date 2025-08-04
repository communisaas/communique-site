import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

// Mock the database
const mockDb = {
	template: {
		findMany: vi.fn(),
		create: vi.fn()
	}
};

vi.mock('$lib/server/db', () => ({
	db: mockDb
}));

// Mock the template config extraction
vi.mock('$lib/types/templateConfig', () => ({
	extractRecipientEmails: vi.fn((config) => {
		if (!config) return [];
		try {
			const parsed = typeof config === 'string' ? JSON.parse(config) : config;
			return parsed?.emails || ['default@example.com'];
		} catch {
			return ['default@example.com'];
		}
	})
}));

describe('Templates API', () => {
	// Mock template data
	const mockTemplate = {
		id: 'template-123',
		slug: 'test-template',
		title: 'Test Template',
		description: 'A test template',
		category: 'Testing',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Test Subject',
		message_body: 'Test message body',
		preview: 'Test preview',
		metrics: JSON.stringify({ sent: 10, views: 50 }),
		delivery_config: JSON.stringify({ priority: 'normal' }),
		recipient_config: JSON.stringify({ emails: ['recipient@example.com'] }),
		is_public: true,
		status: 'published',
		createdAt: new Date(),
		updatedAt: new Date(),
		userId: 'user-123'
	};

	// Mock authenticated user
	const mockUser = {
		id: 'user-123',
		name: 'Test User',
		email: 'test@example.com'
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/templates', () => {
		it('should fetch public templates successfully', async () => {
			mockDb.template.findMany.mockResolvedValue([mockTemplate]);

			const response = await GET();
			const responseData = await response.json();

			expect(mockDb.template.findMany).toHaveBeenCalledWith({
				where: {
					is_public: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			});

			expect(responseData).toHaveLength(1);
			expect(responseData[0]).toEqual({
				id: 'template-123',
				slug: 'test-template',
				title: 'Test Template',
				description: 'A test template',
				category: 'Testing',
				type: 'advocacy',
				deliveryMethod: 'email',
				subject: 'Test Subject',
				message_body: 'Test message body',
				preview: 'Test preview',
				metrics: JSON.stringify({ sent: 10, views: 50 }),
				delivery_config: JSON.stringify({ priority: 'normal' }),
				recipient_config: JSON.stringify({ emails: ['recipient@example.com'] }),
				is_public: true,
				recipientEmails: ['recipient@example.com']
			});
		});

		it('should return empty array when no templates exist', async () => {
			mockDb.template.findMany.mockResolvedValue([]);

			const response = await GET();
			const responseData = await response.json();

			expect(responseData).toEqual([]);
		});

		it('should handle database errors gracefully', async () => {
			mockDb.template.findMany.mockRejectedValue(new Error('Database error'));

			const response = await GET();
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData).toEqual({
				error: 'Failed to fetch templates'
			});
		});

		it('should only return public templates', async () => {
			const privateTemplate = { ...mockTemplate, is_public: false };
			mockDb.template.findMany.mockResolvedValue([mockTemplate, privateTemplate]);

			await GET();

			expect(mockDb.template.findMany).toHaveBeenCalledWith({
				where: {
					is_public: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			});
		});

		it('should include recipient emails in response', async () => {
			const templateWithComplexConfig = {
				...mockTemplate,
				recipient_config: JSON.stringify({
					emails: ['admin@example.com', 'support@example.com']
				})
			};
			mockDb.template.findMany.mockResolvedValue([templateWithComplexConfig]);

			const response = await GET();
			const responseData = await response.json();

			expect(responseData[0].recipientEmails).toEqual(['admin@example.com', 'support@example.com']);
		});
	});

	describe('POST /api/templates', () => {
		const templateData = {
			slug: 'new-template',
			title: 'New Template',
			description: 'A new template',
			category: 'Testing',
			type: 'advocacy',
			deliveryMethod: 'email',
			subject: 'New Subject',
			message_body: 'New message body',
			preview: 'New preview',
			delivery_config: JSON.stringify({ priority: 'normal' }),
			recipient_config: JSON.stringify({ emails: ['new@example.com'] })
		};

		const createMockRequest = (data: any, user?: any) => ({
			request: {
				json: vi.fn().mockResolvedValue(data)
			},
			locals: {
				user: user || null
			}
		} as unknown as RequestEvent);

		it('should create template for authenticated user', async () => {
			const createdTemplate = {
				...templateData,
				id: 'new-template-123',
				is_public: false,
				status: 'draft',
				userId: 'user-123',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			mockDb.template.create.mockResolvedValue(createdTemplate);

			const mockRequest = createMockRequest(templateData, mockUser);
			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(mockDb.template.create).toHaveBeenCalledWith({
				data: {
					...templateData,
					is_public: false,
					status: 'draft',
					userId: 'user-123'
				}
			});

			expect(responseData).toEqual(createdTemplate);
		});

		it('should handle guest user template creation', async () => {
			const mockRequest = createMockRequest(templateData); // No user

			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(mockDb.template.create).not.toHaveBeenCalled();
			expect(responseData.id).toMatch(/^guest-\d+$/);
			expect(responseData.is_public).toBe(false);
			expect(responseData.status).toBe('draft');
			expect(responseData.userId).toBeNull();
			expect(responseData.createdAt).toBeDefined();
		});

		it('should set default values for new templates', async () => {
			mockDb.template.create.mockResolvedValue({
				...templateData,
				id: 'new-template-123',
				is_public: false,
				status: 'draft',
				userId: 'user-123'
			});

			const mockRequest = createMockRequest(templateData, mockUser);
			await POST(mockRequest);

			expect(mockDb.template.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					is_public: false,
					status: 'draft',
					userId: 'user-123'
				})
			});
		});

		it('should handle database errors gracefully', async () => {
			mockDb.template.create.mockRejectedValue(new Error('Database error'));

			const mockRequest = createMockRequest(templateData, mockUser);
			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData).toEqual({
				error: 'Failed to create template'
			});
		});

		it('should handle malformed request data', async () => {
			const mockRequest = {
				request: {
					json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
				},
				locals: { user: mockUser }
			} as unknown as RequestEvent;

			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData).toEqual({
				error: 'Failed to create template'
			});
		});

		it('should preserve all template fields', async () => {
			const complexTemplateData = {
				...templateData,
				metrics: JSON.stringify({ sent: 0, views: 0 }),
				additionalField: 'test'
			};

			mockDb.template.create.mockResolvedValue({
				...complexTemplateData,
				id: 'new-template-123',
				is_public: false,
				status: 'draft',
				userId: 'user-123'
			});

			const mockRequest = createMockRequest(complexTemplateData, mockUser);
			await POST(mockRequest);

			expect(mockDb.template.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					...complexTemplateData,
					is_public: false,
					status: 'draft',
					userId: 'user-123'
				})
			});
		});

		it('should generate unique guest IDs', async () => {
			const mockRequest1 = createMockRequest(templateData);
			const mockRequest2 = createMockRequest(templateData);

			const response1 = await POST(mockRequest1);
			const response2 = await POST(mockRequest2);

			const data1 = await response1.json();
			const data2 = await response2.json();

			expect(data1.id).not.toBe(data2.id);
			expect(data1.id).toMatch(/^guest-\d+$/);
			expect(data2.id).toMatch(/^guest-\d+$/);
		});

		it('should handle empty template data', async () => {
			const emptyData = {};
			mockDb.template.create.mockResolvedValue({
				...emptyData,
				id: 'new-template-123',
				is_public: false,
				status: 'draft',
				userId: 'user-123'
			});

			const mockRequest = createMockRequest(emptyData, mockUser);
			const response = await POST(mockRequest);

			expect(response.status).toBe(200);
		});
	});

	describe('Template Data Formatting', () => {
		it('should handle templates with null/undefined fields', async () => {
			const templateWithNulls = {
				...mockTemplate,
				preview: null,
				metrics: null,
				delivery_config: null,
				recipient_config: null
			};

			mockDb.template.findMany.mockResolvedValue([templateWithNulls]);

			const response = await GET();
			const responseData = await response.json();

			expect(responseData[0].preview).toBeNull();
			expect(responseData[0].metrics).toBeNull();
			expect(responseData[0].recipientEmails).toEqual(['default@example.com']);
		});

		it('should handle malformed JSON in recipient_config', async () => {
			const templateWithBadJson = {
				...mockTemplate,
				recipient_config: 'invalid json'
			};

			mockDb.template.findMany.mockResolvedValue([templateWithBadJson]);

			const response = await GET();
			const responseData = await response.json();

			expect(responseData[0].recipientEmails).toEqual(['default@example.com']);
		});

		it('should order templates by creation date descending', async () => {
			const template1 = { ...mockTemplate, id: 'template-1', createdAt: new Date('2024-01-01') };
			const template2 = { ...mockTemplate, id: 'template-2', createdAt: new Date('2024-01-02') };
			
			mockDb.template.findMany.mockResolvedValue([template2, template1]); // Should be returned in desc order

			await GET();

			expect(mockDb.template.findMany).toHaveBeenCalledWith({
				where: { is_public: true },
				orderBy: { createdAt: 'desc' }
			});
		});
	});

	describe('Authentication Edge Cases', () => {
		it('should handle user object without ID', async () => {
			const userWithoutId = { name: 'Test User', email: 'test@example.com' };
			const mockRequest = createMockRequest(templateData, userWithoutId);

			const response = await POST(mockRequest);
			const responseData = await response.json();

			// Should treat as guest user since no valid ID
			expect(responseData.id).toMatch(/^guest-\d+$/);
		});

		it('should handle falsy user values', async () => {
			const falsyUsers = [null, undefined, false, 0, ''];

			for (const user of falsyUsers) {
				const mockRequest = createMockRequest(templateData, user);
				const response = await POST(mockRequest);
				const responseData = await response.json();

				expect(responseData.id).toMatch(/^guest-\d+$/);
			}
		});
	});
});