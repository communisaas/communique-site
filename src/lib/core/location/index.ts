/**
 * Client-Side Location Resolution Module
 *
 * Privacy-preserving, VPN-resistant location inference for template discovery.
 * All location resolution happens in the browser - server NEVER knows user location.
 *
 * Public API:
 * - getUserLocation(): Get inferred location (cached or fresh)
 * - addOAuthLocationSignal(): Add signal from OAuth callback
 * - addVerifiedLocationSignal(): Add signal from identity verification
 * - trackTemplateView(): Track template engagement for behavioral inference
 * - filterTemplatesByLocation(): Client-side template filtering
 * - scoreTemplatesByRelevance(): Relevance-based template ranking
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
	LocationSignal,
	LocationSignalType,
	InferredLocation,
	TemplateWithJurisdictions,
	TemplateJurisdiction,
	JurisdictionType,
	ScoredTemplate,
	BehavioralLocationPattern,
	TemplateViewEvent,
	OAuthLocationData,
	CensusGeocodingResponse
} from './types';

export {
	SIGNAL_CONFIDENCE_WEIGHTS,
	SIGNAL_EXPIRATION,
	INDEXED_DB_STORES,
	INDEXED_DB_NAME,
	INDEXED_DB_VERSION,
	isLocationSignal,
	isInferredLocation,
	isTemplateJurisdiction,
	calculateWeightedConfidence,
	isSignalExpired,
	formatCongressionalDistrict
} from './types';

// ============================================================================
// Location Inference (Main API)
// ============================================================================

export {
	getUserLocation,
	addOAuthLocationSignal,
	addVerifiedLocationSignal,
	addBrowserGeolocationSignal,
	inferBehavioralLocation,
	clearLocationData
} from './inference-engine';

export { locationInferenceEngine, LocationInferenceEngine } from './inference-engine';

// ============================================================================
// Storage Layer
// ============================================================================

export { locationStorage, LocationStorage } from './storage';

// ============================================================================
// Behavioral Tracking
// ============================================================================

export {
	trackTemplateView,
	getBehavioralPatterns,
	behavioralTracker,
	BehavioralLocationTracker
} from './behavioral-tracker';

// ============================================================================
// Template Filtering
// ============================================================================

export {
	filterTemplatesByLocation,
	scoreTemplatesByRelevance,
	scoreByProximity,
	boostByLocalAdoption,
	boostByRecency,
	calculateDistance,
	ClientSideTemplateFilter
} from './template-filter';

// ============================================================================
// Census API
// ============================================================================

export {
	getBrowserGeolocation,
	getTimezoneLocation,
	censusAPI,
	CensusAPIClient
} from './census-api';

// ============================================================================
// Location Resolution (GeoScope utilities)
// ============================================================================

export {
	resolveToGeoScope,
	formatDisplayName,
	displayGeoScope,
	countryCodeToName,
	stateCodeToName
} from './location-resolver';
