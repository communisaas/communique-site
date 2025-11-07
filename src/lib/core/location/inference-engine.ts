/**
 * Location Inference Engine
 *
 * VPN-resistant 5-signal progressive inference system.
 * Combines multiple signals to infer user location with confidence scoring.
 *
 * Signal Priority (weakest to strongest):
 * 1. IP Geolocation (0.2 confidence) - VPN-vulnerable
 * 2. Browser API (0.6 confidence) - User can deny
 * 3. OAuth Profile (0.8 confidence) - Verified with provider
 * 4. Behavioral Patterns (0.9 confidence) - Revealed preference
 * 5. Identity Verification (1.0 confidence) - Cryptographic proof
 *
 * Architecture:
 * - All inference happens client-side (browser)
 * - Server NEVER receives user location data
 * - Location revealed only when user submits template to congress
 */

import { locationStorage } from './storage';
import { getBrowserGeolocation, getTimezoneLocation } from './census-api';
import { behavioralTracker } from './behavioral-tracker';
import {
	calculateWeightedConfidence,
	type LocationSignal,
	type InferredLocation,
	SIGNAL_CONFIDENCE_WEIGHTS
} from './types';

// ============================================================================
// Location Inference Engine
// ============================================================================

/**
 * LocationInferenceEngine: Combine 5 signals to infer location
 */
export class LocationInferenceEngine {
	private inferencePromise: Promise<InferredLocation> | null = null;

	/**
	 * Infer location from all available signals
	 */
	async inferLocation(forceRefresh = false): Promise<InferredLocation> {
		// Return cached inference if available and not forcing refresh
		if (!forceRefresh) {
			const cached = await locationStorage.getInferredLocation();
			if (cached) {
				// Check if cached location is recent (< 1 hour)
				const inferredTime = new Date(cached.inferred_at).getTime();
				const now = Date.now();
				const oneHour = 60 * 60 * 1000;

				if (now - inferredTime < oneHour) {
					return cached;
				}
			}
		}

		// Prevent concurrent inference
		if (this.inferencePromise) {
			return this.inferencePromise;
		}

		// Start new inference
		this.inferencePromise = this.performInference();

		try {
			const result = await this.inferencePromise;
			return result;
		} finally {
			this.inferencePromise = null;
		}
	}

	/**
	 * Perform location inference
	 */
	private async performInference(): Promise<InferredLocation> {
		// Step 1: Clean up expired signals
		await locationStorage.clearExpiredSignals();

		// Step 2: Collect all available signals
		const signals = await locationStorage.getSignals();

		// Step 3: Attempt to generate new signals if none exist
		if (signals.length === 0) {
			await this.generateInitialSignals();
			const newSignals = await locationStorage.getSignals();
			signals.push(...newSignals);
		}

		// Step 4: Sort signals by confidence (highest first)
		const sortedSignals = signals.sort((a, b) => {
			const aWeight = SIGNAL_CONFIDENCE_WEIGHTS[a.signal_type] * a.confidence;
			const bWeight = SIGNAL_CONFIDENCE_WEIGHTS[b.signal_type] * b.confidence;
			return bWeight - aWeight;
		});

		// Step 5: Extract location from highest confidence signal
		const location = this.extractLocationFromSignals(sortedSignals);

		// Step 6: Cache inferred location
		await locationStorage.storeInferredLocation(location);

		return location;
	}

	/**
	 * Generate initial signals (IP, browser, timezone)
	 */
	private async generateInitialSignals(): Promise<void> {
		console.log('[LocationInference] Generating initial signals...');

		// Signal 1: IP-based geolocation (automatic, no permission required)
		try {
			const ipSignal = await this.getIPLocationSignal();
			if (ipSignal) {
				console.log('[LocationInference] ✓ IP signal generated:', ipSignal);
				await locationStorage.storeSignal(ipSignal);
			} else {
				console.warn('[LocationInference] ✗ IP signal failed');
			}
		} catch (error) {
			console.error('[LocationInference] ✗ IP signal error:', error);
		}

		// Signal 2: Timezone-based inference (fallback if IP fails)
		try {
			const timezoneSignal = getTimezoneLocation();
			if (timezoneSignal) {
				console.log('[LocationInference] ✓ Timezone signal generated:', timezoneSignal);
				await locationStorage.storeSignal(timezoneSignal);
			} else {
				console.warn('[LocationInference] ✗ Timezone signal failed - timezone not recognized');
			}
		} catch (error) {
			console.error('[LocationInference] ✗ Timezone signal error:', error);
		}

		// Signal 3: Browser geolocation (requires permission - don't request automatically)
		// This will be triggered manually by user clicking "Update" button
		console.log('[LocationInference] Browser geolocation available but not requested (requires user permission)');
	}

