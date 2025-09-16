/**
 * Core type definitions for the Delivery Platform
 */

import type { ParsedMail } from 'mailparser';
import type { SMTPServerSession } from 'smtp-server';

// ============================================================================
// Message Types
// ============================================================================

export interface CertifiedDeliveryMessage {
	templateId: string;
	templateSlug?: string;
	userId: string;
	senderEmail: string;
	subject?: string;
	messageBody: string;
	personalConnection?: string;
	recipients: string[];
	deliveryMethod: 'certified' | 'standard';
	timestamp: Date;
}

export interface ParsedIncomingMessage {
	senderEmail: string;
	templateIdentifier: string;
	personalConnection?: string;
	rawMessage: ParsedMail;
	certifiedDelivery: boolean;
}

// ============================================================================
// User & Template Types
// ============================================================================

export interface UserProfile {
	id: string;
	email: string;
	secondaryEmails?: string[];
	name?: string;
	street?: string;
	city?: string;
	state?: string;
	zip?: string;
	congressionalDistrict?: string;
	verifiedAt?: Date;
}

export interface UserResolutionResult {
	user: UserProfile | null;
	emailType: 'primary' | 'secondary';
	isVerified: boolean;
}

export interface TemplateData {
	id: string;
	slug: string;
	title: string;
	subject?: string;
	message_body: string;
	deliveryMethod: 'certified' | 'standard';
	status: 'draft' | 'pending' | 'approved' | 'rejected';
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================================================
// CWC API Types
// ============================================================================

export interface CWCSubmissionData {
	templateId: string;
	userId: string;
	subject: string;
	text: string;
	personalConnection?: string;
	userProfile: {
		firstName: string;
		lastName: string;
		email: string;
		address1: string;
		address2?: string;
		city: string;
		state: string;
		zip: string;
	};
	recipientOffice: string;
	messageId: string;
}

export interface CWCSubmissionResult {
	success: boolean;
	submissionId?: string;
	receiptHash?: string;
	error?: string;
	timestamp: Date;
	certificationHash?: string;
	rewardAmount?: number;
}

// ============================================================================
// VOTER Protocol Types
// ============================================================================

export interface VOTERCertificationRequest {
	userProfile: UserProfile;
	templateData: TemplateData;
	cwcResult: CWCSubmissionResult;
	recipients: string[];
}

export interface VOTERCertificationResult {
	certificationHash: string;
	rewardAmount: number;
	userAddress?: string;
	actionType: string;
	timestamp: Date;
}

export type VOTERActionType =
	| 'cwc_message'
	| 'civic_engagement'
	| 'template_creation'
	| 'community_outreach';

// ============================================================================
// N8N Workflow Types
// ============================================================================

export interface N8NWebhookPayload {
	templateId: string;
	verificationId?: string;
	userId: string;
	userEmail: string;
	userName?: string;
	userAddress?: string;
	userZip?: string;
	subject?: string;
	message_body: string;
	deliveryMethod: 'certified' | 'standard';
	severity?: number;
	timestamp: string;
}

export interface N8NWorkflowResult {
	workflowId: string;
	executionId: string;
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
}

export interface VerificationResult {
	verified: boolean;
	verificationId: string;
	severity: number;
	corrections?: {
		subject?: string;
		body?: string;
	};
	flags?: string[];
	confidence: number;
}

export interface ConsensusResult {
	approved: boolean;
	consensusScore: number;
	agentVotes: Record<
		string,
		{
			approved: boolean;
			confidence: number;
			reasoning?: string;
		}
	>;
	diversityScore: number;
	recommendation: string;
}

export interface ReputationUpdate {
	userId: string;
	userAddress?: string;
	reputationDelta: number;
	totalReputation: number;
	tierChange?: string;
	explanation: string;
	timestamp: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};
	metadata?: {
		timestamp: Date;
		requestId?: string;
	};
}

export interface DeliveryNotification {
	templateId: string;
	userId: string;
	deliveryStatus: 'pending' | 'delivered' | 'failed';
	cwcResult?: CWCSubmissionResult;
	certificationResult?: VOTERCertificationResult;
	error?: string;
	timestamp: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SMTPConfig {
	host: string;
	port: number;
	secure: boolean;
	auth?: {
		user: string;
		pass: string;
	};
}

export interface APIConfig {
	communiqueUrl: string;
	communiqueApiKey: string;
	cwcUrl: string;
	cwcApiKey: string;
	voterUrl?: string;
	voterApiKey?: string;
	n8nUrl: string;
	n8nWebhookSecret: string;
}

export interface EnvironmentConfig {
	nodeEnv: 'development' | 'production' | 'test';
	smtp: SMTPConfig;
	api: APIConfig;
	features: {
		enableVoterCertification: boolean;
		enableN8NWorkflows: boolean;
		enableBetaFeatures: boolean;
	};
}

// ============================================================================
// Error Types
// ============================================================================

export class DeliveryPlatformError extends Error {
	constructor(
		message: string,
		public code: string,
		public statusCode: number = 500,
		public details?: unknown
	) {
		super(message);
		this.name = 'DeliveryPlatformError';
	}
}

export class SMTPError extends DeliveryPlatformError {
	constructor(message: string, details?: unknown) {
		super(message, 'SMTP_ERROR', 500, details);
		this.name = 'SMTPError';
	}
}

export class ValidationError extends DeliveryPlatformError {
	constructor(message: string, details?: unknown) {
		super(message, 'VALIDATION_ERROR', 400, details);
		this.name = 'ValidationError';
	}
}

export class IntegrationError extends DeliveryPlatformError {
	constructor(service: 'CWC' | 'COMMUNIQUE' | 'VOTER' | 'N8N', message: string, details?: unknown) {
		super(message, `${service}_INTEGRATION_ERROR`, 502, details);
		this.name = 'IntegrationError';
	}
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
	{ [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

export type Nullable<T> = T | null | undefined;
