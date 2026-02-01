/**
 * Zod Schemas for Firecrawl Agent API Response Validation
 *
 * Provides runtime validation for unstructured JSON responses from
 * Firecrawl's Agent API. Designed for graceful degradation - partial
 * results are still usable even when some fields fail validation.
 *
 * These schemas mirror the TypeScript interfaces in firecrawl-client.ts
 * providing the runtime validation layer that TypeScript cannot.
 */

import { z } from 'zod';

// ============================================================================
// Leader Schema - Core person data from website research
// ============================================================================

/**
 * Schema for individual leader/decision-maker discovered by Firecrawl Agent.
 *
 * Design decisions:
 * - name and title are required (minimum viable leader data)
 * - email is optional with pattern validation
 * - emailVerified defaults to false for safety
 * - All other fields are optional for graceful degradation
 */
export const FirecrawlLeaderSchema = z.object({
	name: z.string().min(1, 'Leader name is required'),
	title: z.string().min(1, 'Leader title is required'),
	email: z
		.string()
		.email()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	emailVerified: z.boolean().default(false),
	linkedin: z
		.string()
		.url()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	department: z
		.string()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	sourceUrl: z
		.string()
		.url()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	responsibilities: z
		.string()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined)
});

/**
 * Lenient leader schema for partial recovery.
 * Accepts any object with name and title strings.
 */
export const FirecrawlLeaderLenientSchema = z
	.object({
		name: z.string().min(1),
		title: z.string().min(1)
	})
	.passthrough();

// ============================================================================
// Policy Position Schema - Organization stances on topics
// ============================================================================

export const FirecrawlPolicyPositionSchema = z.object({
	topic: z.string().min(1, 'Policy topic is required'),
	stance: z.string().min(1, 'Policy stance is required'),
	summary: z.string().min(1, 'Policy summary is required'),
	sourceUrl: z
		.string()
		.url()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined)
});

// ============================================================================
// Organization Contacts Schema
// ============================================================================

export const FirecrawlContactsSchema = z
	.object({
		general: z
			.string()
			.email()
			.optional()
			.nullable()
			.transform((v) => v ?? undefined),
		press: z
			.string()
			.email()
			.optional()
			.nullable()
			.transform((v) => v ?? undefined),
		stakeholder: z
			.string()
			.email()
			.optional()
			.nullable()
			.transform((v) => v ?? undefined),
		phone: z
			.string()
			.optional()
			.nullable()
			.transform((v) => v ?? undefined)
	})
	.default({});

// ============================================================================
// Headquarters Schema
// ============================================================================

export const FirecrawlHeadquartersSchema = z
	.object({
		city: z
			.string()
			.optional()
			.nullable()
			.transform((v) => v ?? undefined),
		state: z
			.string()
			.optional()
			.nullable()
			.transform((v) => v ?? undefined),
		country: z
			.string()
			.optional()
			.nullable()
			.transform((v) => v ?? undefined)
	})
	.optional();

// ============================================================================
// Organization Profile Schema - Full discovery result
// ============================================================================

/**
 * Complete organization profile from Firecrawl Agent discovery.
 *
 * Design decisions:
 * - name is required (critical identifier)
 * - leadership array is required but can be empty
 * - All other fields use sensible defaults for graceful degradation
 * - Nested objects use their own schemas for detailed validation
 */
