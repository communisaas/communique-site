/**
 * Template Configuration Types - COMPLETE KOLMOGOROV COMPRESSED TYPE SYSTEM
 *
 * This module eliminates ALL 'as any' cancer with mathematically minimal type definitions
 * that capture the complete template ecosystem with zero redundancy.
 */

// CORE CONFIG TYPES - Minimal atomic units
export interface RecipientConfig {
	emails: string[];
}

export interface DeliveryConfig {
	timing: 'immediate' | 'scheduled';
	followUp: boolean;
	cwcEnabled?: boolean; // Congressional delivery toggle
}

export interface CwcConfig {
	enabled: boolean;
	routing_code?: string;
	priority?: 'normal' | 'high' | 'urgent';
	tracking_enabled?: boolean;
	office_codes?: string[]; // Specific congressional offices
}

// ANALYTICS & AI TYPES - From schema analysis
export interface ContextTags {
	[key: string]: string | number | boolean;
}

export interface PersonalizationMetrics {
	usage_count: number;
	personalization_rate: number; // % who customize
	avg_length?: number;
	engagement_score?: number;
	top_themes: string[];
}

export interface WritingStyleProfile {
	tone_preference?: 'formal' | 'casual' | 'passionate';
	length_preference?: 'concise' | 'detailed' | 'moderate';
	personal_themes: string[];
	engagement_metrics: PersonalizationMetrics;
}

// COMPLETE METRICS TYPE SYSTEM - All JSON fields typed
export interface TemplateMetrics {
	sent: number;
	opened: number; // Deprecated - not trackable for direct email
	clicked: number; // For direct: recipient count; for congressional: not used
	responded: number; // For congressional: delivery confirmations; for direct: not used
	views?: number; // Deep link views

	// Congressional-specific metrics
	districts_covered?: number;
	total_districts?: number;
	district_coverage_percent?: number;

	// AI/Analytics metrics from schema
	personalization_rate?: number;
	effectiveness_score?: number; // ML-derived
	cascade_depth?: number; // User activation chain length
	viral_coefficient?: number; // Sharing rate

	// Funnel tracking metrics
	funnel_views?: number; // Template page views
	modal_views?: number; // Modal popup views
	onboarding_starts?: number; // Users who started onboarding
	onboarding_completes?: number; // Users who completed onboarding
	auth_completions?: number; // Users who completed authentication
	shares?: number; // Template shares
}

// TEMPLATE ECOSYSTEM TYPES - Complete schema coverage
export interface TemplatePersonalization {
	variable_name: string;
	custom_value: string;
	usage_count: number;
	last_used: Date;
}

// USER ACTIVATION NETWORK - Mathematical cascade tracking
export interface UserActivation {
	user_id: string;
	template_id: string;
	sourceuser_id?: string; // Functor arrow source
	activation_generation: number; // Category theory morphism depth
	activation_method: 'share' | 'view' | 'referral' | 'discovery';
	timestamp: Date;
}

export interface TypedTemplate {
	id: string;
	slug?: string;
	title: string;
	description: string;
	category: string;
	type: string;
	deliveryMethod: 'email' | 'certified';
	subject?: string;
	message_body: string;
	preview: string;
	is_public: boolean;

	delivery_config: DeliveryConfig;
	recipient_config: RecipientConfig;
	cwc_config?: CwcConfig;
	metrics: TemplateMetrics;

	campaign_id?: string;
	status: 'draft' | 'active' | 'archived';
	createdAt: Date;
	updatedAt: Date;
	userId?: string;

	personalizations?: TemplatePersonalization[];
	user_activations?: UserActivation[];
}

export interface ResolvedTemplate {
	subject: string;
	body: string;
	recipients: string[];
	isCongressional: boolean;
	routingEmail?: string;
	resolution_time: number;
	personalization_depth: number;
}

/**
 * Type Guards for Runtime Validation
 */
export function isValidRecipientConfig(obj: unknown): obj is RecipientConfig {
	if (!obj || typeof obj !== 'object' || obj === null) return false;

	const record = obj as Record<string, unknown>;
	return (
		'emails' in record &&
		Array.isArray(record.emails) &&
		record.emails.length > 0 &&
		record.emails.every((email: unknown) => typeof email === 'string')
	);
}

