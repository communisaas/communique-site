<!--
ERROR BOUNDARY COMPONENT
Catches and handles component failures gracefully
-->
<script lang="ts">
	import { createEventDispatcher, onMount as _onMount, type Snippet } from 'svelte';
	import { AlertTriangle, RefreshCw, Home, Bug } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { coordinated } from '$lib/utils/timerCoordinator';

	interface ErrorInfo {
		message: string;
		stack?: string;
		componentStack?: string;
		timestamp: number;
		userAgent: string;
		url: string;
	}

	// Props
	let {
		fallback = 'detailed',
		showRetry = true,
		showReportBug = true,
		enableLogging = true,
		autoRetryDelay = 0, // 0 = no auto retry
		maxRetries = 2,
		children
	}: {
		fallback?: 'minimal' | 'detailed' | 'redirect';
		showRetry?: boolean;
		showReportBug?: boolean;
		enableLogging?: boolean;
		autoRetryDelay?: number;
		maxRetries?: number;
		children?: Snippet;
	} = $props();

	// State
	let hasError = $state(false);
	let errorInfo: ErrorInfo | null = $state(null);
	let retryCount = $state(0);
	let isRetrying = $state(false);

	const dispatch = createEventDispatcher<{
		error: ErrorInfo;
		retry: void;
		report: ErrorInfo;
	}>();

	const componentId = `ErrorBoundary_${Math.random().toString(36).substr(2, 9)}`;

	// Error handler setup
	_onMount(() => {
		const originalError = window.onerror;
		const originalUnhandledRejection = window.onunhandledrejection;

		// Capture JavaScript errors
		window.onerror = (message, source, lineno, colno, _error) => {
			if (_error && !hasError) {
				handleError(_error);
			}
			return originalError?.call(window, message, source, lineno, colno, _error) ?? false;
		};

		// Capture unhandled promise rejections
		window.onunhandledrejection = (_event) => {
			if (!hasError) {
				const errorValue =
					_event.reason instanceof Error ? _event.reason : new Error(String(_event.reason));
				handleError(errorValue);
			}
			return originalUnhandledRejection?.call(window, _event);
		};

		return () => {
			window.onerror = originalError;
			window.onunhandledrejection = originalUnhandledRejection;
		};
	});

	function handleError(error: Error) {
		const info: ErrorInfo = {
			message: _error.message || 'Unknown error occurred',
			stack: _error.stack,
			timestamp: Date.now(),
			userAgent: navigator.userAgent,
			url: window.location.href
		};

		errorInfo = info;
		hasError = true;

		// Log to console in development
		if (enableLogging) {
			console.error("Error occurred:", error);
		}

		// Report to analytics/monitoring
		reportError(info);

		// Dispatch error event
		dispatch('error', info);

		// Auto-retry if configured
		if (autoRetryDelay > 0 && retryCount < maxRetries) {
			coordinated.setTimeout(
				() => {
					retry();
				},
				autoRetryDelay,
				'feedback',
				componentId
			);
		}
	}

	async function reportError(info: ErrorInfo) {
		try {
			const { api } = await import('$lib/core/api/client');
			await api.post(
				'/api/errors/report',
				{
					error: info,
					context: 'ErrorBoundary',
					retryCount
				},
				{ skipErrorLogging: true }
			);
		} catch (error) {
			// Silent fail - don't create error loops
		}
	}

	function retry() {
		if (retryCount >= maxRetries) return;

		isRetrying = true;
		retryCount++;

		// Clear error state after brief delay
		coordinated.setTimeout(
			() => {
				hasError = false;
				errorInfo = null;
				isRetrying = false;
				dispatch('retry');
			},
			100,
			'feedback',
			componentId
		);
	}

	function reportBug() {
		if (errorInfo) {
			dispatch('report', errorInfo);

			// Default behavior: mailto with error details
			const subject = encodeURIComponent(`Bug Report: ${errorInfo.message}`);
			const body = encodeURIComponent(
				`
Error Details:
- Message: ${errorInfo.message}
- URL: ${errorInfo.url}
- Timestamp: ${new Date(errorInfo.timestamp).toISOString()}
- User Agent: ${errorInfo.userAgent}

Stack Trace:
${errorInfo.stack || 'Not available'}
			`.trim()
			);

			window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
		}
	}

	function goHome() {
		window.location.href = '/';
	}

	// Reset error state when children change (for retry functionality)
	$effect(() => {
		if (!hasError) {
			retryCount = 0;
		}
	});
