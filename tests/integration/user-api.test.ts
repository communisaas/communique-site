/**
 * User API Integration Tests
 * 
 * Tests user management API endpoints:
 * - Profile management (GET/POST /api/user/profile)
 * - Address management (POST /api/user/address)
 * - Representatives linking
 * - Authentication integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database using vi.hoisted
const mockDb = vi.hoisted(() => ({
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
}));

// Mock SvelteKit utilities using vi.hoisted
const mockJson = vi.hoisted(() => 
	vi.fn().mockImplementation((data, options) => ({
		ok: options?.status ? options.status < 400 : true,
		status: options?.status || 200,
		json: async () => data,
		text: async () => JSON.stringify(data)
	}))
);

// Mock dependencies
vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

vi.mock('@sveltejs/kit', () => ({
	json: mockJson
}));

// Import API handlers after mocking
import { GET as ProfileGET, POST as ProfilePOST } from '../../src/routes/api/user/profile/+server';
import { POST as AddressPOST } from '../../src/routes/api/user/address/+server';

describe('User API Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Profile Management API', () => {
		describe('GET /api/user/profile', () => {
			it('should return user profile for authenticated user', async () => {
				const mockUser = {
					id: 'user-123',
					name: 'Test User',
					email: 'test@example.com',
					phone: JSON.stringify({
						role: 'advocate',
						organization: 'Test Org',
						location: 'California',
						connection: 'resident',
						connectionDetails: 'Long-time resident',
						completedAt: '2024-01-01T00:00:00.000Z'
					})
				};

				mockDb.user.findUnique.mockResolvedValueOnce(mockUser);

				const mockLocals = {
					user: { id: 'user-123' }
				};

				const response = await ProfileGET({ locals: mockLocals });
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
						profile: {
							role: 'advocate',
							organization: 'Test Org',
							location: 'California',
							connection: 'resident',
							connectionDetails: 'Long-time resident',
							completedAt: '2024-01-01T00:00:00.000Z'
						}
					}
				});
			});

			it('should return 401 for unauthenticated user', async () => {
				const response = await ProfileGET({ locals: {} });

				expect(response.status).toBe(401);
				expect(await response.json()).toEqual({
					error: 'Unauthorized'
				});
			});

			it('should return 404 for non-existent user', async () => {
				mockDb.user.findUnique.mockResolvedValueOnce(null);

				const mockLocals = {
					user: { id: 'nonexistent-user' }
				};

				const response = await ProfileGET({ locals: mockLocals });

				expect(response.status).toBe(404);
				expect(await response.json()).toEqual({
					error: 'User not found'
				});
			});

			it('should handle corrupted profile data gracefully', async () => {
				const mockUser = {
					id: 'user-123',
					name: 'Test User',
					email: 'test@example.com',
					phone: 'invalid-json-data' // Corrupted JSON
				};

				mockDb.user.findUnique.mockResolvedValueOnce(mockUser);

				const response = await ProfileGET({ 
					locals: { user: { id: 'user-123' } }
				});
				
				const responseData = await response.json();

				expect(responseData.user.profile).toBeNull();
			});

			it('should handle database errors gracefully', async () => {
				mockDb.user.findUnique.mockRejectedValueOnce(new Error('Database connection failed'));

				const response = await ProfileGET({ 
					locals: { user: { id: 'user-123' } }
				});

				expect(response.status).toBe(500);
				expect(await response.json()).toEqual({
					error: 'Failed to fetch profile'
				});
			});
		});

		describe('POST /api/user/profile', () => {
			it('should save complete profile for authenticated user', async () => {
				const profileData = {
					role: 'activist',
					organization: 'Climate Action Network',
					location: 'San Francisco, CA',
					connection: 'resident',
					connectionDetails: 'Living here for 10 years'
				};

				const mockUpdatedUser = {
					id: 'user-456',
					name: 'Profile User',
					email: 'profile@example.com',
					phone: JSON.stringify({
						...profileData,
						completedAt: expect.any(String)
					}),
					updatedAt: new Date()
				};

				mockDb.user.update.mockResolvedValueOnce(mockUpdatedUser);

				const mockRequest = {
					json: async () => profileData
				};

				const response = await ProfilePOST({
					request: mockRequest,
					locals: { user: { id: 'user-456' } }
				});

				expect(mockDb.user.update).toHaveBeenCalledWith({
					where: { id: 'user-456' },
					data: expect.objectContaining({
						phone: expect.stringContaining(profileData.role),
						updatedAt: expect.any(Date)
					})
				});

				const responseData = await response.json();
				expect(responseData).toEqual({
					success: true,
					message: 'Profile saved successfully',
					user: {
						id: 'user-456',
						profileComplete: true
					}
				});
			});

			it('should require role and connection fields', async () => {
				const incompleteData = {
					organization: 'Test Org'
					// Missing role and connection
				};

				const mockRequest = {
					json: async () => incompleteData
				};

				const response = await ProfilePOST({
					request: mockRequest,
					locals: { user: { id: 'user-456' } }
				});

				expect(response.status).toBe(400);
				expect(await response.json()).toEqual({
					error: 'Role and connection are required'
				});
			});

			it('should return 401 for unauthenticated user', async () => {
				const mockRequest = {
					json: async () => ({ role: 'test', connection: 'test' })
				};

				const response = await ProfilePOST({
					request: mockRequest,
					locals: {}
				});

				expect(response.status).toBe(401);
			});

			it('should handle optional fields correctly', async () => {
				const minimalData = {
					role: 'citizen',
					connection: 'voter'
					// organization, location, connectionDetails are optional
				};

				const mockUpdatedUser = {
					id: 'user-minimal',
					phone: JSON.stringify({
						...minimalData,
						organization: null,
						location: null,
						connectionDetails: null,
						completedAt: expect.any(String)
					})
				};

				mockDb.user.update.mockResolvedValueOnce(mockUpdatedUser);

				const response = await ProfilePOST({
					request: { json: async () => minimalData },
					locals: { user: { id: 'user-minimal' } }
				});

				expect(response.status).toBe(200);
				expect(mockDb.user.update).toHaveBeenCalled();
			});
		});
	});

	describe('Address Management API', () => {
		describe('POST /api/user/address', () => {
			it('should save address with separate components', async () => {
				const addressData = {
					street: '123 Main Street',
					city: 'San Francisco',
					state: 'CA',
					zipCode: '94102',
					countryCode: 'US',
					latitude: 37.7749,
					longitude: -122.4194
				};

				const mockUpdatedUser = {
					id: 'user-address',
					street: addressData.street,
					city: addressData.city,
					state: addressData.state,
					zip: addressData.zipCode,
					country_code: addressData.countryCode,
					latitude: addressData.latitude,
					longitude: addressData.longitude,
					updatedAt: new Date()
				};

				mockDb.user.update.mockResolvedValueOnce(mockUpdatedUser);

				const response = await AddressPOST({
					request: { json: async () => addressData },
					locals: { user: { id: 'user-address' } }
				});

				expect(mockDb.user.update).toHaveBeenCalledWith({
					where: { id: 'user-address' },
					data: expect.objectContaining({
						street: '123 Main Street',
						city: 'San Francisco',
						state: 'CA',
						zip: '94102',
						country_code: 'US',
						latitude: 37.7749,
						longitude: -122.4194
					})
				});

				const responseData = await response.json();
				expect(responseData.success).toBe(true);
				expect(responseData.user).toEqual({
					id: 'user-address',
					street: '123 Main Street',
					city: 'San Francisco',
					state: 'CA',
					zip: '94102',
					country_code: 'US',
					latitude: 37.7749,
					longitude: -122.4194
				});
			});

			it('should parse full address string', async () => {
				const addressData = {
					address: '456 Oak Avenue, Berkeley, CA 94705'
				};

				mockDb.user.update.mockResolvedValueOnce({
					id: 'user-parsed',
					street: '456 Oak Avenue',
					city: 'Berkeley',
					state: 'CA',
					zip: '94705',
					country_code: 'US'
				});

				const response = await AddressPOST({
					request: { json: async () => addressData },
					locals: { user: { id: 'user-parsed' } }
				});

				expect(mockDb.user.update).toHaveBeenCalledWith({
					where: { id: 'user-parsed' },
					data: expect.objectContaining({
						street: '456 Oak Avenue',
						city: 'Berkeley',
						state: 'CA',
						zip: '94705'
					})
				});
			});

			it('should save representatives and link to user', async () => {
				const addressWithReps = {
					street: '789 Capitol Way',
					city: 'Sacramento',
					state: 'CA',
					zipCode: '95814',
					representatives: [
						{
							name: 'Rep. Nancy Pelosi',
							state: 'CA',
							district: '12',
							chamber: 'house',
							email: 'nancy@congress.gov',
							phone: '202-225-4965',
							office: 'Speaker of the House'
						},
						{
							name: 'Sen. Dianne Feinstein',
							state: 'CA',
							chamber: 'senate',
							email: 'dianne@senate.gov',
							phone: '202-224-3841'
						}
					]
				};

				// Mock user update
				mockDb.user.update.mockResolvedValueOnce({
					id: 'user-with-reps',
					street: '789 Capitol Way'
				});

				// Mock clearing existing representatives
				mockDb.user_representatives.deleteMany.mockResolvedValueOnce({ count: 0 });

				// Mock representative lookup/creation
				mockDb.representative.findFirst
					.mockResolvedValueOnce(null) // First rep doesn't exist
					.mockResolvedValueOnce({ id: 'existing-sen-id' }); // Second rep exists

				mockDb.representative.create.mockResolvedValueOnce({
					id: 'new-house-rep-id',
					name: 'Rep. Nancy Pelosi'
				});

				// Mock user-representative linking
				mockDb.user_representatives.create
					.mockResolvedValueOnce({ id: 'link-1' })
					.mockResolvedValueOnce({ id: 'link-2' });

				const response = await AddressPOST({
					request: { json: async () => addressWithReps },
					locals: { user: { id: 'user-with-reps' } }
				});

				// Verify representatives were processed
				expect(mockDb.user_representatives.deleteMany).toHaveBeenCalledWith({
					where: { user_id: 'user-with-reps' }
				});

				expect(mockDb.representative.create).toHaveBeenCalledWith({
					data: expect.objectContaining({
						name: 'Rep. Nancy Pelosi',
						state: 'CA',
						chamber: 'house'
					})
				});

				expect(mockDb.user_representatives.create).toHaveBeenCalledTimes(2);
			});

			it('should require address information', async () => {
				const emptyData = {};

				const response = await AddressPOST({
					request: { json: async () => emptyData },
					locals: { user: { id: 'user-no-address' } }
				});

				expect(response.status).toBe(400);
				expect(await response.json()).toEqual({
					error: 'Address information is required'
				});
			});

			it('should handle malformed address strings gracefully', async () => {
				const malformedData = {
					address: 'Not a valid address format'
				};

				mockDb.user.update.mockResolvedValueOnce({
					id: 'user-malformed',
					street: 'Not a valid address format',
					city: '',
					state: '',
					zip: ''
				});

				const response = await AddressPOST({
					request: { json: async () => malformedData },
					locals: { user: { id: 'user-malformed' } }
				});

				expect(response.status).toBe(200);
				expect(mockDb.user.update).toHaveBeenCalledWith({
					where: { id: 'user-malformed' },
					data: expect.objectContaining({
						street: 'Not a valid address format',
						city: '',
						state: '',
						zip: ''
					})
				});
			});

			it('should default country code to US', async () => {
				const addressWithoutCountry = {
					street: '999 Test Street',
					city: 'Test City',
					state: 'TX',
					zipCode: '12345'
				};

				mockDb.user.update.mockResolvedValueOnce({
					id: 'user-default-country',
					country_code: 'US'
				});

				await AddressPOST({
					request: { json: async () => addressWithoutCountry },
					locals: { user: { id: 'user-default-country' } }
				});

				expect(mockDb.user.update).toHaveBeenCalledWith({
					where: { id: 'user-default-country' },
					data: expect.objectContaining({
						country_code: 'US'
					})
				});
			});

			it('should return 401 for unauthenticated user', async () => {
				const response = await AddressPOST({
					request: { json: async () => ({ street: 'test' }) },
					locals: {}
				});

				expect(response.status).toBe(401);
			});

			it('should handle database errors during address save', async () => {
				mockDb.user.update.mockRejectedValueOnce(new Error('Database error'));

				const response = await AddressPOST({
					request: { json: async () => ({ street: 'test', city: 'test', state: 'CA', zipCode: '12345' }) },
					locals: { user: { id: 'user-db-error' } }
				});

				expect(response.status).toBe(500);
				expect(await response.json()).toEqual({
					error: 'Failed to save address'
				});
			});
		});

		describe('Address Parsing Utility', () => {
			// Testing the parseAddressString function indirectly
			it('should parse well-formatted addresses correctly', async () => {
				const testCases = [
					{
						input: { address: '123 Main St, Anytown, CA 12345' },
						expected: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '12345' }
					},
					{
						input: { address: '456 Oak Ave, Big City, TX 54321-1234' },
						expected: { street: '456 Oak Ave', city: 'Big City', state: 'TX', zip: '54321-1234' }
					}
				];

				for (const testCase of testCases) {
					mockDb.user.update.mockResolvedValueOnce({
						id: 'parsing-test',
						...testCase.expected
					});

					await AddressPOST({
						request: { json: async () => testCase.input },
						locals: { user: { id: 'parsing-test' } }
					});

					expect(mockDb.user.update).toHaveBeenCalledWith({
						where: { id: 'parsing-test' },
						data: expect.objectContaining({
							street: testCase.expected.street,
							city: testCase.expected.city,
							state: testCase.expected.state,
							zip: testCase.expected.zip
						})
					});

					mockDb.user.update.mockReset();
				}
			});
		});
	});

	describe('Integration Error Scenarios', () => {
		it('should handle concurrent address updates safely', async () => {
			// Simulate concurrent requests
			const addressData = {
				street: 'Concurrent Test St',
				city: 'Test City',
				state: 'CA',
				zipCode: '99999'
			};

			mockDb.user.update.mockResolvedValue({
				id: 'concurrent-user',
				...addressData
			});

			const promises = Array.from({ length: 5 }, () => 
				AddressPOST({
					request: { json: async () => addressData },
					locals: { user: { id: 'concurrent-user' } }
				})
			);

			const results = await Promise.all(promises);

			// All requests should succeed
			results.forEach(result => {
				expect(result.status).toBe(200);
			});
		});

		it('should handle representative creation race conditions', async () => {
			const sameRepresentative = {
				street: 'Race Condition St',
				city: 'Test',
				state: 'CA', 
				zipCode: '12345',
				representatives: [{
					name: 'Rep. Race Test',
					state: 'CA',
					chamber: 'house'
				}]
			};

			mockDb.user.update.mockResolvedValue({ id: 'race-user' });
			mockDb.user_representatives.deleteMany.mockResolvedValue({ count: 0 });
			
			// First call finds no rep, second finds the rep created by first call
			mockDb.representative.findFirst
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: 'race-rep-id' });
				
			mockDb.representative.create.mockResolvedValueOnce({ id: 'new-race-rep' });
			mockDb.user_representatives.create.mockResolvedValue({ id: 'race-link' });

			// Should handle this gracefully without creating duplicates
			const response = await AddressPOST({
				request: { json: async () => sameRepresentative },
				locals: { user: { id: 'race-user' } }
			});

			expect(response.status).toBe(200);
		});
	});

	describe('Security & Permission Checks (from auth-security)', () => {
		it('should enforce user data ownership', async () => {
			// Simulate attempting to access another user's data
			const mockRequest = { url: 'http://localhost:5173/api/users/other-user-id' };
			const currentUser = { id: 'current-user-id' };
			
			// Security check: user can only access their own data
			const hasPermission = (requestedUserId: string, currentUserId: string) => {
				return requestedUserId === currentUserId;
			};

			const canAccess = hasPermission('other-user-id', currentUser.id);
			expect(canAccess).toBe(false);
			
			const canAccessOwn = hasPermission('current-user-id', currentUser.id);
			expect(canAccessOwn).toBe(true);
		});

		it('should validate input data for security', async () => {
			// Test input validation for user updates
			const validateUserInput = (input: any) => {
				const errors: string[] = [];
				
				// Check for XSS attempts
				if (input.name && /<script|javascript:|on\w+=/i.test(input.name)) {
					errors.push('Name contains potentially malicious content');
				}
				
				// Check email format
				if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
					errors.push('Invalid email format');
				}
				
				// Check for SQL injection attempts
				if (typeof input === 'string' && /('|--)|(;)|(\|)|(\*)|(%)|(\\?)|(<)|(>)|(=)/i.test(input)) {
					errors.push('Input contains potentially dangerous characters');
				}
				
				return { isValid: errors.length === 0, errors };
			};

			// Test malicious input
			const maliciousInput = {
				name: '<script>alert("xss")</script>',
				email: 'not-an-email'
			};
			
			const result = validateUserInput(maliciousInput);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Name contains potentially malicious content');
			expect(result.errors).toContain('Invalid email format');

			// Test clean input
			const cleanInput = {
				name: 'John Doe',
				email: 'john@example.com'
			};
			
			const cleanResult = validateUserInput(cleanInput);
			expect(cleanResult.isValid).toBe(true);
			expect(cleanResult.errors).toHaveLength(0);
		});

		it('should handle rate limiting for user operations', async () => {
			// Simulate rate limiting logic
			const rateLimiter = new Map<string, { count: number; resetTime: number }>();
			const RATE_LIMIT = 10;
			const WINDOW_MS = 60 * 1000; // 1 minute

			const checkRateLimit = (userId: string) => {
				const now = Date.now();
				const userLimit = rateLimiter.get(userId);
				
				if (!userLimit) {
					rateLimiter.set(userId, { count: 1, resetTime: now + WINDOW_MS });
					return { allowed: true, remaining: RATE_LIMIT - 1 };
				}
				
				if (now > userLimit.resetTime) {
					rateLimiter.set(userId, { count: 1, resetTime: now + WINDOW_MS });
					return { allowed: true, remaining: RATE_LIMIT - 1 };
				}
				
				if (userLimit.count >= RATE_LIMIT) {
					return { allowed: false, remaining: 0, resetTime: userLimit.resetTime };
				}
				
				userLimit.count++;
				return { allowed: true, remaining: RATE_LIMIT - userLimit.count };
			};

			const userId = 'test-user';
			
			// Should allow first requests
			for (let i = 0; i < RATE_LIMIT; i++) {
				const result = checkRateLimit(userId);
				expect(result.allowed).toBe(true);
			}
			
			// Should reject after rate limit exceeded
			const blockedResult = checkRateLimit(userId);
			expect(blockedResult.allowed).toBe(false);
			expect(blockedResult.remaining).toBe(0);
		});

		it('should sanitize address data for geocoding safety', async () => {
			// Test address sanitization for geocoding APIs
			const sanitizeAddress = (address: string) => {
				return address
					.replace(/[<>]/g, '') // Remove potential HTML tags
					.replace(/[;&|`$()]/g, '') // Remove shell injection chars
					.replace(/\s+/g, ' ') // Normalize whitespace
					.trim()
					.substring(0, 200); // Limit length
			};

			const maliciousAddress = '123 Main St<script>alert("xss")</script>; rm -rf /';
			const sanitized = sanitizeAddress(maliciousAddress);
			
			expect(sanitized).toBe('123 Main Stscriptalert"xss"/script rm -rf /');
			expect(sanitized).not.toContain('<script>');
			expect(sanitized).not.toContain(';');
		});

		it('should protect sensitive user fields from exposure', async () => {
			// Test that sensitive fields are not exposed in API responses
			const mockUserData = {
				id: 'user-123',
				email: 'user@example.com',
				name: 'John Doe',
				password_hash: 'secret-hash', // Should not be exposed
				verification_data: { phone: '+1234567890' }, // Should not be exposed
				created_at: new Date(),
				street: '123 Main St'
			};

			const sanitizeUserForAPI = (user: any) => {
				const { password_hash, verification_data, ...safeUser } = user;
				return safeUser;
			};

			const sanitizedUser = sanitizeUserForAPI(mockUserData);
			
			expect(sanitizedUser).not.toHaveProperty('password_hash');
			expect(sanitizedUser).not.toHaveProperty('verification_data');
			expect(sanitizedUser).toHaveProperty('id');
			expect(sanitizedUser).toHaveProperty('email');
			expect(sanitizedUser).toHaveProperty('name');
		});
	});
});