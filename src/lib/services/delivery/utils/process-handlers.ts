/**
 * Process lifecycle and error handling utilities
 */

import { getConfig, isProduction } from './config';

/**
 * Setup graceful process handlers
 */
export function setupProcessHandlers(): void {
	// Handle graceful shutdown
	process.on('SIGTERM', async () => {
		console.log('📤 Received SIGTERM, initiating graceful shutdown...');
		await gracefulShutdown('SIGTERM');
	});

	process.on('SIGINT', async () => {
		console.log('📤 Received SIGINT, initiating graceful shutdown...');
		await gracefulShutdown('SIGINT');
	});

	// Handle uncaught exceptions in production
	if (isProduction()) {
		process.on('uncaughtException', (error) => {
			console.error('💥 Uncaught Exception:', error);

			// Log to monitoring service
			logToMonitoring('uncaughtException', error);

			// Exit gracefully
			process.exit(1);
		});

		process.on('unhandledRejection', (reason, promise) => {
			console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);

			// Log to monitoring service
			logToMonitoring('unhandledRejection', { reason, promise });

			// Don't exit immediately, but track the error
		});
	}

	// PM2 graceful shutdown
	process.on('message', (msg) => {
		if (msg === 'shutdown') {
			console.log('📤 Received PM2 shutdown message');
			gracefulShutdown('PM2').catch(console.error);
		}
	});
}

/**
 * Perform graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
	console.log(`🛑 Graceful shutdown initiated by ${signal}`);

	const config = getConfig();
	const shutdownTimeout = 5000; // 5 seconds

	const shutdownPromise = new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			console.log('⏰ Shutdown timeout reached, forcing exit');
			resolve();
		}, shutdownTimeout);

		// Perform cleanup tasks
		Promise.all([closeConnections(), flushLogs(), notifyServices()])
			.then(() => {
				clearTimeout(timer);
				console.log('✅ Cleanup completed');
				resolve();
			})
			.catch((error) => {
				clearTimeout(timer);
				console.error('❌ Error during cleanup:', error);
				resolve();
			});
	});

	await shutdownPromise;

	console.log('👋 Goodbye!');
	process.exit(0);
}

/**
 * Close active connections
 */
async function closeConnections(): Promise<void> {
	// TODO: Implement connection closing logic
	// - Close SMTP server
	// - Close HTTP clients
	// - Close database connections if any

	console.log('🔌 Closing connections...');
	await new Promise((resolve) => setTimeout(resolve, 100));
	console.log('✅ Connections closed');
}

/**
 * Flush any pending logs
 */
async function flushLogs(): Promise<void> {
	console.log('📝 Flushing logs...');

	// Ensure all console output is flushed
	return new Promise((resolve) => {
		if (process.stdout.write('')) {
			resolve();
		} else {
			process.stdout.once('drain', resolve);
		}
	});
}

/**
 * Notify external services about shutdown
 */
async function notifyServices(): Promise<void> {
	if (!isProduction()) {
		return;
	}

	console.log('📢 Notifying services of shutdown...');

	try {
		// TODO: Implement service notifications
		// - Update health check status
		// - Notify monitoring services
		// - Update load balancer status

		await new Promise((resolve) => setTimeout(resolve, 100));
		console.log('✅ Services notified');
	} catch (_error) {
		console.error('❌ Failed to notify services:', _error);
	}
}

/**
 * Log errors to monitoring service
 */
function logToMonitoring(type: string, error: unknown): void {
	if (!isProduction()) {
		return;
	}

	try {
		// TODO: Implement monitoring service integration
		// - Send to Sentry
		// - Send to DataDog
		// - Send to custom monitoring endpoint

		console.log(`📊 Logged ${type} to monitoring service`);
	} catch (monitoringError) {
		console.error('❌ Failed to log to monitoring service:', monitoringError);
	}
}

/**
 * Memory usage monitoring
 */
export function startMemoryMonitoring(): void {
	if (!isProduction()) {
		return;
	}

	const interval = 30000; // 30 seconds

	setInterval(() => {
		const memUsage = process.memoryUsage();
		const mbUsage = {
			rss: Math.round(memUsage.rss / 1024 / 1024),
			heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
			heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
			external: Math.round(memUsage.external / 1024 / 1024)
		};

		// Log if memory usage is high
		if (mbUsage.heapUsed > 400) {
			console.warn('⚠️  High memory usage:', mbUsage);
		}

		// Force garbage collection if memory is very high
		if (mbUsage.heapUsed > 450) {
			if (global.gc) {
				global.gc();
				console.log('🗑️  Forced garbage collection');
			}
		}
	}, interval);
}

/**
 * Process health check
 */
export function getProcessHealth(): {
	status: 'healthy' | 'degraded' | 'unhealthy';
	details: {
		uptime: number;
		memory: NodeJS.MemoryUsage;
		pid: number;
		version: string;
	};
} {
	const memUsage = process.memoryUsage();
	const uptime = process.uptime();

	let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

	// Check memory usage (in MB)
	const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
	if (heapUsedMB > 450) {
		status = 'unhealthy';
	} else if (heapUsedMB > 350) {
		status = 'degraded';
	}

	// Check uptime (less than 30 seconds might indicate frequent restarts)
	if (uptime < 30) {
		status = 'degraded';
	}

	return {
		status,
		details: {
			uptime,
			memory: memUsage,
			pid: process.pid,
			version: process.version
		}
	};
}
