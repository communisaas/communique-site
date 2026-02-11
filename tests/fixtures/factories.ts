// Simple ID generator for tests
let idCounter = 1000;
const snowflake = () => (++idCounter).toString();

export interface FactoryOptions<T> {
	overrides?: Partial<T>;
	count?: number;
}

/**
 * Base factory class for creating test data
 */
abstract class Factory<T> {
	abstract build(options?: FactoryOptions<T>): T;

	buildList(count: number, options?: FactoryOptions<T>): T[] {
		return Array.from({ length: count }, () => this.build(options));
	}

	/**
	 * Create factory with custom defaults
	 */
	withDefaults(defaults: Partial<T>): Factory<T> {
		const originalBuild = this.build.bind(this);
		this.build = (options?: FactoryOptions<T>) => ({
			...originalBuild(options),
			...defaults,
			...(options?.overrides || {})
		});
		return this;
	}
}

/**
 * User factory - Updated for consolidated schema
 */
export interface UserFactoryData {
	id: string;
	name: string;
	email: string;
	avatar?: string;
	createdAt: Date;
	updatedAt: Date;

	// Consolidated address fields
	street?: string;
	city?: string;
	state?: string;
	zip?: string;
	congressional_district?: string;
	phone?: string;
	address?: string; // Legacy field for backward compatibility

	// Verification status
	is_verified?: boolean;
	verification_method?: string;
	verification_data?: unknown;
	verified_at?: Date;

	// VOTER Protocol blockchain identity
	wallet_address?: string;
	district_hash?: string;
	trust_score?: number;
	reputation_tier?: string;

	// VOTER Protocol reward and reputation fields
	pending_rewards?: bigint;
	total_earned?: bigint;
	last_certification?: Date;
	challenge_score?: number;
	civic_score?: number;
	discourse_score?: number;

	// Profile fields
	role?: string;
	organization?: string;
	location?: string;
	connection?: string;
	profile_completed_at?: Date;
	profile_visibility?: string;
}

export class UserFactory extends Factory<UserFactoryData> {
	build(options?: FactoryOptions<UserFactoryData>): UserFactoryData {
		const id = snowflake().toString();
		const baseUser = {
			id,
			name: `Test User ${id.slice(-4)}`,
			email: `user${id.slice(-4)}@test.com`,
			avatar: undefined,
			createdAt: new Date(),
			updatedAt: new Date(),

			// Consolidated address fields
			street: '123 Main Street',
			city: 'San Francisco',
			state: 'CA',
			zip: '94102',
			congressional_district: 'CA-12',
			phone: '+1-555-123-4567',

			// Verification status
			is_verified: false,
			verification_method: undefined,
			verification_data: undefined,
			verified_at: undefined,

			// VOTER Protocol blockchain identity
			wallet_address: undefined,
			district_hash: undefined,
			trust_score: 0,
			reputation_tier: 'novice',

			// VOTER Protocol reward and reputation fields
			pending_rewards: BigInt(0),
			total_earned: BigInt(0),
			last_certification: undefined,
			challenge_score: 50,
			civic_score: 50,
			discourse_score: 50,

			// Profile fields
			role: undefined,
			organization: undefined,
			location: undefined,
			connection: undefined,
			profile_completed_at: undefined,
			profile_visibility: 'private'
		};

		return {
			...baseUser,
			...(options?.overrides || {})
		};
	}
}

/**
 * Template factory - Updated for consolidated schema
 */
export interface TemplateFactoryData {
	id: string;
	slug: string;
	title: string;
	description: string;
	category: string;
	type: string;
	deliveryMethod: string;
	subject?: string;
	preview: string;
	message_body: string;
	delivery_config: unknown;
	cwc_config?: unknown;
	recipient_config: unknown;
	metrics: unknown;
	campaign_id?: string;
	status: string;
	is_public: boolean;

	// Perceptual encoding properties
	coordinationScale: number;
	isNew: boolean;

	// Usage tracking
	send_count: number;
	last_sent_at?: Date;

	// Geographic scope
	applicable_countries: string[];
	jurisdiction_level?: string;
	specific_locations: string[];

	// Consolidated verification fields
	verification_status: string;
	severity_level?: number;
	original_content?: object;
	correction_log?: object;
	corrected_subject?: string;
	corrected_body?: string;
	grammar_score?: number;
	clarity_score?: number;
	completeness_score?: number;
	quality_score?: number;
	agent_votes?: object;
	consensus_score?: number;
	reputation_delta?: number;
	reputation_applied: boolean;
	reviewed_at?: Date;

	createdAt: Date;
	updatedAt: Date;
	userId?: string;
}

