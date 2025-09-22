// Svelte 5 Templates Store - migrated from Svelte 4 store patterns
import type { Template } from '$lib/types/template';

// Type guard for Template with enhanced debugging
function isTemplate(obj: unknown): obj is Template {
	if (typeof obj !== 'object' || obj === null) {
		console.debug('Template validation failed: Not an object or null');
		return false;
	}

	const template = obj as Template;
	const validations = [
		// Required string fields
		{ field: 'id', valid: typeof template.id === 'string', actual: typeof template.id },
		{ field: 'slug', valid: typeof template.slug === 'string', actual: typeof template.slug },
		{ field: 'title', valid: typeof template.title === 'string', actual: typeof template.title },
		{
			field: 'description',
			valid: typeof template.description === 'string',
			actual: typeof template.description
		},
		{
			field: 'category',
			valid: typeof template.category === 'string',
			actual: typeof template.category
		},
		{ field: 'type', valid: typeof template.type === 'string', actual: typeof template.type },
		{
			field: 'message_body',
			valid: typeof template.message_body === 'string',
			actual: typeof template.message_body
		},
		{
			field: 'preview',
			valid: typeof template.preview === 'string',
			actual: typeof template.preview
		},
		{ field: 'status', valid: typeof template.status === 'string', actual: typeof template.status },
		// Required number fields
		{
			field: 'send_count',
			valid: typeof template.send_count === 'number',
			actual: typeof template.send_count
		},
		// Required boolean fields
		{
			field: 'is_public',
			valid: typeof template.is_public === 'boolean',
			actual: typeof template.is_public
		},
		// Required enum field
		{
			field: 'deliveryMethod',
			valid: template.deliveryMethod === 'cwc' || template.deliveryMethod === 'email',
			actual: template.deliveryMethod
		},
		// Required array fields
		{
			field: 'applicable_countries',
			valid: Array.isArray(template.applicable_countries),
			actual: Array.isArray(template.applicable_countries)
				? 'array'
				: typeof template.applicable_countries
		},
		{
			field: 'specific_locations',
			valid: Array.isArray(template.specific_locations),
			actual: Array.isArray(template.specific_locations)
				? 'array'
				: typeof template.specific_locations
		},
		// Required object fields (Json fields in database)
		{
			field: 'metrics',
			valid: typeof template.metrics === 'object' && template.metrics !== null,
			actual: typeof template.metrics
		},
		{
			field: 'delivery_config',
			valid: typeof template.delivery_config !== 'undefined',
			actual: typeof template.delivery_config
		},
		{
			field: 'recipient_config',
			valid: typeof template.recipient_config !== 'undefined',
			actual: typeof template.recipient_config
		},
		// Optional/nullable fields validation
		{
			field: 'subject',
			valid:
				template.subject === undefined ||
				template.subject === null ||
				typeof template.subject === 'string',
			actual: typeof template.subject
		},
		{
			field: 'cwc_config',
			valid:
				template.cwc_config === undefined ||
				template.cwc_config === null ||
				typeof template.cwc_config === 'object',
			actual: typeof template.cwc_config
		},
		{
			field: 'campaign_id',
			valid:
				template.campaign_id === undefined ||
				template.campaign_id === null ||
				typeof template.campaign_id === 'string',
			actual: typeof template.campaign_id
		},
		{
			field: 'last_sent_at',
			valid:
				template.last_sent_at === undefined ||
				template.last_sent_at === null ||
				template.last_sent_at instanceof Date ||
				typeof template.last_sent_at === 'string',
			actual: template.last_sent_at instanceof Date ? 'Date' : typeof template.last_sent_at
		},
		{
			field: 'jurisdiction_level',
			valid:
				template.jurisdiction_level === undefined ||
				template.jurisdiction_level === null ||
				typeof template.jurisdiction_level === 'string',
			actual: typeof template.jurisdiction_level
		}
	];

	const failures = validations.filter((v) => !v.valid);

	if (failures.length > 0) {
		console.debug(
			'Template validation failed for fields:',
			failures.map((f) => `${f.field} (expected valid, got ${f.actual})`)
		);
		console.debug('Full template object:', template);
		return false;
	}

	return true;
}

// Type guard for Template array
function isTemplateArray(obj: unknown): obj is Template[] {
	return Array.isArray(obj) && obj.every(isTemplate);
}

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
	const state = $state<TemplateState>({
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
		selectTemplate(id: string): void {
			state.selectedId = id;
		},

		selectTemplateBySlug(slug: string): void {
			const template = state.templates.find((t) => t.slug === slug);
			if (template) {
				state.selectedId = template.id;
			}
		},

		// Auto-select first template when templates change
		autoSelectFirst(): void {
			if (state.templates.length > 0 && !state.selectedId) {
				state.selectedId = state.templates[0].id;
			}
		},

		// API Integration with progressive enhancement
		async fetchTemplates(): Promise<void> {
			state.loading = true;
			state.error = null;

			try {
				const { templatesApi } = await import('$lib/services/apiClient');
				const result = await templatesApi.list<Template[]>();
				console.log('Templates API result:', result);

				if (!result.success) {
					console.error('Template fetch failed:', result.error);
					throw new Error(result.error || 'Failed to fetch templates');
				}

				const data = result.data;

				// Type guard validation
				if (!isTemplateArray(data)) {
					throw new Error('Invalid template data received from API');
				}

				// Update state directly with $state
				state.templates = data;
				state.loading = false;
				state.error = null;
				state.lastUpdated = new Date();
				state.initialized = true;

				// Auto-select first template if none selected or selected template no longer exists
				if (!state.selectedId || !data.find((t) => t.id === state.selectedId)) {
					state.selectedId = data[0]?.id || null;
				}
			} catch (err) {
				console.error('Template fetch error:', err);
				state.loading = false;
				state.error = err instanceof Error ? err.message : 'Failed to fetch templates';
			}
		},

		// Template CRUD operations
		async addTemplate(template: Omit<Template, 'id'>): Promise<Template> {
			try {
				const { templatesApi } = await import('$lib/services/apiClient');
				const result = await templatesApi.create(template);

				if (!result.success) {
					throw new Error(result.error || 'Failed to create template');
				}

				const newTemplate = result.data as Template;

				// Type guard validation
				if (!isTemplate(newTemplate)) {
					throw new Error('Invalid template data received from API');
				}

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

		async updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
			try {
				const { templatesApi } = await import('$lib/services/apiClient');
				const result = await templatesApi.update(id, updates);

				if (!result.success) {
					throw new Error(result.error || 'Failed to update template');
				}

				const updatedTemplate = result.data as Template;

				// Type guard validation
				if (!isTemplate(updatedTemplate)) {
					throw new Error('Invalid template data received from API');
				}

				// Update state directly
				state.templates = state.templates.map((t) => (t.id === id ? updatedTemplate : t));
				state.error = null;

				return updatedTemplate;
			} catch (err) {
				state.error = err instanceof Error ? err.message : 'Failed to update template';
				throw err;
			}
		},

		async deleteTemplate(id: string): Promise<void> {
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
		reset(): void {
			state.templates = [];
			state.selectedId = null;
			state.loading = false;
			state.error = null;
			state.initialized = false;
		}
	};
}

export const templateStore = createTemplateStore();
