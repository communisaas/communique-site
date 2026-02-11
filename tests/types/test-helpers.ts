import type { RequestEvent } from '@sveltejs/kit';
import type { Template } from '../../src/lib/types/template.js';
import type {
	UserWithReputation,
	ClaimData,
	ChallengeWithAddress
} from '../../src/lib/types/database-extensions.js';
import { vi } from 'vitest';

/**
 * Mock Request object for tests
 */
export interface MockRequest {
	json: ReturnType<typeof vi.fn>;
	text?: ReturnType<typeof vi.fn>;
	formData?: ReturnType<typeof vi.fn>;
	headers?: Headers;
	method?: string;
	url?: string;
}

/**
 * Mock User object matching Prisma schema and extending UserWithReputation
 */
export interface MockUser extends Partial<UserWithReputation> {
	id: string;
	email: string;
	name: string | null;
	// NO PII FIELDS (removed per privacy-preserving architecture)
	// Address data is never stored in database (verified once via TEE, then destroyed)
	congressional_district: string | null; // Stored as hash only in real schema (district_hash)
	is_verified: boolean;
	createdAt: Date;
	updatedAt: Date;
	is_active: boolean;
	is_banned: boolean;
	is_admin: boolean;
	profile_picture: string | null;
	login_count: number;
	political_party: string | null;
	interests: string[];
	political_affiliation: string | null;
	profile_metadata: Record<string, unknown>;
	profile_visibility: string;
	// Core fields from schema
	trust_score: number;
	reputation_tier: string;
	// Computed/alias properties
	reputation_score: number; // Maps to trust_score
	// Additional fields for backwards compat
	avatar?: string | null;
	phone?: string | null;
	role?: string | null;
	organization?: string | null;
	location?: string | null;
	connection?: string | null;
	profile_completed_at?: Date | null;
	verification_method?: string | null;
	verified_at?: Date | null;
	coordinates?: {
		lat?: number;
		lng?: number;
	} | null;
	preferences?: Record<string, unknown> | null;
	phone_verified?: boolean;
	email_verified?: boolean;
	last_active?: Date | null;
	failed_login_attempts?: number;
	last_failed_login?: Date | null;
	account_locked?: boolean;
	lock_reason?: string | null;
	locked_until?: Date | null;
}

/**
 * Mock Locals object for API routes
 */
export interface MockLocals {
	user?: Partial<MockUser> | null;
	session?: {
		id?: string;
		user_id?: string;
		expires_at?: Date;
	} | null;
}

/**
 * Helper to create a proper RequestEvent from mocks
 * Provides better type safety while maintaining test flexibility
 */
export function asRequestEvent<
	Params extends Record<string, string> = Record<string, string>
>(
	request: MockRequest | Partial<Request>,
	locals: MockLocals = {},
	params: Params = {} as Params,
	routeId: string = '/api/test'
): RequestEvent<Params, any> {
	// Create a more complete mock Request object
	const mockRequest = {
		json: vi.fn(),
		text: vi.fn(),
		formData: vi.fn(),
		headers: new Headers(),
		method: 'GET',
		url: 'http://localhost:3000/api/test',
		...request
	} as Request;

	// Create cookies mock with common cookie methods
	const mockCookies = {
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn(),
		getAll: vi.fn()
	};

	// Create mock spans for tracing
	const mockSpan = {
		setAttribute: vi.fn(),
		setAttributes: vi.fn(),
		addEvent: vi.fn(),
		setStatus: vi.fn(),
		updateName: vi.fn(),
		end: vi.fn(),
		isRecording: vi.fn(() => false),
		recordException: vi.fn()
	};

	return {
		request: mockRequest,
		locals: {
			user: null,
			session: null,
			...locals
		},
		params,
		url: new URL(mockRequest.url || 'http://localhost:3000'),
		route: { id: routeId as string | null },
		cookies: mockCookies as RequestEvent['cookies'],
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		platform: {},
		setHeaders: vi.fn(),
		isDataRequest: false,
		isSubRequest: false,
		tracing: {
			enabled: false,
			root: mockSpan as unknown as RequestEvent['tracing']['root'],
			current: mockSpan as unknown as RequestEvent['tracing']['current']
		},
		isRemoteRequest: false
	} as unknown as RequestEvent<Params, any>;
}

