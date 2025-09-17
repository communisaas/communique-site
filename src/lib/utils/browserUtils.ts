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
	const win = getWindow();
	if (win) {
		win.location.href = url;
	}
}

export function openInNewTab(url: string): void {
	const win = getWindow();
	if (win) {
		win.open(url, '_blank', 'noopener,noreferrer');
	}
}

// CLIPBOARD UTILITIES - Graceful fallback
export async function copyToClipboard(text: string): Promise<boolean> {
	const nav = getNavigator();
	if (!nav) return false;

	try {
		// Modern Clipboard API
		if (nav.clipboard && window.isSecureContext) {
			await nav.clipboard.writeText(text);
			return true;
		}

		// Fallback for older browsers
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		const success = document.execCommand('copy');
		textArea.remove();
		return success;
	} catch (error) {
		return false;
	}
}

// MEDIA QUERY UTILITIES - Event-driven responsive detection
export function matchesMediaQuery(query: string): boolean {
	if (!isBrowser) return false;
	return window.matchMedia(query).matches;
}

export function createMediaQueryWatcher(
	query: string,
	callback: (matches: boolean) => void
): (() => void) | null {
	if (!isBrowser) return null;

	const mediaQuery = window.matchMedia(query);
	const handler = (e: MediaQueryListEvent) => callback(e.matches);

	mediaQuery.addEventListener('change', handler);

	// Initial call
	callback(mediaQuery.matches);

	// Return cleanup function
	return () => mediaQuery.removeEventListener('change', handler);
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

	window.scrollTo({
		left: x,
		top: y,
		behavior: smooth ? 'smooth' : 'auto'
	});
}

export function isScrolledToBottom(threshold: number = 100): boolean {
	if (!isBrowser) return false;

	const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
	return scrollTop + clientHeight >= scrollHeight - threshold;
}

// DOM UTILITIES - SSR-safe DOM manipulation
export function addClass(element: Element | null, className: string): void {
	if (element && isBrowser) {
		element.classList.add(className);
	}
}

export function removeClass(element: Element | null, className: string): void {
	if (element && isBrowser) {
		element.classList.remove(className);
	}
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

export function canShareData(data: {
	title?: string;
	text?: string;
	url?: string;
	files?: File[];
}): boolean {
	if (!supportsWebShare()) return false;
	const nav = getNavigator();
	return !!nav?.canShare?.(data);
}

export async function shareData(data: {
	title?: string;
	text?: string;
	url?: string;
	files?: File[];
}): Promise<boolean> {
	if (!supportsWebShare()) return false;

	const nav = getNavigator();
	if (!nav?.share) return false;

	try {
		// Validate data before sharing
		if (nav.canShare && !nav.canShare(data)) {
			return false;
		}

		await nav.share(data);
		return true;
	} catch (error) {
		// User cancelled or sharing failed
		console.debug('Web Share cancelled or failed:', error);
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
	listener: (event: WindowEventMap[K]) => void,
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
	listener: (event: DocumentEventMap[K]) => void,
	options?: boolean | AddEventListenerOptions
): (() => void) | null {
	const doc = getDocument();
	if (!doc) return null;

	doc.addEventListener(type, listener, options);

	// Return cleanup function
	return () => doc.removeEventListener(type, listener, options);
}
