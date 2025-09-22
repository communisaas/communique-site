/**
 * UNIFIED BROWSER DETECTION & CLIENT/SERVER BOUNDARY UTILITIES
 *
 * Eliminates mixed patterns: `typeof window`, `browser`, direct window access
 * Single source of truth for SSR-safe browser interactions
 */

import { browser } from '$app/environment';
import { coordinated } from './timerCoordinator';

// CORE BROWSER DETECTION
export const isBrowser = browser;

// Type guards for browser objects
export function isWindow(obj: unknown): obj is Window {
	return isBrowser && typeof obj === 'object' && obj === window;
}

export function isDocument(obj: unknown): obj is Document {
	return isBrowser && typeof obj === 'object' && obj === document;
}

export function isNavigator(obj: unknown): obj is Navigator {
	return isBrowser && typeof obj === 'object' && obj === navigator;
}

// SSR-SAFE WINDOW ACCESS
export function getWindow(): Window | null {
	return isBrowser ? window : null;
}

export function getDocument(): Document | null {
	return isBrowser ? document : null;
}

export function getNavigator(): Navigator | null {
	return isBrowser ? navigator : null;
}

// VIEWPORT UTILITIES - SSR-safe responsive detection
export function getViewportWidth(): number {
	if (!isBrowser) return 1024; // Default server-side width
	return window.innerWidth;
}

export function getViewportHeight(): number {
	if (!isBrowser) return 768; // Default server-side height
	return window.innerHeight;
}

export function isMobile(): boolean {
	return getViewportWidth() < 768;
}

export function isTablet(): boolean {
	const width = getViewportWidth();
	return width >= 768 && width < 1024;
}

export function isDesktop(): boolean {
	return getViewportWidth() >= 1024;
}

// RESPONSIVE BREAKPOINTS - Tailwind-compatible
export const breakpoints = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536
} as const;

export function isBreakpoint(bp: keyof typeof breakpoints): boolean {
	return getViewportWidth() >= breakpoints[bp];
}

// NAVIGATION UTILITIES - SSR-safe
export function navigateTo(url: string): void {
	if (typeof url !== 'string' || url.trim() === '') {
		console.warn('Invalid URL provided to navigateTo');
		return;
	}

	const win = getWindow();
	if (win) {
		try {
			win.location.href = url;
		} catch {
			console.error('Error occurred');
		}
	}
}

export function openInNewTab(url: string): void {
	if (typeof url !== 'string' || url.trim() === '') {
		console.warn('Invalid URL provided to openInNewTab');
		return;
	}

	const win = getWindow();
	if (win) {
		try {
			win.open(url, '_blank', 'noopener,noreferrer');
		} catch {
			console.error('Error occurred');
		}
	}
}

// CLIPBOARD UTILITIES - Graceful fallback
export async function copyToClipboard(text: string): Promise<boolean> {
	if (typeof text !== 'string') {
		console.warn('Text to copy must be a string');
		return false;
	}

	const nav = getNavigator();
	if (!nav) return false;

	try {
		// Modern Clipboard API
		if (nav.clipboard && window.isSecureContext) {
			await nav.clipboard.writeText(text);
			return true;
		}

		// Fallback for older browsers
		const doc = getDocument();
		if (!doc) return false;

		const textArea = doc.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		doc.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		const success = doc.execCommand('copy');
		textArea.remove();
		return success;
	} catch {
		console.error('Error occurred');
		return false;
	}
}

// Type definition for media query callback
export type MediaQueryCallback = (matches: boolean) => void;

// MEDIA QUERY UTILITIES - Event-driven responsive detection
export function matchesMediaQuery(query: string): boolean {
	if (!isBrowser || typeof query !== 'string') return false;

	try {
		return window.matchMedia(query).matches;
	} catch {
		console.error('Error occurred');
		return false;
	}
}

export function createMediaQueryWatcher(
	query: string,
	callback: MediaQueryCallback
): (() => void) | null {
	if (!isBrowser || typeof query !== 'string' || typeof callback !== 'function') {
		return null;
	}

	try {
		const mediaQuery = window.matchMedia(query);
		const handler = (e: MediaQueryListEvent): void => {
			try {
				callback(e.matches);
			} catch {
				console.error('Error occurred');
			}
		};

		mediaQuery.addEventListener('change', handler);

		// Initial call with error handling
		try {
			callback(mediaQuery.matches);
		} catch {
			console.error('Error occurred');
		}

		// Return cleanup function
		return (): void => {
			try {
				mediaQuery.removeEventListener('change', handler);
			} catch {
				console.error('Error occurred');
			}
		};
	} catch {
		console.error('Error occurred');
		return null;
	}
}

// SCROLL UTILITIES - SSR-safe
export function getScrollPosition(): { x: number; y: number } {
	if (!isBrowser) return { x: 0, y: 0 };
	return {
		x: window.pageXOffset || document.documentElement.scrollLeft,
		y: window.pageYOffset || document.documentElement.scrollTop
	};
}

