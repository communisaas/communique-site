/**
 * Cicero API Proxy - SECURE SERVER-SIDE ONLY
 *
 * SECURITY CRITICAL:
 * - API key NEVER exposed to client
 * - Rate limiting protects OUR budget
 * - Caching prevents duplicate charges
 * - Circuit breakers prevent budget drain
 * - SHA-256 hashing prevents address storage
 *
 * Flow:
 * 1. Client sends lat/lng (NO API KEY)
 * 2. Server validates, rate limits, checks cache
 * 3. Server calls Cicero with API key (from env)
 * 4. Server caches result (2-year expiration)
 * 5. Server returns ONLY district data (NO API KEY)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CICERO_API_KEY } from '$env/static/private';
import { prisma } from '$lib/core/db';
import { createHash } from 'crypto';
import { rateLimiter } from '$lib/server/rate-limiter';

// ============================================================================
// Types
// ============================================================================

interface CiceroRequest {
	latitude: number;
	longitude: number;
	city: string;
	state: string;
	fingerprint?: string; // Device fingerprint for rate limiting
}

interface CityCouncilDistrict {
	district: string;
	representative: string | null;
	email: string | null;
	phone: string | null;
	office_address: string | null;
	website: string | null;
	valid_to?: string | null; // Cicero's term expiration date
}

interface CiceroResponse {
	city_council_district: CityCouncilDistrict | null;
	cached: boolean;
	cost_cents: number; // Track actual cost
}

// ============================================================================
// Budget Monitoring
// ============================================================================

/**
 * Check if we've exceeded daily/monthly budget limits
 */
async function checkBudgetLimits(): Promise<{ allowed: boolean; reason?: string }> {
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

	// Get today's spending
	const todayBudget = await prisma.ciceroBudget.findFirst({
		where: {
			date: {
				gte: todayStart
			}
		}
	});

	const todayCostCents = todayBudget?.cost_cents || 0;
	const dailyLimitCents = 2000; // $20/day

	if (todayCostCents >= dailyLimitCents) {
		console.error('[Cicero] ⛔ Daily budget limit exceeded:', {
			spent: `$${(todayCostCents / 100).toFixed(2)}`,
			limit: `$${(dailyLimitCents / 100).toFixed(2)}`
		});
		return {
			allowed: false,
			reason: 'Daily budget limit exceeded ($20/day)'
		};
	}

	// Get this month's spending
	const monthBudget = await prisma.ciceroBudget.findMany({
		where: {
			date: {
				gte: monthStart
			}
		}
	});

	const monthCostCents = monthBudget.reduce((sum, day) => sum + day.cost_cents, 0);
	const monthlyLimitCents = 50000; // $500/month

	if (monthCostCents >= monthlyLimitCents) {
		console.error('[Cicero] ⛔ Monthly budget limit exceeded:', {
			spent: `$${(monthCostCents / 100).toFixed(2)}`,
			limit: `$${(monthlyLimitCents / 100).toFixed(2)}`
		});
		return {
			allowed: false,
			reason: 'Monthly budget limit exceeded ($500/month)'
		};
	}

	console.log('[Cicero] ✓ Budget check passed:', {
		today: `$${(todayCostCents / 100).toFixed(2)}/$20`,
		month: `$${(monthCostCents / 100).toFixed(2)}/$500`
	});

	return { allowed: true };
}

/**
 * Record Cicero API call cost
 */
async function recordCost(costCents: number, cacheHit: boolean): Promise<void> {
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	// Find or create today's budget record
	const existing = await prisma.ciceroBudget.findFirst({
		where: {
			date: {
				gte: todayStart
			}
		}
	});

	if (existing) {
		// Update existing record
		await prisma.ciceroBudget.update({
			where: { id: existing.id },
			data: {
				requests: { increment: 1 },
				cost_cents: { increment: cacheHit ? 0 : costCents },
				cache_hits: { increment: cacheHit ? 1 : 0 },
				cache_misses: { increment: cacheHit ? 0 : 1 }
			}
		});
	} else {
		// Create new record
		await prisma.ciceroBudget.create({
			data: {
				date: now,
				requests: 1,
				cost_cents: cacheHit ? 0 : costCents,
				cache_hits: cacheHit ? 1 : 0,
				cache_misses: cacheHit ? 0 : 1
			}
		});
	}
}

// ============================================================================
// Caching Layer
// ============================================================================

/**
 * Generate cache key from coordinates
 *
 * SECURITY: SHA-256 hash prevents storing raw coordinates
 */
