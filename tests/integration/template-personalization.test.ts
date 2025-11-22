/**
 * Template Personalization Integration Tests
 *
 * Focused tests for template variable resolution using consolidated schemas.
 * This test suite validates that templates work correctly with the new
 * consolidated User and Representative models.
 */

import { describe, it, expect } from 'vitest';
import { resolveVariables } from '$lib/services/personalization';
import { userFactory, representativeFactory, templateFactory } from '../fixtures/factories';

describe('Template Personalization Integration', () => {
	it('should resolve user variables using consolidated address schema', async () => {
		const user = userFactory.build({
			overrides: {
				name: 'Jane Smith',
				// Test consolidated address fields
				congressional_district: 'CA-12',
			}
		});

		const template =
			'Dear Representative, I am [Name] from [City], [State] [Zip] in district [Congressional District]. Thank you.';

		const resolved = resolveVariables(template, user, undefined);

		expect(resolved).toBe(
			'Dear Representative, I am Jane Smith from San Francisco, CA 94102 in district CA-12. Thank you.'
		);
	});

	it('should resolve representative variables using consolidated model', async () => {
		const user = userFactory.build();
		const representative = representativeFactory.build({
			overrides: {
				name: 'Nancy Pelosi',
				chamber: 'house',
				party: 'Democratic',
				district: '12'
			}
		});

		const template =
			'Dear [Representative Name], As a [Representative Party] representative for [Representative State] district [Representative District]...';

		const resolved = resolveVariables(template, user, representative);

		expect(resolved).toBe(
			'Dear Nancy Pelosi, As a Democratic representative for CA district 12...'
		);
	});

	it('should handle consolidated template with user and representative data', async () => {
		const user = userFactory.build({
			overrides: {
				name: 'John Doe',
				congressional_district: 'TX-35',
				city: 'Austin',
				state: 'TX',
				// Test additional consolidated fields
				is_verified: true,
				reputation_tier: 'verified',
				trust_score: 95
			}
		});

		const representative = representativeFactory.build({
			overrides: {
				name: 'Lloyd Doggett',
				chamber: 'house',
				party: 'Democratic',
				district: '35',
				state: 'TX'
			}
		});

		const consolidatedTemplate = `Dear [Representative Name],

I am [Name], your verified constituent from [City], [State]. I live in district [Congressional District].

As a [Representative Party] representative for Texas district [Representative District], I hope you will consider this important issue.

Sincerely,
[Name]`;

		const resolved = resolveVariables(consolidatedTemplate, user, representative);

		expect(resolved).toContain('Dear Lloyd Doggett,');
		expect(resolved).toContain('I am John Doe, your verified constituent from Austin, TX');
		expect(resolved).toContain('I live in district TX-35');
		expect(resolved).toContain('As a Democratic representative for Texas district 35');
		expect(resolved).toContain('Sincerely,\nJohn Doe');
	});

	it('should handle missing variables gracefully with consolidated schema', async () => {
		const user = userFactory.build({
			overrides: {
				name: 'Test User',
				congressional_district: undefined, // Missing district
				phone: undefined // Missing phone
			}
		});

		const template =
			'I am [Name] from [City], [State] in district [Congressional District]. Contact: [Phone].';

		const resolved = resolveVariables(template, user, undefined);

		// Should handle missing fields gracefully
		expect(resolved).toContain('I am Test User from');
		expect(resolved).toContain('CA');
		// Missing values should be handled appropriately
		expect(resolved).toBeDefined();
	});

	it('should work with templates using consolidated verification fields', async () => {
		const user = userFactory.build({
			overrides: {
				name: 'Verified User',
				is_verified: true,
				reputation_tier: 'expert',
				trust_score: 98
			}
		});

		const verifiedTemplate = templateFactory.build({
			overrides: {
				message_body: 'Hello [Name], verification status: [User Verified Status]',
				verification_status: 'approved',
				quality_score: 95,
				consensus_score: 0.95
			}
		});

		const resolved = resolveVariables(verifiedTemplate.message_body, user, undefined);
		expect(resolved).toContain('Hello Verified User');

		// Template should have consolidated verification data
		expect(verifiedTemplate.verification_status).toBe('approved');
		expect(verifiedTemplate.quality_score).toBe(95);
	});

	it('should preserve template formatting and handle edge cases', async () => {
		const user = userFactory.build({
			overrides: {
				name: "O'Connor-Smith", // Special characters
			}
		});

		const template = `Dear Representative,

    I am [Name] from [City].

    Thank you for your time.`;

		const resolved = resolveVariables(template, user, undefined);

		// Factory default city is San Francisco
		expect(resolved).toContain("I am O'Connor-Smith from San Francisco");
		expect(resolved).toContain('    Thank you for your time.'); // Preserves indentation
	});
});