export class TemplateFactory extends Factory<TemplateFactoryData> {
	build(options?: FactoryOptions<TemplateFactoryData>): TemplateFactoryData {
		const id = snowflake().toString();
		const slug = `test-template-${id.slice(-4)}`;
		const baseTemplate = {
			id,
			slug,
			title: `Test Template ${id.slice(-4)}`,
			description: 'A test template for integration testing',
			category: 'advocacy',
			type: 'congressional',
			deliveryMethod: 'cwc',
			subject: 'Important Legislative Issue',
			preview: 'I am writing to you about an important issue...',
			message_body:
				'Dear [representative.title],\n\nI am writing to you about [issue]. [Personal Connection]\n\nSincerely,\n[user.name]',
			delivery_config: { method: 'cwc', target: 'congress' },
			cwc_config: { house: true, senate: true },
			recipient_config: { auto_lookup: true },
			metrics: { opens: 0, clicks: 0, responses: 0 },
			campaign_id: undefined,
			status: 'draft',
			is_public: true,

			// Perceptual encoding properties
			coordinationScale: 0.0,
			isNew: true,

			// Usage tracking
			send_count: 0,
			last_sent_at: undefined,

			// Geographic scope
			applicable_countries: ['US'],
			jurisdiction_level: 'federal',
			specific_locations: [],

			// Consolidated verification fields
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

			createdAt: new Date(),
			updatedAt: new Date(),
			userId: undefined
		};

		return {
			...baseTemplate,
			...(options?.overrides || {})
		};
	}
}

/**
 * Representative factory
 */
export interface RepresentativeFactoryData {
	id: string;
	name: string;
	bioguide_id: string;
	chamber: 'house' | 'senate' | 'commons';
	party: string;
	state: string;
	district?: string;
	office_code: string;
	phone?: string;
	email?: string;

	// Enhanced office information
	member_name?: string;
	office_address?: string;
	office_city?: string;
	office_state?: string;
	office_zip?: string;

	// Enhanced term information
	term_start?: Date;
	term_end?: Date;
	current_term?: number;

	// Status and metadata
	is_active?: boolean;
	last_updated?: Date;

	// Data source tracking
	data_source?: string;
	source_updated_at?: Date;
}

export class RepresentativeFactory extends Factory<RepresentativeFactoryData> {
	build(options?: FactoryOptions<RepresentativeFactoryData>): RepresentativeFactoryData {
		const id = snowflake().toString();
		const chamber = options?.overrides?.chamber || 'house';
		const state = options?.overrides?.state || 'CA';
		const district = chamber === 'house' ? options?.overrides?.district || '12' : undefined;

		const baseRep = {
			id,
			name:
				chamber === 'senate'
					? `Sen. Test Senator ${id.slice(-4)}`
					: `Rep. Test Representative ${id.slice(-4)}`,
			bioguide_id: `T${id.slice(-6)}`,
			chamber,
			party: 'Democratic',
			state,
			district,
			office_code: `T${id.slice(-6)}`,
			phone: '+1-202-224-0000',
			email: `${chamber}@congress.gov`,

			// Enhanced office information
			member_name: undefined,
			office_address: '123 Capitol Hill',
			office_city: 'Washington',
			office_state: 'DC',
			office_zip: '20515',

			// Enhanced term information
			term_start: new Date('2023-01-01'),
			term_end: new Date('2025-01-01'),
			current_term: 1,

			// Status and metadata
			is_active: true,
			last_updated: new Date(),

			// Data source tracking
			data_source: 'test',
			source_updated_at: new Date()
		};

		return {
			...baseRep,
			...(options?.overrides || {})
		};
	}
}

/**
 * Address factory
 */
export interface AddressFactoryData {
	street: string;
	city: string;
	state: string;
	postal_code: string;
	country_code: string;
}

export class AddressFactory extends Factory<AddressFactoryData> {
	build(options?: FactoryOptions<AddressFactoryData>): AddressFactoryData {
		const baseAddress = {
			street: '123 Main Street',
			city: 'San Francisco',
			state: 'CA',
			postal_code: '94102',
			country_code: 'US'
		};

		return {
			...baseAddress,
			...(options?.overrides || {})
		};
	}
}

/**
 * Congressional office factory
 */
export interface CongressionalOfficeFactoryData {
	bioguide_id: string;
	name: string;
	chamber: 'house' | 'senate';
	office_code: string;
	state: string;
	district?: string;
	party: string;
}

export class CongressionalOfficeFactory extends Factory<CongressionalOfficeFactoryData> {
	build(options?: FactoryOptions<CongressionalOfficeFactoryData>): CongressionalOfficeFactoryData {
		const chamber = options?.overrides?.chamber || 'house';
		const state = options?.overrides?.state || 'CA';
		const bioguide_id = options?.overrides?.bioguide_id || 'T123456';

		const baseOffice = {
			bioguide_id,
			name: chamber === 'senate' ? `Sen. ${bioguide_id}` : `Rep. ${bioguide_id}`,
			chamber,
			office_code: bioguide_id,
			state,
			district: chamber === 'house' ? '12' : undefined,
			party: 'Democratic'
		};

		return {
			...baseOffice,
			...(options?.overrides || {})
		};
	}
}

