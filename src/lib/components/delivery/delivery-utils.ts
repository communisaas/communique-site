/**
 * Delivery Feedback Utilities
 * Helper functions for CWC submission feedback experience
 *
 * Based on: docs/temp/CWC-FEEDBACK-REDESIGN.md
 */

import type { DeliveryResult, DeliverySummary, OfficeOutcome } from './delivery-types';

// ============================================================================
// Summary Computation
// ============================================================================

/**
 * Compute a delivery summary from results
 */
export function computeSummary(results: DeliveryResult[]): DeliverySummary {
	return {
		total: results.length,
		delivered: results.filter((r) => r.outcome === 'delivered').length,
		failed: results.filter((r) => r.outcome === 'failed').length,
		unavailable: results.filter((r) => r.outcome === 'unavailable').length
	};
}

// ============================================================================
// Grouping & Sorting
// ============================================================================

/**
 * Group results by chamber (Senate first, then House)
 */
export function groupByChamber(results: DeliveryResult[]): {
	senate: DeliveryResult[];
	house: DeliveryResult[];
} {
	return {
		senate: results.filter((r) => r.chamber === 'senate'),
		house: results.filter((r) => r.chamber === 'house')
	};
}

/**
 * Sort results by outcome (delivered first, then failed, then unavailable)
 */
export function sortByOutcome(results: DeliveryResult[]): DeliveryResult[] {
	const order: Record<OfficeOutcome, number> = {
		delivered: 0,
		failed: 1,
		unavailable: 2
	};
	return [...results].sort((a, b) => order[a.outcome] - order[b.outcome]);
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format office name for display
 * e.g., "Sen. Adam Schiff" or "Rep. John Smith"
 */
export function formatOfficeName(result: DeliveryResult): string {
	return result.office;
}

/**
 * Format chamber name for display
 */
export function formatChamber(chamber: 'senate' | 'house'): string {
	return chamber === 'senate' ? 'Senate' : 'House';
}

/**
 * Format state and district for display
 * e.g., "CA-11" for House, "CA" for Senate
 */
export function formatLocation(result: DeliveryResult): string {
	if (result.chamber === 'house' && result.district) {
		return `${result.state}-${result.district}`;
	}
	return result.state;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(isoTimestamp: string): string {
	const date = new Date(isoTimestamp);
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

/**
 * Format confirmation ID for display (truncated with copy option)
 */
export function formatConfirmationId(id: string): string {
	if (id.length <= 12) return id;
	return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

// ============================================================================
// Outcome Messaging
// ============================================================================

/**
 * Get user-friendly message for an outcome
 */
export function getOutcomeMessage(result: DeliveryResult): string {
	switch (result.outcome) {
		case 'delivered':
			return 'Message delivered successfully';
		case 'failed':
			return result.error || 'Delivery failed - you can try again';
		case 'unavailable':
			return `${result.office} is not currently accepting messages through this system`;
	}
}

/**
 * Get short status label for an outcome
 */
export function getOutcomeLabel(outcome: OfficeOutcome): string {
	switch (outcome) {
		case 'delivered':
			return 'Delivered';
		case 'failed':
			return 'Failed';
		case 'unavailable':
			return 'Unavailable';
	}
}

// ============================================================================
// Receipt Generation
// ============================================================================

/**
 * Generate shareable receipt text
 */
export function generateReceiptText(
	submissionId: string,
	results: DeliveryResult[],
	templateTitle?: string,
	timestamp?: Date
): string {
	const summary = computeSummary(results);
	const date = timestamp || new Date();

	const lines: string[] = [
		'═══════════════════════════════════════',
		'        CONGRESSIONAL MESSAGE RECEIPT',
		'═══════════════════════════════════════',
		''
	];

	if (templateTitle) {
		lines.push(`Topic: ${templateTitle}`, '');
	}

	lines.push(
		`Date: ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
		`Time: ${date.toLocaleTimeString('en-US')}`,
		`Reference: ${submissionId}`,
		'',
		`Delivered: ${summary.delivered} of ${summary.total} offices`,
		''
	);

	// Group by chamber
	const { senate, house } = groupByChamber(results);

	if (senate.length > 0) {
		lines.push('SENATE:', '');
		for (const r of senate) {
			const status = r.outcome === 'delivered' ? '✓' : r.outcome === 'failed' ? '✗' : '○';
			lines.push(`  ${status} ${r.office} (${r.state})`);
			if (r.confirmationId) {
				lines.push(`    ID: ${r.confirmationId}`);
			}
		}
		lines.push('');
	}

	if (house.length > 0) {
		lines.push('HOUSE:', '');
		for (const r of house) {
			const status = r.outcome === 'delivered' ? '✓' : r.outcome === 'failed' ? '✗' : '○';
			lines.push(`  ${status} ${r.office} (${formatLocation(r)})`);
			if (r.confirmationId) {
				lines.push(`    ID: ${r.confirmationId}`);
			}
		}
		lines.push('');
	}

	lines.push(
		'═══════════════════════════════════════',
		'         Sent via communi.email',
		'═══════════════════════════════════════'
	);

	return lines.join('\n');
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Get results that can be retried (failed but not unavailable)
 */
export function getRetryableResults(results: DeliveryResult[]): DeliveryResult[] {
	return results.filter((r) => r.outcome === 'failed' && r.retryable !== false);
}

/**
 * Check if any results are retryable
 */
export function hasRetryableResults(results: DeliveryResult[]): boolean {
	return getRetryableResults(results).length > 0;
}
