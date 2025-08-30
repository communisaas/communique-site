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
	additionalData?: Record<string, any>;
}

export interface ErrorBoundaryConfig {
	fallback?: 'minimal' | 'detailed' | 'redirect';
	enableRetry?: boolean;
	maxRetries?: number;
	autoRetryDelay?: number;
	enableReporting?: boolean;
	enableLogging?: boolean;
	onError?: (error: ErrorReport) => void;
	onRetry?: () => void;
}

class ErrorBoundaryManager {
	private errorCounts = new Map<string, number>();
	private reportQueue: ErrorReport[] = [];
	private isReporting = false;

	/**
	 * Global error handler setup
	 */
	setup(config: ErrorBoundaryConfig = {}) {
		if (!browser) return;

		const {
			enableReporting = true,
			enableLogging = true,
			onError
		} = config;

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
	createErrorReport(
		error: Error,
		context: string,
		additionalData?: Record<string, any>
	): ErrorReport {
		return {
			message: error.message || 'Unknown error',
			stack: error.stack,
			context,
			timestamp: Date.now(),
			userAgent: browser ? navigator.userAgent : undefined,
			url: browser ? window.location.href : undefined,
			additionalData
		};
	}

	/**
	 * Report error with deduplication and batching
	 */
	reportError(error: ErrorReport) {
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
			await api.post('/api/errors/batch', { errors }, { 
				skipErrorLogging: true,
				timeout: 5000 
			});
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
	getErrorStats(): Record<string, number> {
		return Object.fromEntries(this.errorCounts);
	}

	/**
	 * Clear error counts (useful for testing)
	 */
	clearErrorCounts() {
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
		fallback?: any;
		onError?: (error: Error) => void;
	} = {}
): T {
	return ((...args: any[]) => {
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
				});
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
	}) as T;
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