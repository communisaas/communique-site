/**
 * Client-Side Location Resolution Module
 *
 * Legacy signal-based inference — retained for AddressVerificationFlow.
 * Primary location path is now the Postal Bubble (see $lib/core/bubble).
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
// Template Filtering
// ============================================================================

export {
	filterTemplatesByLocation,
	scoreTemplatesByRelevance,
	scoreByProximity,
	boostByLocalAdoption,
	boostByRecency,
	calculateDistance,
	ClientSideTemplateFilter,
	geoScopeToInferredLocation,
	inferredLocationToGeoScope,
	groupByPrecision
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

// ============================================================================
// Location Search (server-proxied Nominatim autocomplete)
// ============================================================================

export {
	searchLocations,
	searchCities,
	searchStates,
	searchCountries
} from './location-search';
export type { LocationHierarchy } from './location-search';

// ============================================================================
// State Code Maps (shared by geocoding modules)
// ============================================================================

export { getStateCode, US_STATES, CA_PROVINCES, AU_STATES } from './state-codes';