export function scrollTo(x: number, y: number, smooth: boolean = true): void {
	if (!isBrowser) return;

	// Input validation
	if (typeof x !== 'number' || typeof y !== 'number') {
		console.warn('scrollTo: x and y coordinates must be numbers');
		return;
	}

	if (typeof smooth !== 'boolean') {
		console.warn('scrollTo: smooth parameter must be a boolean');
		smooth = true;
	}

	window.scrollTo({
		left: x,
		top: y,
		behavior: smooth ? 'smooth' : 'auto'
	});
}

export function isScrolledToBottom(threshold: number = 100): boolean {
	if (!isBrowser) return false;

	// Input validation
	if (typeof threshold !== 'number' || threshold < 0) {
		console.warn('isScrolledToBottom: threshold must be a non-negative number');
		threshold = 100;
	}

	const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
	return scrollTop + clientHeight >= scrollHeight - threshold;
}

// DOM UTILITIES - SSR-safe DOM manipulation
export function addClass(element: Element | null, className: string): void {
	if (!element || !isBrowser) return;

	if (typeof className !== 'string' || className.trim() === '') {
		console.warn('addClass: className must be a non-empty string');
		return;
	}

	element.classList.add(className);
}

export function removeClass(element: Element | null, className: string): void {
	if (!element || !isBrowser) return;

	if (typeof className !== 'string' || className.trim() === '') {
		console.warn('removeClass: className must be a non-empty string');
		return;
	}

	element.classList.remove(className);
}

export function toggleBodyScroll(locked: boolean): void {
	const doc = getDocument();
	if (doc) {
		doc.body.style.overflow = locked ? 'hidden' : '';
	}
}

// FEATURE DETECTION - Progressive enhancement
export function supportsClipboard(): boolean {
	const nav = getNavigator();
	return !!(nav?.clipboard && window.isSecureContext);
}

export function supportsWebShare(): boolean {
	const nav = getNavigator();
	if (!nav?.share || !window.isSecureContext) return false;

	// Check for platforms where Web Share API has poor UX
	// macOS Safari doesn't include "Copy" in share menu
	const isMacOSSafari =
		/Mac OS X/.test(navigator.userAgent) &&
		/Safari/.test(navigator.userAgent) &&
		!/Chrome/.test(navigator.userAgent);
	if (isMacOSSafari) return false;

	// Firefox has inconsistent support
	const isFirefox = /Firefox/.test(navigator.userAgent);
	if (isFirefox) return false;

	return true;
}

// Type definition for share data
export interface ShareData {
	title?: string;
	text?: string;
	url?: string;
	files?: File[];
}

// Type guard for ShareData
export function isValidShareData(data: unknown): data is ShareData {
	if (typeof data !== 'object' || data === null) return false;
	const shareData = data as Record<string, unknown>;

	return (
		(shareData.title === undefined || typeof shareData.title === 'string') &&
		(shareData.text === undefined || typeof shareData.text === 'string') &&
		(shareData.url === undefined || typeof shareData.url === 'string') &&
		(shareData.files === undefined || Array.isArray(shareData.files))
	);
}

export function canShareData(data: ShareData): boolean {
	if (!supportsWebShare() || !isValidShareData(data)) return false;

	const nav = getNavigator();
	if (!nav?.canShare) return false;

	try {
		return nav.canShare(data);
	} catch {
		console.error('Error occurred');
		return false;
	}
}

export async function shareData(data: ShareData): Promise<boolean> {
	if (!supportsWebShare() || !isValidShareData(data)) return false;

	const nav = getNavigator();
	if (!nav?.share) return false;

	try {
		// Validate data before sharing
		if (nav.canShare && !nav.canShare(data)) {
			return false;
		}

		await nav.share(data);
		return true;
	} catch (_error) {
		// User cancelled or sharing failed
		console.debug('Web Share cancelled or failed:', _error);
		return false;
	}
}

export function supportsTouch(): boolean {
	if (!isBrowser) return false;
	return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function supportsHover(): boolean {
	if (!isBrowser) return true; // Assume hover support on server
	return matchesMediaQuery('(hover: hover)');
}

// PERFORMANCE UTILITIES - Browser optimization
export function requestIdleCallback(callback: () => void, timeout: number = 5000): void {
	if (!isBrowser) {
		callback();
		return;
	}

	if ('requestIdleCallback' in window) {
		window.requestIdleCallback(callback, { timeout });
	} else {
		// Fallback for browsers without requestIdleCallback
		coordinated.nextTick(callback);
	}
}

export function requestAnimationFrame(callback: () => void): void {
	if (!isBrowser) {
		callback();
		return;
	}

	window.requestAnimationFrame(callback);
}

// EVENT UTILITIES - Memory-safe event handling
export function addEventListener<K extends keyof WindowEventMap>(
	type: K,
	listener: (_event: WindowEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions
): (() => void) | null {
	const win = getWindow();
	if (!win) return null;

	win.addEventListener(type, listener, options);

	// Return cleanup function
	return () => win.removeEventListener(type, listener, options);
}

export function addDocumentEventListener<K extends keyof DocumentEventMap>(
	type: K,
	listener: (_event: DocumentEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions
): (() => void) | null {
	const doc = getDocument();
	if (!doc) return null;

	doc.addEventListener(type, listener, options);

	// Return cleanup function
	return () => doc.removeEventListener(type, listener, options);
}
