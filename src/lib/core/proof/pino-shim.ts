/**
 * Pino Browser Shim
 *
 * The pino browser bundle uses CommonJS (module.exports = pino),
 * but @aztec/bb.js imports it as a named export ({ pino }).
 * This shim provides the named export compatibility.
 *
 * We inline a minimal browser-compatible logger instead of importing pino
 * to avoid circular alias issues and reduce bundle size.
 */

type LogFn = (msg: string, ...args: unknown[]) => void;

interface PinoLogger {
	level: string;
	trace: LogFn;
	debug: LogFn;
	info: LogFn;
	warn: LogFn;
	error: LogFn;
	fatal: LogFn;
	silent: LogFn;
	child: (bindings: Record<string, unknown>) => PinoLogger;
}

function createLogger(options?: { level?: string }): PinoLogger {
	const level = options?.level || 'info';
	const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
	const levelIndex = levels.indexOf(level);

	const noop: LogFn = () => {};
	const log = (lvl: string): LogFn => {
		const idx = levels.indexOf(lvl);
		if (idx < levelIndex) return noop;
		return (msg: string, ...args: unknown[]) => {
			const method = lvl === 'fatal' ? 'error' : lvl === 'trace' ? 'debug' : lvl;
			if (method in console && typeof (console as unknown as Record<string, unknown>)[method] === 'function') {
				(console as unknown as Record<string, (...args: unknown[]) => void>)[method](`[${lvl}]`, msg, ...args);
			}
		};
	};

	const logger: PinoLogger = {
		level,
		trace: log('trace'),
		debug: log('debug'),
		info: log('info'),
		warn: log('warn'),
		error: log('error'),
		fatal: log('fatal'),
		silent: noop,
		child: () => logger // Return same logger for simplicity
	};

	return logger;
}

// Export as named export for @aztec/bb.js compatibility
export const pino = createLogger;
export default createLogger;

// Export Logger type
export type Logger = PinoLogger;
