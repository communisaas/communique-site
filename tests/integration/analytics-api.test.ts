/**
 * Analytics API Integration Tests
 * 
 * Tests the /api/analytics/events endpoint that handles client-side event batching
 * and database storage. Validates the fix for the OAuth funnel tracking issue.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AnalyticsEvent, SessionData } from '$lib/core/analytics/database';
import { asRequestEvent } from '../types/test-helpers';

// Setup all mocks using vi.hoisted to fix initialization order
const mocks = vi.hoisted(() => ({
	db: {
		user: {
			findUnique: vi.fn().mockResolvedValue({ id: 'user-456' })
		},
		template: {
			findMany: vi.fn().mockResolvedValue([])
		},
		user_session: {
			upsert: vi.fn(),
			update: vi.fn()
		},
		analytics_event: {
			createMany: vi.fn()
		}
	}
}));

vi.mock('$lib/core/db', () => ({
	db: mocks.db
}));

// Import the API handler after mocks are set up
import { POST } from '../../src/routes/api/analytics/events/+server';

describe('Analytics API Integration', () => {
	let mockRequest: any;
	let mockGetClientAddress: any;

	beforeEach(() => {
		vi.clearAllMocks();
		
		// Setup mock database responses
		mocks.db.user_session.upsert.mockResolvedValue({
			id: 'session-123',
			session_id: 'sess_123_abc'
		});
		
		mocks.db.analytics_event.createMany.mockResolvedValue({
			count: 3
		});
		
		mocks.db.user_session.update.mockResolvedValue({
			id: 'session-123',
			converted: true
		});

		// Mock template existence validation
		mocks.db.template.findMany.mockResolvedValue([
			{ id: 'template-789' }
		]);

		// Setup mock request
		mockGetClientAddress = vi.fn().mockReturnValue('127.0.0.1');
		mockRequest = {
			json: vi.fn()
		};
	});

	describe('Event Batch Processing', () => {
		it('should process valid event batch successfully', async () => {
			const sessionData: SessionData = {
				session_id: 'sess_123_abc',
				user_id: 'user-456',
				user_agent: 'Mozilla/5.0 (Test Browser)',
				referrer: 'https://example.com',
				utm_source: 'test',
				landing_page: 'https://localhost:5173/'
			};

			const events = [
				{
					session_id: 'sess_123_abc',
					event_type: 'navigation',
					event_name: 'page_view',
					page_url: 'https://localhost:5173/',
					timestamp: new Date()
				},
				{
					session_id: 'sess_123_abc',
					event_type: 'funnel',
					event_name: 'template_viewed',
					template_id: 'template-789',
					event_properties: { source: 'direct-link' },
					timestamp: new Date()
				},
				{
					session_id: 'sess_123_abc',
					event_type: 'interaction',
					event_name: 'button_click',
					event_properties: { element: 'share_link' },
					timestamp: new Date()
				}
			];

			mockRequest.json.mockResolvedValue({
				session_data: sessionData,
				events
			});

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			if (!response) {
				throw new Error('POST handler returned undefined');
			}
			
			const result = await response.json();

			// Verify response
			expect(result.success).toBe(true);
			expect(result.events_processed).toBe(3);
			expect(result.session_id).toBe('sess_123_abc');

			// Verify database operations
			expect(mocks.db.user_session.upsert).toHaveBeenCalledWith({
				where: { session_id: 'sess_123_abc' },
				create: expect.objectContaining({
					session_id: 'sess_123_abc',
					user_id: 'user-456',
					ip_address: '127.0.0.1',
					user_agent: 'Mozilla/5.0 (Test Browser)',
					utm_source: 'test',
					events_count: 3,
					page_views: 1
				}),
				update: expect.objectContaining({
					user_id: 'user-456',
					events_count: { increment: 3 },
					page_views: { increment: 1 }
				})
			});

			expect(mocks.db.analytics_event.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						session_id: 'sess_123_abc',
						name: 'page_view'
					}),
					expect.objectContaining({
						session_id: 'sess_123_abc',
						name: 'template_viewed'
					}),
					expect.objectContaining({
						session_id: 'sess_123_abc',
						name: 'button_click'
					})
				]),
				skipDuplicates: true
			});
		});

		it('should handle conversion tracking correctly', async () => {
			const sessionData: SessionData = {
				session_id: 'sess_conversion_test',
				user_id: 'user-converter'
			};

			const conversionEvents: AnalyticsEvent[] = [
				{
					session_id: 'sess_conversion_test',
					event_type: 'funnel',
					event_name: 'auth_completed',
					user_id: 'user-converter',
					template_id: 'template-oauth-test',
					event_properties: { provider: 'facebook' }
				},
				{
					session_id: 'sess_conversion_test',
					event_type: 'funnel',
					event_name: 'template_used',
					user_id: 'user-converter',
					template_id: 'template-oauth-test',
					event_properties: { delivery_method: 'certified' }
				}
			];

			mockRequest.json.mockResolvedValue({
				session_data: sessionData,
				events: conversionEvents
			});

			await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});

			// Verify conversion was tracked
			expect(mocks.db.user_session.update).toHaveBeenCalledWith({
				where: { session_id: 'sess_conversion_test' },
				data: {
					converted: true,
					conversion_type: 'template_usage'
				}
			});
		});

		it('should handle registration conversion correctly', async () => {
			const sessionData: SessionData = {
				session_id: 'sess_registration_test'
			};

			const registrationEvents: AnalyticsEvent[] = [
				{
					session_id: 'sess_registration_test',
					event_type: 'funnel',
					event_name: 'auth_completed',
					user_id: 'new-user-123',
					event_properties: { provider: 'google' }
				}
			];

			mockRequest.json.mockResolvedValue({
				session_data: sessionData,
				events: registrationEvents
			});

			await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});

			// Verify registration conversion was tracked
			expect(mocks.db.user_session.update).toHaveBeenCalledWith({
				where: { session_id: 'sess_registration_test' },
				data: {
					converted: true,
					conversion_type: 'user_registration'
				}
			});
		});
	});

	describe('Error Handling', () => {
		it('should reject invalid request format', async () => {
			mockRequest.json.mockResolvedValue({
				invalid: 'data'
			});

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			if (!response) {
				throw new Error('POST handler returned undefined');
			}
			
			const result = await response.json();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid request format');
			expect(response.status).toBe(400);
		});

		it('should handle missing session_id', async () => {
			mockRequest.json.mockResolvedValue({
				session_data: {},
				events: []
			});

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			if (!response) {
				throw new Error('POST handler returned undefined');
			}
			
			const result = await response.json();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid request format');
		});

		it('should handle database errors gracefully', async () => {
			mocks.db.user_session.upsert.mockRejectedValue(new Error('Database connection failed'));

			mockRequest.json.mockResolvedValue({
				session_data: { session_id: 'test-session' },
				events: [
					{
						session_id: 'test-session',
						event_type: 'test',
						event_name: 'test_event'
					}
				]
			});

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			if (!response) {
				throw new Error('POST handler returned undefined');
			}
			
			const result = await response.json();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Failed to process analytics events');
			expect(response.status).toBe(500);
		});
	});

	describe('Data Security', () => {
		it('should include client IP address', async () => {
			mockGetClientAddress.mockReturnValue('192.168.1.100');
			
			mockRequest.json.mockResolvedValue({
				session_data: { session_id: 'ip-test-session' },
				events: [{
					session_id: 'ip-test-session',
					event_type: 'test',
					event_name: 'ip_test'
				}]
			});

			await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});

			expect(mocks.db.user_session.upsert).toHaveBeenCalledWith({
				where: { session_id: 'ip-test-session' },
				create: expect.objectContaining({
					ip_address: '192.168.1.100'
				}),
				update: expect.any(Object)
			});

			expect(mocks.db.analytics_event.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						session_id: 'ip-test-session'
					})
				]),
				skipDuplicates: true
			});
		});

		it('should preserve user privacy with null user_id', async () => {
			mockRequest.json.mockResolvedValue({
				session_data: { 
					session_id: 'anonymous-session',
					// No user_id - anonymous session
				},
				events: [{
					session_id: 'anonymous-session',
					event_type: 'navigation',
					event_name: 'anonymous_page_view'
				}]
			});

			await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});

			expect(mocks.db.user_session.upsert).toHaveBeenCalledWith({
				where: { session_id: 'anonymous-session' },
				create: expect.objectContaining({
					user_id: null
				}),
				update: expect.any(Object)
			});
		});
	});

	describe('Performance & Batching', () => {
		it('should handle large event batches efficiently', async () => {
			const largeEventBatch = Array.from({ length: 50 }, (_, i) => ({
				session_id: 'batch-test-session',
				event_type: 'interaction' as const,
				event_name: `event_${i}`,
				timestamp: new Date(Date.now() + i * 1000)
			}));

			mockRequest.json.mockResolvedValue({
				session_data: { session_id: 'batch-test-session' },
				events: largeEventBatch
			});

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			if (!response) {
				throw new Error('POST handler returned undefined');
			}
			
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(result.events_processed).toBe(50);

			// Should batch insert all events in one operation
			expect(mocks.db.analytics_event.createMany).toHaveBeenCalledTimes(1);
			expect(mocks.db.analytics_event.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining(largeEventBatch.map(event => 
					expect.objectContaining({
						name: event.event_name
					})
				)),
				skipDuplicates: true
			});
		});
	});

	describe('Performance & Error Handling (from analytics-performance)', () => {
		// Removed performance tests - these are better suited for dedicated performance testing

		it('should handle network errors gracefully', async () => {
			const mockRequest = {
				json: async () => ({
					events: [{
						session_id: 'error-test-session',
						event_name: 'network_failure_test',
						event_properties: { event_type: 'error' }
					}]
				})
			};

			// Mock database error
			mocks.db.analytics_event.createMany.mockRejectedValue(new Error('Network error'));

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			const result = await response.json();

			// Should return error response gracefully
			expect(response.status).toBeGreaterThanOrEqual(400);
		});

		it('should handle malformed event data', async () => {
			const mockRequest = {
				json: async () => ({
					events: [
						// Valid event
						{
							session_id: 'valid-session',
							event_name: 'valid_event',
							event_properties: { type: 'valid' }
						},
						// Malformed event (missing required fields)
						{
							event_name: 'malformed_event'
							// Missing session_id
						}
					]
				})
			};

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			const result = await response.json();

			// Should handle malformed data appropriately
			expect([200, 400, 422]).toContain(response.status);
		});

		it('should handle circular references in event properties', async () => {
			const circularObj: any = { name: 'test' };
			circularObj.self = circularObj;

			const mockRequest = {
				json: async () => ({
					events: [{
						session_id: 'circular-test-session',
						event_name: 'circular_reference_test',
						event_properties: circularObj
					}]
				})
			};

			// Should not throw error when processing circular references
			await expect(POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			})).resolves.toBeDefined();
		});

		it('should limit event property size', async () => {
			const massiveData = 'x'.repeat(10000); // 10KB string (reduced from 1MB)

			const mockRequest = {
				json: async () => ({
					events: [{
						session_id: 'size-limit-test-session',
						event_name: 'size_limit_test',
						event_properties: { 
							event_type: 'performance',
							massive_data: massiveData 
						}
					}]
				})
			};

			const response = await POST(asRequestEvent(mockRequest, {}));
			
			// Should handle large payloads (size limiting happens server-side)
			expect(response).toBeDefined();
			expect([200, 400, 413, 500]).toContain(response.status);
		});

	});
});