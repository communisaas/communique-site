/**
 * Delivery Feedback Utilities
 *
 * Helper functions for the legislative message delivery feedback experience.
 * These utilities are designed to be legislature-agnostic, working with any
 * configured legislature type (US Congress, state legislatures, international
 * parliaments, etc.).
 *
 * Key design principles:
 * - Pure functions with no side effects
 * - Generic over legislature configuration
 * - Defensive handling of edge cases
 *
 * @module delivery-utils
 * @see docs/temp/CWC-FEEDBACK-REDESIGN.md
 */

import type {
	DeliveryResult,
	DeliverySummary,
	LegislatureConfig,
	OfficeOutcome
} from './delivery-types';

// ============================================================================
// Summary Computation
// ============================================================================

/**
 * Compute a delivery summary from results
 *
 * Aggregates delivery results into a summary object with counts for each
 * outcome type. This is useful for determining overall success state and
 * displaying statistics to the user.
 *
 * @param results - Array of delivery results to summarize
 * @returns Summary object with total, delivered, failed, and unavailable counts
 *
 * @example
 * const results = [
 *   { outcome: 'delivered', ... },
 *   { outcome: 'delivered', ... },
 *   { outcome: 'failed', ... }
 * ];
 * const summary = computeSummary(results);
 * // { total: 3, delivered: 2, failed: 1, unavailable: 0 }
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
 * Group results by legislative body
 *
 * Creates a record mapping body IDs to their corresponding delivery results.
 * The bodies parameter defines which bodies to include and their order,
 * typically sourced from a LegislatureConfig.
 *
 * Bodies not present in the results will have empty arrays. Results with
 * body IDs not in the bodies list will be ignored.
 *
 * @param results - Delivery results to group
 * @param bodies - Body IDs in display order (from LegislatureConfig.bodies[].id)
 * @returns Record mapping body IDs to arrays of results
 *
 * @example
 * // Group US Congress results
 * const results = [
 *   { body: 'senate', office: 'Sen. Smith', ... },
 *   { body: 'house', office: 'Rep. Jones', ... },
 *   { body: 'senate', office: 'Sen. Doe', ... }
 * ];
 * const grouped = groupByBody(results, ['senate', 'house']);
 * // {
 * //   senate: [{ body: 'senate', ... }, { body: 'senate', ... }],
 * //   house: [{ body: 'house', ... }]
 * // }
 *
 * @example
 * // Group with config
 * import { LEGISLATURE_CONFIGS } from './delivery-types';
 * const bodyIds = LEGISLATURE_CONFIGS.US_CONGRESS.bodies.map(b => b.id);
 * const grouped = groupByBody(results, bodyIds);
 */
export function groupByBody(
	results: DeliveryResult[],
	bodies: string[]
): Record<string, DeliveryResult[]> {
	const grouped: Record<string, DeliveryResult[]> = {};
	for (const body of bodies) {
		grouped[body] = results.filter((r) => r.body === body);
	}
	return grouped;
}

/**
 * Sort results by outcome (delivered first, then failed, then unavailable)
 *
 * Creates a new sorted array without mutating the original. This ordering
 * prioritizes successful deliveries for positive reinforcement, followed
 * by actionable failures, then unavailable offices.
 *
 * @param results - Delivery results to sort
 * @returns New array sorted by outcome priority
 *
 * @example
 * const sorted = sortByOutcome(results);
 * // [delivered results, failed results, unavailable results]
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
 *
 * Currently returns the office name as-is, but provides a hook for
 * future formatting logic (e.g., abbreviation, truncation).
 *
 * @param result - Delivery result containing office name
 * @returns Formatted office name string
 */
export function formatOfficeName(result: DeliveryResult): string {
	return result.office;
}

/**
 * Get display name for a legislative body
 *
 * Looks up the display name for a body ID in the legislature configuration.
 * Falls back to capitalizing the body ID if not found.
 *
 * @param bodyId - The body identifier (e.g., 'senate', 'house')
 * @param config - Legislature configuration containing body definitions
 * @returns Display name for the body (e.g., 'Senate', 'House')
 *
 * @example
 * import { LEGISLATURE_CONFIGS } from './delivery-types';
 * const name = formatBody('senate', LEGISLATURE_CONFIGS.US_CONGRESS);
 * // "Senate"
 */
