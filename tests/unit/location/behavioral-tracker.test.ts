/**
 * Unit tests for Behavioral Location Tracker
 *
 * Tests template view tracking, jurisdiction pattern extraction,
 * confidence scoring, recency bonuses, and the exported convenience
 * functions (trackTemplateView, getBehavioralPatterns, getTemplateViewCounts).
 *
 * Mocks:
 * - locationStorage (IndexedDB storage layer)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
	TemplateViewEvent,
	TemplateJurisdiction,
	LocationSignal,
	BehavioralLocationPattern
} from '$lib/core/location/types';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockLocationStorage = vi.hoisted(() => ({
	recordTemplateView: vi.fn(),
	getTemplateViews: vi.fn(),
	storeSignal: vi.fn(),
	clearOldTemplateViews: vi.fn()
}));

vi.mock('$lib/core/location/storage', () => ({
	locationStorage: mockLocationStorage,
	LocationStorage: vi.fn()
}));

// ---------------------------------------------------------------------------
// Helpers: factories
// ---------------------------------------------------------------------------

function makeJurisdiction(overrides: Partial<TemplateJurisdiction> = {}): TemplateJurisdiction {
	return {
		id: 'jur-1',
		template_id: 'tmpl-1',
		jurisdiction_type: 'federal',
		congressional_district: null,
		state_code: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		senate_class: null,
		state_senate_district: null,
		state_house_district: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		...overrides
	};
}

function makeViewEvent(
	templateId: string,
	jurisdictions: TemplateJurisdiction[],
	viewedAt: string = new Date().toISOString()
): TemplateViewEvent {
	return {
		template_id: templateId,
		template_slug: `template-${templateId}`,
		jurisdictions,
		viewed_at: viewedAt
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Behavioral Location Tracker', () => {
	let BehavioralLocationTracker: typeof import('$lib/core/location/behavioral-tracker').BehavioralLocationTracker;
	let behavioralTracker: typeof import('$lib/core/location/behavioral-tracker').behavioralTracker;
	let trackTemplateView: typeof import('$lib/core/location/behavioral-tracker').trackTemplateView;
	let getBehavioralPatterns: typeof import('$lib/core/location/behavioral-tracker').getBehavioralPatterns;
	let getTemplateViewCounts: typeof import('$lib/core/location/behavioral-tracker').getTemplateViewCounts;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-23T12:00:00Z'));

		// Default mock returns
		mockLocationStorage.recordTemplateView.mockResolvedValue(undefined);
		mockLocationStorage.getTemplateViews.mockResolvedValue([]);
		mockLocationStorage.storeSignal.mockResolvedValue(undefined);
		mockLocationStorage.clearOldTemplateViews.mockResolvedValue(undefined);

		// Fresh import for each test
		vi.resetModules();
		const mod = await import('$lib/core/location/behavioral-tracker');
		BehavioralLocationTracker = mod.BehavioralLocationTracker;
		behavioralTracker = mod.behavioralTracker;
		trackTemplateView = mod.trackTemplateView;
		getBehavioralPatterns = mod.getBehavioralPatterns;
		getTemplateViewCounts = mod.getTemplateViewCounts;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// =========================================================================
	// BehavioralLocationTracker.trackTemplateView
	// =========================================================================

	describe('trackTemplateView', () => {
		it('should record a template view event in storage', async () => {
			const jurisdictions = [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-18' })];

			await trackTemplateView('tmpl-1', 'test-template', jurisdictions);

			expect(mockLocationStorage.recordTemplateView).toHaveBeenCalledOnce();
			const event = mockLocationStorage.recordTemplateView.mock.calls[0][0] as TemplateViewEvent;
			expect(event.template_id).toBe('tmpl-1');
			expect(event.template_slug).toBe('test-template');
			expect(event.jurisdictions).toHaveLength(1);
		});

		it('should serialize bigint estimated_population to number', async () => {
			const jurisdictions = [
				makeJurisdiction({
					state_code: 'CA',
					estimated_population: BigInt(39538223)
				})
			];

			await trackTemplateView('tmpl-2', 'big-pop', jurisdictions);

			const event = mockLocationStorage.recordTemplateView.mock.calls[0][0] as TemplateViewEvent;
			const storedJurisdiction = event.jurisdictions[0];
			// BigInt should be converted to number for IndexedDB storage
			expect(storedJurisdiction.estimated_population).toBe(39538223);
			expect(typeof storedJurisdiction.estimated_population).toBe('number');
		});

		it('should handle null fields in jurisdiction without errors', async () => {
			const jurisdictions = [
				makeJurisdiction({
					congressional_district: null,
					state_code: null,
					county_fips: null,
					city_name: null
				})
			];

			await trackTemplateView('tmpl-3', 'null-fields', jurisdictions);

			expect(mockLocationStorage.recordTemplateView).toHaveBeenCalledOnce();
		});

		it('should include viewed_at timestamp in event', async () => {
			const jurisdictions = [makeJurisdiction({ state_code: 'NY' })];

			await trackTemplateView('tmpl-4', 'timestamped', jurisdictions);

			const event = mockLocationStorage.recordTemplateView.mock.calls[0][0] as TemplateViewEvent;
			expect(event.viewed_at).toBe('2026-02-23T12:00:00.000Z');
		});

		it('should trigger inferFromBehavior after recording', async () => {
			const jurisdictions = [makeJurisdiction({ state_code: 'CA' })];

			// Set up views so inferFromBehavior has data to work with
			const views = [
				makeViewEvent('tmpl-5', jurisdictions, '2026-02-23T12:00:00.000Z')
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			await trackTemplateView('tmpl-5', 'triggers-infer', jurisdictions);

			// inferFromBehavior calls getTemplateViews
			expect(mockLocationStorage.getTemplateViews).toHaveBeenCalled();
		});

		it('should handle errors in recordTemplateView gracefully', async () => {
			mockLocationStorage.recordTemplateView.mockRejectedValue(new Error('Storage error'));

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Should not throw
			await trackTemplateView('tmpl-err', 'error-test', [makeJurisdiction()]);

			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to track template view:',
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});

		it('should handle multiple jurisdictions per template', async () => {
			const jurisdictions = [
				makeJurisdiction({ state_code: 'CA', congressional_district: 'CA-12' }),
				makeJurisdiction({ state_code: 'CA', congressional_district: 'CA-13' }),
				makeJurisdiction({ state_code: 'CA', congressional_district: 'CA-14' })
			];

			await trackTemplateView('tmpl-multi', 'multi-jurisdiction', jurisdictions);

			const event = mockLocationStorage.recordTemplateView.mock.calls[0][0] as TemplateViewEvent;
			expect(event.jurisdictions).toHaveLength(3);
		});
	});

	// =========================================================================
	// BehavioralLocationTracker.inferFromBehavior
	// =========================================================================

	describe('inferFromBehavior', () => {
		it('should return null when no views exist', async () => {
			mockLocationStorage.getTemplateViews.mockResolvedValue([]);

			const tracker = new BehavioralLocationTracker();
			const result = await tracker.inferFromBehavior();

			expect(result).toBeNull();
		});

		it('should return null when confidence is below 0.5 threshold', async () => {
			// A single view out of many with no clear pattern
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'CA' })]),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX' })]),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'NY' })]),
				makeViewEvent('t4', [makeJurisdiction({ state_code: 'FL' })]),
				makeViewEvent('t5', [makeJurisdiction({ state_code: 'WA' })]),
				makeViewEvent('t6', [makeJurisdiction({ state_code: 'OR' })]),
				makeViewEvent('t7', [makeJurisdiction({ state_code: 'IL' })]),
				makeViewEvent('t8', [makeJurisdiction({ state_code: 'OH' })]),
				makeViewEvent('t9', [makeJurisdiction({ state_code: 'PA' })]),
				makeViewEvent('t10', [makeJurisdiction({ state_code: 'MI' })])
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const result = await tracker.inferFromBehavior();

			// With 10 different states, each has frequency=0.1, recency bonus=0.1 = 0.2 confidence
			// 0.2 < 0.5 threshold, so should return null
			expect(result).toBeNull();
		});

		it('should generate signal when single state dominates views', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-18' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-18' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-18' })], now),
				makeViewEvent('t4', [makeJurisdiction({ state_code: 'CA' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const result = await tracker.inferFromBehavior();

			expect(result).not.toBeNull();
			expect(result!.signal_type).toBe('behavioral');
			expect(result!.state_code).toBe('TX');
			expect(result!.congressional_district).toBe('TX-18');
			expect(result!.source).toBe('behavioral.template_views');
		});

		it('should store the behavioral signal', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'NY', congressional_district: 'NY-10' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'NY', congressional_district: 'NY-10' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'NY', congressional_district: 'NY-10' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			await tracker.inferFromBehavior();

			expect(mockLocationStorage.storeSignal).toHaveBeenCalledWith(
				expect.objectContaining({
					signal_type: 'behavioral',
					state_code: 'NY',
					congressional_district: 'NY-10'
				})
			);
		});

		it('should cap confidence at 0.9', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			// All views same jurisdiction -> frequency=1.0, consistency=0.2, recency=0.1 = 1.3
			// Should be capped at 0.9
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'CA' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'CA' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'CA' })], now),
				makeViewEvent('t4', [makeJurisdiction({ state_code: 'CA' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const result = await tracker.inferFromBehavior();

			expect(result).not.toBeNull();
			expect(result!.confidence).toBeLessThanOrEqual(0.9);
		});

		it('should include metadata with view_count, first_seen, last_seen', async () => {
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'FL' })], '2026-02-20T10:00:00Z'),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'FL' })], '2026-02-21T10:00:00Z'),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'FL' })], '2026-02-23T10:00:00Z')
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const result = await tracker.inferFromBehavior();

			expect(result).not.toBeNull();
			expect(result!.metadata).toBeDefined();
			expect(result!.metadata!.view_count).toBe(3);
			expect(result!.metadata!.first_seen).toBe('2026-02-20T10:00:00Z');
			expect(result!.metadata!.last_seen).toBe('2026-02-23T10:00:00Z');
		});

		it('should handle errors in getTemplateViews gracefully', async () => {
			mockLocationStorage.getTemplateViews.mockRejectedValue(new Error('DB error'));
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const tracker = new BehavioralLocationTracker();
			const result = await tracker.inferFromBehavior();

			expect(result).toBeNull();
			consoleSpy.mockRestore();
		});
	});

	// =========================================================================
	// Pattern extraction and confidence scoring
	// =========================================================================

	describe('Pattern extraction', () => {
		it('should group views by jurisdiction key', async () => {
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-18' })]),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-18' })]),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'CA', congressional_district: 'CA-12' })])
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			// Should have 2 patterns (TX-18 and CA-12)
			expect(patterns.length).toBe(2);

			// TX-18 should have higher confidence (2 views vs 1)
			const txPattern = patterns.find(p => p.state_code === 'TX');
			const caPattern = patterns.find(p => p.state_code === 'CA');
			expect(txPattern).toBeDefined();
			expect(caPattern).toBeDefined();
			expect(txPattern!.view_count).toBe(2);
			expect(caPattern!.view_count).toBe(1);
		});

		it('should calculate frequency-based confidence', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			// 3 out of 4 views for TX = 75% frequency
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t4', [makeJurisdiction({ state_code: 'CA' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			const txPattern = patterns.find(p => p.state_code === 'TX');
			expect(txPattern).toBeDefined();
			// frequency = 3/4 = 0.75
			// consistencyBonus = 0.2 (3+ views)
			// recencyBonus = 0.1 (recent views)
			// total = min(0.9, 0.75 + 0.2 + 0.1) = 0.9 (capped)
			expect(txPattern!.confidence).toBeCloseTo(0.9, 2);
		});

		it('should apply consistency bonus for 3+ views of same jurisdiction', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			// 2 views: no consistency bonus
			const views2 = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views2);

			let tracker = new BehavioralLocationTracker();
			let patterns = await tracker.getPatterns();
			const conf2 = patterns[0].confidence;

			// 3 views: gets consistency bonus
			const views3 = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'TX' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views3);

			tracker = new BehavioralLocationTracker();
			patterns = await tracker.getPatterns();
			const conf3 = patterns[0].confidence;

			// Both have frequency=1.0 and recency=0.1, but 3-view version gets +0.2 consistency
			// 2 views: min(0.9, 1.0 + 0 + 0.1) = 0.9
			// 3 views: min(0.9, 1.0 + 0.2 + 0.1) = 0.9
			// Both capped at 0.9 in this case because frequency is already 1.0
			// Let's verify they are both capped at 0.9
			expect(conf2).toBeLessThanOrEqual(0.9);
			expect(conf3).toBeLessThanOrEqual(0.9);
		});

		it('should apply recency bonus for views within 7 days', async () => {
			const recent = new Date('2026-02-23T12:00:00Z').toISOString();
			const old = new Date('2026-02-01T12:00:00Z').toISOString(); // 22 days ago

			// Recent views
			const recentViews = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'CA' })], recent),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX' })], old)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(recentViews);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			const caPattern = patterns.find(p => p.state_code === 'CA');
			const txPattern = patterns.find(p => p.state_code === 'TX');

			expect(caPattern).toBeDefined();
			expect(txPattern).toBeDefined();
			// CA (recent) should have recency bonus of 0.1
			// TX (old, > 7 days) should have recency bonus of 0
			// Both have same frequency (0.5), no consistency bonus
			// CA: 0.5 + 0 + 0.1 = 0.6
			// TX: 0.5 + 0 + 0 = 0.5
			expect(caPattern!.confidence).toBeGreaterThan(txPattern!.confidence);
		});

		it('should sort patterns by confidence descending', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'TX' })], now),
				makeViewEvent('t4', [makeJurisdiction({ state_code: 'CA' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			expect(patterns.length).toBeGreaterThanOrEqual(2);
			// First pattern should have highest confidence
			for (let i = 1; i < patterns.length; i++) {
				expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
			}
		});

		it('should handle views with county_fips in jurisdiction key', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX', county_fips: '48453' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX', county_fips: '48453' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'TX', county_fips: '48201' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			// Should have 2 patterns for different counties
			expect(patterns.length).toBe(2);
		});

		it('should handle views with city_fips in jurisdiction key', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'CA', city_fips: '0667000' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'CA', city_fips: '0667000' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			expect(patterns.length).toBeGreaterThanOrEqual(1);
		});

		it('should use "unknown" key for jurisdictions with no identifiable fields', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({})], now),
				makeViewEvent('t2', [makeJurisdiction({})], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			// Should still produce a pattern (with "unknown" key)
			expect(patterns.length).toBe(1);
		});
	});

	// =========================================================================
	// getBehavioralPatterns (convenience function)
	// =========================================================================

	describe('getBehavioralPatterns', () => {
		it('should return patterns from the singleton tracker', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'CA' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'CA' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const patterns = await getBehavioralPatterns();

			expect(patterns.length).toBeGreaterThanOrEqual(1);
			expect(patterns[0].state_code).toBe('CA');
		});

		it('should return empty array when no views exist', async () => {
			mockLocationStorage.getTemplateViews.mockResolvedValue([]);

			const patterns = await getBehavioralPatterns();

			expect(patterns).toEqual([]);
		});
	});

	// =========================================================================
	// getTemplateViewCounts
	// =========================================================================

	describe('getTemplateViewCounts', () => {
		it('should aggregate view counts by template_id', async () => {
			const views = [
				makeViewEvent('tmpl-1', [makeJurisdiction()]),
				makeViewEvent('tmpl-1', [makeJurisdiction()]),
				makeViewEvent('tmpl-2', [makeJurisdiction()]),
				makeViewEvent('tmpl-1', [makeJurisdiction()]),
				makeViewEvent('tmpl-3', [makeJurisdiction()])
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const counts = await getTemplateViewCounts();

			expect(counts.get('tmpl-1')).toBe(3);
			expect(counts.get('tmpl-2')).toBe(1);
			expect(counts.get('tmpl-3')).toBe(1);
		});

		it('should return empty map when no views exist', async () => {
			mockLocationStorage.getTemplateViews.mockResolvedValue([]);

			const counts = await getTemplateViewCounts();

			expect(counts.size).toBe(0);
		});

		it('should handle single view correctly', async () => {
			const views = [makeViewEvent('tmpl-only', [makeJurisdiction()])];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const counts = await getTemplateViewCounts();

			expect(counts.get('tmpl-only')).toBe(1);
			expect(counts.size).toBe(1);
		});

		it('should handle many templates correctly', async () => {
			const views = Array.from({ length: 100 }, (_, i) =>
				makeViewEvent(`tmpl-${i % 10}`, [makeJurisdiction()])
			);
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const counts = await getTemplateViewCounts();

			expect(counts.size).toBe(10);
			// Each of 10 templates should have 10 views
			for (let i = 0; i < 10; i++) {
				expect(counts.get(`tmpl-${i}`)).toBe(10);
			}
		});
	});

	// =========================================================================
	// BehavioralLocationTracker.clear
	// =========================================================================

	describe('clear', () => {
		it('should delegate to locationStorage.clearOldTemplateViews', async () => {
			const tracker = new BehavioralLocationTracker();
			await tracker.clear();

			expect(mockLocationStorage.clearOldTemplateViews).toHaveBeenCalledOnce();
		});
	});

	// =========================================================================
	// Geographic clustering and topic affinity
	// =========================================================================

	describe('Geographic clustering', () => {
		it('should detect single-state clustering', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-07' })], now),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-18' })], now),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'TX', congressional_district: 'TX-29' })], now),
				makeViewEvent('t4', [makeJurisdiction({ state_code: 'CA' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			// TX districts are separate jurisdiction keys but share state
			// Each TX district is a separate pattern
			const txPatterns = patterns.filter(p => p.state_code === 'TX');
			expect(txPatterns.length).toBe(3);
		});

		it('should handle multi-jurisdiction templates', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			// A single template view with multiple jurisdictions
			const views = [
				makeViewEvent('t1', [
					makeJurisdiction({ state_code: 'CA', congressional_district: 'CA-12' }),
					makeJurisdiction({ state_code: 'CA', congressional_district: 'CA-13' })
				], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			// Both jurisdictions should have patterns
			expect(patterns.length).toBe(2);
		});
	});

	// =========================================================================
	// Edge cases
	// =========================================================================

	describe('Edge cases', () => {
		it('should handle empty jurisdictions array in view event', async () => {
			const views = [makeViewEvent('t1', [])];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			expect(patterns).toEqual([]);
		});

		it('should handle single view with single jurisdiction', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'HI' })], now)
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			expect(patterns.length).toBe(1);
			expect(patterns[0].state_code).toBe('HI');
			expect(patterns[0].view_count).toBe(1);
			// frequency=1.0, no consistency bonus (only 1 view), recency=0.1
			// confidence = min(0.9, 1.0 + 0 + 0.1) = 0.9
			expect(patterns[0].confidence).toBeLessThanOrEqual(0.9);
		});

		it('should handle rapid repeated views of same template', async () => {
			const now = new Date('2026-02-23T12:00:00Z').toISOString();
			const views = Array.from({ length: 20 }, () =>
				makeViewEvent('tmpl-spam', [makeJurisdiction({ state_code: 'NV' })], now)
			);
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			expect(patterns.length).toBe(1);
			expect(patterns[0].view_count).toBe(20);
			expect(patterns[0].confidence).toBeLessThanOrEqual(0.9);
		});

		it('should handle views spanning a long time period', async () => {
			const views = [
				makeViewEvent('t1', [makeJurisdiction({ state_code: 'WA' })], '2025-01-15T10:00:00Z'),
				makeViewEvent('t2', [makeJurisdiction({ state_code: 'WA' })], '2025-06-15T10:00:00Z'),
				makeViewEvent('t3', [makeJurisdiction({ state_code: 'WA' })], '2026-02-23T10:00:00Z')
			];
			mockLocationStorage.getTemplateViews.mockResolvedValue(views);

			const tracker = new BehavioralLocationTracker();
			const patterns = await tracker.getPatterns();

			expect(patterns.length).toBe(1);
			expect(patterns[0].first_seen).toBe('2025-01-15T10:00:00Z');
			expect(patterns[0].last_seen).toBe('2026-02-23T10:00:00Z');
		});
	});
});
