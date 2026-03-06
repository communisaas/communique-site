/**
 * Email Verification Service
 *
 * Orchestrates suppression-list checks and Reacher SMTP probes.
 * Flow per email: suppression check -> SMTP probe -> verdict mapping -> suppress if invalid.
 * Graceful degradation: if Reacher is unavailable, all emails pass as "unknown".
 */

import { prisma } from '$lib/core/db';
import { checkEmail, checkEmailBatch, type ReacherResult } from '$lib/server/reacher-client';

export type EmailVerdict = 'deliverable' | 'undeliverable' | 'risky' | 'unknown';

export interface VerificationResult {
	email: string;
	verdict: EmailVerdict;
	reason: string;
	source: 'suppression_list' | 'dns' | 'smtp_probe' | 'degraded';
	reacherData?: ReacherResult;
}

const SUPPRESSION_TTL_VERIFICATION_DAYS = 180; // 6 months
const SUPPRESSION_TTL_USER_REPORT_DAYS = 365; // 1 year
const MAX_BATCH_SIZE = 50;

function mapVerdict(reacher: ReacherResult): { verdict: EmailVerdict; reason: string } {
	switch (reacher.is_reachable) {
		case 'safe':
			return { verdict: 'deliverable', reason: 'smtp_deliverable' };
		case 'invalid':
			if (reacher.smtp.is_disabled) return { verdict: 'undeliverable', reason: 'smtp_disabled' };
			if (reacher.smtp.has_full_inbox) return { verdict: 'risky', reason: 'full_inbox' };
			if (!reacher.mx.accepts_mail) return { verdict: 'undeliverable', reason: 'dns_no_mx' };
			return { verdict: 'undeliverable', reason: 'smtp_invalid' };
		case 'risky':
			return { verdict: 'risky', reason: reacher.smtp.is_catch_all ? 'catch_all' : 'risky_other' };
		case 'unknown':
			return { verdict: 'unknown', reason: 'smtp_inconclusive' };
		default:
			return { verdict: 'unknown', reason: 'unrecognized_verdict' };
	}
}

function suppressionExpiry(source: 'verification' | 'user_report'): Date {
	const days = source === 'user_report' ? SUPPRESSION_TTL_USER_REPORT_DAYS : SUPPRESSION_TTL_VERIFICATION_DAYS;
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d;
}

function maskEmail(email: string): string {
	const at = email.indexOf('@');
	if (at < 1) return '***';
	return `${email[0]}***@${email.slice(at + 1)}`;
}

async function suppressEmail(email: string, reason: string, source: 'verification' | 'user_report', reacherData?: ReacherResult, reportedBy?: string): Promise<void> {
	const at = email.indexOf('@');
	const domain = at > 0 ? email.slice(at + 1).toLowerCase() : '';
	try {
		await prisma.suppressedEmail.upsert({
			where: { email },
			create: {
				email,
				domain,
				reason,
				source,
				reportedBy: reportedBy ?? null,
				reacherData: reacherData ? (JSON.parse(JSON.stringify(reacherData)) as object) : undefined,
				expiresAt: suppressionExpiry(source)
			},
			update: {
				reason,
				source,
				reportedBy: reportedBy ?? null,
				reacherData: reacherData ? (JSON.parse(JSON.stringify(reacherData)) as object) : undefined,
				expiresAt: suppressionExpiry(source)
			}
		});
	} catch (err) {
		console.warn(`[email-verification] Failed to suppress ${maskEmail(email)}:`, err);
	}
}

/**
 * Verify a single email address.
 */
export async function verifyEmail(email: string): Promise<VerificationResult> {
	// 1. Suppression check
	try {
		const suppressed = await prisma.suppressedEmail.findUnique({ where: { email } });
		if (suppressed) {
			if (suppressed.expiresAt > new Date()) {
				return { email, verdict: 'undeliverable', reason: suppressed.reason, source: 'suppression_list' };
			}
			// Expired — clean up and re-verify
			await prisma.suppressedEmail.delete({ where: { email } }).catch(() => {});
		}
	} catch (err) {
		console.warn(`[email-verification] Suppression lookup failed for ${maskEmail(email)}:`, err);
	}

	// 2. SMTP probe
	const result = await checkEmail(email);
	if (!result) {
		return { email, verdict: 'unknown', reason: 'reacher_unavailable', source: 'degraded' };
	}

	// 3. Map verdict
	const { verdict, reason } = mapVerdict(result);

	// 4. Suppress if undeliverable — awaited to stay within ALS scope on Workers
	if (verdict === 'undeliverable') {
		await suppressEmail(email, reason, 'verification', result);
	}

	return { email, verdict, reason, source: 'smtp_probe', reacherData: result };
}

/**
 * Verify a batch of emails. Bulk suppression check first, then only probe unsuppressed.
 * Capped at MAX_BATCH_SIZE to prevent Worker timeout.
 */
export async function verifyEmailBatch(emails: string[]): Promise<Map<string, VerificationResult>> {
	const results = new Map<string, VerificationResult>();
	if (emails.length === 0) return results;

	const unique = [...new Set(emails)].slice(0, MAX_BATCH_SIZE);
	const toProbe: string[] = [];

	// 1. Bulk suppression check
	try {
		const suppressed = await prisma.suppressedEmail.findMany({
			where: { email: { in: unique } }
		});

		const now = new Date();
		const expiredIds: string[] = [];

		for (const s of suppressed) {
			if (s.expiresAt > now) {
				results.set(s.email, { email: s.email, verdict: 'undeliverable', reason: s.reason, source: 'suppression_list' });
			} else {
				expiredIds.push(s.id);
			}
		}

		// Clean expired entries — awaited to stay within ALS scope
		if (expiredIds.length > 0) {
			await prisma.suppressedEmail.deleteMany({ where: { id: { in: expiredIds } } }).catch(() => {});
		}
	} catch (err) {
		console.warn('[email-verification] Bulk suppression check failed:', err);
	}

	// Collect unsuppressed emails for probing
	for (const email of unique) {
		if (!results.has(email)) toProbe.push(email);
	}

	// 2. SMTP probe unsuppressed emails
	if (toProbe.length > 0) {
		const probeResults = await checkEmailBatch(toProbe);

		for (const email of toProbe) {
			const reacher = probeResults.get(email);
			if (!reacher) {
				results.set(email, { email, verdict: 'unknown', reason: 'reacher_unavailable', source: 'degraded' });
				continue;
			}

			const { verdict, reason } = mapVerdict(reacher);

			// Awaited to stay within ALS scope on Workers
			if (verdict === 'undeliverable') {
				await suppressEmail(email, reason, 'verification', reacher);
			}

			results.set(email, { email, verdict, reason, source: 'smtp_probe', reacherData: reacher });
		}
	}

	return results;
}

/**
 * Report a bounce from a user. Suppresses the email for 1 year.
 * Unlike suppressEmail (which swallows errors for graceful degradation in the
 * verification pipeline), this throws on DB failure so the endpoint can return 500.
 */
export async function reportBounce(email: string, reportedBy: string): Promise<void> {
	const at = email.indexOf('@');
	const domain = at > 0 ? email.slice(at + 1).toLowerCase() : '';
	await prisma.suppressedEmail.upsert({
		where: { email },
		create: {
			email,
			domain,
			reason: 'bounce_report',
			source: 'user_report',
			reportedBy,
			expiresAt: suppressionExpiry('user_report')
		},
		update: {
			reason: 'bounce_report',
			source: 'user_report',
			reportedBy,
			expiresAt: suppressionExpiry('user_report')
		}
	});
}
