import type { TemplateScope } from './jurisdiction';

export interface Template {
	id: string;
	slug: string; // Required in database with unique constraint
	title: string;
	description: string;
	category: string;
	type: string;
	deliveryMethod: 'email' | 'certified' | 'direct' | 'cwc';
	subject?: string | null;
	message_body: string;
	sources?: Source[]; // Citation sources from message generation agent
	research_log?: string[]; // Agent's research process log
	delivery_config: unknown; // Json field in database
	cwc_config?: unknown | null; // Json? field in database - was missing
	recipient_config: unknown; // Json field in database
	metrics: {
		sent?: number;
		delivered?: number; // Number of messages successfully delivered
		opened?: number; // Deprecated - not trackable for direct email
		clicked?: number; // For direct: recipient count; for congressional: not used
		responded?: number; // For congressional: delivery confirmations; for direct: not used
		views?: number; // Number of times the template has been viewed via deep link
		responses?: number; // Alternative field name used in some seed data
		// New congressional-specific metrics
		districts_covered?: number; // Number of unique districts reached
		total_districts?: number; // Total districts in the target area (for calculating coverage %)
		district_coverage_percent?: number; // Calculated: districts_covered / total_districts * 100
	}; // Json field in database, never null
	campaign_id?: string | null; // String? field in database - was missing
	status: string; // String field with default "draft" - was missing
	is_public: boolean;

	// Usage tracking - AGGREGATE METRICS ONLY (privacy-preserving)
	// Backend: verified_sends (Prisma field)
	// Frontend: send_count (mapped from verified_sends for compatibility)
	send_count: number; // Total verified sends (aggregate pool metric)

	// Geographic scope (from Prisma Template model)
	applicable_countries: string[]; // String[] with default []
	jurisdiction_level?: string | null;
	specific_locations: string[]; // String[] with default []

	// Optional place scoping linked via separate table
	scope?: TemplateScope;

	// === NEW: Location-as-Context Properties (Phase 2025-01) ===
	// How geographically broad is the target/issue?
	geographic_scope?: 'international' | 'national' | 'state' | 'metro' | 'district' | 'local';

	// What location verification is required to participate?
	minimum_precision_required?: 'none' | 'country' | 'state' | 'county' | 'district';

	// What type of power structure is the target?
	target_type?: 'government' | 'corporate' | 'institutional' | 'labor' | 'advocacy';

	// Entity name (for corporate/institutional targets)
	target_entity?: string | null;
	preview: string;
	recipientEmails?: string[]; // Computed field - use extractRecipientEmails(recipient_config) instead

	// === MERGED VERIFICATION FIELDS (Phase 4 consolidation) ===
	// Verification status & process
	verification_status?: 'pending' | 'reviewing' | 'approved' | 'rejected' | null;
	country_code?: string | null; // From TemplateVerification
	severity_level?: number | null; // 1-10 scale

	// Content correction & backup
	correction_log?: Record<string, unknown> | null; // Grammar, clarity fixes applied
	original_content?: Record<string, unknown> | null; // Before corrections
	corrected_subject?: string | null;
	corrected_body?: string | null;

	// Multi-agent consensus & quality scores
	agent_votes?: Record<string, unknown> | null; // {openai: 0.8, gemini: 0.7}
	consensus_score?: number | null; // Weighted average
	quality_score?: number; // 0-100
	grammar_score?: number | null;
	clarity_score?: number | null;
	completeness_score?: number | null;

	// Reputation impact (quadratic)
	reputation_delta?: number; // Default 0
	reputation_applied?: boolean; // Default false

	// Enhanced timestamps (from verification)
	submitted_at?: Date | string | null; // When submitted for verification
	corrected_at?: Date | string | null; // When AI corrections applied
	reviewed_at?: Date | string | null; // When human/final review completed
}

export interface TemplateCreationContext {
	channelId: 'certified' | 'direct' | 'cwc';
	channelTitle: string;
	isCongressional?: boolean;
	features?: Array<{
		icon: unknown;
		text: string;
	}>;
}

export interface TemplateFormData {
	objective: {
		title: string;
		description: string;
		category: string;
		slug?: string;
		aiGenerated?: boolean; // Flag indicating content was AI-generated
	};
	audience: {
		decisionMakers: ProcessedDecisionMaker[];
		recipientEmails: string[];
		includesCongress: boolean;
		customRecipients: CustomRecipient[];
	};
	content: {
		preview: string;
		variables: string[];
		sources?: Source[]; // Citation sources from message generation
		researchLog?: string[]; // Agent's research process log
		aiGenerated?: boolean; // Flag indicating message was AI-generated
		edited?: boolean; // Flag indicating user edited AI-generated message
	};
	review: Record<string, never>; // For validation purposes, no data to store
}

/**
 * Processed decision-maker with extracted provenance data
 */
export interface ProcessedDecisionMaker {
	name: string;
	title: string;
	organization: string;
	email?: string;
	provenance: string; // Full verification text from agent
	reasoning: string; // Extracted: why this person matters
	source?: string; // Extracted: verification URL
	powerLevel?: 'primary' | 'secondary' | 'supporting';
	isAiResolved: boolean; // true = AI-resolved, false = manually added
}

/**
 * Custom recipient added manually by user
 */
export interface CustomRecipient {
	email: string;
	name: string;
	organization?: string;
}

/**
 * Source reference from message generation agent
 */
export interface Source {
	num: number; // Citation number [1], [2], etc.
	title: string; // Source title
	url: string; // Source URL
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy'; // Source type
}

// ============================================================================
// Multi-Target Delivery Types (Hackathon Implementation)
// ============================================================================

/**
 * Template recipient configuration for multi-target delivery
 * Templates can target Congress + external decision-makers in one action
 */
export interface TemplateRecipientConfig {
	type: 'multi-target';
	recipients: TemplateRecipient[];
}

/**
 * Individual recipient in a multi-target template
 */
export interface TemplateRecipient {
	type: 'congressional' | 'email';

	// Congressional recipients
	chamber?: 'house' | 'senate'; // undefined = both
	selection?: 'user_district' | 'all_congress' | 'specific_members';
	specific_bioguide_ids?: string[]; // For targeting specific members

	// Email recipients
	email?: string;
	name?: string; // Display name for UI
	organization?: string; // For context
}

// For UI components that only need a minimal user shape
export type MinimalUser = { id: string; name: string };

// ============================================================================
// Progressive Template Sections (2025-01-12)
// ============================================================================

/**
 * Geographic precision level for template grouping
 */
export type PrecisionLevel = 'district' | 'city' | 'county' | 'state' | 'nationwide';

/**
 * Template group for section-based display
 * Templates are grouped by geographic precision tier
 */
export interface TemplateGroup {
	/** Section title (e.g., "In Your District", "Nationwide") */
	title: string;

	/** Templates in this tier */
	templates: Template[];

	/** Minimum relevance score for this tier (for internal sorting) */
	minScore: number;

	/** Precision level this group represents */
	level: PrecisionLevel;

	/** Number of people coordinating in this tier (for display) */
	coordinationCount: number;
}

/**
 * Preview card for next unlockable tier
 * Creates desire for next funnel step (GPS → verified address)
 */
export interface NextTierPreview {
	/** Number of templates in next tier */
	count: number;

	/** Geographic level (e.g., "city", "district") */
	level: string;

	/** Call-to-action text */
	cta: string;

	/** Button action text */
	action: string;

	/** Callback when user clicks */
	onClick: () => void;
}
