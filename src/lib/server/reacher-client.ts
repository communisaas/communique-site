/**
 * Reacher SMTP Verification Client
 *
 * Calls self-hosted Reacher on Fly.io to probe email deliverability.
 * Returns null on ANY failure — never throws. Pipeline treats null as "unknown".
 */

export interface ReacherResult {
	input: string;
	is_reachable: 'safe' | 'invalid' | 'risky' | 'unknown';
	misc: { is_disposable: boolean; is_role_account: boolean };
	mx: { accepts_mail: boolean; records: string[] };
	smtp: { can_connect_smtp: boolean; has_full_inbox: boolean; is_catch_all: boolean; is_deliverable: boolean; is_disabled: boolean };
	syntax: { address: string; domain: string; is_valid_syntax: boolean; username: string };
}

export interface ReacherConfig {
	url: string;
	apiKey: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmail(email: string): string {
	const at = email.indexOf('@');
	if (at < 1) return '***';
	return `${email[0]}***@${email.slice(at + 1)}`;
}

function getConfig(override?: Partial<ReacherConfig>): ReacherConfig | null {
	const url = override?.url ?? process.env.REACHER_URL;
	const apiKey = override?.apiKey ?? process.env.REACHER_API_KEY;
	if (!url || !apiKey) return null;
	return { url, apiKey };
}

/**
 * Check a single email address via Reacher's SMTP probe.
 * Returns null on any failure (timeout, network, HTTP error, missing config, invalid input).
 */
export async function checkEmail(
	email: string,
	configOverride?: Partial<ReacherConfig>
): Promise<ReacherResult | null> {
	if (!EMAIL_RE.test(email)) {
		console.warn(`[reacher] Invalid email format: ${maskEmail(email)}`);
		return null;
	}

	const config = getConfig(configOverride);
	if (!config) {
		console.warn('[reacher] Missing REACHER_URL or REACHER_API_KEY');
		return null;
	}

	try {
		const res = await fetch(`${config.url}/v0/check_email`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-reacher-secret': config.apiKey
			},
			body: JSON.stringify({ to_email: email }),
			signal: AbortSignal.timeout(15_000)
		});

		if (!res.ok) {
			console.warn(`[reacher] HTTP ${res.status} for ${maskEmail(email)}`);
			return null;
		}

		return (await res.json()) as ReacherResult;
	} catch (err) {
		console.warn(`[reacher] Failed for ${maskEmail(email)}:`, err);
		return null;
	}
}

/**
 * Check multiple emails in parallel with concurrency cap and dedup.
 * Returns a Map of email -> result (null for failures).
 */
export async function checkEmailBatch(
	emails: string[],
	concurrency = 3,
	configOverride?: Partial<ReacherConfig>
): Promise<Map<string, ReacherResult | null>> {
	const unique = [...new Set(emails)];
	const results = new Map<string, ReacherResult | null>();

	for (let i = 0; i < unique.length; i += concurrency) {
		const chunk = unique.slice(i, i + concurrency);
		const settled = await Promise.all(
			chunk.map(async (email) => {
				const result = await checkEmail(email, configOverride);
				return { email, result };
			})
		);
		for (const { email, result } of settled) {
			results.set(email, result);
		}
	}

	return results;
}
