/**
 * FORMATTING UTILITIES
 *
 * Centralized text, number, date, and data formatting functions
 * with comprehensive type safety and error handling
 */

// Types for formatting options
export interface NumberFormatOptions {
	locale?: string;
	minimumFractionDigits?: number;
	maximumFractionDigits?: number;
	useGrouping?: boolean;
}

export interface DateFormatOptions {
	locale?: string;
	dateStyle?: 'full' | 'long' | 'medium' | 'short';
	timeStyle?: 'full' | 'long' | 'medium' | 'short';
	timeZone?: string;
}

export interface CurrencyFormatOptions {
	locale?: string;
	currency?: string;
	currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
}

// Type guards for formatting inputs
export function isValidNumber(value: unknown): value is number {
	return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function isValidDate(value: unknown): value is Date {
	return value instanceof Date && !isNaN(value.getTime());
}

export function isValidString(value: unknown): value is string {
	return typeof value === 'string';
}

// TEXT FORMATTERS

/**
 * Capitalize the first letter of a string
 */
export function capitalize(text: string): string {
	if (!isValidString(text) || text.length === 0) {
		return '';
	}
	return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert string to title case (capitalize each word)
 */
export function titleCase(text: string): string {
	if (!isValidString(text)) {
		return '';
	}
	
	return text
		.toLowerCase()
		.split(' ')
		.map(word => word.length > 0 ? capitalize(word) : word)
		.join(' ');
}

/**
 * Truncate text to a specified length with ellipsis
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
	if (!isValidString(text)) {
		return '';
	}
	
	if (typeof maxLength !== 'number' || maxLength < 0) {
		console.warn('truncate: maxLength must be a non-negative number');
		return text;
	}
	
	if (text.length <= maxLength) {
		return text;
	}
	
	return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Remove extra whitespace and normalize line breaks
 */
export function normalizeWhitespace(text: string): string {
	if (!isValidString(text)) {
		return '';
	}
	
	return text
		.replace(/\r\n/g, '\n') // Normalize line endings
		.replace(/\s+/g, ' ') // Collapse multiple spaces
		.trim();
}

/**
 * Convert text to URL-friendly slug
 */
export function slugify(text: string): string {
	if (!isValidString(text)) {
		return '';
	}
	
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '') // Remove special characters
		.replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
		.replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// NUMBER FORMATTERS

/**
 * Format number with locale-specific formatting
 */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
	if (!isValidNumber(value)) {
		console.warn('formatNumber: invalid number provided');
		return '0';
	}
	
	const { locale = 'en-US', ...intlOptions } = options;
	
	try {
		return new Intl.NumberFormat(locale, intlOptions).format(value);
	} catch (error) {
		console.error('Error formatting number:', error);
		return value.toString();
	}
}

/**
 * Format number as currency
 */
export function formatCurrency(value: number, options: CurrencyFormatOptions = {}): string {
	if (!isValidNumber(value)) {
		console.warn('formatCurrency: invalid number provided');
		return '$0.00';
	}
	
	const { locale = 'en-US', currency = 'USD', ...intlOptions } = options;
	
	try {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency,
			...intlOptions
		}).format(value);
	} catch (error) {
		console.error('Error formatting currency:', error);
		return `${currency} ${value.toFixed(2)}`;
	}
}

/**
 * Format number as percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
	if (!isValidNumber(value)) {
		console.warn('formatPercentage: invalid number provided');
		return '0%';
	}
	
	if (typeof decimals !== 'number' || decimals < 0) {
		decimals = 1;
	}
	
	try {
		return new Intl.NumberFormat('en-US', {
			style: 'percent',
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		}).format(value / 100);
	} catch (error) {
		console.error('Error formatting percentage:', error);
		return `${(value).toFixed(decimals)}%`;
	}
}

/**
 * Format large numbers with abbreviations (1K, 1M, etc.)
 */
export function formatCompactNumber(value: number): string {
	if (!isValidNumber(value)) {
		console.warn('formatCompactNumber: invalid number provided');
		return '0';
	}
	
	try {
		return new Intl.NumberFormat('en-US', {
			notation: 'compact',
			maximumFractionDigits: 1
		}).format(value);
	} catch (error) {
		// Fallback for older browsers
		const abs = Math.abs(value);
		if (abs >= 1e9) return (value / 1e9).toFixed(1) + 'B';
		if (abs >= 1e6) return (value / 1e6).toFixed(1) + 'M';
		if (abs >= 1e3) return (value / 1e3).toFixed(1) + 'K';
		return value.toString();
	}
}