function getCacheKey(latitude: number, longitude: number): string {
	// Round to 4 decimal places (~11 meters precision)
	// This allows cache hits for nearby coordinates
	const roundedLat = Math.round(latitude * 10000) / 10000;
	const roundedLng = Math.round(longitude * 10000) / 10000;

	const normalized = `${roundedLat},${roundedLng}`;
	return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check cache for existing district data
 */
async function checkCache(
	latitude: number,
	longitude: number
): Promise<CityCouncilDistrict | null> {
	const cacheKey = getCacheKey(latitude, longitude);

	const cached = await prisma.locationCache.findUnique({
		where: {
			address_hash: cacheKey,
			expires_at: {
				gt: new Date() // Not expired
			}
		}
	});

	if (!cached) {
		console.log('[Cicero] Cache MISS:', cacheKey.substring(0, 16));
		return null;
	}

	console.log('[Cicero] Cache HIT - saved $0.04:', cacheKey.substring(0, 16));

	// Update hit count and last verified
	await prisma.locationCache.update({
		where: { id: cached.id },
		data: {
			hit_count: { increment: 1 },
			last_verified: new Date()
		}
	});

	return {
		district: cached.city_council_district || 'Unknown',
		representative: cached.city_council_member_name,
		email: cached.city_council_member_email,
		phone: cached.city_council_member_phone,
		office_address: null,
		website: null
	};
}

/**
 * Store district data in cache
 */
async function storeCache(
	latitude: number,
	longitude: number,
	district: CityCouncilDistrict,
	congressionalDistrict?: string,
	validToDate?: string // Cicero's official.valid_to or district.valid_to
): Promise<void> {
	const cacheKey = getCacheKey(latitude, longitude);

	// Calculate expiration using Cicero's valid_to date (if available)
	let expiresAt: Date;
	if (validToDate) {
		// Use Cicero's authoritative expiration date
		expiresAt = new Date(validToDate);
		console.log('[Cicero] Using Cicero valid_to date:', validToDate);
	} else {
		// Fallback: 2 years from now (typical election cycle)
		expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 2);
		console.log('[Cicero] No valid_to date, using 2-year fallback');
	}

	await prisma.locationCache.upsert({
		where: { address_hash: cacheKey },
		create: {
			address_hash: cacheKey,
			city_council_district: district.district,
			city_council_member_name: district.representative,
			city_council_member_email: district.email,
			city_council_member_phone: district.phone,
			congressional_district: congressionalDistrict || null,
			cached_at: new Date(),
			expires_at: expiresAt,
			hit_count: 0,
			api_cost_cents: 4 // $0.04
		},
		update: {
			city_council_district: district.district,
			city_council_member_name: district.representative,
			city_council_member_email: district.email,
			city_council_member_phone: district.phone,
			congressional_district: congressionalDistrict || null,
			last_verified: new Date(),
			expires_at: expiresAt
		}
	});

	const daysUntilExpiration = Math.floor(
		(expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
	);
	console.log(`[Cicero] ✓ Cached until ${expiresAt.toISOString().split('T')[0]} (${daysUntilExpiration} days)`);
}

// ============================================================================
// Rate Limiting (In-Memory + Sliding Window)
// ============================================================================

/**
 * Check rate limits (IP + device fingerprint)
 *
 * Multi-layer defense:
 * - IP-based: 10/hour (prevents spam from single IP)
 * - Device-based: 5/hour (survives IP changes, catches VPN rotation)
 *
 * PHILOSOPHY (Lean Startup):
 * - In-memory Map for now (zero cost, zero config)
 * - Migrate to Redis when scaling requires it (10+ instances)
 * - Following unicorn patterns: Stripe, Airbnb, Figma all started this way
 */
async function checkRateLimit(
	ip: string,
	fingerprint?: string
): Promise<{ allowed: boolean; reason?: string }> {
	// Check IP rate limit: 10 requests per hour
	const ipCheck = await rateLimiter.limit(`ip:${ip}`, 10, 60 * 60 * 1000);
	if (!ipCheck.success) {
		console.warn('[Cicero] IP rate limit exceeded:', {
			ip,
			limit: ipCheck.limit,
			remaining: ipCheck.remaining,
			reset: new Date(ipCheck.reset)
		});
		return {
			allowed: false,
			reason: `Rate limit exceeded (${ipCheck.limit} requests per hour). Try again in ${Math.ceil((ipCheck.reset - Date.now()) / 1000 / 60)} minutes.`
		};
	}

	// Check device fingerprint rate limit: 5 requests per hour
	if (fingerprint) {
		const deviceCheck = await rateLimiter.limit(`device:${fingerprint}`, 5, 60 * 60 * 1000);
		if (!deviceCheck.success) {
			console.warn('[Cicero] Device rate limit exceeded:', {
				fingerprint: fingerprint.substring(0, 16),
				limit: deviceCheck.limit,
				remaining: deviceCheck.remaining,
				reset: new Date(deviceCheck.reset)
			});
			return {
				allowed: false,
				reason: `Device limit exceeded (${deviceCheck.limit} requests per hour). Try again in ${Math.ceil((deviceCheck.reset - Date.now()) / 1000 / 60)} minutes.`
			};
		}

		console.log('[Cicero] ✓ Rate limit check passed:', {
			ip,
			ipRemaining: ipCheck.remaining,
			deviceRemaining: deviceCheck.remaining
		});
	} else {
		console.log('[Cicero] ✓ Rate limit check passed:', {
			ip,
			ipRemaining: ipCheck.remaining,
			deviceRemaining: 'not provided'
		});
	}

	return { allowed: true };
}

// ============================================================================
// Cicero API Client
// ============================================================================

/**
 * Call Cicero API
 *
 * SECURITY: API key from environment, NEVER exposed to client
 */
async function callCiceroAPI(
	latitude: number,
	longitude: number
): Promise<CityCouncilDistrict | null> {
	// Validate API key exists
	if (!CICERO_API_KEY) {
		console.error('[Cicero] ⛔ API key not configured');
		throw new Error('Cicero API key not configured');
	}

	// Build Cicero API URL
	const url = new URL('https://api.cicerodata.com/v3.1/legislative_district');
	url.searchParams.set('lat', latitude.toString());
	url.searchParams.set('lon', longitude.toString());
	url.searchParams.set('key', CICERO_API_KEY); // ← API KEY from .env (NEVER exposed)

	console.log('[Cicero] Calling API ($0.04):', { latitude, longitude });

	try {
		const response = await fetch(url.toString());

		if (!response.ok) {
			console.error('[Cicero] API error:', response.status, response.statusText);
			return null;
		}

		const data = await response.json();

		// Parse Cicero response
		// Cicero API structure: response.results.officials[]
		const officials = data?.response?.results?.officials || [];
		const cityCouncilOfficial = officials.find(
			(o: { office: { type: string } }) =>
				o.office?.type === 'CITY_COUNCIL' ||
				o.office?.type === 'LOCAL_EXEC'
		);

		if (!cityCouncilOfficial) {
			console.warn('[Cicero] No city council official found in response');
			return null;
		}

		// Extract valid_to date from official record (term expiration)
		const validToDate = cityCouncilOfficial.valid_to || null;

		return {
			district: cityCouncilOfficial.office?.district || 'Unknown',
			representative: cityCouncilOfficial.name || null,
			email: cityCouncilOfficial.email || null,
			phone: cityCouncilOfficial.phone || null,
			office_address: cityCouncilOfficial.address || null,
			website: cityCouncilOfficial.website || null,
			valid_to: validToDate // Cicero's authoritative expiration date
		};
	} catch (error) {
		console.error('[Cicero] API request failed:', error);
		return null;
	}
}

// ============================================================================
// Request Handler
// ============================================================================

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { latitude, longitude, city, state, fingerprint } = (await request.json()) as CiceroRequest;

		// 1. Validate inputs
		if (
			typeof latitude !== 'number' ||
			typeof longitude !== 'number' ||
			!city ||
			!state
		) {
			return json({ error: 'Invalid request parameters' }, { status: 400 });
		}

		// Validate coordinates are within US bounds
		if (
			latitude < 24.396308 || // Southern tip of Florida
			latitude > 71.538800 || // Northern Alaska
			longitude < -179.148909 || // Western Alaska
			longitude > -66.949895 // Eastern Maine
		) {
			console.warn('[Cicero] Coordinates outside US bounds:', { latitude, longitude });
			return json({ error: 'Coordinates must be within US bounds' }, { status: 400 });
		}

		// 2. Check rate limits (IP + device fingerprint)
		const ip = getClientAddress();
		const rateLimitCheck = await checkRateLimit(ip, fingerprint);

		if (!rateLimitCheck.allowed) {
			console.warn('[Cicero] Rate limit exceeded:', { ip, fingerprint: fingerprint?.substring(0, 16) });
			return json({ error: rateLimitCheck.reason }, { status: 429 });
		}

		// 3. Check budget limits (CRITICAL SECURITY)
		const budgetCheck = await checkBudgetLimits();

		if (!budgetCheck.allowed) {
			console.error('[Cicero] Budget limit exceeded - circuit breaker activated');
			return json(
				{
					error: 'Service temporarily unavailable (budget limit reached)',
					fallback: 'Try again tomorrow or contact support'
				},
				{ status: 503 }
			);
		}

		// 4. Check cache
		const cachedDistrict = await checkCache(latitude, longitude);

		if (cachedDistrict) {
			// Record cache hit (no cost)
			await recordCost(0, true);

			const response: CiceroResponse = {
				city_council_district: cachedDistrict,
				cached: true,
				cost_cents: 0
			};

			return json(response);
		}

		// 5. Cache MISS - call Cicero API
		const district = await callCiceroAPI(latitude, longitude);

		if (!district) {
			return json({ error: 'No district data available for this location' }, { status: 404 });
		}

		// 6. Store in cache (using Cicero's valid_to date)
		await storeCache(latitude, longitude, district, undefined, district.valid_to || undefined);

		// 7. Record cost ($0.04)
		await recordCost(4, false); // 4 cents

		// 8. Return district data (NEVER return API key)
		const response: CiceroResponse = {
			city_council_district: district,
			cached: false,
			cost_cents: 4
		};

		console.log('[Cicero] ✓ District found ($0.04):', district.district);

		return json(response);
	} catch (error) {
		console.error('[Cicero] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
