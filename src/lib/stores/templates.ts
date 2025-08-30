import { writable, derived } from 'svelte/store';
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
	const { subscribe, set, update } = writable<TemplateState>({
		templates: [],
		selectedId: null,
		loading: false,
		error: null,
		initialized: false
	});

	return {
		subscribe,
		

		// Core template management
		selectTemplate: (id: string) => {
			update((state) => ({ ...state, selectedId: id }));
		},
		
		selectTemplateBySlug: (slug: string) => {
			update((state) => {
				const template = state.templates.find(t => t.slug === slug);
				if (template) {
					return { ...state, selectedId: template.id };
				}
				return state;
			});
		},

		// Auto-select first template when templates change
		autoSelectFirst() {
			update((state) => {
				if (state.templates.length > 0 && !state.selectedId) {
					return { ...state, selectedId: state.templates[0].id };
				}
				return state;
			});
		},

		// API Integration with progressive enhancement
		async fetchTemplates() {
			update((state) => ({ ...state, loading: true, error: null }));
			try {
				const { api } = await import('$lib/core/api/client');
				const result = await api.list();
				console.log('Templates API result:', result);
				if (!result.success) {
					console.error('Templates API error:', result.error);
					throw new Error(result.error || 'Failed to fetch templates');
				}
				const data = result.data;
				
				update((state) => {
					const newState = {
						...state,
						templates: data,
						loading: false,
						error: null,
						lastUpdated: new Date(),
						initialized: true
					};
					
					// Auto-select first template if none selected or selected template no longer exists
					if (!newState.selectedId || !data.find((t: Template) => t.id === newState.selectedId)) {
						newState.selectedId = data[0]?.id || null;
					}
					
					return newState;
				});
			} catch (err) {
				console.error('Template fetch error:', err);
				update((state) => ({
					...state,
					loading: false,
					error: err instanceof Error ? err.message : 'Failed to fetch templates'
				}));
				
				// No fallback to static data - API-only approach
			}
		},

		// Template CRUD operations
		async addTemplate(template: Omit<Template, 'id'>) {
			try {
				const { api } = await import('$lib/core/api/client');
				const result = await api.create(template);

				if (!result.success) {
					throw new Error(result.error || 'Failed to create template');
				}

				const newTemplate = result.data;
				update((store) => ({
					...store,
					templates: [...store.templates, newTemplate],
					selectedId: newTemplate.id, // Auto-select newly created template
					error: null
				}));

				return newTemplate;
			} catch (err) {
				update((store) => ({
					...store,
					error: 'Template could not be added.'
				}));
				throw err;
			}
		},

		async updateTemplate(id: string, updates: Partial<Template>) {
			try {
				const { api } = await import('$lib/core/api/client');
				const result = await api.update(id, updates);

				if (!result.success) {
					throw new Error(result.error || 'Failed to update template');
				}

				const updatedTemplate = result.data;
				update((store) => ({
					...store,
					templates: store.templates.map((t) => (t.id === id ? updatedTemplate : t)),
					error: null
				}));

				return updatedTemplate;
			} catch (err) {
				update((store) => ({
					...store,
					error: err instanceof Error ? err.message : 'Failed to update template'
				}));
				throw err;
			}
		},

		async deleteTemplate(id: string) {
			try {
				const { api } = await import('$lib/core/api/client');
				const result = await api.delete(id);

				if (!result.success) {
					throw new Error(result.error || 'Failed to delete template');
				}

				update((store) => {
					const newTemplates = store.templates.filter((t) => t.id !== id);
					const newSelectedId = store.selectedId === id ? (newTemplates[0]?.id || null) : store.selectedId;
					
					return {
						...store,
						templates: newTemplates,
						selectedId: newSelectedId,
						error: null
					};
				});
			} catch (err) {
				update((store) => ({
					...store,
					error: err instanceof Error ? err.message : 'Failed to delete template'
				}));
				throw err;
			}
		},

		// Development helpers
		reset: () => {
			set({
				templates: [],
				selectedId: null,
				loading: false,
				error: null,
				initialized: false
			});
		}
	};
}

export const templateStore = createTemplateStore();

export const selectedTemplate = derived(
	templateStore,
	($store) => $store.templates.find((t) => t.id === $store.selectedId)
);

// Helper derived stores for better UX
export const isLoading = derived(templateStore, ($store) => $store.loading);
export const hasError = derived(templateStore, ($store) => !!$store.error);
export const isInitialized = derived(templateStore, ($store) => $store.initialized);

