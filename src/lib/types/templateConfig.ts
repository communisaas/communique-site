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
	opened: number;          // Deprecated - not trackable for direct email
	clicked: number;         // For direct: recipient count; for congressional: not used
	responded: number;       // For congressional: delivery confirmations; for direct: not used
	views?: number;          // Deep link views
	
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
	funnel_views?: number;       // Template page views
	modal_views?: number;        // Modal popup views  
	onboarding_starts?: number;  // Users who started onboarding
	onboarding_completes?: number; // Users who completed onboarding
	auth_completions?: number;   // Users who completed authentication
	shares?: number;             // Template shares
}

// TEMPLATE ECOSYSTEM TYPES - Complete schema coverage
export interface TemplatePersonalization {
	variable_name: string;
	custom_value: string;
	usage_count: number;
	last_used: Date;
}

export interface AISuggestion {
	variable_name: string;
	category: 'personal_story' | 'reasoning' | 'example' | 'context';
	suggestion_text: string;
	context_tags: ContextTags;
	effectiveness_score?: number;
	is_active: boolean;
}

export interface TemplateAnalytics {
	variable_name: string;
	date: Date;
	total_uses: number;
	personalization_rate: number;
	avg_length?: number;
	engagement_score?: number;
	top_themes: string[];
}

// USER ACTIVATION NETWORK - Mathematical cascade tracking
export interface UserActivation {
	user_id: string;
	template_id: string;
	source_user_id?: string; // Functor arrow source
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
	deliveryMethod: 'email' | 'both';
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
	ai_suggestions?: AISuggestion[];
	analytics?: TemplateAnalytics[];
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
	return 'emails' in record && Array.isArray(record.emails) && 
		   record.emails.length > 0 &&
		   record.emails.every((email: unknown) => typeof email === 'string');
}

export function isValidDeliveryConfig(obj: unknown): obj is DeliveryConfig {
	if (!obj || typeof obj !== 'object' || obj === null) return false;
	
	const record = obj as Record<string, unknown>;
	return 'timing' in record && typeof record.timing === 'string' && 
		   ['immediate', 'scheduled'].includes(record.timing) &&
		   'followUp' in record && typeof record.followUp === 'boolean';
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
	return obj !== null && 
		   typeof obj === 'object' && 
		   'sent' in obj && typeof (obj as Record<string, unknown>).sent === 'number';
}

/**
 * Migration Helper - Convert Legacy Template to Typed Template
 */
export function migrateToTypedTemplate(legacyTemplate: unknown): TypedTemplate {
	const legacy = legacyTemplate as Record<string, unknown>;
	return {
		...legacy,
		delivery_config: extractDeliveryConfig(legacy.delivery_config),
		recipient_config: { emails: extractRecipientEmails(legacy.recipient_config) },
		cwc_config: legacy.cwc_config || undefined,
		metrics: legacy.metrics || {
			sent: 0,
			opened: 0,
			clicked: 0,
			responded: 0
		}
	} as TypedTemplate;
}