// DATE FORMATTERS

/**
 * Format date with locale-specific formatting
 */
export function formatDate(date: Date | string | number, options: DateFormatOptions = {}): string {
	let dateObj: Date;
	
	if (typeof date === 'string' || typeof date === 'number') {
		dateObj = new Date(date);
	} else if (isValidDate(date)) {
		dateObj = date;
	} else {
		console.warn('formatDate: invalid date provided');
		return 'Invalid Date';
	}
	
	if (!isValidDate(dateObj)) {
		console.warn('formatDate: could not parse date');
		return 'Invalid Date';
	}
	
	const { locale = 'en-US', ...intlOptions } = options;
	
	try {
		return new Intl.DateTimeFormat(locale, intlOptions).format(dateObj);
	} catch (error) {
		console.error('Error formatting date:', error);
		return dateObj.toLocaleDateString();
	}
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
	let dateObj: Date;
	
	if (typeof date === 'string' || typeof date === 'number') {
		dateObj = new Date(date);
	} else if (isValidDate(date)) {
		dateObj = date;
	} else {
		console.warn('formatRelativeTime: invalid date provided');
		return 'Invalid Date';
	}
	
	if (!isValidDate(dateObj)) {
		console.warn('formatRelativeTime: could not parse date');
		return 'Invalid Date';
	}
	
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
	
	// Handle future dates
	if (diffInSeconds < 0) {
		return 'in the future';
	}
	
	const intervals = [
		{ label: 'year', seconds: 31536000 },
		{ label: 'month', seconds: 2592000 },
		{ label: 'week', seconds: 604800 },
		{ label: 'day', seconds: 86400 },
		{ label: 'hour', seconds: 3600 },
		{ label: 'minute', seconds: 60 }
	];
	
	for (const interval of intervals) {
		const count = Math.floor(diffInSeconds / interval.seconds);
		if (count >= 1) {
			return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
		}
	}
	
	return 'just now';
}

// UTILITY FORMATTERS

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
	if (!isValidNumber(bytes) || bytes < 0) {
		console.warn('formatFileSize: invalid bytes value');
		return '0 B';
	}
	
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	
	if (bytes === 0) return '0 B';
	
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / Math.pow(1024, i);
	
	return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/**
 * Format phone number (US format)
 */
export function formatPhoneNumber(phone: string): string {
	if (!isValidString(phone)) {
		return '';
	}
	
	// Remove all non-digit characters
	const cleaned = phone.replace(/\D/g, '');
	
	// Check for valid US phone number length
	if (cleaned.length !== 10 && cleaned.length !== 11) {
		return phone; // Return original if invalid length
	}
	
	// Remove country code if present
	const number = cleaned.length === 11 ? cleaned.slice(1) : cleaned;
	
	// Format as (XXX) XXX-XXXX
	return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
}

/**
 * Format postal code (US ZIP code)
 */
export function formatZipCode(zip: string): string {
	if (!isValidString(zip)) {
		return '';
	}
	
	// Remove all non-digit characters
	const cleaned = zip.replace(/\D/g, '');
	
	if (cleaned.length === 5) {
		return cleaned;
	} else if (cleaned.length === 9) {
		return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
	}
	
	// Return original if invalid
	return zip;
}

/**
 * Format email address (basic validation and normalization)
 */
export function formatEmail(email: string): string {
	if (!isValidString(email)) {
		return '';
	}
	
	// Basic email validation regex
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	
	const normalized = email.toLowerCase().trim();
	
	if (emailRegex.test(normalized)) {
		return normalized;
	}
	
	// Return original if invalid
	return email;
}

// UTILITY TYPES FOR FORMATTERS

// Type for values that can be formatted as strings
export type Formattable = string | number | Date | null | undefined;

// Type guard for formattable values
export function isFormattable(value: unknown): value is Formattable {
	return (
		typeof value === 'string' ||
		typeof value === 'number' ||
		value instanceof Date ||
		value === null ||
		value === undefined
	);
}

// ERROR-SAFE FORMATTERS

/**
 * Safe formatter that never throws - returns fallback on error
 */
export function safeFormat<T>(
	formatter: () => T,
	fallback: T,
	errorMessage?: string
): T {
	// Input validation
	if (typeof formatter !== 'function') {
		console.warn('safeFormat: formatter must be a function');
		return fallback;
	}

	try {
		const result = formatter();
		return result;
	} catch (error) {
		if (errorMessage && typeof errorMessage === 'string') {
			console.warn(errorMessage, error);
		} else {
			console.warn('Error in formatter function:', error);
		}
		return fallback;
	}
}