/**
 * Mock Template object for tests - extends Template with additional test fields
 */
export interface MockTemplate extends Omit<Template, 'metrics'> {
	// Additional fields that may exist in tests
	channel_id?: string;
	created_at?: Date;
	updated_at?: Date;
	creator_id?: string;
	severity_level?: number;
	userId?: string;
	last_sent_at?: Date | undefined;
	metrics?: {
		sent?: number;
		opened?: number;
		clicked?: number;
		responded?: number;
		views?: number;
		responses?: number;
		districts_covered?: number;
		total_districts?: number;
		district_coverage_percent?: number;
	} | null;
}

/**
 * Create a minimal mock template
 */
export function createMockTemplate(overrides: Partial<MockTemplate> = {}): MockTemplate {
	const now = new Date();
	return {
		id: 'template-123',
		slug: 'test-template',
		title: 'Test Template',
		description: 'A test template',
		category: 'test',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Test Subject',
		message_body: 'This is a test message.',
		delivery_config: {},
		cwc_config: undefined,
		recipient_config: {},
		preview: 'Test Template',
		is_public: true,
		metrics: { sent: 0, opened: 0, clicked: 0 },
		campaign_id: undefined,
		status: 'draft',
		send_count: 0,
		last_sent_at: undefined,
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		verification_status: 'pending',
		severity_level: undefined,
		original_content: undefined,
		correction_log: undefined,
		corrected_subject: undefined,
		corrected_body: undefined,
		grammar_score: undefined,
		clarity_score: undefined,
		completeness_score: undefined,
		quality_score: undefined,
		agent_votes: undefined,
		consensus_score: undefined,
		reputation_delta: undefined,
		reputation_applied: false,
		reviewed_at: undefined,
		corrected_at: undefined,
		country_code: 'US',
		created_at: now,
		updated_at: now,
		createdAt: overrides.createdAt ?? now,
		updatedAt: overrides.updatedAt ?? now,
		isNew: false,
		coordinationScale: 0,
		...overrides
	};
}

/**
 * Create a minimal mock user
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
	const now = new Date();
	const trustScore = overrides.trust_score || 500;
	return {
		id: 'user-123',
		email: 'test@example.com',
		name: 'Test User',
		// NO PII FIELDS - address data never stored in database
		congressional_district: null,
		is_verified: false,
		createdAt: now,
		updatedAt: now,
		is_active: true,
		is_banned: false,
		is_admin: false,
		profile_picture: null,
		login_count: 0,
		political_party: null,
		interests: [],
		political_affiliation: null,
		profile_metadata: {},
		profile_visibility: 'public',
		trust_score: trustScore,
		reputation_tier: 'verified',
		reputation_score: trustScore, // Map trust_score to reputation_score
		...overrides
	};
}

/**
 * Create a minimal mock claim
 */
export function createMockClaim(overrides: Partial<ClaimData> = {}): ClaimData {
	return {
		content: 'Test claim content',
		creator: createMockUser({ id: 'claim-creator-123' }),
		template: {
			id: 'template-123',
			send_count: 100
		} as any,
		...overrides
	};
}

/**
 * Create a minimal mock challenge
 */
export function createMockChallenge(
	overrides: Partial<ChallengeWithAddress> = {}
): ChallengeWithAddress {
	return {
		id: 'challenge-123',
		challenger_id: 'user-challenger',
		defender_id: 'user-defender',
		claim_hash: 'claim-hash-123',
		stake_amount: '1000000000000000000',
		status: 'active',
		challenger_address: '0x123...abc',
		...overrides
	};
}
