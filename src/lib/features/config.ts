/**
 * Feature Flag Configuration System
 *
 * This system manages feature availability across the application.
 * Features can be in various states from research to production.
 */

export enum FeatureStatus {
	OFF = 'off', // Not available
	BETA = 'beta', // Available for testing
	ON = 'on', // Production ready
	ROADMAP = 'roadmap' // Planned, see ROADMAP.md
}

export const FEATURES = {
	// === PHASE 1: PRODUCTION (3 months to launch) ===
	TEMPLATE_CREATION: FeatureStatus.ON,
	CONGRESSIONAL_ROUTING: FeatureStatus.ON,
	OAUTH_LOGIN: FeatureStatus.ON,
	ADDRESS_VALIDATION: FeatureStatus.ON,

	// Beta Features (working but not polished)
	LEGISLATIVE_CHANNELS: FeatureStatus.BETA, // Database schema exists, no UI

	// === PHASE 2: ROADMAP (12-18 months) ===
	// Removed from codebase - will be implemented in voter-protocol repo
	BLOCKCHAIN_INTEGRATION: FeatureStatus.ROADMAP,
	REPUTATION_SYSTEM: FeatureStatus.ROADMAP,
	CHALLENGE_MARKETS: FeatureStatus.ROADMAP,
	OUTCOME_MARKETS: FeatureStatus.ROADMAP,
	VOTER_TOKEN: FeatureStatus.ROADMAP,
	MULTI_AGENT_CONSENSUS: FeatureStatus.ROADMAP,

	// === NOT IMPLEMENTING ===
	// These were experimental and are now removed
	CASCADE_ANALYTICS: FeatureStatus.OFF, // Removed - too complex for MVP
	AI_SUGGESTIONS: FeatureStatus.OFF, // Phase 2 feature
	POLITICAL_FIELD_MODELING: FeatureStatus.OFF, // Research only
	SHEAF_FUSION: FeatureStatus.OFF, // Research only - removed
	PERCOLATION_ENGINE: FeatureStatus.OFF // Research only - removed
} as const;

export type FeatureName = keyof typeof FEATURES;

/**
 * Check if a feature is enabled at runtime
 * @param feature - The feature to check
 * @returns true if the feature is enabled
 * @throws Error in production if trying to enable OFF/RESEARCH/ROADMAP features
 */
export function isFeatureEnabled(feature: FeatureName): boolean {
	const status = FEATURES[feature];
	const isProduction = process.env.NODE_ENV === 'production';

	if (status === FeatureStatus.ON) {
		return true;
	}

	if (status === FeatureStatus.BETA) {
		const betaEnabled =
			process.env.ENABLE_BETA === 'true' || process.env.PUBLIC_ENABLE_BETA === 'true';
		if (isProduction && betaEnabled) {
			console.warn(
				`[Feature Flags] Beta feature '${feature}' enabled in production - use with caution`
			);
		}
		return betaEnabled;
	}

	if (status === FeatureStatus.ROADMAP) {
		if (isProduction) {
			throw new Error(
				`[Feature Flags] BLOCKED: Roadmap feature '${feature}' not implemented yet. ` +
					`See ROADMAP.md for timeline.`
			);
		}
		// Allow in development for testing future integrations
		return false;
	}

	// OFF status - explicitly disabled
	if (status === FeatureStatus.OFF) {
		if (isProduction) {
			throw new Error(
				`[Feature Flags] BLOCKED: Feature '${feature}' is disabled (removed from codebase). ` +
					`This feature is not available.`
			);
		}
		return false;
	}

	return false;
}

/**
 * Get the status of a feature
 * @param feature - The feature to check
 * @returns The feature's current status
 */
export function getFeatureStatus(feature: FeatureName): FeatureStatus {
	return FEATURES[feature];
}

/**
 * Check if a feature is in development (beta)
 * @param feature - The feature to check
 * @returns true if the feature is in development
 */
export function isFeatureInDevelopment(feature: FeatureName): boolean {
	const status = FEATURES[feature];
	return status === FeatureStatus.BETA;
}

/**
 * Get all features by status
 * @param status - The status to filter by
 * @returns Array of feature names with the given status
 */
export function getFeaturesByStatus(status: FeatureStatus): FeatureName[] {
	return (Object.keys(FEATURES) as FeatureName[]).filter((feature) => FEATURES[feature] === status);
}

/**
 * Feature flag hook for Svelte components
 * Usage: const aiEnabled = useFeature('AI_SUGGESTIONS');
 */
export function useFeature(feature: FeatureName): boolean {
	return isFeatureEnabled(feature);
}

// Export type-safe feature names for use in components
export const FeatureNames = Object.keys(FEATURES) as FeatureName[];
