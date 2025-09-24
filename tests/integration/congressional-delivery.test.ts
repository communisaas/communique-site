import { createMockRequestEvent } from '../helpers/request-event';
/**
 * Congressional Delivery Integration Tests
 *
 * Consolidated tests for congressional message delivery pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnknownRecord } from '../../src/lib/types/any-replacements';
import {
	userFactory as _userFactory,
	templateFactory as _templateFactory,
	testScenarios
} from '../fixtures/factories';

// Setup mocks using vi.hoisted
const mocks = vi.hoisted(() => ({
	db: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn()
		},
		template: {
			findUnique: vi.fn()
		},
		user_representatives: {
			findMany: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn()
		},
		representative: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
			create: vi.fn()
		}
	},
	addressLookup: {
		lookupRepsByAddress: vi.fn()
	},
	cwcClient: {
		submitToHouse: vi.fn(),
		submitToSenate: vi.fn()
	},
	resolveVariables: vi.fn(),
	deliveryPipeline: {
		deliverToRepresentatives: vi.fn()
	}
}));

// Mock SvelteKit utilities
vi.mock('@sveltejs/kit', () => ({
	json: (data: UnknownRecord, init?: ResponseInit) => {
		return new Response(JSON.stringify(data), {
			...init,
			headers: {
				'content-type': 'application/json',
				...(init?.headers || {})
			}
		});
	},
	error: (status: number, message: string) => {
		return new Response(JSON.stringify({ error: message }), {
			status,
			headers: {
				'content-type': 'application/json'
			}
		});
	}
}));

// Apply mocks
vi.mock('$lib/core/db', () => ({
	db: mocks.db
}));

vi.mock('$lib/core/congress/address-lookup', () => ({
	addressLookup: mocks.addressLookup
}));

vi.mock('$lib/core/congress/cwc-client', () => ({
	cwcClient: mocks.cwcClient
}));

vi.mock('$lib/services/personalization', () => ({
	resolveVariables: mocks.resolveVariables
}));

vi.mock('$lib/core/legislative', () => ({
	deliveryPipeline: mocks.deliveryPipeline
}));

// Import handler after mocks
import { POST } from '../../src/routes/api/civic/routing/+server';

describe('Congressional Delivery Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default successful responses
		mocks.deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
			job_id: 'test-job-123',
			total_recipients: 3,
			successful_deliveries: 3,
			failed_deliveries: 0,
			results: [
				{ success: true, message_id: 'house-msg-123', metadata: { representative: 'Rep. Pelosi' } },
				{
					success: true,
					message_id: 'senate-msg-456',
					metadata: { representative: 'Sen. Padilla' }
				},
				{ success: true, message_id: 'senate-msg-789', metadata: { representative: 'Sen. Butler' } }
			],
			duration_ms: 1500
		});

		mocks.addressLookup.lookupRepsByAddress.mockResolvedValue([
			{ name: 'Rep. Pelosi', chamber: 'house', bioguide_id: 'P000197' },
			{ name: 'Sen. Padilla', chamber: 'senate', bioguide_id: 'P000145' },
			{ name: 'Sen. Butler', chamber: 'senate', bioguide_id: 'B000001' }
		]);

		mocks.cwcClient.submitToHouse.mockResolvedValue({
			success: true,
			message_id: 'house-msg-123'
		});

		mocks.cwcClient.submitToSenate.mockResolvedValue({
			success: true,
			message_id: 'senate-msg-456'
		});

		mocks.resolveVariables.mockImplementation((template, context) => {
			return template.replace('[user.name]', context.user?.name || 'Guest');
		});
	});

	describe('Authenticated User Flow', () => {
		it('delivers message from template selection to congressional offices', async () => {
			const user = testScenarios.californiaUser();
			const template = testScenarios.climateTemplate();
			const routingEmail = testScenarios.routingEmail();

			mocks.db.user.findUnique.mockResolvedValue(user);
			mocks.db.template.findUnique.mockResolvedValue(template);

			const mockRequest = {
				json: vi.fn().mockResolvedValue(routingEmail)
			};

			const response = await POST(createMockRequestEvent(mockRequest, '/api/civic/routing'));
			const responseData = JSON.parse(await response.text());

			expect(response.status).toBe(200);
			expect(responseData.success).toBe(true);
			expect(responseData.deliveryCount).toBe(3);

			// Verify database queries
			expect(mocks.db.user.findUnique).toHaveBeenCalledWith({
				where: { id: 'action-user123' }
			});
			expect(mocks.db.template.findUnique).toHaveBeenCalledWith({
				where: { id: 'climate' }
			});

			// Verify delivery pipeline called with consolidated user address fields
			expect(mocks.deliveryPipeline.deliverToRepresentatives).toHaveBeenCalledWith(
				expect.objectContaining({
					user: expect.objectContaining({
						id: 'action-user123',
						name: 'Alice Cooper',
						email: 'alice@example.com',
						address: expect.objectContaining({
							street: expect.any(String),
							city: 'San Francisco',
							state: 'CA',
							postal_code: '94102',
							country_code: 'US'
						})
					})
				})
			);
		});
	});

	describe('Guest User Flow', () => {
		it('handles guest users with onboarding flow', async () => {
			const template = testScenarios.climateTemplate();
			const guestEmail = testScenarios.guestRoutingEmail();

			mocks.db.template.findUnique.mockResolvedValue(template);

			const mockRequest = {
				json: vi.fn().mockResolvedValue(guestEmail)
			};

			const response = await POST(createMockRequestEvent(mockRequest, '/api/civic/routing'));
			const responseData = JSON.parse(await response.text());

			expect(response.status).toBe(200);
			expect(responseData.success).toBe(true);
			expect(responseData.message).toContain('Onboarding');
		});
	});

	describe('Error Handling', () => {
		it('gracefully handles address lookup failures', async () => {
			const user = testScenarios.californiaUser();
			const template = testScenarios.climateTemplate();

			mocks.db.user.findUnique.mockResolvedValue(user);
			mocks.db.template.findUnique.mockResolvedValue(template);

			// Make delivery pipeline fail
			mocks.deliveryPipeline.deliverToRepresentatives.mockRejectedValue(
				new Error('Address service unavailable')
			);

			const mockRequest = {
				json: vi.fn().mockResolvedValue(testScenarios.routingEmail())
			};

			const response = await POST(createMockRequestEvent(mockRequest, '/api/civic/routing'));

			expect(response.status).toBe(500);
			const errorData = JSON.parse(await response.text());
			expect(errorData.error).toContain('Failed to process congressional routing');
		});

		it('continues delivery even if some CWC submissions fail', async () => {
			const user = testScenarios.californiaUser();
			const template = testScenarios.climateTemplate();

			mocks.db.user.findUnique.mockResolvedValue(user);
			mocks.db.template.findUnique.mockResolvedValue(template);

			// One submission fails
			mocks.deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
				job_id: 'partial-job-123',
				total_recipients: 3,
				successful_deliveries: 2,
				failed_deliveries: 1,
				results: [
					{ success: true, message_id: 'house-msg-123' },
					{ success: false, error: 'CWC API error' },
					{ success: true, message_id: 'senate-msg-789' }
				],
				duration_ms: 2000
			});

			const mockRequest = {
				json: vi.fn().mockResolvedValue(testScenarios.routingEmail())
			};

			const response = await POST(createMockRequestEvent(mockRequest, '/api/civic/routing'));
			const responseData = JSON.parse(await response.text());

			expect(response.status).toBe(200);
			expect(responseData.deliveryCount).toBe(2);
			expect(responseData.totalRecipients).toBe(3);
		});

		it('validates routing address format', async () => {
			const mockRequest = {
				json: vi.fn().mockResolvedValue({
					to: 'invalid-address@example.com', // Bad routing format
					from: 'user@example.com',
					subject: 'Test',
					body: 'Test'
				})
			};

			const response = await POST(createMockRequestEvent(mockRequest, '/api/civic/routing'));

			expect(response.status).toBe(400);
			const errorData = JSON.parse(await response.text());
			expect(errorData.error).toContain('Invalid routing address format');
		});

		it('handles missing template gracefully', async () => {
			// Mock user to exist but template to be null
			mocks.db.user.findUnique.mockResolvedValue(testScenarios.californiaUser());
			mocks.db.template.findUnique.mockResolvedValue(null);

			const mockRequest = {
				json: vi.fn().mockResolvedValue(testScenarios.routingEmail())
			};

			const response = await POST(createMockRequestEvent(mockRequest, '/api/civic/routing'));

			expect(response.status).toBe(404);
			const errorData = JSON.parse(await response.text());
			expect(errorData.error).toContain('Template not found');
		});
	});

	describe('Template Processing', () => {
		it('passes consolidated template and user data to delivery pipeline', async () => {
			const user = testScenarios.californiaUser();
			const template = {
				...testScenarios.climateTemplate(),
				message_body: 'Dear [representative.title], I am [user.name] from [user.city].',
				// Test consolidated verification fields
				verification_status: 'approved',
				quality_score: 85,
				consensus_score: 0.9
			};

			mocks.db.user.findUnique.mockResolvedValue(user);
			mocks.db.template.findUnique.mockResolvedValue(template);

			const mockRequest = {
				json: vi.fn().mockResolvedValue(testScenarios.routingEmail())
			};

			await POST(createMockRequestEvent(mockRequest, '/api/civic/routing'));

			// Verify consolidated schema usage
			expect(mocks.deliveryPipeline.deliverToRepresentatives).toHaveBeenCalledWith(
				expect.objectContaining({
					template: expect.objectContaining({
						id: template.id,
						message_body: template.message_body,
						subject: template.subject
					}),
					user: expect.objectContaining({
						id: user.id,
						name: user.name,
						email: user.email,
						address: expect.objectContaining({
							city: user.city,
							state: user.state,
							postal_code: user.zip,
							country_code: 'US'
						})
					})
				})
			);
		});
	});
});
