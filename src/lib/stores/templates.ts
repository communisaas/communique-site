import { writable, derived } from 'svelte/store';
import type { Template } from '$lib/types/template';
import { templates as mockTemplates } from '$lib/data/templates';

interface TemplateState {
    templates: Template[];
    selectedId: number | null;
    loading: boolean;
    error: string | null;
    lastUpdated?: Date;
}

const USE_MOCK_DATA = true; // Cntrol this with an environment variable later if needed

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
        
        // API Integration (commented for future use)
        /* async fetchTemplates() {
            update(state => ({ ...state, loading: true }));
            try {
                const response = await fetch('/api/templates');
                const data = await response.json();
                update(state => ({
                    ...state,
                    templates: data,
                    loading: false,
                    error: null,
                    lastUpdated: new Date()
                }));
            } catch (err) {
                update(state => ({
                    ...state,
                    loading: false,
                    error: err.message
                }));
            }
        }, */

        // Template CRUD operations (for future use)
        /* async createTemplate(template: Omit<Template, 'id'>) {
            update(state => ({ ...state, loading: true }));
            try {
                const response = await fetch('/api/templates', {
                    method: 'POST',
                    body: JSON.stringify(template)
                });
                const newTemplate = await response.json();
                update(state => ({
                    ...state,
                    templates: [...state.templates, newTemplate],
                    loading: false
                }));
            } catch (err) {
                update(state => ({
                    ...state,
                    loading: false,
                    error: err.message
                }));
            }
        }, */

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

// Load mock data based on configuration flag instead of DEV check
if (USE_MOCK_DATA) {
    templateStore.loadMockData();
}
