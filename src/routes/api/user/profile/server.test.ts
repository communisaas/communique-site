import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

// Mock the database
const mockDb = {
	user: {
		update: vi.fn(),
		findUnique: vi.fn()
	}
};

vi.mock('$lib/server/db', () => ({
	db: mockDb
}));

describe('User Profile API', () => {
	// Mock user data
	const mockUser = {
		id: 'user-123',
		name: 'Test User',
		email: 'test@example.com',
		phone: null
	};

	const mockProfileData = {
		role: 'advocate',
		organization: 'Test Organization',
		location: 'San Francisco, CA',
		connection: 'personal',
		connectionDetails: 'I care about this issue personally'
	};

	const createMockRequest = (data?: any, user?: any) => ({
		request: {
			json: vi.fn().mockResolvedValue(data || {})
		},
		locals: {
			user: user || null
		}
	} as unknown as RequestEvent);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('POST /api/user/profile', () => {
		it('should save profile for authenticated user', async () => {
			const updatedUser = {
				...mockUser,
				phone: JSON.stringify({
					...mockProfileData,
					completedAt: expect.any(String)
				}),
				updatedAt: new Date()
			};

			mockDb.user.update.mockResolvedValue(updatedUser);

			const mockRequest = createMockRequest(mockProfileData, mockUser);
			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(mockDb.user.update).toHaveBeenCalledWith({
				where: { id: 'user-123' },
				data: {
					phone: expect.stringContaining(mockProfileData.role),
					updatedAt: expect.any(Date)
				}
			});

			expect(responseData).toEqual({
				success: true,
				message: 'Profile saved successfully',
				user: {
					id: 'user-123',
					profileComplete: true
				}
			});
		});

		it('should require authentication', async () => {
			const mockRequest = createMockRequest(mockProfileData); // No user

			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(401);
			expect(responseData).toEqual({
				error: 'Unauthorized'
			});
			expect(mockDb.user.update).not.toHaveBeenCalled();
		});

		it('should require role and connection fields', async () => {
			const incompleteData = {
				organization: 'Test Organization'
				// Missing role and connection
			};

			const mockRequest = createMockRequest(incompleteData, mockUser);
			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(400);
			expect(responseData).toEqual({
				error: 'Role and connection are required'
			});
			expect(mockDb.user.update).not.toHaveBeenCalled();
		});

		it('should handle missing role field', async () => {
			const dataWithoutRole = {
				connection: 'personal',
				organization: 'Test Organization'
			};

			const mockRequest = createMockRequest(dataWithoutRole, mockUser);
			const response = await POST(mockRequest);

			expect(response.status).toBe(400);
			expect(mockDb.user.update).not.toHaveBeenCalled();
		});

		it('should handle missing connection field', async () => {
			const dataWithoutConnection = {
				role: 'advocate',
				organization: 'Test Organization'
			};

			const mockRequest = createMockRequest(dataWithoutConnection, mockUser);
			const response = await POST(mockRequest);

			expect(response.status).toBe(400);
			expect(mockDb.user.update).not.toHaveBeenCalled();
		});

		it('should handle optional fields gracefully', async () => {
			const minimalData = {
				role: 'advocate',
				connection: 'personal'
				// No organization, location, or connectionDetails
			};

			mockDb.user.update.mockResolvedValue({
				...mockUser,
				phone: JSON.stringify({
					...minimalData,
					organization: null,
					location: null,
					connectionDetails: null,
					completedAt: expect.any(String)
				})
			});

			const mockRequest = createMockRequest(minimalData, mockUser);
			const response = await POST(mockRequest);

			expect(response.status).toBe(200);
			expect(mockDb.user.update).toHaveBeenCalledWith({
				where: { id: 'user-123' },
				data: {
					phone: expect.stringContaining('"organization":null'),
					updatedAt: expect.any(Date)
				}
			});
		});

		it('should store profile data as JSON in phone field', async () => {
			mockDb.user.update.mockResolvedValue({ ...mockUser, phone: 'test' });

			const mockRequest = createMockRequest(mockProfileData, mockUser);
			await POST(mockRequest);

			const updateCall = mockDb.user.update.mock.calls[0][0];
			const storedData = JSON.parse(updateCall.data.phone);

			expect(storedData).toEqual({
				role: 'advocate',
				organization: 'Test Organization',
				location: 'San Francisco, CA',
				connection: 'personal',
				connectionDetails: 'I care about this issue personally',
				completedAt: expect.any(String)
			});
		});

		it('should include completion timestamp', async () => {
			mockDb.user.update.mockResolvedValue({ ...mockUser, phone: 'test' });

			const mockRequest = createMockRequest(mockProfileData, mockUser);
			await POST(mockRequest);

			const updateCall = mockDb.user.update.mock.calls[0][0];
			const storedData = JSON.parse(updateCall.data.phone);

			expect(storedData.completedAt).toBeDefined();
			expect(new Date(storedData.completedAt)).toBeInstanceOf(Date);
		});

		it('should handle database errors gracefully', async () => {
			mockDb.user.update.mockRejectedValue(new Error('Database error'));

			const mockRequest = createMockRequest(mockProfileData, mockUser);
			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData).toEqual({
				error: 'Failed to save profile'
			});
		});

		it('should handle request parsing errors', async () => {
			const mockRequest = {
				request: {
					json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
				},
				locals: { user: mockUser }
			} as unknown as RequestEvent;

			const response = await POST(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData).toEqual({
				error: 'Failed to save profile'
			});
		});

		it('should handle empty string values', async () => {
			const dataWithEmptyStrings = {
				role: 'advocate',
				organization: '',
				location: '',
				connection: 'personal',
				connectionDetails: ''
			};

			mockDb.user.update.mockResolvedValue({ ...mockUser, phone: 'test' });

			const mockRequest = createMockRequest(dataWithEmptyStrings, mockUser);
			await POST(mockRequest);

			const updateCall = mockDb.user.update.mock.calls[0][0];
			const storedData = JSON.parse(updateCall.data.phone);

			expect(storedData.organization).toBeNull();
			expect(storedData.location).toBeNull();
			expect(storedData.connectionDetails).toBeNull();
		});
	});

	describe('GET /api/user/profile', () => {
		it('should fetch profile for authenticated user', async () => {
			const profileData = {
				role: 'advocate',
				organization: 'Test Organization',
				connection: 'personal',
				completedAt: new Date().toISOString()
			};

			const userWithProfile = {
				...mockUser,
				phone: JSON.stringify(profileData)
			};

			mockDb.user.findUnique.mockResolvedValue(userWithProfile);

			const mockRequest = { locals: { user: mockUser } } as RequestEvent;
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(mockDb.user.findUnique).toHaveBeenCalledWith({
				where: { id: 'user-123' },
				select: {
					id: true,
					name: true,
					email: true,
					phone: true
				}
			});

			expect(responseData).toEqual({
				user: {
					id: 'user-123',
					name: 'Test User',
					email: 'test@example.com',
					profile: profileData
				}
			});
		});

		it('should require authentication', async () => {
			const mockRequest = { locals: { user: null } } as RequestEvent;

			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(401);
			expect(responseData).toEqual({
				error: 'Unauthorized'
			});
			expect(mockDb.user.findUnique).not.toHaveBeenCalled();
		});

		it('should handle user not found', async () => {
			mockDb.user.findUnique.mockResolvedValue(null);

			const mockRequest = { locals: { user: mockUser } } as RequestEvent;
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(404);
			expect(responseData).toEqual({
				error: 'User not found'
			});
		});

		it('should handle user without profile data', async () => {
			const userWithoutProfile = {
				...mockUser,
				phone: null
			};

			mockDb.user.findUnique.mockResolvedValue(userWithoutProfile);

			const mockRequest = { locals: { user: mockUser } } as RequestEvent;
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(responseData).toEqual({
				user: {
					id: 'user-123',
					name: 'Test User',
					email: 'test@example.com',
					profile: null
				}
			});
		});

		it('should handle phone field with actual phone number', async () => {
			const userWithPhoneNumber = {
				...mockUser,
				phone: '+1234567890' // Actual phone number, not JSON
			};

			mockDb.user.findUnique.mockResolvedValue(userWithPhoneNumber);

			const mockRequest = { locals: { user: mockUser } } as RequestEvent;
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(responseData.user.profile).toBeNull();
		});

		it('should handle malformed JSON in phone field', async () => {
			const userWithBadJson = {
				...mockUser,
				phone: 'invalid json string'
			};

			mockDb.user.findUnique.mockResolvedValue(userWithBadJson);

			const mockRequest = { locals: { user: mockUser } } as RequestEvent;
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(responseData.user.profile).toBeNull();
		});

		it('should handle database errors gracefully', async () => {
			mockDb.user.findUnique.mockRejectedValue(new Error('Database error'));

			const mockRequest = { locals: { user: mockUser } } as RequestEvent;
			const response = await GET(mockRequest);
			const responseData = await response.json();

			expect(response.status).toBe(500);
			expect(responseData).toEqual({
				error: 'Failed to fetch profile'
			});
		});

		it('should only return selected user fields', async () => {
			const fullUser = {
				...mockUser,
				phone: null,
				password: 'secret',
				secretField: 'confidential'
			};

			mockDb.user.findUnique.mockResolvedValue(fullUser);

			const mockRequest = { locals: { user: mockUser } } as RequestEvent;
			await GET(mockRequest);

			expect(mockDb.user.findUnique).toHaveBeenCalledWith({
				where: { id: 'user-123' },
				select: {
					id: true,
					name: true,
					email: true,
					phone: true
				}
			});
		});
	});

	describe('Profile Data Validation', () => {
		it('should accept valid role values', async () => {
			const validRoles = ['advocate', 'organizer', 'citizen', 'professional'];

			for (const role of validRoles) {
				mockDb.user.update.mockResolvedValue({ ...mockUser, phone: 'test' });

				const data = { ...mockProfileData, role };
				const mockRequest = createMockRequest(data, mockUser);
				const response = await POST(mockRequest);

				expect(response.status).toBe(200);
			}
		});

		it('should accept valid connection values', async () => {
			const validConnections = ['personal', 'professional', 'community', 'other'];

			for (const connection of validConnections) {
				mockDb.user.update.mockResolvedValue({ ...mockUser, phone: 'test' });

				const data = { ...mockProfileData, connection };
				const mockRequest = createMockRequest(data, mockUser);
				const response = await POST(mockRequest);

				expect(response.status).toBe(200);
			}
		});

		it('should handle very long text fields', async () => {
			const longText = 'A'.repeat(10000);
			const dataWithLongText = {
				...mockProfileData,
				organization: longText,
				connectionDetails: longText
			};

			mockDb.user.update.mockResolvedValue({ ...mockUser, phone: 'test' });

			const mockRequest = createMockRequest(dataWithLongText, mockUser);
			const response = await POST(mockRequest);

			expect(response.status).toBe(200);
		});

		it('should handle special characters in text fields', async () => {
			const specialCharsData = {
				...mockProfileData,
				organization: 'Test Org & Co. <script>alert("xss")</script>',
				connectionDetails: 'I care about "special" characters & symbols!'
			};

			mockDb.user.update.mockResolvedValue({ ...mockUser, phone: 'test' });

			const mockRequest = createMockRequest(specialCharsData, mockUser);
			const response = await POST(mockRequest);

			expect(response.status).toBe(200);
		});
	});

	describe('Authentication Edge Cases', () => {
		it('should handle user without ID in POST', async () => {
			const userWithoutId = { name: 'Test User', email: 'test@example.com' };
			const mockRequest = createMockRequest(mockProfileData, userWithoutId);

			const response = await POST(mockRequest);

			expect(response.status).toBe(401);
		});

		it('should handle user without ID in GET', async () => {
			const userWithoutId = { name: 'Test User', email: 'test@example.com' };
			const mockRequest = { locals: { user: userWithoutId } } as RequestEvent;

			const response = await GET(mockRequest);

			expect(response.status).toBe(401);
		});

		it('should handle falsy user values in POST', async () => {
			const falsyUsers = [null, undefined, false, 0, ''];

			for (const user of falsyUsers) {
				const mockRequest = createMockRequest(mockProfileData, user);
				const response = await POST(mockRequest);

				expect(response.status).toBe(401);
			}
		});

		it('should handle falsy user values in GET', async () => {
			const falsyUsers = [null, undefined, false, 0, ''];

			for (const user of falsyUsers) {
				const mockRequest = { locals: { user } } as RequestEvent;
				const response = await GET(mockRequest);

				expect(response.status).toBe(401);
			}
		});
	});
});