import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('$lib/core/db', () => {
	const suppressedEmail = {
		findUnique: vi.fn(),
		findMany: vi.fn(),
		delete: vi.fn(),
		deleteMany: vi.fn(),
		upsert: vi.fn()
	};
	return {
		prisma: { suppressedEmail },
		db: { suppressedEmail }
	};
});

vi.mock('$lib/server/reacher-client', () => ({
	checkEmail: vi.fn(),
	checkEmailBatch: vi.fn()
}));

import { verifyEmail, verifyEmailBatch, reportBounce } from '$lib/server/email-verification';
import { prisma } from '$lib/core/db';
import { checkEmail, checkEmailBatch } from '$lib/server/reacher-client';
import type { ReacherResult } from '$lib/server/reacher-client';

const mockDb = prisma.suppressedEmail as unknown as {
	findUnique: ReturnType<typeof vi.fn>;
	findMany: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
	deleteMany: ReturnType<typeof vi.fn>;
	upsert: ReturnType<typeof vi.fn>;
};

const mockCheckEmail = checkEmail as ReturnType<typeof vi.fn>;
const mockCheckEmailBatch = checkEmailBatch as ReturnType<typeof vi.fn>;

function makeReacherResult(
	email: string,
	verdict: ReacherResult['is_reachable'] = 'safe',
	overrides?: Partial<ReacherResult['smtp']> & { accepts_mail?: boolean }
): ReacherResult {
	const domain = email.split('@')[1];
	const { accepts_mail, ...smtpOverrides } = overrides ?? {};
	return {
		input: email,
		is_reachable: verdict,
		misc: { is_disposable: false, is_role_account: false },
		mx: { accepts_mail: accepts_mail ?? true, records: [`mx.${domain}`] },
		smtp: {
			can_connect_smtp: true,
			has_full_inbox: false,
			is_catch_all: verdict === 'risky',
			is_deliverable: verdict === 'safe',
			is_disabled: false,
			...smtpOverrides
		},
		syntax: { address: email, domain, is_valid_syntax: true, username: email.split('@')[0] }
	};
}