export function formatBody(bodyId: string, config: LegislatureConfig): string {
	const body = config.bodies.find((b) => b.id === bodyId);
	if (body) {
		return body.displayName;
	}
	// Fallback: capitalize the ID
	return bodyId.charAt(0).toUpperCase() + bodyId.slice(1);
}

/**
 * Format jurisdiction for display
 *
 * Combines jurisdiction and sub-jurisdiction into a display string.
 * For US Congress: "CA" for Senate, "CA-11" for House district 11.
 * Adapts to other legislature formats automatically.
 *
 * @param result - Delivery result containing jurisdiction info
 * @returns Formatted location string
 *
 * @example
 * // Senate result (no sub-jurisdiction)
 * formatLocation({ jurisdiction: 'CA', ... }); // "CA"
 *
 * @example
 * // House result (with district)
 * formatLocation({ jurisdiction: 'CA', subJurisdiction: '11', ... }); // "CA-11"
 *
 * @example
 * // State assembly result
 * formatLocation({ jurisdiction: 'Los Angeles', subJurisdiction: '42', ... }); // "Los Angeles-42"
 */
export function formatLocation(result: DeliveryResult): string {
	if (result.subJurisdiction) {
		return `${result.jurisdiction}-${result.subJurisdiction}`;
	}
	return result.jurisdiction;
}

/**
 * Format timestamp for display
 *
 * Converts an ISO timestamp string to a human-readable format
 * using the US English locale.
 *
 * @param isoTimestamp - ISO 8601 timestamp string
 * @returns Formatted date/time string (e.g., "Jan 15, 2024, 10:30 AM")
 *
 * @example
 * formatTimestamp('2024-01-15T10:30:00Z');
 * // "Jan 15, 2024, 10:30 AM" (varies by timezone)
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
 * Format confirmation ID for display (truncated with ellipsis)
 *
 * For long confirmation IDs, shows the first 6 and last 4 characters
 * with an ellipsis in between. Short IDs are returned as-is.
 *
 * @param id - Full confirmation ID
 * @returns Truncated ID for display (e.g., "CWC-20...1234")
 *
 * @example
 * formatConfirmationId('CWC-2024-001234'); // "CWC-20...1234"
 * formatConfirmationId('SHORT'); // "SHORT"
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
 *
 * Returns an appropriate message based on the delivery outcome:
 * - delivered: Generic success message
 * - failed: Error message from result, or generic retry prompt
 * - unavailable: Explains the office isn't accepting messages
 *
 * @param result - Delivery result to get message for
 * @returns User-friendly outcome message
 *
 * @example
 * getOutcomeMessage({ outcome: 'delivered', ... });
 * // "Message delivered successfully"
 *
 * @example
 * getOutcomeMessage({ outcome: 'failed', error: 'Network timeout', ... });
 * // "Network timeout"
 *
 * @example
 * getOutcomeMessage({ outcome: 'unavailable', office: 'Sen. Smith', ... });
 * // "Sen. Smith is not currently accepting messages through this system"
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
 *
 * Returns a brief, one-word label suitable for badges or status indicators.
 *
 * @param outcome - The outcome type
 * @returns Short label string
 *
 * @example
 * getOutcomeLabel('delivered'); // "Delivered"
 * getOutcomeLabel('failed'); // "Failed"
 * getOutcomeLabel('unavailable'); // "Unavailable"
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
 *
 * Creates a formatted text receipt of the delivery attempt, suitable for
 * copying, sharing, or printing. The receipt is customized based on the
 * legislature configuration, using appropriate body names and structure.
 *
 * The receipt includes:
 * - Header with legislature name
 * - Template topic (if provided)
 * - Date, time, and reference number
 * - Delivery summary statistics
 * - Per-body breakdown with status indicators
 * - Footer with service attribution
 *
 * @param submissionId - Unique identifier for this submission
 * @param results - Array of delivery results
 * @param config - Legislature configuration for customization
 * @param templateTitle - Optional title of the message template used
 * @param timestamp - Optional timestamp (defaults to current time)
 * @returns Formatted receipt text string
 *
 * @example
 * import { LEGISLATURE_CONFIGS } from './delivery-types';
 *
 * const receipt = generateReceiptText(
 *   'SUB-2024-001234',
 *   results,
 *   LEGISLATURE_CONFIGS.US_CONGRESS,
 *   'Climate Action Now',
 *   new Date('2024-01-15T10:30:00Z')
 * );
 *
 * // Returns formatted receipt like:
 * // ═══════════════════════════════════════
 * //       CONGRESS MESSAGE RECEIPT
 * // ═══════════════════════════════════════
 * //
 * // Topic: Climate Action Now
 * //
 * // Date: Monday, January 15, 2024
 * // Time: 10:30:00 AM
 * // Reference: SUB-2024-001234
 * //
 * // Delivered: 2 of 3 offices
 * //
 * // SENATE:
 * //
 * //   ✓ Sen. Adam Schiff (CA)
 * //     ID: CWC-2024-001234
 * //   ✓ Sen. Alex Padilla (CA)
 * //     ID: CWC-2024-001235
 * //
 * // HOUSE:
 * //
 * //   ✗ Rep. John Smith (CA-11)
 * //
 * // ═══════════════════════════════════════
 * //          Sent via communi.email
 * // ═══════════════════════════════════════
 */
