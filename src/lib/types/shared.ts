/**
 * SHARED TYPES MODULE
 *
 * Consolidated type definitions to eliminate duplication across the codebase.
 * This module provides the canonical definitions for commonly-used types.
 *
 * Type Hierarchy:
 * - Source: Citation reference for message generation
 * - DecisionMaker: Hierarchical types for decision-maker representation
 * - TemplateScope: Geographic scope for template filtering
 */

import type { GeoFence } from './location';

// ============================================================================
// Source Interface (Canonical Definition)
// ============================================================================

/**
 * Source reference from message generation agent
 *
 * Used for:
 * - Inline citations in generated messages [1], [2], etc.
 * - Grounding metadata from Google Search
 * - Research provenance tracking
 *
 * Canonical definition - previously duplicated in:
 * - src/lib/types/template.ts (kept as canonical)
 * - src/lib/core/agents/types.ts (removed, re-exports from here)
 */
export interface Source {
	num: number; // Citation number [1], [2], etc.
	title: string; // Source title
	url: string; // Source URL
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy'; // Source type
}

// ============================================================================
// DecisionMaker Type Hierarchy (Discriminated Unions)
// ============================================================================

/**
 * Base decision-maker with core identity fields
 *
 * Contains the minimum required fields for identifying a decision-maker.
 * Extended by more specific types with additional data.
 */
export interface DecisionMakerBase {
	/** Full name: "John Smith" or "Mayor London Breed" */
	name: string;
	/** Job title: "CEO", "Senator", "Director of Communications" */
	title: string;
	/** Organization: "Apple Inc.", "City of San Francisco", "U.S. Congress" */
	organization: string;
}

/**
 * Decision-maker with contact information
 *
 * Extends base with email and contact channel.
 * Used after email enrichment pipeline completes.
 */
export interface DecisionMakerWithContact extends DecisionMakerBase {
	/** Email address (required after enrichment) */
	email: string;
	/** Contact channel type */
	contactChannel: ContactChannel;
}

/**
 * Fully enriched decision-maker with provenance data
 *
 * Contains all verification and sourcing information.
 * Result of full decision-maker resolution pipeline.
 */
export interface DecisionMakerEnriched extends DecisionMakerWithContact {
	/** Why this person matters for the campaign */
	reasoning: string;
	/** Identity verification source URL */
	sourceUrl: string;
	/** Email verification source URL */
	emailSource: string;
	/** Confidence score 0.0-1.0 based on verification quality */
	confidence: number;
	/** Legacy provenance field (deprecated, use reasoning + sourceUrl) */
	provenance?: string;
	/** Legacy snake_case source URL (deprecated) */
	source_url?: string;
}

/**
 * Decision-maker for UI display
 *
 * Optimized for recognition in card/list views.
 * Contains optional display-friendly fields.
 */
export interface DecisionMakerDisplay extends DecisionMakerBase {
	/** Short display name: "Mayor Breed" */
	shortName?: string;
	/** Role fallback: "Mayor" (if name unavailable) */
	role?: string;
}

/**
 * Contact channel for reaching decision-makers
 */
export type ContactChannel = 'email' | 'form' | 'phone' | 'congress' | 'other';

/**
 * Decision-maker candidate before enrichment
 *
 * Initial research result before email verification.
 * May or may not have contact information.
 */
export interface DecisionMakerCandidate extends DecisionMakerBase {
	reasoning: string;
	sourceUrl: string;
	confidence: number;
	contactChannel?: ContactChannel;
}

/**
 * Decision-maker after enrichment attempt
 *
 * Contains enrichment status and optional email.
 * Used in pipeline stages before final validation.
 */
export interface EnrichedDecisionMaker extends DecisionMakerCandidate {
	email?: string;
	emailSource?: string;
	emailConfidence?: number;
	enrichmentStatus: 'success' | 'not_found' | 'timeout' | 'error';
	enrichmentAttempts: number;
}

/**
 * Fully validated decision-maker ready for delivery
 *
 * All required fields guaranteed present.
 * Final stage of decision-maker pipeline.
 */
export interface ValidatedDecisionMaker {
	name: string;
	title: string;
	organization: string;
	email: string; // REQUIRED - guaranteed present
	reasoning: string;
	sourceUrl: string;
	emailSource: string;
	confidence: number;
	contactChannel: ContactChannel;
}

// ============================================================================
// TemplateScope (Canonical Definition)
// ============================================================================

/**
 * Template scope mode - how geographic targeting is specified
 */
export type TemplateScopeMode = 'jurisdictions' | 'geofence' | 'user_home' | 'country';

/**
 * Template scope for geographic targeting
 *
 * Links templates to geographic areas via multiple mechanisms:
 * - jurisdictions: Specific jurisdiction IDs
 * - geofence: Geographic boundary polygon
 * - user_home: User's registered address
 * - country: Country-level targeting
 *
 * Canonical definition - previously duplicated in:
 * - src/lib/types/jurisdiction.ts (kept as canonical)
 * - src/lib/types/any-replacements.ts (removed)
 * - src/lib/core/location/template-filter.ts (removed, re-exports)
 */
export interface TemplateScope {
	id: string;
	template_id: string;
	mode: TemplateScopeMode;
	country_codes?: string[];
	jurisdiction_ids?: string[];
	geofence?: GeoFence | unknown;
	created_at: string | Date;
	updated_at: string | Date;
}

/**
 * Template scope for client-side filtering
 *
 * Extended scope with additional fields used in template-filter.ts
 * for hierarchical international scope matching.
 */
export interface TemplateScopeExtended {
	id: string;
	template_id: string;
	country_code: string;
	region_code?: string | null;
	locality_code?: string | null;
	district_code?: string | null;
	display_text: string;
	scope_level: 'district' | 'locality' | 'region' | 'country';
	confidence: number;
	extraction_method?: string;
}
