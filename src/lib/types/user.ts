export interface UserAddress {
	street?: string;
	city?: string;
	state?: string;
	zip?: string;
	congressional_district?: string;
}

export interface UserProfile {
	id: string;
	name?: string;
	email: string;
	avatar?: string;
	phone?: string;
	created_at: Date;
	updated_at: Date;
}

// NOTE: UserLocation interface removed - coordinates data now part of enhanced User model
// All location data (latitude, longitude, political_embedding, community_sheaves)
// is now directly accessible on the User object after Phase 2 consolidation

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

	// Enhanced office information (from Phase 5 consolidation)
	member_name?: string; // May differ from name field
	office_address?: string;
	office_city?: string;
	office_state?: string;
	office_zip?: string;

	// Enhanced term information
	term_start?: Date;
	term_end?: Date;
	current_term?: number;

	// Status and metadata
	is_active: boolean;
	last_updated: Date;
	data_source?: string; // 'congress_api', 'bioguide', 'manual'
	source_updated_at?: Date;

	// User-_representative relationship fields (for joined queries)
	relationship?: string;
	assigned_at?: Date;
	last_validated?: Date | null;
}

/**
 * UNIFIED EMAIL SERVICE USER INTERFACE
 *
 * Consolidated User interface for email and template services.
 * This interface represents the user context needed for:
 * - Email flow analysis (auth, _address, send)
 * - Template variable resolution with user data
 * - Congressional routing determination
 * - Component user context handling
 *
 * Note: This interface is designed to be compatible with the Prisma User model
 * while exposing only the fields needed for email services.
 */
export interface EmailServiceUser {
	/** Unique user identifier */
	id: string;

	/** User's display name for template personalization */
	name?: string | null;

	/** User's email address (required for authenticated users) */
	email: string;

	/** Address  components required for congressional routing */
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	congressional_district?: string | null;

	/** Legacy address field for backward compatibility */
	address?: string | null;

	/** Enhanced location data (from Phase 2 User consolidation) */
	latitude?: number | null;
	longitude?: number | null;
	political_embedding?: unknown | null;
	community_sheaves?: unknown | null;
	embedding_version?: string | null;
	coordinates_updated_at?: Date | null;

	/** Congressional representatives for template variable resolution */
	representatives?: Array<{
		name: string;
		party: string;
		chamber: string;
		state: string;
		district: string;
	}>;

	/** Identity verification status for enhanced delivery */
	is_verified?: boolean;
	verification_method?: string | null;
	verified_at?: Date | null;

	/** VOTER Protocol wallet integration (from Phase 2 consolidation) */
	wallet_address?: string | null;
	trust_score?: number;
	reputation_tier?: string;
}

/**
 * Type representing the Prisma User model shape for email services
 * This matches the subset of fields that EmailServiceUser needs
 */
export type PrismaUserForEmail = {
	id: string;
	email: string;
	name: string | null;
	street: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	congressional_district: string | null;
	is_verified: boolean;
	verification_method: string | null;
	verified_at: Date | null;
	// Additional fields that might be present but aren't needed
	[key: string]: unknown;
};

/**
 * Convert a User model or partial user object to EmailServiceUser interface
 * Handles type compatibility and filters only required fields
 *
 * @param user - User object from Prisma query or partial user object (can be null)
 * @returns EmailServiceUser compatible object or null
 */
export function toEmailServiceUser(user: Record<string, unknown> | null): EmailServiceUser | null {
	if (!user) {
		return null;
	}

	// For partial user objects (like in AppHeader), provide fallback email
	// This allows the function to work with incomplete user data
	const email = (user.email as string) || 'guest@example.com';

	return {
		id: user.id as string,
		email: email,
		name: (user.name as string | null) || null,
		street: (user.street as string | null) || null,
		city: (user.city as string | null) || null,
		state: (user.state as string | null) || null,
		zip: (user.zip as string | null) || null,
		congressional_district: (user.congressional_district as string | null) || null,

		// Enhanced location data (from Phase 2 User consolidation)
		latitude: (user.latitude as number | null) || null,
		longitude: (user.longitude as number | null) || null,
		political_embedding: user.political_embedding || null,
		community_sheaves: user.community_sheaves || null,
		embedding_version: (user.embedding_version as string | null) || null,
		coordinates_updated_at: (user.coordinates_updated_at as Date | null) || null,

		// Congressional representatives for template variable resolution
		representatives:
			(user.representatives as Array<{
				name: string;
				party: string;
				chamber: string;
				state: string;
				district: string;
			}>) || [],

		// Identity verification
		is_verified: (user.is_verified as boolean) || false,
		verification_method: (user.verification_method as string | null) || null,
		verified_at: (user.verified_at as Date | null) || null,

		// VOTER Protocol wallet integration (from Phase 2 consolidation)
		wallet_address: (user.wallet_address as string | null) || null,
		trust_score: (user.trust_score as number) || 0,
		reputation_tier: (user.reputation_tier as string) || 'novice'
	};
}
