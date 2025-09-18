/**
 * ERROR BOUNDARY UTILITIES
 *
 * Centralized error handling, reporting, and recovery patterns
 */

import { browser } from '$app/environment';

export interface ErrorReport {
	message: string;
	stack?: string;
	context: string;
	timestamp: number;
	userAgent?: string;
	url?: string;
	userId?: string;
	sessionId?: string;
	additionalData?: Record<string, unknown>;
}

// Type for error boundary fallback strategies
export type ErrorFallbackStrategy = 'minimal' | 'detailed' | 'redirect';

// Type for error callbacks
export type ErrorCallback = (error: ErrorReport) => void;
export type RetryCallback = () => void;

export interface ErrorBoundaryConfig {
	fallback?: ErrorFallbackStrategy;
	enableRetry?: boolean;
	maxRetries?: number;
	autoRetryDelay?: number;
	enableReporting?: boolean;
	enableLogging?: boolean;
	onError?: ErrorCallback;
	onRetry?: RetryCallback;
}

// Type guard for ErrorBoundaryConfig
export function isValidErrorBoundaryConfig(config: unknown): config is ErrorBoundaryConfig {
	if (typeof config !== 'object' || config === null) return false;
	const cfg = config as Record<string, unknown>;
	
	return (
		(cfg.fallback === undefined || ['minimal', 'detailed', 'redirect'].includes(cfg.fallback as string)) &&
		(cfg.enableRetry === undefined || typeof cfg.enableRetry === 'boolean') &&
		(cfg.maxRetries === undefined || typeof cfg.maxRetries === 'number') &&
		(cfg.autoRetryDelay === undefined || typeof cfg.autoRetryDelay === 'number') &&
		(cfg.enableReporting === undefined || typeof cfg.enableReporting === 'boolean') &&
		(cfg.enableLogging === undefined || typeof cfg.enableLogging === 'boolean') &&
		(cfg.onError === undefined || typeof cfg.onError === 'function') &&
		(cfg.onRetry === undefined || typeof cfg.onRetry === 'function')
	);
}

class ErrorBoundaryManager {
	private errorCounts = new Map<string, number>();
	private reportQueue: ErrorReport[] = [];
	private isReporting = false;

	/**
	 * Global error handler setup
	 */
	public setup(config: ErrorBoundaryConfig = {}): void {
		if (!browser) return;

		// Validate config
		if (!isValidErrorBoundaryConfig(config)) {
			console.warn('Invalid error boundary config provided, using defaults');
			config = {};
		}

		const { enableReporting = true, enableLogging = true, onError } = config;

		// Global error handler
		window.addEventListener('error', (event) => {
			const error = this.createErrorReport(
				event.error || new Error(event.message),
				'global_error',
				{ source: event.filename, line: event.lineno, column: event.colno }
			);

			if (enableLogging) {
				console.error('Global error caught:', error);
			}

			if (enableReporting) {
				this.reportError(error);
			}

			onError?.(error);
		});

		// Unhandled promise rejections
		window.addEventListener('unhandledrejection', (event) => {
			const error = this.createErrorReport(
				event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
				'unhandled_promise',
				{ reason: event.reason }
			);

			if (enableLogging) {
				console.error('Unhandled promise rejection:', error);
			}

			if (enableReporting) {
				this.reportError(error);
			}

			onError?.(error);
		});

		// Report queued errors periodically
		if (enableReporting) {
			setInterval(() => this.flushReportQueue(), 30000); // Every 30 seconds
		}
	}

	/**
	 * Create standardized error report
	 */
	public createErrorReport(
		error: Error | string | unknown,
		context: string,
		additionalData?: Record<string, unknown>
	): ErrorReport {
		// Handle different types of errors
		let errorObj: Error;
		if (error instanceof Error) {
			errorObj = error;
		} else if (typeof error === 'string') {
			errorObj = new Error(error);
		} else {
			errorObj = new Error(`Unknown error: ${String(error)}`);
		}

		// Validate context
		if (typeof context !== 'string' || context.trim() === '') {
			context = 'unknown_context';
		}

		return {
			message: errorObj.message || 'Unknown error',
			stack: errorObj.stack,
			context: context.trim(),
			timestamp: Date.now(),
			userAgent: browser ? navigator.userAgent : undefined,
			url: browser ? window.location.href : undefined,
			additionalData
		};
	}

