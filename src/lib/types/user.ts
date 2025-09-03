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
 */
export interface EmailServiceUser {
	/** Unique user identifier */
	id: string;
	
	/** User's display name for template personalization */
	name?: string | null;
	
	/** User's email address (optional for guest flows) */
	email?: string;
	
	/** Address components required for congressional routing */
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	
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
	verification_method?: string;
}