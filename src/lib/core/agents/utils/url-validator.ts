/**
 * URL Validation Utility
 *
 * Validates that URLs are accessible before they're cited in messages.
 * Uses HEAD requests to minimize bandwidth while confirming URL existence.
 *
 * Critical for civic credibility: one broken link destroys trust.
 */

export interface UrlValidationResult {
	url: string;
	isValid: boolean;
	statusCode?: number;
	contentType?: string;
	error?: string;
	/** Final URL after redirects */
	finalUrl?: string;
}

/**
 * Validate a single URL is accessible
 *
 * Uses HEAD request with short timeout. Follows redirects.
 * Returns validation result with status info.
 */
export async function validateUrl(url: string): Promise<UrlValidationResult> {
	// Basic URL format validation
	try {
		new URL(url);
	} catch {
		return {
			url,
			isValid: false,
			error: 'Invalid URL format'
		};
	}

	// Skip obvious non-HTTP URLs
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return {
			url,
			isValid: false,
			error: 'Not an HTTP(S) URL'
		};
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

		const response = await fetch(url, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow',
			headers: {
				// Mimic browser to avoid bot detection
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		});

		clearTimeout(timeout);

		// Some servers don't support HEAD, try GET if we get 405
		if (response.status === 405) {
			const getResponse = await fetch(url, {
				method: 'GET',
				signal: AbortSignal.timeout(5000),
				redirect: 'follow',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					Range: 'bytes=0-0' // Only get first byte to minimize bandwidth
				}
			});

			return {
				url,
				isValid: getResponse.ok || getResponse.status === 206, // 206 = Partial Content (Range worked)
				statusCode: getResponse.status,
				contentType: getResponse.headers.get('content-type') || undefined,
				finalUrl: getResponse.url !== url ? getResponse.url : undefined
			};
		}

		return {
			url,
			isValid: response.ok,
			statusCode: response.status,
			contentType: response.headers.get('content-type') || undefined,
			finalUrl: response.url !== url ? response.url : undefined
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Categorize common errors
		if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
			return {
				url,
				isValid: false,
				error: 'Request timed out'
			};
		}

		if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
			return {
				url,
				isValid: false,
				error: 'Domain not found'
			};
		}

		if (errorMessage.includes('ECONNREFUSED')) {
			return {
				url,
				isValid: false,
				error: 'Connection refused'
			};
		}

		if (errorMessage.includes('certificate')) {
			return {
				url,
				isValid: false,
				error: 'SSL certificate error'
			};
		}

		return {
			url,
			isValid: false,
			error: errorMessage
		};
	}
}

/**
 * Validate multiple URLs in parallel with concurrency limit
 *
 * @param urls - URLs to validate
 * @param concurrency - Max parallel requests (default: 5)
 * @returns Validation results for all URLs
 */
export async function validateUrls(
	urls: string[],
	concurrency: number = 5
): Promise<UrlValidationResult[]> {
	const results: UrlValidationResult[] = [];
	const queue = [...urls];

	async function worker() {
		while (queue.length > 0) {
			const url = queue.shift();
			if (url) {
				const result = await validateUrl(url);
				results.push(result);
			}
		}
	}

	// Start workers
	const workers = Array(Math.min(concurrency, urls.length))
		.fill(null)
		.map(() => worker());

	await Promise.all(workers);

	// Maintain original order
	return urls.map((url) => results.find((r) => r.url === url)!);
}

/**
 * Filter to only valid URLs
 */
export async function filterValidUrls(urls: string[]): Promise<string[]> {
	const results = await validateUrls(urls);
	return results.filter((r) => r.isValid).map((r) => r.url);
}
