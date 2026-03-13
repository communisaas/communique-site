/**
 * SMS + Patch-through Calling type definitions.
 */

export type SmsStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';

export type SmsBlastStatus = 'draft' | 'sending' | 'sent' | 'failed';

export type CallStatus =
	| 'initiated'
	| 'ringing'
	| 'in-progress'
	| 'completed'
	| 'failed'
	| 'no-answer'
	| 'busy';

export interface SmsSendResult {
	success: boolean;
	sid?: string;
	error?: string;
}

export interface CallInitResult {
	success: boolean;
	callSid?: string;
	error?: string;
}

export const VALID_SMS_STATUSES: SmsStatus[] = [
	'queued', 'sent', 'delivered', 'failed', 'undelivered'
];

export const VALID_BLAST_STATUSES: SmsBlastStatus[] = [
	'draft', 'sending', 'sent', 'failed'
];

export const VALID_CALL_STATUSES: CallStatus[] = [
	'initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy'
];

/** Maximum SMS body length (multi-segment) */
export const SMS_MAX_LENGTH = 1600;

/** Single SMS segment length */
export const SMS_SEGMENT_LENGTH = 160;