export function isValidDeliveryConfig(obj: unknown): obj is DeliveryConfig {
	if (!obj || typeof obj !== 'object' || obj === null) return false;

	const record = obj as Record<string, unknown>;
	return (
		'timing' in record &&
		typeof record.timing === 'string' &&
		['immediate', 'scheduled'].includes(record.timing) &&
		'followUp' in record &&
		typeof record.followUp === 'boolean'
	);
}

/**
 * Safe Type Extraction Functions - Replace the 'as any' pattern
 */
export function extractRecipientEmails(recipient_config: unknown): string[] {
	if (isValidRecipientConfig(recipient_config)) {
		return recipient_config.emails;
	}
	return [];
}

export function extractDeliveryConfig(delivery_config: unknown): DeliveryConfig {
	if (isValidDeliveryConfig(delivery_config)) {
		return delivery_config;
	}
	return {
		timing: 'immediate',
		followUp: false
	};
}

export function extractTemplateMetrics(metrics: unknown): TemplateMetrics {
	if (isValidTemplateMetrics(metrics)) {
		return metrics;
	}
	// Default metrics if invalid/null
	return {
		sent: 0,
		opened: 0,
		clicked: 0,
		responded: 0
	};
}

function isValidTemplateMetrics(obj: unknown): obj is TemplateMetrics {
	return (
		obj !== null &&
		typeof obj === 'object' &&
		'sent' in obj &&
		typeof (obj as Record<string, unknown>).sent === 'number'
	);
}

/**
 * Migration Helper - Convert Legacy Template to Typed Template
 */
export function migrateToTypedTemplate(legacyTemplate: unknown): TypedTemplate {
	if (typeof legacyTemplate !== 'object' || legacyTemplate === null) {
		throw new Error('Invalid legacy template: must be an object');
	}

	const legacy = legacyTemplate as Record<string, unknown>;

	// Build the typed template with proper validation
	const template: TypedTemplate = {
		id: typeof legacy.id === 'string' ? legacy.id : '',
		slug: typeof legacy.slug === 'string' ? legacy.slug : undefined,
		title: typeof legacy.title === 'string' ? legacy.title : '',
		description: typeof legacy.description === 'string' ? legacy.description : '',
		category: typeof legacy.category === 'string' ? legacy.category : '',
		type: typeof legacy.type === 'string' ? legacy.type : '',
		deliveryMethod: legacy.deliveryMethod === 'certified' ? 'certified' : 'email',
		subject: typeof legacy.subject === 'string' ? legacy.subject : undefined,
		message_body: typeof legacy.message_body === 'string' ? legacy.message_body : '',
		preview: typeof legacy.preview === 'string' ? legacy.preview : '',
		is_public: typeof legacy.is_public === 'boolean' ? legacy.is_public : false,

		delivery_config: extractDeliveryConfig(legacy.delivery_config),
		recipient_config: { emails: extractRecipientEmails(legacy.recipient_config) },
		cwc_config: legacy.cwc_config as CwcConfig | undefined,
		metrics: extractTemplateMetrics(legacy.metrics),

		campaign_id: typeof legacy.campaign_id === 'string' ? legacy.campaign_id : undefined,
		status: isValidStatus(legacy.status) ? legacy.status : 'draft',
		createdAt: legacy.createdAt instanceof Date ? legacy.createdAt : new Date(),
		updatedAt: legacy.updatedAt instanceof Date ? legacy.updatedAt : new Date(),
		userId: typeof legacy.userId === 'string' ? legacy.userId : undefined,

		personalizations: Array.isArray(legacy.personalizations) ? legacy.personalizations as TemplatePersonalization[] : undefined,
		user_activations: Array.isArray(legacy.user_activations) ? legacy.user_activations as UserActivation[] : undefined
	};

	return template;
}

function isValidStatus(status: unknown): status is 'draft' | 'active' | 'archived' {
	return status === 'draft' || status === 'active' || status === 'archived';
}
