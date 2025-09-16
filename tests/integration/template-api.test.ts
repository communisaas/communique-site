/**
 * Template API Integration Tests
 *
 * Tests template CRUD operations and slug validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { asRequestEvent, createMockUser } from '../types/test-helpers';

// Use vi.hoisted for all mocks to fix initialization order
const mocks = vi.hoisted(() => ({
	db: {
		template: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		},
		user: {
			findUnique: vi.fn()
		}
	},
	extractRecipientEmails: vi.fn().mockReturnValue([]),
	createApiError: vi.fn().mockReturnValue({ type: 'API_ERROR', message: 'Error' }),
	createValidationError: vi
		.fn()
		.mockReturnValue({ type: 'VALIDATION_ERROR', field: 'test', message: 'Validation failed' }),
	json: vi.fn().mockImplementation((data, options) => ({
		ok: options?.status ? options.status < 400 : true,
		status: options?.status || 200,
		json: async () => data,
		text: async () => JSON.stringify(data)
	}))
}));

// Apply mocks
vi.mock('$lib/core/db', () => ({
	db: mocks.db
}));

vi.mock('$lib/types/templateConfig', () => ({
	extractRecipientEmails: mocks.extractRecipientEmails
}));

vi.mock('$lib/types/errors', () => ({
	createApiError: mocks.createApiError,
	createValidationError: mocks.createValidationError
}));

vi.mock('@sveltejs/kit', () => ({
	json: mocks.json
}));

// Import API handlers after mocking
import { POST as TemplatesPOST, GET as TemplatesGET } from '../../src/routes/api/templates/+server';
import { GET as CheckSlugGET } from '../../src/routes/api/templates/check-slug/+server';

describe('Template API Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Template Creation', () => {
		it('creates valid template successfully', async () => {
			const templateData = {
				title: 'Climate Action Template',
				subject: 'Support Climate Legislation',
				message_body: 'Dear [representative.name], I urge you to support climate action.',
				category: 'environment',
				type: 'advocacy',
				delivery_method: 'email',
				is_public: true
			};

			const mockCreatedTemplate = {
				id: 'template-new-123',
				slug: 'climate-action-template',
				...templateData,
				created_by: 'user-creator-123',
				created_at: new Date(),
				updated_at: new Date()
			};

			mocks.db.template.create.mockResolvedValueOnce(mockCreatedTemplate);

			const mockRequest = {
				json: vi.fn().mockResolvedValue(templateData)
			};

			const mockLocals = {
				user: { id: 'user-creator-123' }
			};

			const response = await TemplatesPOST(asRequestEvent(mockRequest, mockLocals));
			const responseData = await response.json();

			expect(mocks.db.template.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					title: 'Climate Action Template',
					subject: 'Support Climate Legislation',
					category: 'environment'
				})
			});

			expect(responseData).toMatchObject({
				template: expect.objectContaining({
					id: 'template-new-123',
					title: 'Climate Action Template'
				})
			});
		});

		it('validates required fields', async () => {
			const incompleteData = {
				title: 'Missing Required Fields'
				// Missing subject and message_body
			};

			const mockRequest = {
				json: vi.fn().mockResolvedValue(incompleteData)
			};

			const response = await TemplatesPOST(
				asRequestEvent(mockRequest, { user: createMockUser({ id: 'user-123' }), session: null })
			);

			expect(response.status).toBe(400);
			const errorData = await response.json();
			expect(errorData.error).toBeDefined();
		});

		it('enforces character limits', async () => {
			const oversizedData = {
				title: 'a'.repeat(256), // Exceeds 255 char limit
				subject: 'Test Subject',
				message_body: 'Test message'
			};

			const mockRequest = {
				json: vi.fn().mockResolvedValue(oversizedData)
			};

			const response = await TemplatesPOST(
				asRequestEvent(mockRequest, { user: createMockUser({ id: 'user-123' }), session: null })
			);

			expect(response.status).toBe(400);
			const errorData = await response.json();
			expect(errorData.error).toContain('limit');
		});

		it('generates unique slugs', async () => {
			const templateData = {
				title: 'Template With Duplicate Title',
				subject: 'Test',
				message_body: 'Test'
			};

			// First call finds existing slug
			mocks.db.template.findUnique.mockResolvedValueOnce({
				id: 'existing',
				slug: 'template-with-duplicate-title'
			});
			// Second call finds the slug is available with suffix
			mocks.db.template.findUnique.mockResolvedValueOnce(null);

			mocks.db.template.create.mockResolvedValueOnce({
				id: 'new-template',
				slug: 'template-with-duplicate-title-2',
				...templateData
			});

			const mockRequest = {
				json: vi.fn().mockResolvedValue(templateData)
			};

			const response = await TemplatesPOST(
				asRequestEvent(mockRequest, { user: createMockUser({ id: 'user-123' }), session: null })
			);

			const responseData = await response.json();
			expect(responseData.template.slug).toBe('template-with-duplicate-title-2');
		});

		it('handles guest users without authentication', async () => {
			const templateData = {
				title: 'Guest Template',
				subject: 'Test',
				message_body: 'Test',
				guest_email: 'guest@example.com',
				guest_name: 'Guest User'
			};

			mocks.db.template.create.mockResolvedValueOnce({
				id: 'guest-template',
				...templateData,
				created_by: null
			});

			const mockRequest = {
				json: vi.fn().mockResolvedValue(templateData)
			};

			const response = await TemplatesPOST(
				asRequestEvent(
					mockRequest,
					{ user: null, session: null } // No authenticated user
				)
			);

			expect(response.status).toBe(200);
			const responseData = await response.json();
			expect(responseData.template.id).toBe('guest-template');
		});
	});

	describe('Template Retrieval', () => {
		it('fetches public templates for unauthenticated users', async () => {
			const publicTemplates = [
				{ id: 'template-1', title: 'Public 1', is_public: true },
				{ id: 'template-2', title: 'Public 2', is_public: true }
			];

			mocks.db.template.findMany.mockResolvedValueOnce(publicTemplates);

			const mockUrl = new URL('http://localhost:5173/api/templates');
			const response = await TemplatesGET(asRequestEvent({ url: mockUrl }, {}));
			const responseData = await response.json();

			expect(mocks.db.template.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { is_public: true }
				})
			);

			expect(responseData.templates).toHaveLength(2);
			expect(responseData.templates[0].title).toBe('Public 1');
		});

		it('includes user templates for authenticated users', async () => {
			const mixedTemplates = [
				{ id: 'template-1', title: 'Public', is_public: true },
				{ id: 'template-2', title: 'My Private', is_public: false, created_by: 'user-123' }
			];

			mocks.db.template.findMany.mockResolvedValueOnce(mixedTemplates);

			const mockUrl = new URL('http://localhost:5173/api/templates');
			const response = await TemplatesGET({
				url: mockUrl,
				locals: { user: { id: 'user-123' } }
			});
			const responseData = await response.json();

			expect(mocks.db.template.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						OR: [{ is_public: true }, { created_by: 'user-123' }]
					}
				})
			);

			expect(responseData.templates).toHaveLength(2);
		});
	});

	describe('Slug Validation', () => {
		it.each([
			['new-valid-slug', true],
			['existing-slug', false]
		])('checks slug availability for "%s"', async (slug, isAvailable) => {
			const mockUrl = new URL(`http://localhost:5173/api/templates/check-slug?slug=${slug}`);

			if (isAvailable) {
				mocks.db.template.findUnique.mockResolvedValueOnce(null);
			} else {
				mocks.db.template.findUnique.mockResolvedValueOnce({
					id: 'existing-template',
					slug
				});
			}

			const response = await CheckSlugGET({ url: mockUrl });
			const responseData = await response.json();

			expect(mocks.db.template.findUnique).toHaveBeenCalledWith({
				where: { slug },
				select: { id: true }
			});

			if (isAvailable) {
				expect(responseData).toEqual({
					available: true,
					slug
				});
			} else {
				expect(responseData).toMatchObject({
					available: false,
					error: expect.stringContaining('already taken')
				});
			}
		});

		it.each([
			'Invalid Slug!', // Special characters
			'UPPERCASE', // Uppercase letters
			'slug with spaces' // Spaces
		])('rejects invalid slug format: "%s"', async (invalidSlug) => {
			const mockUrl = new URL(
				`http://localhost:5173/api/templates/check-slug?slug=${encodeURIComponent(invalidSlug)}`
			);

			const response = await CheckSlugGET({ url: mockUrl });

			expect(response.status).toBe(400);
			const errorData = await response.json();
			expect(errorData.error).toContain('Invalid slug format');
		});

		it('requires slug parameter', async () => {
			const mockUrl = new URL('http://localhost:5173/api/templates/check-slug');

			const response = await CheckSlugGET({ url: mockUrl });

			expect(response.status).toBe(400);
			const errorData = await response.json();
			expect(errorData.error).toContain('required');
		});
	});

	describe('Error Handling', () => {
		it('handles database errors during creation', async () => {
			mocks.db.template.create.mockRejectedValueOnce(new Error('Database connection failed'));

			const mockRequest = {
				json: vi.fn().mockResolvedValue({
					title: 'Test',
					subject: 'Test',
					message_body: 'Test'
				})
			};

			const response = await TemplatesPOST(
				asRequestEvent(mockRequest, { user: createMockUser({ id: 'user-123' }), session: null })
			);

			expect(response.status).toBe(500);
			const errorData = await response.json();
			expect(errorData.error).toBeDefined();
		});

		it('handles database errors during retrieval', async () => {
			mocks.db.template.findMany.mockRejectedValueOnce(new Error('Query timeout'));

			const mockUrl = new URL('http://localhost:5173/api/templates');
			const response = await TemplatesGET(asRequestEvent({ url: mockUrl }, {}));

			expect(response.status).toBe(500);
			const errorData = await response.json();
			expect(errorData.error).toBeDefined();
		});
	});
});
