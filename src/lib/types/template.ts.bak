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

	// Usage tracking (from Prisma Template model) - was missing
	send_count: number; // Int with default 0
	last_sent_at?: Date | string | null; // DateTime? field

	// Geographic scope (from Prisma Template model)
	applicable_countries: string[]; // String[] with default []
	jurisdiction_level?: string | null;
	specific_locations: string[]; // String[] with default []

	// Optional place scoping linked via separate table
	scope?: TemplateScope;
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
	};
	audience: {
		recipientEmails: string[];
	};
	content: {
		preview: string;
		variables: string[];
	};
	review: Record<string, never>; // For validation purposes, no data to store
}

// For UI components that only need a minimal user shape
export type MinimalUser = { id: string; name: string };
