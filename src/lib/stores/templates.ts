import { writable, derived, get } from 'svelte/store';
import type { Template } from '$lib/types/template';
import { templates as mockTemplates } from '$lib/data/templates';

interface TemplateState {
    templates: Template[];
    selectedId: number | null;
    loading: boolean;
    error: string | null;
    lastUpdated?: Date;
}

const USE_MOCK_DATA = false; // Switch to true if you want to use mock data

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
        selectTemplate: (id: number) => {
            update(state => ({ ...state, selectedId: id }));
        },
        
        // API Integration - TODO: Update once Prisma API routes are ready
        async fetchTemplates() {
            update(state => ({ ...state, loading: true, error: null }));
            try {
                const response = await fetch('/api/templates');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                update(state => ({
                    ...state,
                    templates: data,
                    loading: false,
                    error: null,
                    lastUpdated: new Date()
                }));
            } catch (err) {
                console.error('Error fetching templates:', err);
                // Fall back to mock data if API fails
                this.loadMockData();
                update(state => ({
                    ...state,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Failed to fetch templates - using mock data'
                }));
            }
        },

        // Template CRUD operations
        async addTemplate(template: Omit<Template, 'id'>) {
            try {
                const response = await fetch('/api/templates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(template),
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const newTemplate = await response.json();
                update(store => ({
                    ...store,
                    templates: [...store.templates, newTemplate],
                    selectedId: newTemplate.id,
                    error: null
                }));
                
                return newTemplate;
            } catch (err) {
                console.error('Error adding template:', err);
                // Fall back to local addition for now
                const newId = Math.max(...(get(templateStore).templates.map(t => t.id)), 0) + 1;
                const newTemplate: Template = {
                    id: newId,
                    ...template,
                    metrics: {
                        messages: '0 messages sent',
                        reach: template.metrics.reach || 'Pending',
                        tooltip: template.metrics.tooltip || 'Campaign recently created',
                        target: template.metrics.target || 'Pending'
                    }
                };
                
                update(store => ({
                    ...store,
                    templates: [...store.templates, newTemplate],
                    selectedId: newId,
                    error: 'Template added locally - API integration needed'
                }));
                
                return newTemplate;
            }
        },

        async updateTemplate(id: number, updates: Partial<Template>) {
            try {
                const response = await fetch(`/api/templates/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updates),
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const updatedTemplate = await response.json();
                update(store => ({
                    ...store,
                    templates: store.templates.map(t => 
                        t.id === id ? updatedTemplate : t
                    ),
                    error: null
                }));
                
                return updatedTemplate;
            } catch (err) {
                console.error('Error updating template:', err);
                update(store => ({
                    ...store,
                    error: err instanceof Error ? err.message : 'Failed to update template'
                }));
                throw err;
            }
        },

        async deleteTemplate(id: number) {
            try {
                const response = await fetch(`/api/templates/${id}`, {
                    method: 'DELETE',
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                update(store => ({
                    ...store,
                    templates: store.templates.filter(t => t.id !== id),
                    selectedId: store.selectedId === id ? null : store.selectedId,
                    error: null
                }));
                
            } catch (err) {
                console.error('Error deleting template:', err);
                update(store => ({
                    ...store,
                    error: err instanceof Error ? err.message : 'Failed to delete template'
                }));
                throw err;
            }
        },

        // Development helpers
        loadMockData: () => {
            update(state => ({
                ...state,
                templates: mockTemplates,
                loading: false,
                error: null,
                lastUpdated: new Date()
            }));
        },

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
    $store => $store.templates.find(t => t.id === $store.selectedId)
);
// Load data on store initialization
if (USE_MOCK_DATA) {
    // For development/testing with mock data
    templateStore.loadMockData();
}
// Note: Templates are loaded via fetchTemplates() call in +layout.svelte

