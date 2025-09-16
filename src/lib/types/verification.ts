/**
 * Template Verification Types
 *
 * TypeScript interfaces for the VOTER Protocol moderation system
 */

export interface TemplateVerification {
	id: string;
	template_id: string;
	user_id: string;
	country_code: string;

	// Stage 1: Auto-correction
	correction_log?: CorrectionChange[];
	original_content?: OriginalContent;
	corrected_at?: Date;

	// Stage 2: Moderation
	moderation_status: 'pending' | 'reviewing' | 'approved' | 'rejected';
	severity_level?: number; // 1-10 scale
	reviewed_at?: Date;

	// Multi-agent consensus
	agent_votes?: Record<string, AgentVote>;
	consensus_score?: number; // 0-1

	// Quality metrics
	quality_score: number; // 0-100
	grammar_score?: number;
	clarity_score?: number;
	completeness_score?: number;

	// Reputation impact (quadratic)
	reputation_delta: number;
	reputation_applied: boolean;

	// Audit trail
	created_at: Date;
	updated_at: Date;
}

export interface CorrectionChange {
	type: 'grammar' | 'formatting' | 'clarity' | 'completeness';
	original: string;
	corrected: string;
	reason: string;
}

export interface OriginalContent {
	message_body: string;
	subject?: string;
	preview?: string;
}

export interface AgentVote {
	approved: boolean;
	confidence: number; // 0-1
	reasons?: string[];
	violations?: ViolationType[];
}

export type ViolationType =
	| 'hate_speech'
	| 'threats'
	| 'malicious_links'
	| 'impersonation'
	| 'spam_patterns'
	| 'misinformation';

export interface ModerationResult {
	status: 'approved' | 'rejected' | 'pending';
	stages: {
		correction?: any;
		moderation?: any;
		reputation?: any;
	};
	message: string;
}

export interface VerificationFlow {
	verificationId: string;
	templateId: string;
	userId: string;
	currentStage: 'correction' | 'moderation' | 'reputation' | 'complete';
	progress: number; // 0-100

	timeline: VerificationEvent[];
}

export interface VerificationEvent {
	timestamp: Date;
	stage: string;
	action: string;
	details?: Record<string, any>;
	agent?: string; // Which agent performed the action
}

export type ReputationTier =
	| 'untrusted' // 0-30
	| 'novice' // 31-50
	| 'emerging' // 51-70
	| 'established' // 71-90
	| 'trusted'; // 91-100

export interface ReputationUpdate {
	delta: number;
	reason: string;
	tier: ReputationTier;
	breakdown: {
		base: number;
		multiplier: number;
		final: number;
	};
}

// Type guards for runtime validation
export function isValidTemplateVerification(obj: unknown): obj is TemplateVerification {
	if (!obj || typeof obj !== 'object') return false;

	const record = obj as Record<string, unknown>;
	return (
		typeof record.id === 'string' &&
		typeof record.template_id === 'string' &&
		typeof record.user_id === 'string' &&
		typeof record.moderation_status === 'string' &&
		['pending', 'reviewing', 'approved', 'rejected'].includes(record.moderation_status as string)
	);
}

export function isValidAgentVote(obj: unknown): obj is AgentVote {
	if (!obj || typeof obj !== 'object') return false;

	const record = obj as Record<string, unknown>;
	return (
		typeof record.approved === 'boolean' &&
		typeof record.confidence === 'number' &&
		record.confidence >= 0 &&
		record.confidence <= 1
	);
}