	/**
	 * Get location signal from IP address (via server-side lookup)
	 */
	private async getIPLocationSignal(): Promise<LocationSignal | null> {
		try {
			const response = await fetch('/api/location/ip-lookup');
			if (!response.ok) {
				console.error('[IP Lookup] Server error:', response.status);
				return null;
			}

			const data = (await response.json()) as {
				city?: string;
				state_code?: string;
				latitude?: number;
				longitude?: number;
				timezone?: string;
			};

			if (!data.state_code) {
				console.warn('[IP Lookup] No state code in response');
				return null;
			}

			// If we have coordinates, use Census API to get congressional district
			if (data.latitude && data.longitude) {
				console.log('[IP Lookup] Got coordinates, fetching congressional district...');

				// Import Census API client
				const { censusAPI } = await import('./census-api');
				const censusSignal = await censusAPI.geocodeCoordinates(data.latitude, data.longitude);

				if (censusSignal) {
					// Upgrade to IP signal (override the 'browser' type from Census API)
					return {
						...censusSignal,
						signal_type: 'ip',
						source: 'ip.geolocation',
						confidence: 0.4, // Higher than timezone, lower than browser geolocation
						metadata: {
							...censusSignal.metadata,
							city: data.city,
							timezone: data.timezone
						}
					};
				}
			}

			// Fallback: Return state-only signal without congressional district
			return {
				signal_type: 'ip',
				confidence: 0.3, // State-only is less confident
				state_code: data.state_code,
				city_name: data.city || null,
				congressional_district: null,
				latitude: data.latitude || null,
				longitude: data.longitude || null,
				source: 'ip.geolocation',
				timestamp: new Date().toISOString(),
				metadata: {
					timezone: data.timezone
				}
			};
		} catch (error) {
			console.error('[IP Lookup] Failed:', error);
			return null;
		}
	}

	/**
	 * Extract location from sorted signals
	 */
	private extractLocationFromSignals(signals: LocationSignal[]): InferredLocation {
		if (signals.length === 0) {
			return {
				congressional_district: null,
				state_code: null,
				city_name: null,
				county_fips: null,
				confidence: 0,
				signals: [],
				inferred_at: new Date().toISOString()
			};
		}

		// Use highest confidence signal for location
		const primarySignal = signals[0];

		// Calculate weighted confidence from all signals
		const confidence = calculateWeightedConfidence(signals);

		return {
			congressional_district: primarySignal.congressional_district || null,
			state_code: primarySignal.state_code || null,
			city_name: primarySignal.city_name || null,
			county_fips: primarySignal.county_fips || null,
			confidence,
			signals,
			inferred_at: new Date().toISOString()
		};
	}

	/**
	 * Add a new location signal (replaces existing signals from same source)
	 */
	async addSignal(signal: LocationSignal): Promise<void> {
		// Remove any existing signals from the same source to avoid duplicates
		const existingSignals = await locationStorage.getSignals();
		const signalsToKeep = existingSignals.filter(s => s.source !== signal.source);

		// Clear all signals and re-add only the ones we want to keep
		await locationStorage.clearAll();
		for (const s of signalsToKeep) {
			await locationStorage.storeSignal(s);
		}

		// Add the new signal
		await locationStorage.storeSignal(signal);

		// Re-infer location with new signal
		await this.inferLocation(true);
	}

	/**
	 * Prune stale signals
	 */
	async pruneStaleSignals(): Promise<number> {
		return locationStorage.clearExpiredSignals();
	}

	/**
	 * Clear all location data
	 */
	async clearAll(): Promise<void> {
		await locationStorage.clearAll();
	}