export const FirecrawlOrganizationProfileSchema = z.object({
	name: z.string().min(1, 'Organization name is required'),
	website: z
		.string()
		.url()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	about: z
		.string()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	industry: z
		.string()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	headquarters: FirecrawlHeadquartersSchema,
	employeeCount: z
		.string()
		.optional()
		.nullable()
		.transform((v) => v ?? undefined),
	leadership: z.array(FirecrawlLeaderSchema).default([]),
	policyPositions: z.array(FirecrawlPolicyPositionSchema).default([]),
	contacts: FirecrawlContactsSchema
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type FirecrawlLeaderValidated = z.infer<typeof FirecrawlLeaderSchema>;
export type FirecrawlPolicyPositionValidated = z.infer<typeof FirecrawlPolicyPositionSchema>;
export type FirecrawlOrganizationProfileValidated = z.infer<
	typeof FirecrawlOrganizationProfileSchema
>;

// ============================================================================
// Validation Utilities
// ============================================================================

export interface ValidationResult<T> {
	success: boolean;
	data: T | null;
	partialData?: Partial<T>;
	errors: string[];
	warnings: string[];
}

/**
 * Validate organization profile with graceful degradation.
 *
 * Strategy:
 * 1. Try strict validation first
 * 2. On failure, attempt partial recovery of leadership array
 * 3. Return usable data even if some fields failed validation
 */
export function validateOrganizationProfile(
	data: unknown
): ValidationResult<FirecrawlOrganizationProfileValidated> {
	const warnings: string[] = [];

	// Step 1: Try full validation
	const result = FirecrawlOrganizationProfileSchema.safeParse(data);

	if (result.success) {
		return {
			success: true,
			data: result.data,
			errors: [],
			warnings
		};
	}

	// Step 2: Attempt partial recovery
	console.warn(
		'[firecrawl-schemas] Full validation failed, attempting recovery:',
		result.error.flatten()
	);

	// Extract what we can from the raw data
	const rawData = data as Record<string, unknown>;
	const recoveredLeaders: FirecrawlLeaderValidated[] = [];

	if (Array.isArray(rawData?.leadership)) {
		for (const leader of rawData.leadership) {
			const leaderResult = FirecrawlLeaderLenientSchema.safeParse(leader);
			if (leaderResult.success) {
				// Spread first, then add required emailVerified default
				recoveredLeaders.push({
					...leaderResult.data,
					emailVerified: false
				} as FirecrawlLeaderValidated);
				warnings.push(`Recovered leader with lenient validation: ${leaderResult.data.name}`);
			}
		}
	}

	// Build partial result with recovered data
	const partialData: Partial<FirecrawlOrganizationProfileValidated> = {
		name: typeof rawData?.name === 'string' ? rawData.name : 'Unknown Organization',
		leadership: recoveredLeaders,
		policyPositions: [],
		contacts: {}
	};

	// Copy other recoverable fields
	if (typeof rawData?.website === 'string') partialData.website = rawData.website;
	if (typeof rawData?.about === 'string') partialData.about = rawData.about;
	if (typeof rawData?.industry === 'string') partialData.industry = rawData.industry;

	const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);

	// Return success if we recovered the critical data (name + some leaders)
	if (partialData.name && recoveredLeaders.length > 0) {
		return {
			success: true,
			data: partialData as FirecrawlOrganizationProfileValidated,
			partialData,
			errors: [],
			warnings: [...warnings, 'Some fields failed validation but core data was recovered']
		};
	}

	return {
		success: false,
		data: null,
		partialData,
		errors,
		warnings
	};
}

/**
 * Validate an array of leaders with partial recovery.
 * Returns all valid leaders, logging warnings for invalid ones.
 */
export function validateLeadersArray(data: unknown[]): {
	leaders: FirecrawlLeaderValidated[];
	invalidCount: number;
} {
	const leaders: FirecrawlLeaderValidated[] = [];
	let invalidCount = 0;

	for (const item of data) {
		const result = FirecrawlLeaderSchema.safeParse(item);
		if (result.success) {
			leaders.push(result.data);
		} else {
			invalidCount++;
			console.warn('[firecrawl-schemas] Invalid leader entry:', {
				input: item,
				errors: result.error.flatten()
			});

			// Try lenient recovery
			const lenient = FirecrawlLeaderLenientSchema.safeParse(item);
			if (lenient.success) {
				leaders.push({
					name: lenient.data.name,
					title: lenient.data.title,
					emailVerified: false
				} as FirecrawlLeaderValidated);
			}
		}
	}

	return { leaders, invalidCount };
}
