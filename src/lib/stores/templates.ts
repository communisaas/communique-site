import { writable, derived } from 'svelte/store';
import type { Template } from '$lib/types/template';
import { templates as staticTemplates } from '$lib/data/templates';

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
		
		// Initialize with static data for immediate render
		initializeWithStaticData() {
			const templatesWithIds = staticTemplates.map((template, index) => ({
				...template,
				id: `static-${index + 1}` // Generate consistent IDs for static data
			}));
			
			update((state) => ({
				...state,
				templates: templatesWithIds,
				selectedId: templatesWithIds[0]?.id || null, // Auto-select first template
				initialized: true
			}));
		},

		// Core template management
		selectTemplate: (id: string) => {
			update((state) => ({ ...state, selectedId: id }));
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
				const response = await fetch('/api/templates');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				
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
				console.error('Error fetching templates:', err);
				update((state) => ({
					...state,
					loading: false,
					error: err instanceof Error ? err.message : 'Failed to fetch templates'
				}));
				
				// Fallback to static data if API fails and we haven't initialized yet
				if (!state.initialized) {
					this.initializeWithStaticData();
				}
			}
		},

		// Template CRUD operations
		async addTemplate(template: Omit<Template, 'id'>) {
			try {
				const response = await fetch('/api/templates', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(template)
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const newTemplate = await response.json();
				update((store) => ({
					...store,
					templates: [...store.templates, newTemplate],
					selectedId: newTemplate.id, // Auto-select newly created template
					error: null
				}));

				return newTemplate;
			} catch (err) {
				console.error('Error adding template:', err);
				update((store) => ({
					...store,
					error: 'Template could not be added.'
				}));
				throw err;
			}
		},

		async updateTemplate(id: string, updates: Partial<Template>) {
			try {
				const response = await fetch(`/api/templates/${id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(updates)
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const updatedTemplate = await response.json();
				update((store) => ({
					...store,
					templates: store.templates.map((t) => (t.id === id ? updatedTemplate : t)),
					error: null
				}));

				return updatedTemplate;
			} catch (err) {
				console.error('Error updating template:', err);
				update((store) => ({
					...store,
					error: err instanceof Error ? err.message : 'Failed to update template'
				}));
				throw err;
			}
		},

		async deleteTemplate(id: string) {
			try {
				const response = await fetch(`/api/templates/${id}`, {
					method: 'DELETE'
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
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
				console.error('Error deleting template:', err);
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