	/**
	 * Report error with deduplication and batching
	 */
	public reportError(error: ErrorReport): void {
		if (!error || typeof error !== 'object') {
			console.warn('Invalid error report provided');
			return;
		}

		try {
			// Deduplicate similar errors
			const errorKey = `${error.context}:${error.message}`;
			const count = this.errorCounts.get(errorKey) || 0;

			// Only report first occurrence and then every 10th occurrence
			if (count === 0 || count % 10 === 0) {
				this.reportQueue.push({
					...error,
					additionalData: {
						...error.additionalData,
						occurrenceCount: count + 1
					}
				});
			}

			this.errorCounts.set(errorKey, count + 1);

			// Flush queue if it gets too large
			if (this.reportQueue.length >= 10) {
				this.flushReportQueue();
			}
		} catch (reportingError) {
			console.error('Error while reporting error:', reportingError);
		}
	}

	/**
	 * Send error reports to backend
	 */
	private async flushReportQueue() {
		if (this.isReporting || this.reportQueue.length === 0) return;

		this.isReporting = true;
		const errors = [...this.reportQueue];
		this.reportQueue.length = 0;

		try {
			const { api } = await import('$lib/core/api/client');
			await api.post(
				'/api/errors/batch',
				{ errors },
				{
					skipErrorLogging: true,
					timeout: 5000
				}
			);
		} catch (reportingError) {
			// Don't create error loops - just put errors back in queue
			this.reportQueue.unshift(...errors);
		} finally {
			this.isReporting = false;
		}
	}

	/**
	 * Get error statistics
	 */
	public getErrorStats(): Record<string, number> {
		return Object.fromEntries(this.errorCounts);
	}

	/**
	 * Clear error counts (useful for testing)
	 */
	public clearErrorCounts(): void {
		this.errorCounts.clear();
	}
}

// Singleton instance
export const errorBoundaryManager = new ErrorBoundaryManager();

/**
 * HOC function to wrap functions with error boundaries
 */
export function withErrorBoundary<T extends (...args: any[]) => any>(
	fn: T,
	context: string,
	options: {
		silent?: boolean;
		fallback?: ReturnType<T>;
		onError?: (error: Error) => void;
	} = {}
): (...args: Parameters<T>) => ReturnType<T> | undefined {
	return ((...args: Parameters<T>): ReturnType<T> | undefined => {
		try {
			const result = fn(...args);

			// Handle async functions
			if (result instanceof Promise) {
				return result.catch((error) => {
					const errorReport = errorBoundaryManager.createErrorReport(error, context);

					if (!options.silent) {
						console.error(`Error in ${context}:`, error);
					}

					errorBoundaryManager.reportError(errorReport);
					options.onError?.(error);

					return options.fallback;
				}) as ReturnType<T>;
			}

			return result;
		} catch (error) {
			const errorReport = errorBoundaryManager.createErrorReport(error as Error, context);

			if (!options.silent) {
				console.error(`Error in ${context}:`, error);
			}

			errorBoundaryManager.reportError(errorReport);
			options.onError?.(error as Error);

			return options.fallback;
		}
	});
}

/**
 * Safe async wrapper
 */
export async function safeAsync<T>(
	operation: () => Promise<T>,
	context: string,
	fallback?: T
): Promise<T | undefined> {
	try {
		return await operation();
	} catch (error) {
		const errorReport = errorBoundaryManager.createErrorReport(error as Error, context);
		errorBoundaryManager.reportError(errorReport);
		console.error(`Safe async error in ${context}:`, error);
		return fallback;
	}
}

/**
 * Component error boundary decorator for Svelte components
 */
export function createComponentErrorBoundary(componentName: string) {
	return {
		onError: (error: Error) => {
			const errorReport = errorBoundaryManager.createErrorReport(
				error,
				`component:${componentName}`
			);
			errorBoundaryManager.reportError(errorReport);
		}
	};
}

// Auto-setup in browser
if (browser) {
	errorBoundaryManager.setup();
}
