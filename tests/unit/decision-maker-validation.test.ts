/**
 * Unit Tests: Decision-Maker Validation Module
 *
 * Tests the Phase 3 validation and merge logic for enriched decision-makers.
 */

import { describe, test, expect } from 'vitest';
import { validateAndMerge } from '$lib/core/agents/agents/decision-maker-validation';
import type { EnrichedDecisionMaker } from '$lib/core/agents/types';

describe('Decision-Maker Validation', () => {
	describe('validateAndMerge', () => {
		test('should filter out candidates without email', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'John Doe',
					title: 'CEO',
					organization: 'Acme Corp',
					reasoning: 'Has power over corporate policy',
					sourceUrl: 'https://example.com/john',
					confidence: 0.9,
					enrichmentStatus: 'not_found',
					enrichmentAttempts: 2
					// No email field
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(0);
		});

		test('should filter out candidates with invalid email format', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'John Doe',
					title: 'CEO',
					organization: 'Acme Corp',
					reasoning: 'Has power over corporate policy',
					sourceUrl: 'https://example.com/john',
					confidence: 0.9,
					email: 'not-an-email',
					emailSource: 'https://example.com/contact',
					emailConfidence: 0.8,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(0);
		});

		test('should accept email with matching organization domain', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'John Doe',
					title: 'CEO',
					organization: 'Acme Corporation',
					reasoning: 'Has power over corporate policy',
					sourceUrl: 'https://example.com/john',
					confidence: 0.9,
					email: 'john.doe@acme.com',
					emailSource: 'https://example.com/contact',
					emailConfidence: 0.85,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			expect(result[0].email).toBe('john.doe@acme.com');
		});

		test('should accept email from known generic domains', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'Senator Smith',
					title: 'U.S. Senator',
					organization: 'U.S. Senate',
					reasoning: 'Federal legislator',
					sourceUrl: 'https://example.com/senator',
					confidence: 0.95,
					email: 'smith@senate.gov',
					emailSource: 'https://senate.gov/contact',
					emailConfidence: 0.9,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'congress'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			expect(result[0].email).toBe('smith@senate.gov');
		});

		test('should calculate combined confidence correctly', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'Jane Doe',
					title: 'Director',
					organization: 'Tech Inc',
					reasoning: 'Decision maker',
					sourceUrl: 'https://example.com/jane',
					confidence: 0.8, // 60% weight
					email: 'jane@techinc.com',
					emailSource: 'https://example.com/contact',
					emailConfidence: 0.6, // 40% weight
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			// Combined: 0.8 * 0.6 + 0.6 * 0.4 = 0.48 + 0.24 = 0.72
			expect(result[0].confidence).toBe(0.72);
		});

		test('should sort by confidence descending', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'Low Confidence',
					title: 'Manager',
					organization: 'Company A',
					reasoning: 'Some power',
					sourceUrl: 'https://example.com/1',
					confidence: 0.5,
					email: 'low@companya.com',
					emailSource: 'https://example.com/contact1',
					emailConfidence: 0.5,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				},
				{
					name: 'High Confidence',
					title: 'CEO',
					organization: 'Company B',
					reasoning: 'Major power',
					sourceUrl: 'https://example.com/2',
					confidence: 0.9,
					email: 'high@companyb.com',
					emailSource: 'https://example.com/contact2',
					emailConfidence: 0.9,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				},
				{
					name: 'Medium Confidence',
					title: 'Director',
					organization: 'Company C',
					reasoning: 'Moderate power',
					sourceUrl: 'https://example.com/3',
					confidence: 0.7,
					email: 'medium@companyc.com',
					emailSource: 'https://example.com/contact3',
					emailConfidence: 0.7,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(3);
			expect(result[0].name).toBe('High Confidence');
			expect(result[1].name).toBe('Medium Confidence');
			expect(result[2].name).toBe('Low Confidence');
		});

		test('should use default contact channel if not provided', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'John Doe',
					title: 'CEO',
					organization: 'Acme Corp',
					reasoning: 'Has power',
					sourceUrl: 'https://example.com/john',
					confidence: 0.9,
					email: 'john@acme.com',
					emailSource: 'https://example.com/contact',
					emailConfidence: 0.85,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1
					// No contactChannel
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			expect(result[0].contactChannel).toBe('email');
		});

		test('should fall back to sourceUrl for emailSource if not provided', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'John Doe',
					title: 'CEO',
					organization: 'Acme Corp',
					reasoning: 'Has power',
					sourceUrl: 'https://example.com/john',
					confidence: 0.9,
					email: 'john@acme.com',
					emailConfidence: 0.85,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1
					// No emailSource
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			expect(result[0].emailSource).toBe('https://example.com/john');
		});

		test('should accept high-confidence emails even with domain mismatch', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'John Doe',
					title: 'CEO',
					organization: 'Acme Corporation',
					reasoning: 'Has power',
					sourceUrl: 'https://example.com/john',
					confidence: 0.9,
					email: 'john.doe@gmail.com', // Domain doesn't match
					emailSource: 'https://linkedin.com/john',
					emailConfidence: 0.85, // High confidence (>= 0.8)
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			expect(result[0].email).toBe('john.doe@gmail.com');
		});

		test('should filter out low-confidence emails with domain mismatch', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'John Doe',
					title: 'CEO',
					organization: 'Acme Corporation',
					reasoning: 'Has power',
					sourceUrl: 'https://example.com/john',
					confidence: 0.9,
					email: 'john.doe@randomdomain.com', // Domain doesn't match
					emailSource: 'https://example.com/contact',
					emailConfidence: 0.5, // Low confidence (< 0.8)
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(0);
		});

		test('should handle university domains correctly', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'Dr. Smith',
					title: 'Professor',
					organization: 'Stanford University',
					reasoning: 'Academic leader',
					sourceUrl: 'https://example.com/smith',
					confidence: 0.9,
					email: 'smith@stanford.edu',
					emailSource: 'https://stanford.edu/faculty',
					emailConfidence: 0.85,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			expect(result[0].email).toBe('smith@stanford.edu');
		});

		test('should round confidence to 2 decimal places', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'Test User',
					title: 'Manager',
					organization: 'Test Corp',
					reasoning: 'Has some power',
					sourceUrl: 'https://example.com/test',
					confidence: 0.777, // 60% weight
					email: 'test@testcorp.com',
					emailSource: 'https://example.com/contact',
					emailConfidence: 0.333, // 40% weight
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'email'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			// Combined: 0.777 * 0.6 + 0.333 * 0.4 = 0.4662 + 0.1332 = 0.5994
			// Rounded: 0.60
			expect(result[0].confidence).toBe(0.6);
		});

		test('should handle empty input array', () => {
			const result = validateAndMerge([]);

			expect(result).toHaveLength(0);
		});

		test('should preserve all required fields in output', () => {
			const enriched: EnrichedDecisionMaker[] = [
				{
					name: 'Complete User',
					title: 'Director',
					organization: 'Complete Corp',
					reasoning: 'Complete reasoning',
					sourceUrl: 'https://example.com/complete',
					confidence: 0.8,
					email: 'complete@completecorp.com',
					emailSource: 'https://example.com/contact',
					emailConfidence: 0.7,
					enrichmentStatus: 'success',
					enrichmentAttempts: 1,
					contactChannel: 'phone'
				}
			];

			const result = validateAndMerge(enriched);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				name: 'Complete User',
				title: 'Director',
				organization: 'Complete Corp',
				email: 'complete@completecorp.com',
				reasoning: 'Complete reasoning',
				sourceUrl: 'https://example.com/complete',
				emailSource: 'https://example.com/contact',
				confidence: 0.76, // 0.8 * 0.6 + 0.7 * 0.4 = 0.48 + 0.28 = 0.76
				contactChannel: 'phone'
			});
		});
	});
});
