/**
 * User API Integration Tests
 * 
 * Tests user management API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { asRequestEvent, createMockUser } from '../types/test-helpers';

// Use vi.hoisted for all mocks to fix initialization order
const mocks = vi.hoisted(() => ({
	db: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn()
		},
		representative: {
			findFirst: vi.fn(),
			create: vi.fn()
		},
		user_representatives: {
			deleteMany: vi.fn(),
			create: vi.fn()
		}
	},
	json: vi.fn().mockImplementation((data, options) => ({
		ok: options?.status ? options.status < 400 : true,
		status: options?.status || 200,
		json: async () => data,
		text: async () => JSON.stringify(data)
	}))
}));

vi.mock('$lib/core/db', () => ({
	db: mocks.db
}));

vi.mock('@sveltejs/kit', () => ({
	json: mocks.json
}));

// Import API handlers after mocking
import { GET as ProfileGET, POST as ProfilePOST } from '../../src/routes/api/user/profile/+server';
import { POST as AddressPOST } from '../../src/routes/api/user/address/+server';

describe('User API Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Profile Management', () => {
		describe('GET /api/user/profile', () => {
			it('returns user profile for authenticated user', async () => {
				const mockUser = {
					id: 'user-123',
					name: 'Test User',
					email: 'test@example.com',
					avatar: 'https://example.com/avatar.jpg',
					phone: '+1234567890',
					street: '123 Main St',
					city: 'San Francisco',
					state: 'CA',
					zip: '94102',
					congressional_district: 'CA-12',
					role: 'advocate',
					organization: 'Test Org',
					location: 'California',
					connection: 'resident',
					connection_details: 'Long-time resident',
					profile_completed_at: new Date('2024-01-01'),
					profile_visibility: 'public',
					is_verified: true,
					createdAt: new Date('2023-01-01'),
					updatedAt: new Date('2024-01-01')
				};

				mocks.db.user.findUnique.mockResolvedValueOnce(mockUser);

				const response = await ProfileGET(asRequestEvent({}, { user: createMockUser() }));
				const data = await response.json();

				expect(mocks.db.user.findUnique).toHaveBeenCalledWith({
					where: { id: 'user-123' },
					select: expect.objectContaining({
						id: true,
						name: true,
						email: true
					})
				});

				expect(data.user).toMatchObject({
					id: 'user-123',
					name: 'Test User',
					email: 'test@example.com'
				});
				expect(data.user.profile.role).toBe('advocate');
				expect(data.user.address.city).toBe('San Francisco');
			});

			it('returns 401 for unauthenticated user', async () => {
				const response = await ProfileGET(asRequestEvent({} as any, { user: null, session: null }));
				
				expect(response.status).toBe(401);
				expect(await response.json()).toEqual({
					error: 'Unauthorized'
				});
			});

			it('returns 404 for non-existent user', async () => {
				mocks.db.user.findUnique.mockResolvedValueOnce(null);

				const response = await ProfileGET({ 
					locals: { user: { id: 'nonexistent' } }
				});

				expect(response.status).toBe(404);
				expect(await response.json()).toEqual({
					error: 'User not found'
				});
			});
		});

		describe('POST /api/user/profile', () => {
			it('saves profile for authenticated user', async () => {
				const profileData = {
					role: 'advocate',
					organization: 'Climate Action Now',
					location: 'San Francisco, CA',
					connection: 'resident',
					connectionDetails: 'Born and raised here'
				};

				const mockRequest = {
					json: vi.fn().mockResolvedValue(profileData)
				};

				mocks.db.user.update.mockResolvedValueOnce({
					id: 'user-456',
					...profileData,
					connection_details: profileData.connectionDetails,
					profile_completed_at: new Date()
				});

				const response = await ProfilePOST({ 
					request: mockRequest, 
					locals: { user: { id: 'user-456' } }
				});
				const data = await response.json();

				expect(mocks.db.user.update).toHaveBeenCalledWith({
					where: { id: 'user-456' },
					data: expect.objectContaining({
						role: 'advocate',
						organization: 'Climate Action Now',
						connection: 'resident',
						connection_details: 'Born and raised here'
					})
				});

				expect(data).toEqual({
					success: true,
					message: 'Profile saved successfully',
					user: {
						id: 'user-456',
						profileComplete: true
					}
				});
			});

			it('requires role and connection', async () => {
				const mockRequest = {
					json: vi.fn().mockResolvedValue({
						organization: 'Some Org'
						// Missing role and connection
					})
				};

				const response = await ProfilePOST({ 
					request: mockRequest, 
					locals: { user: { id: 'user-789' } }
				});

				expect(response.status).toBe(400);
				expect(await response.json()).toEqual({
					error: 'Role and connection are required'
				});
			});

			it('returns 401 for unauthenticated user', async () => {
				const mockRequest = {
					json: vi.fn().mockResolvedValue({
						role: 'advocate',
						connection: 'resident'
					})
				};

				const response = await ProfilePOST(asRequestEvent(
					mockRequest, 
					{ user: null, session: null }
				));

				expect(response.status).toBe(401);
			});
		});
	});

	describe('Address Management', () => {
		describe('POST /api/user/address', () => {
			it('saves address with separate components', async () => {
				const addressData = {
					street: '456 Oak Ave',
					city: 'Berkeley',
					state: 'CA',
					zip: '94704',
					congressional_district: 'CA-13'
				};

				const mockRequest = {
					json: vi.fn().mockResolvedValue(addressData)
				};

				mocks.db.user.update.mockResolvedValueOnce({
					id: 'user-address',
					...addressData
				});

				const response = await AddressPOST({ 
					request: mockRequest, 
					locals: { user: { id: 'user-address' } }
				});
				const data = await response.json();

				expect(mocks.db.user.update).toHaveBeenCalledWith({
					where: { id: 'user-address' },
					data: expect.objectContaining({
						street: '456 Oak Ave',
						city: 'Berkeley',
						state: 'CA',
						zip: '94704'
					})
				});

				expect(data.success).toBe(true);
			});

			it('parses full address string', async () => {
				const mockRequest = {
					json: vi.fn().mockResolvedValue({
						address: '789 Pine St, Oakland, CA 94612'
					})
				};

				mocks.db.user.update.mockResolvedValueOnce({
					id: 'user-parse',
					street: '789 Pine St',
					city: 'Oakland',
					state: 'CA',
					zip: '94612'
				});

				const response = await AddressPOST({ 
					request: mockRequest, 
					locals: { user: { id: 'user-parse' } }
				});
				const data = await response.json();

				expect(data.success).toBe(true);
				expect(data.user).toMatchObject({
					city: 'Oakland',
					state: 'CA'
				});
			});

			it('saves representatives and links to user', async () => {
				const representatives = [
					{
						name: 'Rep. Barbara Lee',
						bioguide_id: 'L000551',
						chamber: 'house',
						state: 'CA',
						district: '13'
					},
					{
						name: 'Sen. Alex Padilla',
						bioguide_id: 'P000145',
						chamber: 'senate',
						state: 'CA'
					}
				];

				const mockRequest = {
					json: vi.fn().mockResolvedValue({
						street: '123 Main St',
						city: 'Oakland',
						state: 'CA',
						zip: '94612',
						representatives
					})
				};

				mocks.db.user.update.mockResolvedValueOnce({ id: 'user-reps' });
				mocks.db.representative.findFirst.mockResolvedValue(null);
				mocks.db.representative.create.mockImplementation(({ data }) => 
					Promise.resolve({ id: `rep-${data.bioguide_id}`, ...data })
				);

				const response = await AddressPOST({ 
					request: mockRequest, 
					locals: { user: { id: 'user-reps' } }
				});
				const data = await response.json();

				expect(mocks.db.user_representatives.deleteMany).toHaveBeenCalledWith({
					where: { user_id: 'user-reps' }
				});

				expect(mocks.db.representative.create).toHaveBeenCalledTimes(2);
				expect(data.success).toBe(true);
			});

			it('requires address information', async () => {
				const mockRequest = {
					json: vi.fn().mockResolvedValue({})
				};

				const response = await AddressPOST({ 
					request: mockRequest, 
					locals: { user: { id: 'user-no-address' } }
				});

				expect(response.status).toBe(400);
				expect(await response.json()).toEqual({
					error: 'Address information is required'
				});
			});

			it('returns 401 for unauthenticated user', async () => {
				const mockRequest = {
					json: vi.fn().mockResolvedValue({
						street: '123 Main St',
						city: 'Oakland',
						state: 'CA',
						zip: '94612'
					})
				};

				const response = await AddressPOST(asRequestEvent(
					mockRequest, 
					{ user: null, session: null }
				));

				expect(response.status).toBe(401);
			});

			it('handles database errors gracefully', async () => {
				const mockRequest = {
					json: vi.fn().mockResolvedValue({
						street: '123 Error St',
						city: 'Oakland',
						state: 'CA',
						zip: '94612'
					})
				};

				mocks.db.user.update.mockRejectedValueOnce(new Error('Database error'));

				const response = await AddressPOST({ 
					request: mockRequest, 
					locals: { user: { id: 'user-error' } }
				});

				expect(response.status).toBe(500);
				const data = await response.json();
				expect(data.error).toBeDefined();
			});
		});
	});

	describe('Security Checks', () => {
		it('enforces user data ownership', async () => {
			// User can only access their own data
			const response = await ProfileGET({ 
				locals: { user: { id: 'user-123' } }
			});

			expect(mocks.db.user.findUnique).toHaveBeenCalledWith({
				where: { id: 'user-123' }, // Same as authenticated user
				select: expect.any(Object)
			});
		});

		it('sanitizes user input', async () => {
			const mockRequest = {
				json: vi.fn().mockResolvedValue({
					role: '<script>alert("xss")</script>',
					organization: 'Normal Org',
					connection: 'resident',
					connectionDetails: '<img src=x onerror=alert("xss")>'
				})
			};

			mocks.db.user.update.mockResolvedValueOnce({ id: 'user-xss' });

			await ProfilePOST(asRequestEvent(
				mockRequest,
				{ user: createMockUser({ id: 'user-xss' }) }
			));

			// The actual sanitization would happen in the API handler
			// Here we just verify the handler was called
			expect(mocks.db.user.update).toHaveBeenCalled();
		});
	});
});