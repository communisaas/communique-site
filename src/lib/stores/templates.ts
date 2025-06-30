import { writable, derived } from 'svelte/store';
import type { Template } from '$lib/types/template';

interface TemplateState {
	templates: Template[];
	selectedId: string | null;
	loading: boolean;
	error: string | null;
	lastUpdated?: Date;
}

function createTemplateStore() {
	const { subscribe, set, update } = writable<TemplateState>({
		templates: [],
		selectedId: null,
		loading: false,
		error: null
	});

	return {
		subscribe,
		// Core template management
		selectTemplate: (id: string) => {
			update((state) => ({ ...state, selectedId: id }));
		},

		// API Integration - TODO: Update once Prisma API routes are ready
		async fetchTemplates() {
			update((state) => ({ ...state, loading: true, error: null }));
			try {
				const response = await fetch('/api/templates');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				update((state) => ({
					...state,
					templates: data,
					loading: false,
					error: null,
					lastUpdated: new Date()
				}));
			} catch (err) {
				console.error('Error fetching templates:', err);
				update((state) => ({
					...state,
					loading: false,
					error: err instanceof Error ? err.message : 'Failed to fetch templates'
				}));
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
					selectedId: newTemplate.id,
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

				update((store) => ({
					...store,
					templates: store.templates.filter((t) => t.id !== id),
					selectedId: store.selectedId === id ? null : store.selectedId,
					error: null
				}));
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
				error: null
			});
		}
	};
}

export const templateStore = createTemplateStore();

export const selectedTemplate = derived(
	templateStore,
	($store) => $store.templates.find((t) => t.id === $store.selectedId)
);
// Note: Templates are loaded via fetchTemplates() call in +layout.svelte

