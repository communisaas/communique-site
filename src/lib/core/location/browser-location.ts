/**
 * Browser Location Utilities
 *
 * Browser geolocation and timezone-based location inference.
 */

import type { LocationSignal } from './types';

// ============================================================================
// Browser Geolocation Utilities
// ============================================================================

/**
 * Get browser geolocation (requires user permission)
 */
export async function getBrowserGeolocation(): Promise<LocationSignal | null> {
	// Check if geolocation is supported
	if (!navigator.geolocation) {
		console.warn('Geolocation API not supported');
		return null;
	}

	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords;

				// Return minimal signal with coordinates only.
				// District resolution happens server-side via /api/location/resolve
				// (Shadow Atlas for districts/officials).
				resolve({
					signal_type: 'browser',
					confidence: 0.6,
					country_code: 'US',
					congressional_district: null,
					state_code: null,
					city_name: null,
					county_fips: null,
					latitude,
					longitude,
					source: 'browser.geolocation',
					timestamp: new Date().toISOString()
				});
			},
			(error) => {
				console.warn('Geolocation permission denied or unavailable:', error.message);
				resolve(null);
			},
			{
				enableHighAccuracy: true,
				timeout: 30000, // 30 seconds for geolocation
				maximumAge: 0
			}
		);
	});
}

/**
 * Get timezone-based location inference (country-level only).
 *
 * Design principle: timezone → country is reliable (IANA zone names are
 * geographically scoped). Timezone → state is NOT (US Eastern covers 20+
 * states, Canada and US share America/* prefix). We intentionally do NOT
 * infer state/province from timezone — that's what IP lookup and user
 * selection are for.
 *
 * The map below covers IANA reference cities for countries we actively
 * support. Unknown zones return null. This scales globally by adding
 * one line per IANA city, not per state×timezone.
 */
export function getTimezoneLocation(): LocationSignal | null {
	try {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		console.debug(`[Location] Detected timezone: ${timezone}`);

		// IANA reference city → ISO 3166-1 alpha-2 country code
		// One entry per city. No state inference — country only.
		const tzToCountry: Record<string, string> = {
			// North America
			'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
			'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
			'America/Boise': 'US', 'America/Detroit': 'US', 'America/Juneau': 'US',
			'America/Nome': 'US', 'America/Sitka': 'US', 'America/Yakutat': 'US',
			'America/Metlakatla': 'US', 'America/Adak': 'US', 'America/Menominee': 'US',
			'America/Indiana/Indianapolis': 'US', 'America/Indiana/Knox': 'US',
			'America/Indiana/Marengo': 'US', 'America/Indiana/Petersburg': 'US',
			'America/Indiana/Tell_City': 'US', 'America/Indiana/Vevay': 'US',
			'America/Indiana/Vincennes': 'US', 'America/Indiana/Winamac': 'US',
			'America/Kentucky/Louisville': 'US', 'America/Kentucky/Monticello': 'US',
			'America/North_Dakota/Beulah': 'US', 'America/North_Dakota/Center': 'US',
			'America/North_Dakota/New_Salem': 'US',
			'Pacific/Honolulu': 'US', 'America/Puerto_Rico': 'US', 'America/Virgin': 'US',
			'Pacific/Guam': 'US', 'Pacific/Saipan': 'US',
			'America/Toronto': 'CA', 'America/Montreal': 'CA', 'America/Vancouver': 'CA',
			'America/Winnipeg': 'CA', 'America/Edmonton': 'CA', 'America/Halifax': 'CA',
			'America/St_Johns': 'CA', 'America/Regina': 'CA', 'America/Iqaluit': 'CA',
			'America/Whitehorse': 'CA', 'America/Dawson': 'CA', 'America/Moncton': 'CA',
			'America/Yellowknife': 'CA',
			'America/Mexico_City': 'MX', 'America/Tijuana': 'MX', 'America/Hermosillo': 'MX',
			'America/Mazatlan': 'MX', 'America/Matamoros': 'MX', 'America/Ojinaga': 'MX',
			// Caribbean & Central America
			'America/Nassau': 'BS', 'America/Panama': 'PA',
			'America/Jamaica': 'JM', 'America/Barbados': 'BB',
			// Oceania
			'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
			'Australia/Adelaide': 'AU', 'Australia/Perth': 'AU', 'Australia/Hobart': 'AU',
			'Australia/Darwin': 'AU', 'Australia/Canberra': 'AU',
			'Pacific/Auckland': 'NZ', 'Pacific/Chatham': 'NZ',
			// Europe
			'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR',
			'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
			'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH',
			'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
			'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL',
			'Europe/Prague': 'CZ', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR',
			'Europe/Bucharest': 'RO', 'Europe/Budapest': 'HU',
			// Asia
			'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
			'Asia/Hong_Kong': 'HK', 'Asia/Singapore': 'SG', 'Asia/Kolkata': 'IN',
			'Asia/Dubai': 'AE', 'Asia/Jerusalem': 'IL', 'Asia/Bangkok': 'TH',
			'Asia/Jakarta': 'ID', 'Asia/Taipei': 'TW', 'Asia/Manila': 'PH',
			// South America
			'America/Sao_Paulo': 'BR', 'America/Buenos_Aires': 'AR',
			'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE',
			// Africa
			'Africa/Lagos': 'NG', 'Africa/Cairo': 'EG', 'Africa/Johannesburg': 'ZA',
			'Africa/Nairobi': 'KE', 'Africa/Casablanca': 'MA'
		};

		const countryCode = tzToCountry[timezone];

		if (!countryCode) {
			console.debug(`[Location] No country mapping for timezone: ${timezone}`);
			return null;
		}

		return {
			signal_type: 'ip',
			confidence: 0.15, // Very low — country-level hint only
			country_code: countryCode,
			state_code: null, // Intentionally null: timezone cannot reliably infer state
			city_name: null,
			congressional_district: null,
			county_fips: null,
			latitude: null,
			longitude: null,
			source: 'browser.timezone',
			timestamp: new Date().toISOString(),
			metadata: {
				timezone
			}
		};
	} catch (error) {
		console.error('Failed to extract timezone location:', error);
		return null;
	}
}