</script>

{#if hasError && errorInfo}
	<!-- Error Boundary UI -->
	<div class="flex min-h-[400px] items-center justify-center p-8">
		<div class="w-full max-w-md space-y-6 text-center">
			{#if fallback === 'minimal'}
				<!-- Minimal error display -->
				<div class="space-y-3">
					<AlertTriangle class="mx-auto h-8 w-8 text-red-500" />
					<p class="text-sm text-slate-600">Something went wrong.</p>
					{#if showRetry && retryCount < maxRetries}
						<Button variant="secondary" size="sm" onclick={retry} disabled={isRetrying}>
							{#if isRetrying}
								<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
								Retrying...
							{:else}
								Try Again
							{/if}
						</Button>
					{/if}
				</div>
			{:else if fallback === 'detailed'}
				<!-- Detailed error display -->
				<div class="space-y-4">
					<div class="space-y-2">
						<AlertTriangle class="mx-auto h-12 w-12 text-red-500" />
						<h3 class="text-lg font-semibold text-slate-900">Oops! Something went wrong</h3>
						<p class="text-sm text-slate-600">
							We encountered an unexpected error. This has been reported to our team.
						</p>
					</div>

					<!-- Error details (development) -->
					{#if import.meta.env.DEV}
						<details class="rounded-lg bg-red-50 p-3 text-left">
							<summary class="cursor-pointer text-xs font-medium text-red-700">
								Error Details
							</summary>
							<div class="mt-2 space-y-1 text-xs text-red-600">
								<div><strong>Message:</strong> {errorInfo.message}</div>
								<div><strong>Time:</strong> {new Date(errorInfo.timestamp).toLocaleString()}</div>
								{#if errorInfo.stack}
									<div><strong>Stack:</strong></div>
									<pre class="overflow-x-auto whitespace-pre-wrap text-xs">{errorInfo.stack}</pre>
								{/if}
							</div>
						</details>
					{/if}

					<!-- Action buttons -->
					<div class="flex justify-center gap-3">
						{#if showRetry && retryCount < maxRetries}
							<Button variant="primary" onclick={retry} disabled={isRetrying}>
								{#if isRetrying}
									<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
									Retrying...
								{:else}
									<RefreshCw class="mr-2 h-4 w-4" />
									Try Again
								{/if}
							</Button>
						{/if}

						<Button variant="secondary" onclick={goHome}>
							<Home class="mr-2 h-4 w-4" />
							Go Home
						</Button>

						{#if showReportBug}
							<Button variant="secondary" onclick={reportBug}>
								<Bug class="mr-2 h-4 w-4" />
								Report Bug
							</Button>
						{/if}
					</div>

					{#if retryCount >= maxRetries}
						<p class="text-xs text-slate-500">
							Maximum retry attempts reached. Please refresh the page or go home.
						</p>
					{/if}
				</div>
			{:else}
				<!-- Redirect fallback -->
				<div class="space-y-3">
					<AlertTriangle class="mx-auto h-8 w-8 text-red-500" />
					<p class="text-sm text-slate-600">Redirecting to safety...</p>
				</div>
				{#if typeof window !== 'undefined'}
					{coordinated.setTimeout(goHome, 2000, 'feedback', componentId)}
				{/if}
			{/if}
		</div>
	</div>
{:else}
	<!-- Normal component rendering -->
	{#if children}
		{@render children()}
	{/if}
{/if}
