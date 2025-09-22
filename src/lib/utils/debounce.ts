// Type constraint for debounced functions
type DebouncedFunction<T extends (...args: unknown[]) => unknown> = (
	...args: Parameters<T>
) => void;

// Type for timer ID (browser vs Node.js compatibility)
type TimerId = ReturnType<typeof setTimeout>;

/**
 * Debounce function to limit the rate at which a function can fire
 * @param func - The function to debounce
 * @param wait - The delay in milliseconds
 * @param immediate - If true, trigger on the leading edge instead of trailing
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number,
	immediate: boolean = false
): DebouncedFunction<T> {
	// Input validation
	if (typeof func !== 'function') {
		throw new Error('Debounce: first argument must be a function');
	}

	if (typeof wait !== 'number' || wait < 0) {
		throw new Error('Debounce: wait time must be a non-negative number');
	}

	if (typeof immediate !== 'boolean') {
		throw new Error('Debounce: immediate must be a boolean');
	}

	let timeout: TimerId | null = null;

	return function executedFunction(this: unknown, ...args: Parameters<T>): void {
		const later = (): void => {
			timeout = null;
			if (!immediate) {
				try {
					func.apply(this, args);
				} catch (error) {
					console.error('Error occurred');
				}
			}
		};

		const callNow = immediate && !timeout;

		if (timeout !== null) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(later, wait);

		if (callNow) {
			try {
				func.apply(this, args);
			} catch (error) {
				console.error('Error occurred');
			}
		}
	};
}

// Type constraint for throttled functions
type ThrottledFunction<T extends (...args: unknown[]) => unknown> = (
	...args: Parameters<T>
) => void;

/**
 * Throttle function to limit execution to once per specified time period
 * @param func - The function to throttle
 * @param limit - The minimum time in milliseconds between function calls
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
	func: T,
	limit: number
): ThrottledFunction<T> {
	// Input validation
	if (typeof func !== 'function') {
		throw new Error('Throttle: first argument must be a function');
	}

	if (typeof limit !== 'number' || limit < 0) {
		throw new Error('Throttle: limit must be a non-negative number');
	}

	let inThrottle: boolean = false;

	return function executedFunction(this: unknown, ...args: Parameters<T>): void {
		if (!inThrottle) {
			try {
				func.apply(this, args);
			} catch (error) {
				console.error('Error occurred');
			}

			inThrottle = true;
			setTimeout((): void => {
				inThrottle = false;
			}, limit);
		}
	};
}
