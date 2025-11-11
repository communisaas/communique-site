/**
 * Universal Credential Verification System - Database Helpers
 *
 * ARCHITECTURE (2025-11-09):
 * - Communique: Database storage, UI/UX, query helpers (this file)
 * - voter-protocol: ReputationAgent (Gemini 2.5 Flash), state API verification, credibility scoring
 *
 * Cost Savings: $682.50/month (Gemini 2.5 Flash FREE tier vs OpenAI GPT-4o $700/month)
 *
 * See: /Users/noot/Documents/voter-protocol/specs/REPUTATION-AGENT-SPEC.md
 * See: /Users/noot/Documents/communique/docs/UNIVERSAL-CREDIBILITY-SYSTEM.md
 */

import { db } from '$lib/core/db';
import type { UserExpertise } from '@prisma/client';

/**
 * Get all expertise records for a user
 */
export async function getUserExpertise(user_id: string): Promise<UserExpertise[]> {
	return db.userExpertise.findMany({
		where: { user_id },
		orderBy: { credential_multiplier: 'desc' }
	});
}

/**
 * Get verified experts in a domain (for congressional staffer filtering)
 */
export async function getVerifiedExpertsInDomain(
	domain: string,
	min_multiplier = 1.5
): Promise<UserExpertise[]> {
	return db.userExpertise.findMany({
		where: {
			domain,
			credential_multiplier: { gte: min_multiplier },
			is_active: true
		},
		orderBy: { credential_multiplier: 'desc' }
	});
}

/**
 * Update expertise usage signals (when user sends message, creates template, etc.)
 */
export async function trackExpertiseUsage(
	user_id: string,
	domain: string,
	action: 'message_sent' | 'template_created' | 'issue_tracked',
	metadata?: { issue_id?: string }
): Promise<void> {
	const expertise = await db.userExpertise.findUnique({
		where: { user_id_domain: { user_id, domain } }
	});

	if (!expertise) return;

	const updates: Record<string, unknown> = {
		last_used_at: new Date()
	};

	if (action === 'message_sent') {
		updates.messages_sent = { increment: 1 };
	} else if (action === 'template_created') {
		updates.templates_created = { increment: 1 };
	} else if (action === 'issue_tracked' && metadata?.issue_id) {
		// Add to issues_tracked array if not already present
		const currentIssues = expertise.issues_tracked || [];
		if (!currentIssues.includes(metadata.issue_id)) {
			updates.issues_tracked = [...currentIssues, metadata.issue_id];
		}
	}

	await db.userExpertise.update({
		where: { id: expertise.id },
		data: updates
	});
}
