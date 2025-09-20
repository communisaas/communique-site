/**
 * Template Verification Types - Post-Consolidation (Phase 4)
 *
 * NOTE: TemplateVerification model has been merged into Template model.
 * These types are now for validation and processing workflows only.
 */

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
		correction?: unknown;
		moderation?: unknown;
		reputation?: unknown;
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
	details?: Record<string, unknown>;
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

export interface VerificationResult {
	approved: boolean;
	confidence: number;
	reasoning: string[];
	violations?: ViolationType[];
}

export interface ConsensusResult {
	decision: 'APPROVE' | 'REJECT' | 'NEEDS_REVIEW';
	confidence: number;
	votes: Record<string, AgentVote>;
	reasoning: string[];
}

export interface N8NWorkflowResult {
	workflowId: string;
	executionId: string;
	success: boolean;
	data?: unknown;
	error?: string;
}

export interface N8NWebhookPayload {
	template?: unknown;
	userId?: string;
	userAddress?: string;
	action?: string;
	metadata?: Record<string, unknown>;
}

// Type guards for runtime validation - updated for consolidated Template model
export function isValidVerificationStatus(status: unknown): status is 'pending' | 'reviewing' | 'approved' | 'rejected' {
	return typeof status === 'string' && 
		['pending', 'reviewing', 'approved', 'rejected'].includes(status);
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
