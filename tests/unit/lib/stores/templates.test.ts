import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { templateStore, selectedTemplate, isLoading, hasError, isInitialized } from './templates';
import type { Template } from '$lib/types/template';

// Mock the API client module
const mockTemplatesApi = {
	list: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn()
};

vi.mock('$lib/utils/apiClient', () => ({
	templatesApi: mockTemplatesApi
}));

describe('TemplateStore', () => {
	// Mock templates for testing
	const mockTemplate1: Template = {
		id: 'template-1',
		slug: 'climate-action',
		title: 'Climate Action Template',
		description: 'Urge action on climate change',
		category: 'Environment',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Climate Action Needed',
		message_body: 'Dear Representative, please act on climate change.',
		preview: 'Climate action preview',
		metrics: JSON.stringify({ sent: 100, views: 500 }),
		delivery_config: JSON.stringify({ priority: 'high' }),
		recipient_config: JSON.stringify({ targetType: 'congress' }),
		is_public: true,
		status: 'published',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	const mockTemplate2: Template = {
		id: 'template-2',
		slug: 'healthcare-access',
		title: 'Healthcare Access Template',
		description: 'Support healthcare access',
		category: 'Healthcare',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Healthcare Access',
		message_body: 'Dear Representative, please support healthcare access.',
		preview: 'Healthcare preview',
		metrics: JSON.stringify({ sent: 50, views: 200 }),
		delivery_config: JSON.stringify({ priority: 'medium' }),
		recipient_config: JSON.stringify({ targetType: 'local' }),
		is_public: true,
		status: 'published',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	beforeEach(() => {
		// Reset store state before each test
		templateStore.reset();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Initial State', () => {
		it('should have correct initial state', () => {
			const state = get(templateStore);
			
			expect(state).toEqual({
				templates: [],
				selectedId: null,
				loading: false,
				error: null,
				initialized: false
			});
		});

		it('should have correct derived store initial values', () => {
			expect(get(selectedTemplate)).toBeUndefined();
			expect(get(isLoading)).toBe(false);
			expect(get(hasError)).toBe(false);
			expect(get(isInitialized)).toBe(false);
		});
	});

	describe('Template Selection', () => {
		beforeEach(async () => {
			// Set up templates in store first
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1, mockTemplate2]
			});
			await templateStore.fetchTemplates();
		});

		it('should select template by id', () => {
			templateStore.selectTemplate('template-1');
			
			const state = get(templateStore);
			expect(state.selectedId).toBe('template-1');
		});

		it('should select template by slug', () => {
			templateStore.selectTemplateBySlug('healthcare-access');
			
			const state = get(templateStore);
			expect(state.selectedId).toBe('template-2');
		});

		it('should not change selection for non-existent slug', () => {
			templateStore.selectTemplate('template-1');
			
			templateStore.selectTemplateBySlug('non-existent');
			
			const state = get(templateStore);
			expect(state.selectedId).toBe('template-1'); // Should remain unchanged
		});

		it('should auto-select first template when none selected', () => {
			// Clear selection first
			templateStore.selectTemplate('');
			
			templateStore.autoSelectFirst();
			
			const state = get(templateStore);
			expect(state.selectedId).toBe('template-1');
		});

		it('should not change selection if already selected', () => {
			templateStore.selectTemplate('template-2');
			
			templateStore.autoSelectFirst();
			
			const state = get(templateStore);
			expect(state.selectedId).toBe('template-2'); // Should remain unchanged
		});
	});

	describe('Template Fetching', () => {
		it('should successfully fetch templates', async () => {
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1, mockTemplate2]
			});

			await templateStore.fetchTemplates();

			const state = get(templateStore);
			expect(state.templates).toEqual([mockTemplate1, mockTemplate2]);
			expect(state.loading).toBe(false);
			expect(state.error).toBeNull();
			expect(state.initialized).toBe(true);
			expect(state.selectedId).toBe('template-1'); // Auto-selected first
			expect(state.lastUpdated).toBeInstanceOf(Date);
		});

		it('should handle API errors gracefully', async () => {
			mockTemplatesApi.list.mockResolvedValue({
				success: false,
				error: 'API Error'
			});

			await templateStore.fetchTemplates();

			const state = get(templateStore);
			expect(state.templates).toEqual([]);
			expect(state.loading).toBe(false);
			expect(state.error).toBe('API Error');
			expect(state.initialized).toBe(false);
		});

		it('should handle network errors gracefully', async () => {
			mockTemplatesApi.list.mockRejectedValue(new Error('Network error'));

			await templateStore.fetchTemplates();

			const state = get(templateStore);
			expect(state.templates).toEqual([]);
			expect(state.loading).toBe(false);
			expect(state.error).toBe('Network error');
		});

		it('should preserve existing selection if still valid after fetch', async () => {
			// First load templates
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1, mockTemplate2]
			});

			await templateStore.fetchTemplates();
			templateStore.selectTemplate('template-2');

			// Fetch again with same templates
			await templateStore.fetchTemplates();

			const state = get(templateStore);
			expect(state.selectedId).toBe('template-2'); // Should preserve selection
		});

		it('should reset selection if selected template no longer exists', async () => {
			// First load templates
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1, mockTemplate2]
			});

			await templateStore.fetchTemplates();
			templateStore.selectTemplate('template-2');

			// Fetch again with only template-1
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1]
			});

			await templateStore.fetchTemplates();

			const state = get(templateStore);
			expect(state.selectedId).toBe('template-1'); // Should auto-select first available
		});
	});

	describe('Template Creation', () => {
		it('should successfully create a template', async () => {
			const newTemplate = { ...mockTemplate1 };
			delete (newTemplate as any).id; // Remove id for creation

			const createdTemplate = { ...mockTemplate1, id: 'new-template-id' };

			mockTemplatesApi.create.mockResolvedValue({
				success: true,
				data: createdTemplate
			});

			const result = await templateStore.addTemplate(newTemplate);

			expect(result).toEqual(createdTemplate);
			
			const state = get(templateStore);
			expect(state.templates).toContain(createdTemplate);
			expect(state.selectedId).toBe('new-template-id'); // Auto-selected
			expect(state.error).toBeNull();
		});

		it('should handle creation errors', async () => {
			const newTemplate = { ...mockTemplate1 };
			delete (newTemplate as any).id;

			mockTemplatesApi.create.mockResolvedValue({
				success: false,
				error: 'Creation failed'
			});

			await expect(templateStore.addTemplate(newTemplate)).rejects.toThrow('Creation failed');

			const state = get(templateStore);
			expect(state.error).toBe('Template could not be added.');
		});
	});

	describe('Template Updates', () => {
		beforeEach(async () => {
			// Set up initial templates
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1, mockTemplate2]
			});
			await templateStore.fetchTemplates();
		});

		it('should successfully update a template', async () => {
			const updates = { title: 'Updated Title' };
			const updatedTemplate = { ...mockTemplate1, ...updates };

			mockTemplatesApi.update.mockResolvedValue({
				success: true,
				data: updatedTemplate
			});

			const result = await templateStore.updateTemplate('template-1', updates);

			expect(result).toEqual(updatedTemplate);
			
			const state = get(templateStore);
			const template = state.templates.find(t => t.id === 'template-1');
			expect(template?.title).toBe('Updated Title');
			expect(state.error).toBeNull();
		});

		it('should handle update errors', async () => {
			mockTemplatesApi.update.mockResolvedValue({
				success: false,
				error: 'Update failed'
			});

			await expect(templateStore.updateTemplate('template-1', { title: 'New' }))
				.rejects.toThrow('Update failed');

			const state = get(templateStore);
			expect(state.error).toBe('Update failed');
		});
	});

	describe('Template Deletion', () => {
		beforeEach(async () => {
			// Set up initial templates
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1, mockTemplate2]
			});
			await templateStore.fetchTemplates();
		});

		it('should successfully delete a template', async () => {
			mockTemplatesApi.delete.mockResolvedValue({ success: true });

			await templateStore.deleteTemplate('template-1');

			const state = get(templateStore);
			expect(state.templates).toHaveLength(1);
			expect(state.templates.find(t => t.id === 'template-1')).toBeUndefined();
			expect(state.error).toBeNull();
		});

		it('should update selection when deleting selected template', async () => {
			templateStore.selectTemplate('template-1');

			mockTemplatesApi.delete.mockResolvedValue({ success: true });

			await templateStore.deleteTemplate('template-1');

			const state = get(templateStore);
			expect(state.selectedId).toBe('template-2'); // Should select first remaining
		});

		it('should clear selection when deleting last template', async () => {
			// Set up with only one template
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1]
			});
			await templateStore.fetchTemplates();

			templateStore.selectTemplate('template-1');
			mockTemplatesApi.delete.mockResolvedValue({ success: true });

			await templateStore.deleteTemplate('template-1');

			const state = get(templateStore);
			expect(state.selectedId).toBeNull();
			expect(state.templates).toHaveLength(0);
		});

		it('should handle deletion errors', async () => {
			mockTemplatesApi.delete.mockResolvedValue({
				success: false,
				error: 'Delete failed'
			});

			await expect(templateStore.deleteTemplate('template-1')).rejects.toThrow('Delete failed');

			const state = get(templateStore);
			expect(state.error).toBe('Delete failed');
			expect(state.templates).toHaveLength(2); // Should remain unchanged
		});
	});

	describe('Derived Stores', () => {
		beforeEach(async () => {
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1, mockTemplate2]
			});
			await templateStore.fetchTemplates();
		});

		it('should correctly derive selectedTemplate', () => {
			templateStore.selectTemplate('template-2');
			
			const selected = get(selectedTemplate);
			expect(selected).toEqual(mockTemplate2);
		});

		it('should return undefined when no template selected', () => {
			templateStore.selectTemplate('non-existent');
			
			const selected = get(selectedTemplate);
			expect(selected).toBeUndefined();
		});

		it('should correctly derive error state', async () => {
			expect(get(hasError)).toBe(false);

			mockTemplatesApi.list.mockResolvedValue({
				success: false,
				error: 'Test error'
			});

			await templateStore.fetchTemplates();

			expect(get(hasError)).toBe(true);
		});

		it('should correctly derive initialized state', () => {
			expect(get(isInitialized)).toBe(true); // Already initialized from beforeEach
		});
	});

	describe('Store Reset', () => {
		it('should reset store to initial state', async () => {
			// First load some data
			mockTemplatesApi.list.mockResolvedValue({
				success: true,
				data: [mockTemplate1]
			});
			await templateStore.fetchTemplates();

			// Verify data is loaded
			let state = get(templateStore);
			expect(state.templates).toHaveLength(1);
			expect(state.initialized).toBe(true);

			// Reset
			templateStore.reset();

			// Verify reset
			state = get(templateStore);
			expect(state).toEqual({
				templates: [],
				selectedId: null,
				loading: false,
				error: null,
				initialized: false
			});
		});
	});
});