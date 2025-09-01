/**
 * Analytics API Integration Tests
 * 
 * Tests the /api/analytics/events endpoint that handles client-side event batching
 * and database storage. Validates the fix for the OAuth funnel tracking issue.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import mockRegistry from '../mocks/registry';
import type { AnalyticsEvent, SessionData } from '$lib/core/analytics/database';

// Mock the API handler
const { POST } = await vi.hoisted(() => import('../../src/routes/api/analytics/events/+server.ts'));

describe('Analytics API Integration', () => {
	let mockDb: any;
	let mockRequest: any;
	let mockGetClientAddress: any;

	beforeEach(() => {
		const mocks = mockRegistry.setupMocks();
		mockDb = mocks['$lib/core/db'].db;
		
		// Setup mock database responses
		mockDb.user_session.upsert = vi.fn().mockResolvedValue({
			id: 'session-123',
			session_id: 'sess_123_abc'
		});
		
		mockDb.analytics_event.createMany = vi.fn().mockResolvedValue({
			count: 3
		});
		
		mockDb.user_session.update = vi.fn().mockResolvedValue({
			id: 'session-123',
			converted: true
		});

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

			const events: AnalyticsEvent[] = [
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

			const response = await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});
			const result = await response.json();

			// Verify response
			expect(result.success).toBe(true);
			expect(result.events_processed).toBe(3);
			expect(result.session_id).toBe('sess_123_abc');

			// Verify database operations
			expect(mockDb.user_session.upsert).toHaveBeenCalledWith({
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

			expect(mockDb.analytics_event.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						session_id: 'sess_123_abc',
						event_type: 'navigation',
						event_name: 'page_view'
					}),
					expect.objectContaining({
						session_id: 'sess_123_abc',
						event_type: 'funnel',
						event_name: 'template_viewed',
						template_id: 'template-789'
					}),
					expect.objectContaining({
						session_id: 'sess_123_abc',
						event_type: 'interaction',
						event_name: 'button_click'
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
			expect(mockDb.user_session.update).toHaveBeenCalledWith({
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
			expect(mockDb.user_session.update).toHaveBeenCalledWith({
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

			const response = await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});
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

			const response = await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});
			const result = await response.json();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid request format');
		});

		it('should handle database errors gracefully', async () => {
			mockDb.user_session.upsert.mockRejectedValue(new Error('Database connection failed'));

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

			const response = await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});
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

			expect(mockDb.user_session.upsert).toHaveBeenCalledWith({
				where: { session_id: 'ip-test-session' },
				create: expect.objectContaining({
					ip_address: '192.168.1.100'
				}),
				update: expect.any(Object)
			});

			expect(mockDb.analytics_event.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining([
					expect.objectContaining({
						ip_address: '192.168.1.100'
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

			expect(mockDb.user_session.upsert).toHaveBeenCalledWith({
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

			const response = await POST({ 
				request: mockRequest, 
				getClientAddress: mockGetClientAddress 
			});
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(result.events_processed).toBe(50);

			// Should batch insert all events in one operation
			expect(mockDb.analytics_event.createMany).toHaveBeenCalledTimes(1);
			expect(mockDb.analytics_event.createMany).toHaveBeenCalledWith({
				data: expect.arrayContaining(largeEventBatch.map(event => 
					expect.objectContaining({
						event_name: event.event_name
					})
				)),
				skipDuplicates: true
			});
		});
	});
});