export function generateReceiptText(
	submissionId: string,
	results: DeliveryResult[],
	config: LegislatureConfig,
	templateTitle?: string,
	timestamp?: Date
): string {
	const summary = computeSummary(results);
	const date = timestamp || new Date();

	// Build header with legislature name
	const headerTitle = `${config.name.toUpperCase()} MESSAGE RECEIPT`;
	const lines: string[] = [
		'═══════════════════════════════════════',
		headerTitle.padStart(Math.floor((39 + headerTitle.length) / 2)),
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

	// Group results by body using config
	const bodyIds = config.bodies.map((b) => b.id);
	const grouped = groupByBody(results, bodyIds);

	// Generate section for each body that has results
	for (const body of config.bodies) {
		const bodyResults = grouped[body.id];
		if (bodyResults && bodyResults.length > 0) {
			lines.push(`${body.displayName.toUpperCase()}:`, '');

			for (const r of bodyResults) {
				const status = r.outcome === 'delivered' ? '✓' : r.outcome === 'failed' ? '✗' : '○';
				const location = formatLocation(r);
				lines.push(`  ${status} ${r.office} (${location})`);

				if (r.confirmationId) {
					lines.push(`    ID: ${r.confirmationId}`);
				}
			}
			lines.push('');
		}
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
 * Get results that can be retried
 *
 * Filters results to only those that failed but are marked as retryable.
 * Results with outcome 'unavailable' are not retryable.
 * Failed results with retryable explicitly set to false are excluded.
 *
 * @param results - Array of delivery results to filter
 * @returns Array of retryable failed results
 *
 * @example
 * const retryable = getRetryableResults(results);
 * if (retryable.length > 0) {
 *   showRetryButton();
 * }
 */
export function getRetryableResults(results: DeliveryResult[]): DeliveryResult[] {
	return results.filter((r) => r.outcome === 'failed' && r.retryable !== false);
}

/**
 * Check if any results are retryable
 *
 * Convenience function to determine if a retry option should be shown.
 *
 * @param results - Array of delivery results to check
 * @returns true if at least one result is retryable
 *
 * @example
 * if (hasRetryableResults(results)) {
 *   showRetryButton();
 * }
 */
export function hasRetryableResults(results: DeliveryResult[]): boolean {
	return getRetryableResults(results).length > 0;
}

// ============================================================================
// Headline Generation
// ============================================================================

/**
 * Get appropriate headline based on delivery summary
 *
 * Selects the appropriate headline from the legislature config based on
 * the delivery outcome:
 * - success: All deliveries succeeded (no failures or unavailable)
 * - partial: Some succeeded, some failed/unavailable
 * - failure: All failed or unavailable
 *
 * @param summary - Computed delivery summary
 * @param config - Legislature configuration with headline templates
 * @returns Appropriate headline string
 *
 * @example
 * import { LEGISLATURE_CONFIGS } from './delivery-types';
 *
 * const summary = computeSummary(results);
 * const headline = getHeadline(summary, LEGISLATURE_CONFIGS.US_CONGRESS);
 * // "Your voice reached Congress" (if all delivered)
 * // "Your message was delivered" (if partial)
 * // "Delivery unsuccessful" (if all failed)
 */
export function getHeadline(summary: DeliverySummary, config: LegislatureConfig): string {
	if (summary.delivered === summary.total) {
		return config.headlines.success;
	}
	if (summary.delivered > 0) {
		return config.headlines.partial;
	}
	return config.headlines.failure;
}
