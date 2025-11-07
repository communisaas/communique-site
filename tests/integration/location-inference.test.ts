/**
 * Location Inference Integration Tests
 *
 * Test the 5-signal progressive inference system for client-side location resolution.
 * Ensures privacy-preserving, VPN-resistant location inference.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { locationStorage } from '$lib/core/location/storage';
import { locationInferenceEngine } from '$lib/core/location/inference-engine';
import { behavioralTracker } from '$lib/core/location/behavioral-tracker';
import {
	filterTemplatesByLocation,
	scoreTemplatesByRelevance
} from '$lib/core/location/template-filter';
import type {
	LocationSignal,
	InferredLocation,
	TemplateWithJurisdictions
} from '$lib/core/location/types';

// ============================================================================
// Test Setup & Teardown
// ============================================================================

describe('Location Inference System', () => {
	beforeEach(async () => {
		// Clear all location data before each test
		await locationStorage.clearAll();
	});

	afterEach(async () => {
		// Clean up after each test
		await locationStorage.clearAll();
	});

	// ============================================================================
	// IndexedDB Storage Tests
	// ============================================================================

	describe('LocationStorage', () => {
		it('should store and retrieve location signals', async () => {
			const signal: LocationSignal = {
				signal_type: 'browser',
				confidence: 0.6,
				congressional_district: 'TX-18',
				state_code: 'TX',
				source: 'browser.geolocation',
				timestamp: new Date().toISOString()
			};

			await locationStorage.storeSignal(signal);
			const signals = await locationStorage.getSignals();

			expect(signals).toHaveLength(1);
			expect(signals[0].congressional_district).toBe('TX-18');
			expect(signals[0].state_code).toBe('TX');
		});

		it('should filter expired signals', async () => {
			// Add fresh signal
			const freshSignal: LocationSignal = {
				signal_type: 'browser',
				confidence: 0.6,
				congressional_district: 'TX-18',
				state_code: 'TX',
				source: 'browser.geolocation',
				timestamp: new Date().toISOString()
			};

			// Add expired signal
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() - 100); // 100 days ago

			const expiredSignal: LocationSignal = {
				signal_type: 'ip',
				confidence: 0.2,
				congressional_district: 'CA-12',
				state_code: 'CA',
				source: 'ip.geolocation',
				timestamp: expiredDate.toISOString(),
				expires_at: new Date(expiredDate.getTime() + 24 * 60 * 60 * 1000).toISOString() // Expired 99 days ago
			};

			await locationStorage.storeSignal(freshSignal);
			await locationStorage.storeSignal(expiredSignal);

			// Clear expired signals
			const deletedCount = await locationStorage.clearExpiredSignals();

			expect(deletedCount).toBeGreaterThanOrEqual(1);

			// Verify only fresh signal remains
			const signals = await locationStorage.getSignals();
			expect(signals).toHaveLength(1);
			expect(signals[0].congressional_district).toBe('TX-18');
		});

		it('should store and retrieve template views', async () => {
			const view = {
				template_id: 'test-template-1',
				template_slug: 'test-template',
				jurisdictions: [
					{
						id: 'j1',
						template_id: 'test-template-1',
						jurisdiction_type: 'federal' as const,
						congressional_district: 'TX-18',
						state_code: 'TX',
						created_at: new Date(),
						updated_at: new Date()
					}
				],
				viewed_at: new Date().toISOString()
			};

			await locationStorage.recordTemplateView(view);
			const views = await locationStorage.getTemplateViews();

			expect(views).toHaveLength(1);
			expect(views[0].template_id).toBe('test-template-1');
		});
	});

	// ============================================================================
	// Location Inference Tests
	// ============================================================================

	describe('LocationInferenceEngine', () => {
		it('should infer location from multiple signals', async () => {
			// Add multiple signals with different confidence levels
			const signals: LocationSignal[] = [
				{
					signal_type: 'ip',
					confidence: 0.2,
					state_code: 'CA',
					congressional_district: null,
					source: 'ip.geolocation',
					timestamp: new Date().toISOString()
				},
				{
					signal_type: 'browser',
					confidence: 0.6,
					congressional_district: 'TX-18',
					state_code: 'TX',
					source: 'browser.geolocation',
					timestamp: new Date().toISOString()
				},
				{
					signal_type: 'oauth',
					confidence: 0.8,
					congressional_district: 'TX-18',
					state_code: 'TX',
					city_name: 'Houston',
					source: 'oauth.google',
					timestamp: new Date().toISOString()
				}
			];

			for (const signal of signals) {
				await locationStorage.storeSignal(signal);
			}

			const inferred = await locationInferenceEngine.inferLocation(true);

			// Should use highest confidence signal (OAuth)
			expect(inferred.congressional_district).toBe('TX-18');
			expect(inferred.state_code).toBe('TX');
			expect(inferred.city_name).toBe('Houston');
			expect(inferred.confidence).toBeGreaterThan(0.6);
			expect(inferred.signals).toHaveLength(3);
		});

		it('should prioritize verified signals over all others', async () => {
			// Add verified signal
			const verifiedSignal: LocationSignal = {
				signal_type: 'verified',
				confidence: 1.0,
				congressional_district: 'TX-18',
				state_code: 'TX',
				source: 'verification.identity',
				timestamp: new Date().toISOString()
			};

			// Add conflicting browser signal
			const browserSignal: LocationSignal = {
				signal_type: 'browser',
				confidence: 0.6,
				congressional_district: 'CA-12',
				state_code: 'CA',
				source: 'browser.geolocation',
				timestamp: new Date().toISOString()
			};

			await locationStorage.storeSignal(browserSignal);
			await locationStorage.storeSignal(verifiedSignal);

			const inferred = await locationInferenceEngine.inferLocation(true);

			// Should use verified signal (highest confidence)
			expect(inferred.congressional_district).toBe('TX-18');
			expect(inferred.state_code).toBe('TX');
			expect(inferred.confidence).toBe(1.0);
		});
	});

	// ============================================================================
	// Behavioral Tracking Tests
	// ============================================================================

	describe('BehavioralLocationTracker', () => {
		it('should infer location from template views', async () => {
			// Simulate user viewing multiple TX-18 templates
			const jurisdictions = [
				{
					id: 'j1',
					template_id: 'template-1',
					jurisdiction_type: 'federal' as const,
					congressional_district: 'TX-18',
					state_code: 'TX',
					created_at: new Date(),
					updated_at: new Date()
				}
			];

			// Record 5 views of TX-18 templates
			for (let i = 0; i < 5; i++) {
				await behavioralTracker.trackTemplateView(
					`template-${i}`,
					`test-template-${i}`,
					jurisdictions
				);

				// Small delay between views
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// Get behavioral patterns
			const patterns = await behavioralTracker.getPatterns();

			expect(patterns.length).toBeGreaterThan(0);
			expect(patterns[0].congressional_district).toBe('TX-18');
			expect(patterns[0].view_count).toBe(5);
			expect(patterns[0].confidence).toBeGreaterThan(0.5);
		});

		it('should create behavioral location signal after multiple views', async () => {
			const jurisdictions = [
				{
					id: 'j1',
					template_id: 'template-1',
					jurisdiction_type: 'federal' as const,
					congressional_district: 'CA-12',
					state_code: 'CA',
					created_at: new Date(),
					updated_at: new Date()
				}
			];

			// Record 3 views (threshold for high confidence)
			for (let i = 0; i < 3; i++) {
				await behavioralTracker.trackTemplateView(
					`template-${i}`,
					`test-template-${i}`,
					jurisdictions
				);
			}

			// Check if behavioral signal was created
			const signals = await locationStorage.getSignalsByType('behavioral');

			expect(signals.length).toBeGreaterThan(0);
			expect(signals[0].congressional_district).toBe('CA-12');
			expect(signals[0].confidence).toBeGreaterThan(0.5);
		});
	});

	// ============================================================================
	// Template Filtering Tests
	// ============================================================================

	describe('ClientSideTemplateFilter', () => {
		it('should filter templates by jurisdiction match', () => {
			const location: InferredLocation = {
				congressional_district: 'TX-18',
				state_code: 'TX',
				confidence: 0.8,
				signals: [],
				inferred_at: new Date().toISOString()
			};

			const templates: TemplateWithJurisdictions[] = [
				{
					id: '1',
					slug: 'tx-18-template',
					title: 'TX-18 Template',
					jurisdictions: [
						{
							id: 'j1',
							template_id: '1',
							jurisdiction_type: 'federal',
							congressional_district: 'TX-18',
							state_code: 'TX',
							created_at: new Date(),
							updated_at: new Date()
						}
					]
				},
				{
					id: '2',
					slug: 'ca-12-template',
					title: 'CA-12 Template',
					jurisdictions: [
						{
							id: 'j2',
							template_id: '2',
							jurisdiction_type: 'federal',
							congressional_district: 'CA-12',
							state_code: 'CA',
							created_at: new Date(),
							updated_at: new Date()
						}
					]
				}
			];

			const filtered = filterTemplatesByLocation(templates, location);

			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe('1');
			expect(filtered[0].slug).toBe('tx-18-template');
		});

		it('should score templates by relevance', () => {
			const location: InferredLocation = {
				congressional_district: 'TX-18',
				state_code: 'TX',
				confidence: 0.8,
				signals: [],
				inferred_at: new Date().toISOString()
			};

			const templates: TemplateWithJurisdictions[] = [
				{
					id: '1',
					slug: 'exact-match',
					title: 'Exact District Match',
					jurisdictions: [
						{
							id: 'j1',
							template_id: '1',
							jurisdiction_type: 'federal',
							congressional_district: 'TX-18',
							state_code: 'TX',
							created_at: new Date(),
							updated_at: new Date()
						}
					]
				},
				{
					id: '2',
					slug: 'state-match',
					title: 'State Match Only',
					jurisdictions: [
						{
							id: 'j2',
							template_id: '2',
							jurisdiction_type: 'state',
							state_code: 'TX',
							created_at: new Date(),
							updated_at: new Date()
						}
					]
				},
				{
					id: '3',
					slug: 'no-match',
					title: 'No Match',
					jurisdictions: [
						{
							id: 'j3',
							template_id: '3',
							jurisdiction_type: 'federal',
							congressional_district: 'CA-12',
							state_code: 'CA',
							created_at: new Date(),
							updated_at: new Date()
						}
					]
				}
			];

			const scored = scoreTemplatesByRelevance(templates, location);

			expect(scored).toHaveLength(2); // Only matched templates
			expect(scored[0].template.id).toBe('1'); // Exact match should score highest
			expect(scored[0].score).toBe(1.0);
			expect(scored[1].template.id).toBe('2'); // State match scores lower
			expect(scored[1].score).toBe(0.5);
		});
	});

	// ============================================================================
	// Privacy Tests
	// ============================================================================

	describe('Privacy Guarantees', () => {
		it('should store all location data in IndexedDB only', async () => {
			const signal: LocationSignal = {
				signal_type: 'browser',
				confidence: 0.6,
				congressional_district: 'TX-18',
				state_code: 'TX',
				source: 'browser.geolocation',
				timestamp: new Date().toISOString()
			};

			await locationStorage.storeSignal(signal);

			// Verify data is in IndexedDB
			const signals = await locationStorage.getSignals();
			expect(signals).toHaveLength(1);

			// Verify no data in localStorage
			expect(localStorage.getItem('location_signals')).toBeNull();
			expect(localStorage.getItem('inferred_location')).toBeNull();

			// Verify no data in sessionStorage
			expect(sessionStorage.getItem('location_signals')).toBeNull();
			expect(sessionStorage.getItem('inferred_location')).toBeNull();
		});

		it('should never send location data to server', async () => {
			// Mock fetch to track server requests
			const fetchSpy = vi.spyOn(global, 'fetch');

			// Add signals and infer location
			const signal: LocationSignal = {
				signal_type: 'oauth',
				confidence: 0.8,
				congressional_district: 'TX-18',
				state_code: 'TX',
				source: 'oauth.google',
				timestamp: new Date().toISOString()
			};

			await locationStorage.storeSignal(signal);
			await locationInferenceEngine.inferLocation(true);

			// Verify no fetch calls were made
			expect(fetchSpy).not.toHaveBeenCalled();

			fetchSpy.mockRestore();
		});

		it('should clear all location data on demand', async () => {
			// Add multiple signals
			const signals: LocationSignal[] = [
				{
					signal_type: 'browser',
					confidence: 0.6,
					congressional_district: 'TX-18',
					state_code: 'TX',
					source: 'browser.geolocation',
					timestamp: new Date().toISOString()
				},
				{
					signal_type: 'oauth',
					confidence: 0.8,
					congressional_district: 'TX-18',
					state_code: 'TX',
					source: 'oauth.google',
					timestamp: new Date().toISOString()
				}
			];

			for (const signal of signals) {
				await locationStorage.storeSignal(signal);
			}

			// Record template views
			await behavioralTracker.trackTemplateView('template-1', 'test', [
				{
					id: 'j1',
					template_id: 'template-1',
					jurisdiction_type: 'federal',
					congressional_district: 'TX-18',
					state_code: 'TX',
					created_at: new Date(),
					updated_at: new Date()
				}
			]);

			// Verify data exists
			let storedSignals = await locationStorage.getSignals();
			expect(storedSignals.length).toBeGreaterThan(0);

			// Clear all data
			await locationStorage.clearAll();

			// Verify all data is cleared
			storedSignals = await locationStorage.getSignals();
			expect(storedSignals).toHaveLength(0);

			const views = await locationStorage.getTemplateViews();
			expect(views).toHaveLength(0);

			const inferred = await locationStorage.getInferredLocation();
			expect(inferred).toBeNull();
		});
	});
});
