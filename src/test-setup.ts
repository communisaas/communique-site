import '@testing-library/jest-dom';

// Mock SvelteKit environment
import { beforeAll, beforeEach, vi } from 'vitest';

beforeAll(() => {
	// Mock app environment
	vi.mock('$app/environment', () => ({
		browser: false,
		dev: true,
		building: false,
		version: 'test'
	}));

	// Mock app stores
	vi.mock('$app/stores', () => ({
		page: {
			subscribe: vi.fn(() => vi.fn()),
			url: new URL('http://localhost:3000')
		},
		navigating: {
			subscribe: vi.fn(() => vi.fn())
		},
		updated: {
			subscribe: vi.fn(() => vi.fn())
		}
	}));

	// Mock SvelteKit navigation
	vi.mock('$app/navigation', () => ({
		goto: vi.fn(),
		invalidate: vi.fn(),
		invalidateAll: vi.fn(),
		preloadData: vi.fn(),
		preloadCode: vi.fn(),
		beforeNavigate: vi.fn(),
		afterNavigate: vi.fn(),
		pushState: vi.fn(),
		replaceState: vi.fn()
	}));

	// Mock global fetch
	global.fetch = vi.fn();

	// Polyfill Web Animations API used by Svelte transitions
	if (typeof (global as any).Element !== 'undefined') {
		Object.defineProperty((global as any).Element.prototype, 'animate', {
			value: function () {
				return { cancel: () => {}, finish: () => {} } as any;
			},
			configurable: true
		});
	}

	// Polyfill matchMedia for jsdom
	if (typeof window !== 'undefined' && !window.matchMedia) {
		// @ts-ignore
		window.matchMedia = (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false
		}) as any;
	}
});

beforeEach(() => {
	// Ensure window and document are available in jsdom
	if (typeof window !== 'undefined') {
		// Mock window.location
		Object.defineProperty(window, 'location', {
			value: {
				href: 'http://localhost:3000',
				origin: 'http://localhost:3000',
				pathname: '/',
				search: '',
				hash: ''
			},
			writable: true,
			configurable: true
		});

		// Mock window.scrollTo
		window.scrollTo = vi.fn();

		// Mock window dimensions
		Object.defineProperty(window, 'innerHeight', {
			writable: true,
			configurable: true,
			value: 800
		});

		Object.defineProperty(window, 'innerWidth', {
			writable: true,
			configurable: true,
			value: 1200
		});

		// Mock window.scrollY
		Object.defineProperty(window, 'scrollY', {
			writable: true,
			configurable: true,
			value: 0
		});

		// Mock localStorage
		const localStorageMock = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		};
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
			configurable: true
		});

		// Mock sessionStorage
		const sessionStorageMock = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		};
		Object.defineProperty(window, 'sessionStorage', {
			value: sessionStorageMock,
			configurable: true
		});

		// Mock navigator.clipboard
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: vi.fn(() => Promise.resolve())
			},
			configurable: true
		});
	}

	// Mock document.body.style if document exists
	if (typeof document !== 'undefined') {
		Object.defineProperty(document.body, 'style', {
			writable: true,
			value: {
				position: '',
				top: '',
				width: '',
				overflow: ''
			}
		});
	}
});