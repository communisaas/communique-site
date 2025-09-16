import type { UserAddress } from '$lib/types/user';

export interface GeolocationData {
	source: 'browser_api' | 'manual_address' | 'ip_fallback';
	coordinates?: {
		lat: number;
		lng: number;
		accuracy: number;
	};
	address?: {
		zip: string;
		city?: string;
		state?: string;
		street?: string;
	};
	district?: {
		congressional: string;
		state_house?: string;
		state_senate?: string;
	};
	timestamp: number;
	confidence: number; // 0-1 score
}

export interface GeolocationOptions {
	enableHighAccuracy?: boolean;
	timeout?: number;
	maximumAge?: number;
	fallbackToIP?: boolean;
}

export class GeolocationService {
	private static instance: GeolocationService;

	public static getInstance(): GeolocationService {
		if (!GeolocationService.instance) {
			GeolocationService.instance = new GeolocationService();
		}
		return GeolocationService.instance;
	}

	/**
	 * Get user's location with progressive fallbacks
	 */
	async getLocation(options: GeolocationOptions = {}): Promise<GeolocationData> {
		const {
			enableHighAccuracy = true,
			timeout = 10000,
			maximumAge = 300000, // 5 minutes
			fallbackToIP = true
		} = options;

		// Try browser geolocation first (highest accuracy)
		try {
			const coords = await this.getBrowserLocation({
				enableHighAccuracy,
				timeout,
				maximumAge
			});

			return {
				source: 'browser_api',
				coordinates: coords,
				timestamp: Date.now(),
				confidence: this.calculateLocationConfidence(coords.accuracy)
			};
		} catch (error) {}

		// Fallback to IP-based location (lower accuracy)
		if (fallbackToIP) {
			try {
				const ipLocation = await this.getIPLocation();
				return {
					source: 'ip_fallback',
					address: ipLocation,
					timestamp: Date.now(),
					confidence: 0.3 // IP location is rough
				};
			} catch (error) {}
		}

		throw new Error('All geolocation methods failed');
	}

	/**
	 * Prompt user for manual address entry (high confidence)
	 */
	async requestManualAddress(): Promise<GeolocationData> {
		// This would integrate with your existing address input UI
		throw new Error('Manual address collection requires UI integration');
	}

	/**
	 * Convert coordinates to congressional district
	 * Delegates to server-side geo endpoint that uses Census Geocoding
	 */
	async coordinatesToDistrict(lat: number, lng: number): Promise<GeolocationData['district']> {
		try {
			const { api } = await import('$lib/core/api/client');
			const result = await api.get(`/api/geo/district?lat=${lat}&lng=${lng}`);

			if (!result.success) {
				throw new Error(`District lookup failed: ${result.error}`);
			}

			const data = result.data;

			return {
				congressional: data.congressional_district,
				state_house: data.state_house_district,
				state_senate: data.state_senate_district
			};
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Convert ZIP code to approximate district
	 */
	async zipToDistrict(zip: string): Promise<GeolocationData['district']> {
		try {
			const { api } = await import('$lib/core/api/client');
			const result = await api.get(`/api/geo/zip-district?zip=${zip}`);

			if (!result.success) {
				throw new Error(`ZIP district lookup failed: ${result.error}`);
			}

			const data = result.data;

			return {
				congressional: data.congressional_district
			};
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Get browser geolocation with promise wrapper
	 */
	private getBrowserLocation(options: PositionOptions): Promise<{
		lat: number;
		lng: number;
		accuracy: number;
	}> {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error('Geolocation not supported'));
				return;
			}

			navigator.geolocation.getCurrentPosition(
				(position) => {
					resolve({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
						accuracy: position.coords.accuracy
					});
				},
				(error) => {
					reject(new Error(`Geolocation error: ${error.message}`));
				},
				options
			);
		});
	}

	/**
	 * Get approximate location from IP address
	 */
	private async getIPLocation(): Promise<GeolocationData['address']> {
		try {
			// Use a service like ipapi.co or similar
			const { api } = await import('$lib/core/api/client');
			const result = await api.get('/api/geo/ip-location');

			if (!result.success) {
				throw new Error(`IP location failed: ${result.error}`);
			}

			const data = result.data;

			return {
				zip: data.postal_code,
				city: data.city,
				state: data.region_code
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Calculate confidence score based on accuracy
	 */
	private calculateLocationConfidence(accuracy: number): number {
		// GPS accuracy in meters -> confidence score
		if (accuracy <= 10) return 1.0; // Very high confidence
		if (accuracy <= 50) return 0.9; // High confidence
		if (accuracy <= 100) return 0.8; // Good confidence
		if (accuracy <= 500) return 0.6; // Medium confidence
		if (accuracy <= 1000) return 0.4; // Low confidence
		return 0.2; // Very low confidence
	}

	/**
	 * Check if location is within expected district
	 */
	async validateLocation(
		location: GeolocationData,
		expectedDistrict?: string
	): Promise<{ valid: boolean; confidence: number }> {
		if (!expectedDistrict) {
			return { valid: true, confidence: location.confidence };
		}

		try {
			let actualDistrict: string | undefined;

			if (location.coordinates) {
				const district = await this.coordinatesToDistrict(
					location.coordinates.lat,
					location.coordinates.lng
				);
				actualDistrict = district?.congressional;
			} else if (location.address?.zip) {
				const district = await this.zipToDistrict(location.address.zip);
				actualDistrict = district?.congressional;
			}

			const valid = actualDistrict === expectedDistrict;
			const confidence = valid ? location.confidence : location.confidence * 0.5;

			return { valid, confidence };
		} catch (error) {
			return { valid: false, confidence: 0 };
		}
	}

	/**
	 * Generate location fingerprint for anti-astroturf detection
	 */
	generateLocationFingerprint(location: GeolocationData): string {
		const components = [
			location.source,
			location.coordinates
				? `${location.coordinates.lat.toFixed(3)},${location.coordinates.lng.toFixed(3)}`
				: '',
			location.address?.zip || '',
			location.timestamp.toString(),
			location.confidence.toString()
		];

		// Simple hash for fingerprinting (use crypto.subtle in production)
		return btoa(components.join('|')).substring(0, 16);
	}
}

// Export singleton instance
export const geolocation = GeolocationService.getInstance();

// Export alias for backwards compatibility
export async function geolocateFromAddress(address: UserAddress): Promise<GeolocationData> {
	const geoService = GeolocationService.getInstance();

	if (address.zip) {
		const district = await geoService.zipToDistrict(address.zip);
		return {
			source: 'manual_address',
			address: {
				zip: address.zip,
				city: address.city || undefined,
				state: address.state || undefined,
				street: address.street || undefined
			},
			district,
			timestamp: Date.now(),
			confidence: 0.8 // Manual address is fairly reliable
		};
	}

	throw new Error('ZIP code required for address geolocation');
}
