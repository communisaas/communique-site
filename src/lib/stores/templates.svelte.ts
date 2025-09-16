// Svelte 5 Templates Store - migrated from Svelte 4 store patterns
import type { Template } from '$lib/types/template';

interface TemplateState {
	templates: Template[];
	selectedId: string | null;
	loading: boolean;
	error: string | null;
	lastUpdated?: Date;
	initialized: boolean;
}

function createTemplateStore() {
	// Convert writable store to $state rune
	let state = $state<TemplateState>({
		templates: [],
		selectedId: null,
		loading: false,
		error: null,
		initialized: false
	});

	return {
		// Getters - replace subscribe pattern
		get templates() {
			return state.templates;
		},
		get selectedId() {
			return state.selectedId;
		},
		get loading() {
			return state.loading;
		},
		get error() {
			return state.error;
		},
		get lastUpdated() {
			return state.lastUpdated;
		},
		get initialized() {
			return state.initialized;
		},

		// Core template management
		selectTemplate: (id: string) => {
			state.selectedId = id;
		},

		selectTemplateBySlug: (slug: string) => {
			const template = state.templates.find((t) => t.slug === slug);
			if (template) {
				state.selectedId = template.id;
			}
		},

		// Auto-select first template when templates change
		autoSelectFirst() {
			if (state.templates.length > 0 && !state.selectedId) {
				state.selectedId = state.templates[0].id;
			}
		},

		// API Integration with progressive enhancement
		async fetchTemplates() {
			state.loading = true;
			state.error = null;

			try {
				const { templatesApi } = await import('$lib/services/apiClient');
				const result = await templatesApi.list();
				console.log('Templates API result:', result);

				if (!result.success) {
					console.error('Templates API error:', result.error);
					throw new Error(result.error || 'Failed to fetch templates');
				}

				const data = result.data;

				// Update state directly with $state
				state.templates = data;
				state.loading = false;
				state.error = null;
				state.lastUpdated = new Date();
				state.initialized = true;

				// Auto-select first template if none selected or selected template no longer exists
				if (!state.selectedId || !data.find((t: Template) => t.id === state.selectedId)) {
					state.selectedId = data[0]?.id || null;
				}
			} catch (err) {
				console.error('Template fetch error:', err);
				state.loading = false;
				state.error = err instanceof Error ? err.message : 'Failed to fetch templates';
			}
		},

		// Template CRUD operations
		async addTemplate(template: Omit<Template, 'id'>) {
			try {
				const { templatesApi } = await import('$lib/services/apiClient');
				const result = await templatesApi.create(template);

				if (!result.success) {
					throw new Error(result.error || 'Failed to create template');
				}

				const newTemplate = result.data;

				// Update state directly
				state.templates = [...state.templates, newTemplate];
				state.selectedId = newTemplate.id; // Auto-select newly created template
				state.error = null;

				return newTemplate;
			} catch (err) {
				state.error = 'Template could not be added.';
				throw err;
			}
		},

		async updateTemplate(id: string, updates: Partial<Template>) {
			try {
				const { templatesApi } = await import('$lib/services/apiClient');
				const result = await templatesApi.update(id, updates);

				if (!result.success) {
					throw new Error(result.error || 'Failed to update template');
				}

				const updatedTemplate = result.data;

				// Update state directly
				state.templates = state.templates.map((t) => (t.id === id ? updatedTemplate : t));
				state.error = null;

				return updatedTemplate;
			} catch (err) {
				state.error = err instanceof Error ? err.message : 'Failed to update template';
				throw err;
			}
		},

		async deleteTemplate(id: string) {
			try {
				const { templatesApi } = await import('$lib/services/apiClient');
				const result = await templatesApi.delete(id);

				if (!result.success) {
					throw new Error(result.error || 'Failed to delete template');
				}

				// Update state directly
				const newTemplates = state.templates.filter((t) => t.id !== id);
				const newSelectedId =
					state.selectedId === id ? newTemplates[0]?.id || null : state.selectedId;

				state.templates = newTemplates;
				state.selectedId = newSelectedId;
				state.error = null;
			} catch (err) {
				state.error = err instanceof Error ? err.message : 'Failed to delete template';
				throw err;
			}
		},

		// Development helpers
		reset: () => {
			state.templates = [];
			state.selectedId = null;
			state.loading = false;
			state.error = null;
			state.initialized = false;
		}
	};
}

export const templateStore = createTemplateStore();