	/**
	 * Export location data (for debugging)
	 */
	async export(): Promise<{
		inferred: InferredLocation | null;
		signals: LocationSignal[];
	}> {
		const [inferred, signals] = await Promise.all([
			locationStorage.getInferredLocation(),
			locationStorage.getSignals()
		]);

		return {
			inferred,
			signals
		};
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance for location inference
 */
export const locationInferenceEngine = new LocationInferenceEngine();

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Get user's inferred location (cached or fresh)
 */
export async function getUserLocation(forceRefresh = false): Promise<InferredLocation> {
	return locationInferenceEngine.inferLocation(forceRefresh);
}

/**
 * Add a location signal from OAuth callback
 */
export async function addOAuthLocationSignal(
	provider: string,
	location: string
): Promise<void> {
	// Parse location string (e.g., "Austin, TX" or "Texas")
	const parts = location.split(',').map((s) => s.trim());

	let cityName: string | null = null;
	let stateCode: string | null = null;

	if (parts.length === 2) {
		cityName = parts[0];
		stateCode = parts[1];
	} else if (parts.length === 1) {
		// Could be state or city
		const part = parts[0];
		if (part.length === 2) {
			stateCode = part.toUpperCase();
		} else {
			// Try to parse as state name
			stateCode = parseStateName(part);
		}
	}

	if (!stateCode && !cityName) {
		console.warn('Could not parse OAuth location:', location);
		return;
	}

	const signal: LocationSignal = {
		signal_type: 'oauth',
		confidence: 0.8,
		state_code: stateCode,
		city_name: cityName,
		congressional_district: null, // Will be resolved via Census API if coordinates available
		source: `oauth.${provider}`,
		timestamp: new Date().toISOString(),
		metadata: {
			raw_location: location
		}
	};

	await locationInferenceEngine.addSignal(signal);
}

/**
 * Add a verified location signal from identity verification
 */
export async function addVerifiedLocationSignal(
	congressionalDistrict: string,
	stateCode: string
): Promise<void> {
	const signal: LocationSignal = {
		signal_type: 'verified',
		confidence: 1.0,
		congressional_district: congressionalDistrict,
		state_code: stateCode,
		source: 'verification.identity',
		timestamp: new Date().toISOString()
	};

	await locationInferenceEngine.addSignal(signal);
}

/**
 * Add browser geolocation signal
 */
export async function addBrowserGeolocationSignal(): Promise<LocationSignal | null> {
	const signal = await getBrowserGeolocation();
	if (signal) {
		await locationInferenceEngine.addSignal(signal);
	}
	return signal;
}

/**
 * Trigger behavioral location inference
 */
export async function inferBehavioralLocation(): Promise<LocationSignal | null> {
	return behavioralTracker.inferFromBehavior();
}

/**
 * Clear all location data
 */
export async function clearLocationData(): Promise<void> {
	await locationInferenceEngine.clearAll();
}

// ============================================================================
// State Name Parsing
// ============================================================================

/**
 * Parse state name to state code
 */
function parseStateName(name: string): string | null {
	const stateNames: Record<string, string> = {
		alabama: 'AL',
		alaska: 'AK',
		arizona: 'AZ',
		arkansas: 'AR',
		california: 'CA',
		colorado: 'CO',
		connecticut: 'CT',
		delaware: 'DE',
		florida: 'FL',
		georgia: 'GA',
		hawaii: 'HI',
		idaho: 'ID',
		illinois: 'IL',
		indiana: 'IN',
		iowa: 'IA',
		kansas: 'KS',
		kentucky: 'KY',
		louisiana: 'LA',
		maine: 'ME',
		maryland: 'MD',
		massachusetts: 'MA',
		michigan: 'MI',
		minnesota: 'MN',
		mississippi: 'MS',
		missouri: 'MO',
		montana: 'MT',
		nebraska: 'NE',
		nevada: 'NV',
		'new hampshire': 'NH',
		'new jersey': 'NJ',
		'new mexico': 'NM',
		'new york': 'NY',
		'north carolina': 'NC',
		'north dakota': 'ND',
		ohio: 'OH',
		oklahoma: 'OK',
		oregon: 'OR',
		pennsylvania: 'PA',
		'rhode island': 'RI',
		'south carolina': 'SC',
		'south dakota': 'SD',
		tennessee: 'TN',
		texas: 'TX',
		utah: 'UT',
		vermont: 'VT',
		virginia: 'VA',
		washington: 'WA',
		'west virginia': 'WV',
		wisconsin: 'WI',
		wyoming: 'WY',
		'district of columbia': 'DC'
	};

	return stateNames[name.toLowerCase()] || null;
}
