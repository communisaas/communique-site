/**
 * Automation workflow type definitions.
 */

// ── Trigger types ──

export type TriggerType =
	| 'supporter_created'
	| 'campaign_action'
	| 'event_rsvp'
	| 'event_checkin'
	| 'donation_completed'
	| 'tag_added';

export interface WorkflowTrigger {
	type: TriggerType;
	/** For tag_added: which tag triggers this workflow */
	tagId?: string;
	/** For campaign_action: which campaign (optional, null = any) */
	campaignId?: string;
}

// ── Step types ──

export type StepType = 'send_email' | 'add_tag' | 'remove_tag' | 'delay' | 'condition';

export interface EmailStep {
	type: 'send_email';
	emailSubject: string;
	emailBody: string;
}

export interface TagStep {
	type: 'add_tag' | 'remove_tag';
	tagId: string;
}

export interface DelayStep {
	type: 'delay';
	delayMinutes: number;
}

export interface ConditionStep {
	type: 'condition';
	field: 'engagementTier' | 'verified' | 'hasTag';
	operator: 'eq' | 'gte' | 'lte' | 'exists';
	value: string | number | boolean;
	/** Step index to jump to if condition is true */
	thenStepIndex: number;
	/** Step index to jump to if condition is false */
	elseStepIndex: number;
}

export type WorkflowStep = EmailStep | TagStep | DelayStep | ConditionStep;

// ── Trigger event snapshot ──

export interface TriggerEventData {
	type: TriggerType;
	entityId: string;
	supporterId?: string;
	metadata?: Record<string, unknown>;
}

// ── Execution status ──

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

// ── Validation ──

export const VALID_TRIGGER_TYPES: TriggerType[] = [
	'supporter_created',
	'campaign_action',
	'event_rsvp',
	'event_checkin',
	'donation_completed',
	'tag_added'
];

export const VALID_STEP_TYPES: StepType[] = [
	'send_email',
	'add_tag',
	'remove_tag',
	'delay',
	'condition'
];