/**
 * Delivery job factory
 */
export interface DeliveryJobFactoryData {
	id: string;
	template: TemplateFactoryData;
	user: UserFactoryData;
	target_country?: string;
	custom_message?: string;
	created_at: Date;
}

export class DeliveryJobFactory extends Factory<DeliveryJobFactoryData> {
	build(options?: FactoryOptions<DeliveryJobFactoryData>): DeliveryJobFactoryData {
		const id = `job-${snowflake().toString()}`;

		const baseJob = {
			id,
			template: new TemplateFactory().build(),
			user: new UserFactory().build(),
			target_country: 'US',
			custom_message: 'This is my personal story about why this issue matters to me.',
			created_at: new Date()
		};

		return {
			...baseJob,
			...(options?.overrides || {})
		};
	}
}

/**
 * Mock request factory for API tests
 */
export interface MockRequestFactoryData {
	json: () => Promise<unknown>;
	headers: Map<string, string>;
	url: URL;
	method: string;
}

export class MockRequestFactory extends Factory<MockRequestFactoryData> {
	build(options?: FactoryOptions<MockRequestFactoryData>): MockRequestFactoryData {
		const baseRequest = {
			json: async () => ({}),
			headers: new Map(),
			url: new URL('http://localhost:5173'),
			method: 'GET'
		};

		return {
			...baseRequest,
			...(options?.overrides || {})
		};
	}
}

// Export factory instances for easy use
export const userFactory = new UserFactory();
export const templateFactory = new TemplateFactory();
export const representativeFactory = new RepresentativeFactory();
export const addressFactory = new AddressFactory();
export const congressionalOfficeFactory = new CongressionalOfficeFactory();
export const deliveryJobFactory = new DeliveryJobFactory();
export const mockRequestFactory = new MockRequestFactory();

// Export common test scenarios
export const testScenarios = {
	/**
	 * California user with SF address
	 */
	californiaUser: () =>
		userFactory.build({
			overrides: {
				id: 'action-user123',
				name: 'Alice Cooper',
				email: 'alice@example.com',
				state: 'CA',
				city: 'San Francisco',
				zip: '94102',
				congressional_district: 'CA-12',
				is_verified: true,
				trust_score: 100,
				reputation_tier: 'verified'
			}
		}),

	/**
	 * Texas user with Austin address
	 */
	texasUser: () =>
		userFactory.build({
			overrides: {
				id: 'action-user456',
				name: 'Bob Wilson',
				email: 'bob@example.com',
				state: 'TX',
				city: 'Austin',
				zip: '78701',
				congressional_district: 'TX-35',
				is_verified: true,
				trust_score: 85,
				reputation_tier: 'verified'
			}
		}),

	/**
	 * Climate action template
	 */
	climateTemplate: () =>
		templateFactory.build({
			overrides: {
				id: 'climate',
				slug: 'climate-action',
				title: 'Support Climate Action',
				description: 'Template for urging representatives to support climate legislation',
				subject: 'Urgent: Support Climate Legislation',
				message_body:
					'Dear [representative.title],\n\nAs your constituent, I urge you to support strong climate action. [Personal Connection]\n\nClimate change affects us all.\n\nSincerely,\n[user.name]',
				category: 'environment',
				status: 'published',
				is_public: true
			}
		}),

	/**
	 * Healthcare template
	 */
	healthcareTemplate: () =>
		templateFactory.build({
			overrides: {
				id: 'healthcare',
				slug: 'healthcare-access',
				title: 'Healthcare Access for All',
				description: 'Template for advocating for universal healthcare access',
				subject: 'Support Universal Healthcare',
				message_body:
					'Dear [representative.title],\n\nI am writing about healthcare access in our district. [Personal Connection]\n\nPlease support universal healthcare.\n\nSincerely,\n[user.name]',
				category: 'healthcare',
				status: 'published',
				is_public: true
			}
		}),

	/**
	 * Congressional routing email
	 */
	routingEmail: () => ({
		to: 'congress+climate-action-user123@communique.org',
		from: 'user@example.com',
		subject: 'Support Climate Action',
		body: 'This is my personal message about climate change.'
	}),

	/**
	 * Guest routing email
	 */
	guestRoutingEmail: () => ({
		to: 'congress+guest-healthcare-sessionXYZ@communique.org',
		from: 'newuser@example.com',
		subject: 'Healthcare Access',
		body: 'I support universal healthcare because...'
	})
};
