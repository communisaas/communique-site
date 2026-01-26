/**
 * OAuth Location Sync (Client-Side)
 *
 * Reads OAuth location data from cookie and adds signal to IndexedDB.
 * Called on client-side after OAuth callback completes.
 *
 * Privacy: Server stores location in cookie, client reads and stores in IndexedDB.
 * Cookie is deleted after reading to prevent tracking.
 */

import { z } from 'zod';
import { addOAuthLocationSignal } from './inference-engine';
import { censusAPI } from './census-api';
import type { OAuthLocationData } from './types';

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const OAuthLocationDataSchema = z.object({
	provider: z.string(),
	location: z.string().optional(),
	locale: z.string().optional(),
	timezone: z.string().optional()
});

// ============================================================================
// OAuth Location Sync
// ============================================================================

/**
 * Read OAuth location cookie and add signal to IndexedDB
 */
export async function syncOAuthLocation(): Promise<boolean> {
	try {
		// Check if running in browser
		if (typeof document === 'undefined') {
			return false;
		}

		// Read oauth_location cookie
		const cookie = document.cookie.split('; ').find((row) => row.startsWith('oauth_location='));

		if (!cookie) {
			return false;
		}

		// Parse and validate cookie value
		const value = cookie.split('=')[1];
		const parsed = JSON.parse(decodeURIComponent(value));
		const validationResult = OAuthLocationDataSchema.safeParse(parsed);

		if (!validationResult.success) {
			console.error('[OAuth Location Sync] Invalid location data:', validationResult.error.flatten());
			// Delete invalid cookie
			document.cookie = 'oauth_location=; path=/; max-age=0; secure; samesite=lax';
			return false;
		}

		const locationData = validationResult.data as OAuthLocationData;

		// Delete cookie after reading (privacy: one-time use)
		document.cookie = 'oauth_location=; path=/; max-age=0; secure; samesite=lax';

		console.log('[OAuth Location Sync] Processing OAuth location data:', {
			provider: locationData.provider,
			hasLocation: !!locationData.location,
			hasLocale: !!locationData.locale,
			hasTimezone: !!locationData.timezone
		});

		// Extract location from provider data
		let locationString: string | null = null;

		// Priority 1: Direct location string
		if (locationData.location) {
			locationString = locationData.location;
		}
		// Priority 2: Parse from locale (e.g., "en-US" → "US")
		else if (locationData.locale) {
			const parts = locationData.locale.split('-');
			if (parts.length === 2) {
				locationString = parts[1]; // Country code
			}
		}
		// Priority 3: Timezone inference (weak signal, but better than nothing)
		else if (locationData.timezone) {
			locationString = extractLocationFromTimezone(locationData.timezone);
		}

		if (!locationString) {
			console.warn('[OAuth Location Sync] Could not extract location from OAuth data');
			return false;
		}

		// If we have a full address, geocode it
		if (locationString.includes(',')) {
			// Address format: "Austin, TX"
			const signal = await censusAPI.geocodeAddress(locationString);
			if (signal) {
				// Signal already stored by censusAPI.geocodeAddress
				console.log('[OAuth Location Sync] Added OAuth signal via Census API');
				return true;
			}
		}

		// Otherwise, add as basic OAuth signal
		await addOAuthLocationSignal(locationData.provider, locationString);

		console.log('[OAuth Location Sync] Added OAuth location signal:', locationString);
		return true;
	} catch (error) {
		console.error('[OAuth Location Sync] Failed to sync OAuth location:', error);
		return false;
	}
}

/**
 * Extract location from timezone string
 */
function extractLocationFromTimezone(timezone: string): string | null {
	// Map common timezones to state codes
	const timezoneMap: Record<string, string> = {
		'America/New_York': 'NY',
		'America/Chicago': 'TX',
		'America/Denver': 'CO',
		'America/Los_Angeles': 'CA',
		'America/Phoenix': 'AZ',
		'America/Anchorage': 'AK',
		'Pacific/Honolulu': 'HI',
		'America/Detroit': 'MI',
		'America/Indiana/Indianapolis': 'IN',
		'America/Kentucky/Louisville': 'KY',
		'America/Kentucky/Monticello': 'KY',
		'America/North_Dakota/Center': 'ND',
		'America/North_Dakota/New_Salem': 'ND',
		'America/North_Dakota/Beulah': 'ND',
		'America/Boise': 'ID',
		'America/Nome': 'AK',
		'America/Juneau': 'AK',
		'America/Sitka': 'AK',
		'America/Metlakatla': 'AK',
		'America/Yakutat': 'AK',
		'Pacific/Guam': 'GU',
		'America/Puerto_Rico': 'PR'
	};

	return timezoneMap[timezone] || null;
}

/**
 * Check if OAuth location cookie exists
 */
export function hasOAuthLocationCookie(): boolean {
	if (typeof document === 'undefined') {
		return false;
	}

	return document.cookie.includes('oauth_location=');
}

/**
 * Initialize OAuth location sync on page load
 * Call this from root layout or app initialization
 */
export async function initOAuthLocationSync(): Promise<void> {
	// Run on next tick to ensure DOM is ready
	if (typeof window !== 'undefined') {
		window.addEventListener('load', async () => {
			await syncOAuthLocation();
		});
	}
}
