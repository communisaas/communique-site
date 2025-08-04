import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, PUT, DELETE } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

// Mock the database
const mockDb = {
	template: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		update: vi.fn(),
		delete: vi.fn()
	}
};

vi.mock('$lib/server/db', () => ({
	db: mockDb
}));

// Mock district metrics
const mockUpdateTemplateDistrictMetrics = vi.fn();
vi.mock('$lib/server/district-metrics', () => ({
	updateTemplateDistrictMetrics: mockUpdateTemplateDistrictMetrics
}));

// Mock template config extraction
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

describe('Template [id] API', () => {
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
		userId: 'user-123',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	const mockCongressionalTemplate = {
		...mockTemplate,
		deliveryMethod: 'both'
	};

	// Mock user and session
	const mockUser = {
		id: 'user-123',
		name: 'Test User',
		email: 'test@example.com'
	};

	const mockSession = {
		user: mockUser
	};

	const createMockRequest = (params: any, data?: any, user?: any) => ({
		params,
		request: data ? {
			json: vi.fn().mockResolvedValue(data)
		} : undefined,
		locals: {
			auth: {
				validate: vi.fn().mockResolvedValue(user ? { user } : null)
			}
		}
	} as unknown as RequestEvent);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/templates/[id]', () => {
		it('should fetch template by ID successfully', async () => {
			mockDb.template.findUnique.mockResolvedValue(mockTemplate);

			const mockRequest = createMockRequest({ id: 'template-123' });
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(mockDb.template.findUnique).toHaveBeenCalledWith({
				where: { id: 'template-123' }
			});

			expect(responseData).toEqual({
				id: 'template-123',
				title: 'Test Template',
				description: 'A test template',
				category: 'Testing',
				type: 'advocacy',
				deliveryMethod: 'email',
				subject: 'Test Subject',
				preview: 'Test preview',
				message_body: 'Test message body',
				metrics: JSON.stringify({ sent: 10, views: 50 }),
				delivery_config: JSON.stringify({ priority: 'normal' }),
				recipient_config: JSON.stringify({ emails: ['recipient@example.com'] }),
				is_public: true,
				recipientEmails: ['recipient@example.com']
			});
		});

		it('should return 404 when template not found', async () => {
			mockDb.template.findUnique.mockResolvedValue(null);

			const mockRequest = createMockRequest({ id: 'nonexistent' });
			const response = await GET(mockRequest);

			expect(response.status).toBe(404);
		});

		it('should update district metrics for congressional templates', async () => {
			const congressionalTemplate = { ...mockTemplate, deliveryMethod: 'both' };
			const updatedTemplate = {
				...congressionalTemplate,
				metrics: JSON.stringify({ sent: 15, views: 75 })
			};

			mockDb.template.findUnique
				.mockResolvedValueOnce(congressionalTemplate)
				.mockResolvedValueOnce(updatedTemplate);

			const mockRequest = createMockRequest({ id: 'template-123' });
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(mockUpdateTemplateDistrictMetrics).toHaveBeenCalledWith('template-123');
			expect(mockDb.template.findUnique).toHaveBeenCalledTimes(2);
			expect(responseData.metrics).toBe(JSON.stringify({ sent: 15, views: 75 }));
		});

		it('should not update metrics for email-only templates', async () => {
			mockDb.template.findUnique.mockResolvedValue(mockTemplate);

			const mockRequest = createMockRequest({ id: 'template-123' });
			await GET(mockRequest);

			expect(mockUpdateTemplateDistrictMetrics).not.toHaveBeenCalled();
			expect(mockDb.template.findUnique).toHaveBeenCalledTimes(1);
		});

		it('should handle district metrics update failure gracefully', async () => {
			mockDb.template.findUnique
				.mockResolvedValueOnce(mockCongressionalTemplate)
				.mockResolvedValueOnce(null); // Second call returns null

			const mockRequest = createMockRequest({ id: 'template-123' });
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(mockUpdateTemplateDistrictMetrics).toHaveBeenCalled();
			expect(responseData.metrics).toBe(mockCongressionalTemplate.metrics); // Uses original metrics
		});

		it('should handle database errors gracefully', async () => {
			mockDb.template.findUnique.mockRejectedValue(new Error('Database error'));

			const mockRequest = createMockRequest({ id: 'template-123' });
			const response = await GET(mockRequest);

			expect(response.status).toBe(500);
		});

		it('should include recipient emails in response', async () => {
			const templateWithComplexConfig = {
				...mockTemplate,
				recipient_config: JSON.stringify({
					emails: ['admin@example.com', 'support@example.com']
				})
			};

			mockDb.template.findUnique.mockResolvedValue(templateWithComplexConfig);

			const mockRequest = createMockRequest({ id: 'template-123' });
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(responseData.recipientEmails).toEqual(['admin@example.com', 'support@example.com']);
		});
	});

	describe('PUT /api/templates/[id]', () => {
		const updateData = {
			title: 'Updated Template',
			description: 'Updated description'
		};

		it('should update template for authenticated owner', async () => {
			const updatedTemplate = { ...mockTemplate, ...updateData };

			mockDb.template.findFirst.mockResolvedValue(mockTemplate);
			mockDb.template.update.mockResolvedValue(updatedTemplate);

			const mockRequest = createMockRequest(
				{ id: 'template-123' },
				updateData,
				mockUser
			);
			const response = await PUT(mockRequest);
			const responseData = await response.json();

			expect(mockDb.template.findFirst).toHaveBeenCalledWith({
				where: { id: 'template-123', userId: 'user-123' }
			});

			expect(mockDb.template.update).toHaveBeenCalledWith({
				where: { id: 'template-123' },
				data: updateData
			});

			expect(responseData).toEqual(updatedTemplate);
		});

		it('should require authentication', async () => {
			const mockRequest = createMockRequest(
				{ id: 'template-123' },
				updateData
			); // No user

			const response = await PUT(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(401);
			expect(responseData).toEqual({ error: 'Unauthorized' });
			expect(mockDb.template.findFirst).not.toHaveBeenCalled();
		});

		it('should require template ownership', async () => {
			mockDb.template.findFirst.mockResolvedValue(null); // Template not found or not owned

			const mockRequest = createMockRequest(
				{ id: 'template-123' },
				updateData,
				mockUser
			);
			const response = await PUT(mockRequest);

			expect(response.status).toBe(404);
			expect(mockDb.template.update).not.toHaveBeenCalled();
		});

		it('should set is_public to true when status is published', async () => {
			const publishData = { status: 'published' };
			const updatedTemplate = { ...mockTemplate, status: 'published', is_public: true };

			mockDb.template.findFirst.mockResolvedValue(mockTemplate);
			mockDb.template.update.mockResolvedValue(updatedTemplate);

			const mockRequest = createMockRequest(
				{ id: 'template-123' },
				publishData,
				mockUser
			);
			await PUT(mockRequest);

			expect(mockDb.template.update).toHaveBeenCalledWith({
				where: { id: 'template-123' },
				data: { status: 'published', is_public: true }
			});
		});

		it('should not modify is_public for other status changes', async () => {
			const draftData = { status: 'draft' };

			mockDb.template.findFirst.mockResolvedValue(mockTemplate);
			mockDb.template.update.mockResolvedValue(mockTemplate);

			const mockRequest = createMockRequest(
				{ id: 'template-123' },
				draftData,
				mockUser
			);
			await PUT(mockRequest);

			expect(mockDb.template.update).toHaveBeenCalledWith({
				where: { id: 'template-123' },
				data: { status: 'draft' }
			});
		});

		it('should handle database errors gracefully', async () => {
			mockDb.template.findFirst.mockRejectedValue(new Error('Database error'));

			const mockRequest = createMockRequest(
				{ id: 'template-123' },
				updateData,
				mockUser
			);
			const response = await PUT(mockRequest);

			expect(response.status).toBe(500);
		});

		it('should handle request parsing errors', async () => {
			const mockRequest = {
				params: { id: 'template-123' },
				request: {
					json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
				},
				locals: {
					auth: {
						validate: vi.fn().mockResolvedValue(mockSession)
					}
				}
			} as unknown as RequestEvent;

			const response = await PUT(mockRequest);

			expect(response.status).toBe(500);
		});

		it('should preserve existing data for partial updates', async () => {
			const partialUpdate = { title: 'New Title Only' };
			const expectedUpdateData = { title: 'New Title Only' };

			mockDb.template.findFirst.mockResolvedValue(mockTemplate);
			mockDb.template.update.mockResolvedValue({ ...mockTemplate, ...partialUpdate });

			const mockRequest = createMockRequest(
				{ id: 'template-123' },
				partialUpdate,
				mockUser
			);
			await PUT(mockRequest);

			expect(mockDb.template.update).toHaveBeenCalledWith({
				where: { id: 'template-123' },
				data: expectedUpdateData
			});
		});
	});

	describe('DELETE /api/templates/[id]', () => {
		it('should delete template for authenticated owner', async () => {
			mockDb.template.findFirst.mockResolvedValue(mockTemplate);
			mockDb.template.delete.mockResolvedValue(mockTemplate);

			const mockRequest = createMockRequest({ id: 'template-123' }, undefined, mockUser);
			const response = await DELETE(mockRequest);
			const responseData = await response.json();

			expect(mockDb.template.findFirst).toHaveBeenCalledWith({
				where: { id: 'template-123', userId: 'user-123' }
			});

			expect(mockDb.template.delete).toHaveBeenCalledWith({
				where: { id: 'template-123' }
			});

			expect(responseData).toEqual({
				success: true,
				id: 'template-123'
			});
		});

		it('should require authentication', async () => {
			const mockRequest = createMockRequest({ id: 'template-123' }); // No user

			const response = await DELETE(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(401);
			expect(responseData).toEqual({ error: 'Unauthorized' });
			expect(mockDb.template.findFirst).not.toHaveBeenCalled();
		});

		it('should require template ownership', async () => {
			mockDb.template.findFirst.mockResolvedValue(null); // Template not found or not owned

			const mockRequest = createMockRequest({ id: 'template-123' }, undefined, mockUser);
			const response = await DELETE(mockRequest);

			expect(response.status).toBe(404);
			expect(mockDb.template.delete).not.toHaveBeenCalled();
		});

		it('should handle database errors gracefully', async () => {
			mockDb.template.findFirst.mockRejectedValue(new Error('Database error'));

			const mockRequest = createMockRequest({ id: 'template-123' }, undefined, mockUser);
			const response = await DELETE(mockRequest);

			expect(response.status).toBe(500);
		});

		it('should handle delete operation errors', async () => {
			mockDb.template.findFirst.mockResolvedValue(mockTemplate);
			mockDb.template.delete.mockRejectedValue(new Error('Delete failed'));

			const mockRequest = createMockRequest({ id: 'template-123' }, undefined, mockUser);
			const response = await DELETE(mockRequest);

			expect(response.status).toBe(500);
		});
	});

	describe('Authentication Edge Cases', () => {
		it('should handle invalid auth session in PUT', async () => {
			const mockRequest = {
				params: { id: 'template-123' },
				request: { json: vi.fn().mockResolvedValue({}) },
				locals: {
					auth: {
						validate: vi.fn().mockResolvedValue(null)
					}
				}
			} as unknown as RequestEvent;

			const response = await PUT(mockRequest);

			expect(response.status).toBe(401);
		});

		it('should handle auth validation errors in PUT', async () => {
			const mockRequest = {
				params: { id: 'template-123' },
				request: { json: vi.fn().mockResolvedValue({}) },
				locals: {
					auth: {
						validate: vi.fn().mockRejectedValue(new Error('Auth error'))
					}
				}
			} as unknown as RequestEvent;

			const response = await PUT(mockRequest);

			expect(response.status).toBe(500);
		});

		it('should handle invalid auth session in DELETE', async () => {
			const mockRequest = {
				params: { id: 'template-123' },
				locals: {
					auth: {
						validate: vi.fn().mockResolvedValue(null)
					}
				}
			} as unknown as RequestEvent;

			const response = await DELETE(mockRequest);

			expect(response.status).toBe(401);
		});

		it('should handle auth validation errors in DELETE', async () => {
			const mockRequest = {
				params: { id: 'template-123' },
				locals: {
					auth: {
						validate: vi.fn().mockRejectedValue(new Error('Auth error'))
					}
				}
			} as unknown as RequestEvent;

			const response = await DELETE(mockRequest);

			expect(response.status).toBe(500);
		});
	});

	describe('Parameter Validation', () => {
		it('should handle missing template ID', async () => {
			const mockRequest = createMockRequest({ id: '' });
			const response = await GET(mockRequest);

			expect(mockDb.template.findUnique).toHaveBeenCalledWith({
				where: { id: '' }
			});
		});

		it('should handle undefined template ID', async () => {
			const mockRequest = createMockRequest({ id: undefined });
			const response = await GET(mockRequest);

			expect(mockDb.template.findUnique).toHaveBeenCalledWith({
				where: { id: undefined }
			});
		});

		it('should handle very long template IDs', async () => {
			const longId = 'a'.repeat(1000);
			mockDb.template.findUnique.mockResolvedValue(null);

			const mockRequest = createMockRequest({ id: longId });
			const response = await GET(mockRequest);

			expect(response.status).toBe(404);
		});

		it('should handle special characters in template ID', async () => {
			const specialId = 'template-123!@#$%^&*()';
			mockDb.template.findUnique.mockResolvedValue(null);

			const mockRequest = createMockRequest({ id: specialId });
			const response = await GET(mockRequest);

			expect(mockDb.template.findUnique).toHaveBeenCalledWith({
				where: { id: specialId }
			});
		});
	});
});