describe('email-verification', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDb.findUnique.mockResolvedValue(null);
		mockDb.findMany.mockResolvedValue([]);
		mockDb.delete.mockResolvedValue({});
		mockDb.deleteMany.mockResolvedValue({ count: 0 });
		mockDb.upsert.mockResolvedValue({});
	});

	describe('verifyEmail', () => {
		it('short-circuits on suppressed email', async () => {
			mockDb.findUnique.mockResolvedValueOnce({
				email: 'bad@example.com',
				reason: 'smtp_invalid',
				expiresAt: new Date(Date.now() + 86400000)
			});

			const result = await verifyEmail('bad@example.com');

			expect(result.verdict).toBe('undeliverable');
			expect(result.source).toBe('suppression_list');
			expect(mockCheckEmail).not.toHaveBeenCalled();
		});

		it('re-verifies expired suppression', async () => {
			mockDb.findUnique.mockResolvedValueOnce({
				email: 'expired@example.com',
				reason: 'smtp_invalid',
				expiresAt: new Date(Date.now() - 86400000)
			});
			mockCheckEmail.mockResolvedValueOnce(makeReacherResult('expired@example.com', 'safe'));

			const result = await verifyEmail('expired@example.com');

			expect(result.verdict).toBe('deliverable');
			expect(result.source).toBe('smtp_probe');
			expect(mockDb.delete).toHaveBeenCalled();
		});

		it('returns unknown when Reacher is unavailable', async () => {
			mockCheckEmail.mockResolvedValueOnce(null);

			const result = await verifyEmail('test@example.com');

			expect(result.verdict).toBe('unknown');
			expect(result.source).toBe('degraded');
		});

		it('falls through to probe when suppression lookup fails', async () => {
			mockDb.findUnique.mockRejectedValueOnce(new Error('DB down'));
			mockCheckEmail.mockResolvedValueOnce(makeReacherResult('db-fail@example.com', 'safe'));

			const result = await verifyEmail('db-fail@example.com');

			expect(result.verdict).toBe('deliverable');
			expect(result.source).toBe('smtp_probe');
		});

		it('maps safe verdict to deliverable', async () => {
			mockCheckEmail.mockResolvedValueOnce(makeReacherResult('good@example.com', 'safe'));

			const result = await verifyEmail('good@example.com');

			expect(result.verdict).toBe('deliverable');
			expect(result.reason).toBe('smtp_deliverable');
		});

		it('maps invalid verdict to undeliverable and suppresses with correct payload', async () => {
			mockCheckEmail.mockResolvedValueOnce(makeReacherResult('dead@example.com', 'invalid'));

			const result = await verifyEmail('dead@example.com');

			expect(result.verdict).toBe('undeliverable');
			expect(mockDb.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { email: 'dead@example.com' },
					create: expect.objectContaining({
						email: 'dead@example.com',
						domain: 'example.com',
						reason: 'smtp_invalid',
						source: 'verification'
					})
				})
			);
		});

		it('maps smtp_disabled to undeliverable', async () => {
			mockCheckEmail.mockResolvedValueOnce(
				makeReacherResult('disabled@example.com', 'invalid', { is_disabled: true })
			);

			const result = await verifyEmail('disabled@example.com');

			expect(result.verdict).toBe('undeliverable');
			expect(result.reason).toBe('smtp_disabled');
		});

		it('maps full_inbox to risky (temporary condition)', async () => {
			mockCheckEmail.mockResolvedValueOnce(
				makeReacherResult('full@example.com', 'invalid', { has_full_inbox: true })
			);

			const result = await verifyEmail('full@example.com');

			expect(result.verdict).toBe('risky');
			expect(result.reason).toBe('full_inbox');
			// Should NOT suppress — temporary condition
			expect(mockDb.upsert).not.toHaveBeenCalled();
		});

		it('maps dns_no_mx to undeliverable', async () => {
			mockCheckEmail.mockResolvedValueOnce(
				makeReacherResult('nomx@example.com', 'invalid', { accepts_mail: false })
			);

			const result = await verifyEmail('nomx@example.com');

			expect(result.verdict).toBe('undeliverable');
			expect(result.reason).toBe('dns_no_mx');
		});

		it('maps risky catch-all correctly', async () => {
			mockCheckEmail.mockResolvedValueOnce(makeReacherResult('catchall@example.com', 'risky'));

			const result = await verifyEmail('catchall@example.com');

			expect(result.verdict).toBe('risky');
			expect(result.reason).toBe('catch_all');
		});

		it('maps risky non-catch-all correctly', async () => {
			mockCheckEmail.mockResolvedValueOnce(
				makeReacherResult('risky@example.com', 'risky', { is_catch_all: false })
			);

			const result = await verifyEmail('risky@example.com');

			expect(result.verdict).toBe('risky');
			expect(result.reason).toBe('risky_other');
		});

		it('maps unknown verdict correctly', async () => {
			mockCheckEmail.mockResolvedValueOnce(makeReacherResult('mystery@example.com', 'unknown'));

			const result = await verifyEmail('mystery@example.com');

			expect(result.verdict).toBe('unknown');
			expect(result.reason).toBe('smtp_inconclusive');
		});

		it('still returns result when suppression write fails', async () => {
			mockCheckEmail.mockResolvedValueOnce(makeReacherResult('bad@example.com', 'invalid'));
			mockDb.upsert.mockRejectedValueOnce(new Error('DB write failed'));

			const result = await verifyEmail('bad@example.com');

			expect(result.verdict).toBe('undeliverable');
			// Default invalid (accepts_mail: true, not disabled, not full) → smtp_invalid
			expect(result.reason).toBe('smtp_invalid');
		});
	});

	describe('verifyEmailBatch', () => {
		it('skips suppressed emails in batch probe', async () => {
			mockDb.findMany.mockResolvedValueOnce([
				{
					id: '1',
					email: 'suppressed@example.com',
					reason: 'bounce_report',
					expiresAt: new Date(Date.now() + 86400000)
				}
			]);

			mockCheckEmailBatch.mockResolvedValueOnce(
				new Map([['good@example.com', makeReacherResult('good@example.com', 'safe')]])
			);

			const results = await verifyEmailBatch(['suppressed@example.com', 'good@example.com']);

			expect(results.get('suppressed@example.com')?.verdict).toBe('undeliverable');
			expect(results.get('good@example.com')?.verdict).toBe('deliverable');
			expect(mockCheckEmailBatch).toHaveBeenCalledWith(['good@example.com']);
		});

		it('cleans expired suppressions and re-probes', async () => {
			mockDb.findMany.mockResolvedValueOnce([
				{
					id: 'exp-1',
					email: 'old@example.com',
					reason: 'smtp_invalid',
					expiresAt: new Date(Date.now() - 86400000)
				}
			]);

			mockCheckEmailBatch.mockResolvedValueOnce(
				new Map([['old@example.com', makeReacherResult('old@example.com', 'safe')]])
			);

			const results = await verifyEmailBatch(['old@example.com']);

			expect(results.get('old@example.com')?.verdict).toBe('deliverable');
			expect(mockDb.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: ['exp-1'] } }
			});
		});

		it('falls through to probe when bulk suppression check fails', async () => {
			mockDb.findMany.mockRejectedValueOnce(new Error('DB down'));
			mockCheckEmailBatch.mockResolvedValueOnce(
				new Map([['test@example.com', makeReacherResult('test@example.com', 'safe')]])
			);

			const results = await verifyEmailBatch(['test@example.com']);

			expect(results.get('test@example.com')?.verdict).toBe('deliverable');
		});

		it('returns empty map for empty input', async () => {
			const results = await verifyEmailBatch([]);
			expect(results.size).toBe(0);
		});

		it('handles Reacher unavailable in batch gracefully', async () => {
			mockCheckEmailBatch.mockResolvedValueOnce(
				new Map([['down@example.com', null]])
			);

			const results = await verifyEmailBatch(['down@example.com']);

			expect(results.get('down@example.com')?.verdict).toBe('unknown');
			expect(results.get('down@example.com')?.source).toBe('degraded');
		});
	});

	describe('reportBounce', () => {
		it('suppresses email with user_report source and 1yr TTL', async () => {
			await reportBounce('bounced@example.com', 'user-123');

			expect(mockDb.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { email: 'bounced@example.com' },
					create: expect.objectContaining({
						email: 'bounced@example.com',
						domain: 'example.com',
						reason: 'bounce_report',
						source: 'user_report',
						reportedBy: 'user-123'
					})
				})
			);

			// Verify TTL is ~365 days
			const createArg = mockDb.upsert.mock.calls[0][0].create;
			const daysDiff = Math.round((createArg.expiresAt.getTime() - Date.now()) / 86400000);
			expect(daysDiff).toBeGreaterThanOrEqual(364);
			expect(daysDiff).toBeLessThanOrEqual(366);
		});

		it('propagates DB errors to caller', async () => {
			mockDb.upsert.mockRejectedValueOnce(new Error('DB down'));

			// reportBounce throws on failure (unlike suppressEmail which swallows for graceful degradation)
			await expect(reportBounce('fail@example.com', 'user-1')).rejects.toThrow('DB down');
		});
	});
});
