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
	createdAt: Date;
	updatedAt: Date;
}

export interface UserLocation {
	id: string;
	user_id: string;
	latitude?: number;
	longitude?: number;
	political_embedding?: unknown;
	community_sheaves?: unknown;
	embedding_version?: string;
	last_calculated?: Date;
}

export interface Representative {
	id: string;
	name: string;
	title: string;
	district?: string;
	state: string;
	party?: string;
	office?: string;
	phone?: string;
	email?: string;
	website?: string;
}

/**
 * UNIFIED EMAIL SERVICE USER INTERFACE
 *
 * Consolidated User interface for email and template services.
 * This interface represents the user context needed for:
 * - Email flow analysis (auth, address, send)
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

	/** Address components required for congressional routing */
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	congressional_district?: string | null;

	/** Legacy address field for backward compatibility */
	address?: string | null;

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
	[key: string]: any;
};

/**
 * Convert a User model or partial user object to EmailServiceUser interface
 * Handles type compatibility and filters only required fields
 * 
 * @param user - User object from Prisma query or partial user object (can be null)
 * @returns EmailServiceUser compatible object or null
 */
export function toEmailServiceUser(user: any | null): EmailServiceUser | null {
	if (!user) {
		return null;
	}

	// For partial user objects (like in AppHeader), provide fallback email
	// This allows the function to work with incomplete user data
	const email = user.email || 'guest@example.com';

	return {
		id: user.id,
		email: email,
		name: user.name || null,
		street: user.street || null,
		city: user.city || null,
		state: user.state || null,
		zip: user.zip || null,
		congressional_district: user.congressional_district || null,
		is_verified: user.is_verified || false,
		verification_method: user.verification_method || null,
		verified_at: user.verified_at || null
	};
}
