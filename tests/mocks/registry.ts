import { vi } from 'vitest';

/**
 * Simplified Mock Registry
 * Provides essential mocks for database and external services
 */

export interface DatabaseMock {
	user: {
		findUnique: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	template: {
		findUnique: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	user_representatives: {
		findMany: ReturnType<typeof vi.fn>;
		deleteMany: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	representative: {
		findFirst: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	account: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	user_session: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
}

interface MockRegistryCollection {
	db: DatabaseMock;
	http: {
		fetch: ReturnType<typeof vi.fn>;
	};
	auth: {
		createSession: ReturnType<typeof vi.fn>;
		validateSession: ReturnType<typeof vi.fn>;
		deleteSession: ReturnType<typeof vi.fn>;
		sessionCookieName: string;
	};
}

class MockRegistry {
	private mocks: MockRegistryCollection | null = null;

	/**
	 * Reset all mocks to initial state
	 */
	reset() {
		this.mocks = null;
		vi.clearAllMocks();
	}

	/**
	 * Create database mock with consistent interface
	 */
	createDatabaseMock(): DatabaseMock {
		return {
			user: {
				findUnique: vi.fn(),
				findMany: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				delete: vi.fn()
			},
			template: {
				findUnique: vi.fn(),
				findMany: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				delete: vi.fn()
			},
			user_representatives: {
				findMany: vi.fn(),
				deleteMany: vi.fn(),
				create: vi.fn(),
				createMany: vi.fn()
			},
			representative: {
				findFirst: vi.fn(),
				findMany: vi.fn(),
				create: vi.fn()
			},
			account: {
				findUnique: vi.fn(),
				create: vi.fn(),
				update: vi.fn()
			},
			user_session: {
				findUnique: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				delete: vi.fn()
			}
		};
	}

	/**
	 * Create HTTP client mock
	 */
	createHttpMock() {
		return {
			fetch: vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('')
			})
		};
	}

	/**
	 * Create auth service mock
	 */
	createAuthMock() {
		return {
			createSession: vi.fn().mockResolvedValue({
				id: 'session-123',
				user_id: 'user-123',
				expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			}),
			validateSession: vi.fn().mockResolvedValue(true),
			deleteSession: vi.fn().mockResolvedValue(true),
			sessionCookieName: 'auth_session'
		};
	}

	/**
	 * Setup all common mocks for a test suite
	 */
	setupMocks() {
		if (!this.mocks) {
			this.mocks = {
				db: this.createDatabaseMock(),
				http: this.createHttpMock(),
				auth: this.createAuthMock()
			};
		}
		return this.mocks;
	}
}

// Export singleton instance
const mockRegistry = new MockRegistry();
export default mockRegistry;
