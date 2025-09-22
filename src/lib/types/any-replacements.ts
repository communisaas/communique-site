/**
 * COMPREHENSIVE TYPE REPLACEMENTS FOR ANY TYPES
 *
 * This file provides specific type interfaces to replace all 'any' types
 * in the codebase with proper TypeScript types.
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { User, Template } from '@prisma/client';

// =============================================================================
// API AND REQUEST/RESPONSE TYPES
// =============================================================================

export interface ParsedMail {
	subject?: string;
	from?: { address: string; name?: string }[];
	to?: { address: string; name?: string }[];
	replyTo?: { address: string; name?: string }[];
	text?: string;
	html?: string;
	headers?: Map<string, string>;
	attachments?: unknown[];
	messageId?: string;
	references?: string[];
	inReplyTo?: string;
}

export interface SMTPSession {
	id: string;
	remoteAddress: string;
	clientHostname?: string;
	openingCommand?: string;
	envelope?: {
		mailFrom: { address: string; args?: Record<string, unknown> };
		rcptTo: Array<{ address: string; args?: Record<string, unknown> }>;
	};
	user?: string;
	transaction?: number;
}

export interface SMTPServerOptions {
	secure?: boolean;
	port?: number;
	host?: string;
	logger?: Logger;
	authMethods?: string[];
	onAuth?: (
		auth: AuthInfo,
		session: SMTPSession,
		callback: (err?: Error | null, response?: SMTPAuthResponse) => void
	) => void;
	onConnect?: (session: SMTPSession, callback: (err?: Error | null) => void) => void;
	onData?: (
		stream: NodeJS.ReadableStream,
		session: SMTPSession,
		callback: (err?: Error | null) => void
	) => void;
	onRcptTo?: (address: SMTPAddress, session: SMTPSession, callback: (err?: Error | null) => void) => void;
	onMailFrom?: (address: SMTPAddress, session: SMTPSession, callback: (err?: Error | null) => void) => void;
}

export interface SMTPAuthResponse {
	user?: string;
	[key: string]: unknown;
}

export interface AuthInfo {
	method: string;
	username?: string;
	password?: string;
	accessToken?: string;
	[key: string]: unknown;
}

export interface SMTPAddress {
	address: string;
	args?: Record<string, unknown>;
}

export interface Logger {
	info: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	debug: (message: string, ...args: unknown[]) => void;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

export interface ErrorWithCode extends Error {
	code?: string | number;
	status?: number;
	reason?: string;
	transaction?: unknown;
}

export interface ErrorDetails {
	message: string;
	stack?: string;
	context: string;
	timestamp: number;
	userAgent?: string;
	url?: string;
	code?: string | number;
	additionalData?: Record<string, unknown>;
}

// =============================================================================
// COMPONENT AND EVENT TYPES
// =============================================================================

export interface ComponentEventTarget<T = unknown> extends EventTarget {
	value?: T;
	checked?: boolean;
	files?: FileList | null;
	[key: string]: unknown;
}

export interface ComponentEvent<T = unknown> extends Event {
	target: ComponentEventTarget<T>;
	currentTarget: ComponentEventTarget<T>;
	detail?: T;
}

export interface SvelteComponentInstance {
	$on?(type: string, callback: (e: ComponentEvent) => void): () => void;
	$set?(props: Record<string, unknown>): void;
	$destroy?(): void;
}

export interface ComponentWithModal {
	open(): void;
	close(): void;
	toggle?(): void;
}

// =============================================================================
// USER AND PROFILE TYPES
// =============================================================================

export interface UserProfileData {
	id: string;
	name?: string | null;
	email: string;
	role?: string;
	connection?: string;
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	congressional_district?: string | null;
	is_verified?: boolean;
	verification_method?: string | null;
	verified_at?: Date | null;
	wallet_address?: string | null;
	trust_score?: number;
	reputation_tier?: string;
}

export interface ProfileUpdateData {
	section: string;
	data: Record<string, unknown>;
}

export interface Address {
	street: string;
	city: string;
	state: string;
	zip: string;
	congressional_district?: string;
}

export interface GeolocationData {
	congressional_district: string;
	latitude?: number;
	longitude?: number;
	postal_code?: string;
	[key: string]: unknown;
}

// =============================================================================
// TEMPLATE AND SUBMISSION TYPES
// =============================================================================

export interface TemplateData {
	id?: string;
	title: string;
	description?: string;
	message_body: string;
	category?: string;
	recipient_config?: RecipientConfig;
	delivery_config?: DeliveryConfig;
	slug?: string;
	user_id?: string;
	created_at?: Date;
	updated_at?: Date;
}

export interface RecipientConfig {
	type: 'representatives' | 'senators' | 'house' | 'custom';
	targets?: string[];
	[key: string]: unknown;
}

export interface DeliveryConfig {
	method: 'cwc' | 'email' | 'direct';
	options?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface TemplateWithRelations extends Omit<Template, 'correction_log'> {
	user?: User;
	template_scopes?: TemplateScope[];
	correction_log?: CorrectionLogEntry[] | null;
}

export interface TemplateScope {
	id: string;
	template_id: string;
	scope_type: string;
	scope_value: string;
	created_at: Date;
}

export interface CorrectionLogEntry {
	id: string;
	template_id: string;
	field_name: string;
	original_value: string;
	corrected_value: string;
	correction_type: string;
	applied_at: Date;
	applied_by?: string;
}

// =============================================================================
// AGENT AND DECISION TYPES
// =============================================================================

export interface AgentDecision {
	decision: Record<string, unknown>;
	confidence: number;
	reasoning: string;
	timestamp: string;
	agent_id: string;
	stage: string;
}

export interface SupplyDecision {
	rewardAmount: number;
	baseRewardUSD: number;
	multipliers: {
		participationScore: number;
		marketConditions: number;
		timeDecay: number;
	};
	reasoning: string;
	confidence: number;
	timestamp: string;
	claim?: string;
	stakes?: number;
}

export interface ImpactDecision {
	impactScore: number;
	metrics: {
		reach: number;
		engagement: number;
		conversion: number;
	};
	reasoning: string;
	confidence: number;
	timestamp: string;
}

export interface ReputationDecision {
	reputationChange: number;
	newTier: string;
	badges: string[];
	reasoning: string;
	confidence: number;
	timestamp: string;
}

// =============================================================================
// DATABASE AND QUERY TYPES
// =============================================================================

export interface DatabaseWhereClause {
	status?: string;
	OR?: Array<Record<string, unknown>>;
	AND?: Array<Record<string, unknown>>;
	[key: string]: unknown;
}

export interface PaginationParams {
	page?: number;
	limit?: number;
	offset?: number;
	orderBy?: string;
	sortDirection?: 'asc' | 'desc';
}

export interface QueryResult<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

// =============================================================================
// ANALYTICS AND TRACKING TYPES
// =============================================================================

export interface AnalyticsEventData {
	event_type: string;
	template_id?: string;
	user_id?: string;
	session_id: string;
	properties: AnalyticsProperties;
	timestamp: Date;
}

export interface AnalyticsProperties {
	[key: string]: string | number | boolean | Date | null | undefined;
}

export interface PercolationAnalysis {
	score: number;
	metrics: {
		reach: number;
		depth: number;
		velocity: number;
	};
	recommendations: string[];
	timestamp: Date;
}

export interface CampaignMetrics {
	total_submissions: number;
	unique_users: number;
	completion_rate: number;
	avg_time_to_complete: number;
	geographic_distribution: Record<string, number>;
}

// =============================================================================
// VERIFICATION AND CERTIFICATION TYPES
// =============================================================================

export interface VerificationResult {
	success: boolean;
	trust_score: number;
	verification_method: string;
	verified_at: Date;
	evidence?: Record<string, unknown>;
}

export interface AddressVerificationResult {
	verified: boolean;
	correctedAddress?: string;
	representatives?: Representative[];
	[key: string]: unknown;
}

export interface CertificationData {
	actionType: string;
	userAddress: string;
	templateId?: string;
	deliveryConfirmation?: string;
	personalConnection?: string;
	metadata?: Record<string, unknown>;
}

export interface KYCResult {
	verified: boolean;
	confidence: number;
	method: string;
	timestamp: Date;
	details?: Record<string, unknown>;
}

// =============================================================================
// DELIVERY AND MESSAGING TYPES
// =============================================================================

export interface DeliveryResult {
	success: boolean;
	messageId?: string;
	deliveryMethod: string;
	timestamp: Date;
	recipients: string[];
	error?: string;
}

export interface MessageData {
	subject: string;
	body: string;
	recipients: string[];
	templateId: string;
	userId: string;
	metadata?: Record<string, unknown>;
}

export interface CWCSubmissionData {
	template: TemplateData;
	user: UserProfileData;
	recipients: Representative[];
	personalMessage?: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type UnknownRecord = Record<string, unknown>;
export type AnyFunction = (...args: unknown[]) => unknown;
export type AnyAsyncFunction = (...args: unknown[]) => Promise<unknown>;

// Type guard functions
export function isErrorWithCode(error: unknown): error is ErrorWithCode {
	return error instanceof Error && ('code' in error || 'status' in error);
}

export function isUserProfileData(obj: unknown): obj is UserProfileData {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'id' in obj &&
		typeof (obj as UserProfileData).id === 'string' &&
		'email' in obj &&
		typeof (obj as UserProfileData).email === 'string'
	);
}

export function isTemplateData(obj: unknown): obj is TemplateData {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'title' in obj &&
		typeof (obj as TemplateData).title === 'string' &&
		'message_body' in obj &&
		typeof (obj as TemplateData).message_body === 'string'
	);
}

export function isAddress(obj: unknown): obj is Address {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'street' in obj &&
		typeof (obj as Address).street === 'string' &&
		'city' in obj &&
		typeof (obj as Address).city === 'string' &&
		'state' in obj &&
		typeof (obj as Address).state === 'string' &&
		'zip' in obj &&
		typeof (obj as Address).zip === 'string'
	);
}

// Representative type from user.ts
export interface Representative {
	id: string;
	bioguide_id: string;
	name: string;
	party: string;
	state: string;
	district: string;
	chamber: string;
	office_code: string;
	phone?: string;
	email?: string;
	office?: string; // For compatibility with existing code
}

// Template and component types for AppHeader
export interface HeaderTemplate {
	id: string;
	title: string;
	slug: string;
	description?: string;
	category?: string;
	message_body?: string;
	status?: string;
	user_id?: string;
	[key: string]: unknown;
}

export interface TemplateUseEvent {
	template: HeaderTemplate;
	requiresAuth: boolean;
}

export interface HeaderUser {
	id: string;
	email: string;
	name: string | null;
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	congressional_district?: string | null;
	is_verified?: boolean;
	verification_method?: string | null;
	verified_at?: Date | null;
	address?: string | null;
}

// Credential subject type for verification
export interface CredentialSubject {
	nationality?: string;
	issuing_state?: string;
	residence_country?: string;
	[key: string]: unknown;
}

// UI Component types
export type ModalChildrenFunction = (data: UnknownRecord) => unknown;
export type PopoverTriggerFunction = (params: { triggerAction: TriggerAction }) => unknown;
export type PopoverChildrenFunction = (params: { open: boolean }) => unknown;
export type PopoverTriggerVariant = (props: {
	trigger: TriggerAction;
	'aria-controls': string;
}) => unknown;

export interface TriggerAction {
	trigger: () => void;
	'aria-controls': string;
}
