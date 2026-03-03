/**
 * Rejection Rate Monitor — P1 #18
 *
 * Tracks rejection rates for debate/position/submission endpoints.
 * KV-based counters with hourly buckets. Webhook alert when threshold exceeded.
 *
 * Designed for Cloudflare Workers — uses KV namespace for persistence,
 * waitUntil() for async tracking, zero impact on response latency.
 */

type KVNamespace = {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

/** Route groups to monitor */
const MONITORED_ROUTES: Array<{ prefix: string; group: string }> = [
	{ prefix: '/api/debates/', group: 'debates' },
	{ prefix: '/api/positions/', group: 'positions' },
	{ prefix: '/api/submissions/', group: 'submissions' }
];

/** Status codes that count as rejections (not server errors from our infra) */
function isRejection(status: number): boolean {
	// 400-499: client/validation rejections
	// 502: on-chain/upstream failures (proof rejected, CWC failed)
	// Exclude 401 (auth), 429 (rate limit) — those are expected and tracked elsewhere
	return (status >= 400 && status <= 499 && status !== 401 && status !== 429) || status === 502;
}

/** UTC hour bucket key: "2026-03-03T11" */
function hourBucket(): string {
	return new Date().toISOString().slice(0, 13);
}

/**
 * Increment a KV counter atomically-ish.
 * KV doesn't support atomic increment — read-modify-write with 2h TTL.
 * Race conditions are acceptable for monitoring (off by a few counts is fine).
 */
async function incrementCounter(kv: KVNamespace, key: string): Promise<number> {
	const current = parseInt((await kv.get(key)) ?? '0', 10);
	const next = current + 1;
	await kv.put(key, String(next), { expirationTtl: 7200 }); // 2h TTL
	return next;
}

/**
 * Check rejection rate and fire webhook if threshold exceeded.
 */
async function checkThreshold(params: {
	kv: KVNamespace;
	group: string;
	hour: string;
	rejections: number;
	webhookUrl: string | undefined;
	thresholdPercent: number;
}): Promise<void> {
	const { kv, group, hour, rejections, webhookUrl, thresholdPercent } = params;

	// Get total requests for this group/hour
	const totalKey = `tot:${group}:${hour}`;
	const total = parseInt((await kv.get(totalKey)) ?? '0', 10);

	if (total < 10) return; // Not enough data to compute meaningful rate

	const rate = (rejections / total) * 100;
	if (rate <= thresholdPercent) return;

	// Check if we already alerted for this hour (debounce)
	const alertKey = `alert:${group}:${hour}`;
	const alerted = await kv.get(alertKey);
	if (alerted) return;

	// Mark as alerted
	await kv.put(alertKey, '1', { expirationTtl: 7200 });

	// Fire webhook
	if (!webhookUrl) {
		console.error(
			`[RejectionMonitor] ALERT: ${group} rejection rate ${rate.toFixed(1)}% (${rejections}/${total}) in ${hour}. No webhook configured.`
		);
		return;
	}

	try {
		await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				alert: 'rejection_rate_exceeded',
				group,
				hour,
				rejections,
				total,
				rate: parseFloat(rate.toFixed(2)),
				threshold: thresholdPercent,
				ts: new Date().toISOString()
			})
		});
		console.warn(
			`[RejectionMonitor] Webhook fired: ${group} ${rate.toFixed(1)}% (${rejections}/${total})`
		);
	} catch (err) {
		console.error('[RejectionMonitor] Webhook failed:', err);
	}
}

/**
 * Track a request/response for rejection monitoring.
 * Call this from hooks.server.ts via waitUntil() — fire-and-forget.
 */
export async function trackForRejection(params: {
	pathname: string;
	status: number;
	kv: KVNamespace | undefined;
	webhookUrl?: string;
	thresholdPercent?: number;
}): Promise<void> {
	const { pathname, status, kv, webhookUrl, thresholdPercent = 1 } = params;

	if (!kv) return;

	// Find matching route group
	const match = MONITORED_ROUTES.find((r) => pathname.startsWith(r.prefix));
	if (!match) return;

	const hour = hourBucket();
	const group = match.group;

	// Always increment total
	const totalKey = `tot:${group}:${hour}`;
	await incrementCounter(kv, totalKey);

	// If rejection, increment rejection counter and check threshold
	if (isRejection(status)) {
		const rejKey = `rej:${group}:${hour}`;
		const rejections = await incrementCounter(kv, rejKey);

		// Also track by status code for diagnostics
		const codeKey = `rej:${group}:${status}:${hour}`;
		await incrementCounter(kv, codeKey);

		// Log every rejection for observability
		console.warn(
			`[RejectionMonitor] ${group} rejection: ${status} on ${pathname}`
		);

		// Check threshold
		await checkThreshold({
			kv,
			group,
			hour,
			rejections,
			webhookUrl,
			thresholdPercent
		});
	}
}
