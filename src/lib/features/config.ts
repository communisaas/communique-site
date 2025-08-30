/**
 * Feature Flag Configuration System
 * 
 * This system manages feature availability across the application.
 * Features can be in various states from research to production.
 */

export enum FeatureStatus {
  OFF = 'off',           // Not available
  BETA = 'beta',         // Available for testing
  ON = 'on',             // Production ready
  RESEARCH = 'research', // Research only, not for production
  ROADMAP = 'roadmap'    // Planned, see ROADMAP.md
}

export const FEATURES = {
  // Core Features (always on)
  TEMPLATE_CREATION: FeatureStatus.ON,
  CONGRESSIONAL_ROUTING: FeatureStatus.ON,
  OAUTH_LOGIN: FeatureStatus.ON,
  EMAIL_DELIVERY: FeatureStatus.ON,
  
  // Beta Features
  CASCADE_ANALYTICS: FeatureStatus.BETA,
  LEGISLATIVE_CHANNELS: FeatureStatus.BETA,
  VIRAL_PATTERN_GENERATOR: FeatureStatus.BETA,
  
  // Planned Features (see ROADMAP.md)
  AI_SUGGESTIONS: FeatureStatus.ROADMAP,
  VARIABLE_RESOLUTION: FeatureStatus.ROADMAP,
  TEMPLATE_PERSONALIZATION: FeatureStatus.ROADMAP,
  USER_WRITING_STYLE: FeatureStatus.ROADMAP,
  
  // Research Features (experimental code)
  POLITICAL_FIELD_MODELING: FeatureStatus.RESEARCH,
  SHEAF_FUSION: FeatureStatus.RESEARCH,
  PERCOLATION_ENGINE: FeatureStatus.RESEARCH,
  COMMUNITY_INTERSECTION: FeatureStatus.RESEARCH,
} as const;

export type FeatureName = keyof typeof FEATURES;

/**
 * Check if a feature is enabled at runtime
 * @param feature - The feature to check
 * @returns true if the feature is enabled
 */
export function isFeatureEnabled(feature: FeatureName): boolean {
  const status = FEATURES[feature];
  
  if (status === FeatureStatus.ON) {
    return true;
  }
  
  if (status === FeatureStatus.BETA) {
    return process.env.ENABLE_BETA === 'true' || 
           process.env.PUBLIC_ENABLE_BETA === 'true';
  }
  
  if (status === FeatureStatus.RESEARCH) {
    return process.env.ENABLE_RESEARCH === 'true';
  }
  
  // OFF, ROADMAP, or any other status
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
 * Check if a feature is in development (beta or research)
 * @param feature - The feature to check
 * @returns true if the feature is in development
 */
export function isFeatureInDevelopment(feature: FeatureName): boolean {
  const status = FEATURES[feature];
  return status === FeatureStatus.BETA || 
         status === FeatureStatus.RESEARCH;
}

/**
 * Get all features by status
 * @param status - The status to filter by
 * @returns Array of feature names with the given status
 */
export function getFeaturesByStatus(status: FeatureStatus): FeatureName[] {
  return (Object.keys(FEATURES) as FeatureName[])
    .filter(feature => FEATURES[feature] === status);
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