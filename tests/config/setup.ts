import { beforeEach, afterEach, vi } from 'vitest';
/// <reference path="../types/global.d.ts" />

/**
 * Global test setup that runs before each test
 * 
 * Provides comprehensive environment configuration for:
 * - OAuth authentication testing
 * - Database mocking
 * - Browser environment simulation
 * - Feature flag management
 */
beforeEach(() => {
	// Reset all mocks before each test for isolation
	vi.clearAllMocks();
	
	// Core environment configuration
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
	
	// OAuth environment variables for comprehensive provider testing
	process.env.OAUTH_REDIRECT_BASE_URL = 'http://localhost:5173';
	process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
	process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
	process.env.FACEBOOK_CLIENT_ID = 'test-facebook-client-id';
	process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-client-secret';
	process.env.DISCORD_CLIENT_ID = 'test-discord-client-id';
	process.env.DISCORD_CLIENT_SECRET = 'test-discord-client-secret';
	process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
	process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
	process.env.TWITTER_CLIENT_ID = 'test-twitter-client-id';
	process.env.TWITTER_CLIENT_SECRET = 'test-twitter-client-secret';
	
	// API and service configuration
	process.env.CWC_API_KEY = 'test-cwc-api-key';
	process.env.SUPABASE_DATABASE_URL = process.env.DATABASE_URL;
	
	// Mock browser APIs that may be accessed during tests
	if (typeof window !== 'undefined') {
		// localStorage mock for analytics and browser utilities
		const localStorageMock = {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn(),
			length: 0,
			key: vi.fn(() => null)
		};
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
			writable: true
		});
		
		// sessionStorage mock
		Object.defineProperty(window, 'sessionStorage', {
			value: localStorageMock,
			writable: true
		});
		
		// navigator mock for browser detection
		Object.defineProperty(window, 'navigator', {
			value: {
				userAgent: 'test-user-agent',
				language: 'en-US',
				languages: ['en-US'],
				onLine: true
			},
			writable: true
		});
		
		// location mock for URL testing
		Object.defineProperty(window, 'location', {
			value: {
				href: 'http://localhost:5173',
				origin: 'http://localhost:5173',
				protocol: 'http:',
				host: 'localhost:5173',
				hostname: 'localhost',
				port: '5173',
				pathname: '/',
				search: '',
				hash: ''
			},
			writable: true
		});
	}
	
	// Global fetch mock for external API calls
	global.fetch = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		statusText: 'OK',
		headers: new Headers(),
		json: vi.fn().mockResolvedValue({}),
		text: vi.fn().mockResolvedValue(''),
		blob: vi.fn().mockResolvedValue(new Blob()),
		arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
	});
});

/**
 * Global test teardown that runs after each test
 * 
 * Ensures clean state between tests by:
 * - Clearing all mocks
 * - Resetting environment variables
 * - Cleaning up browser API mocks
 */
afterEach(() => {
	// Clean up all mocks to prevent test interference
	vi.clearAllMocks();
	vi.restoreAllMocks();
	
	// Reset feature flag environment variables
	delete process.env.ENABLE_BETA;
	delete process.env.ENABLE_RESEARCH;
	
	// Clean up any global fetch mock
	if (global.fetch && vi.isMockFunction(global.fetch)) {
		global.fetch.mockRestore?.();
	}
	
	// Reset browser API mocks if in browser environment
	if (typeof window !== 'undefined') {
		// Clear localStorage/sessionStorage state
		if (window.localStorage) {
			// Handle both real localStorage and mocked localStorage
			if (typeof window.localStorage.clear === 'function') {
				window.localStorage.clear();
			} else if (vi.isMockFunction(window.localStorage.getItem)) {
				// For mock localStorage, manually reset
				vi.mocked(window.localStorage.getItem).mockReturnValue(null);
				vi.mocked(window.localStorage.setItem).mockImplementation(() => {});
				vi.mocked(window.localStorage.removeItem).mockImplementation(() => {});
			}
		}
	}
});