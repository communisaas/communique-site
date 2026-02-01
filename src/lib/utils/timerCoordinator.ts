/**
 * TIMER COORDINATION SYSTEM
 *
 * Centralized management for all setTimeout/setInterval calls
 * Prevents memory leaks, race conditions, and provides cleanup
 */

import { browser } from '$app/environment';

// Enhanced timer type definition
export type TimerType =
	| 'modal'
	| 'transition'
	| 'feedback'
	| 'dom'
	| 'gesture'
	| 'polling'
	| 'debounce' // existing core types
	| 'scroll-to-channel'
	| 'retry'
	| 'progress' // UI timers
	| 'override-navigation'
	| 'open-creator'
	| 'direct-navigation'
	| 'guest-navigation' // navigation timers
	| 'detection-timeout'
	| 'copy-success'
	| 'copy-reset'
	| 'copy-hide' // action timers
	| 'cleanup'
	| 'auto-send' // system timers
	| 'attention-stagger'
	| 'attention-settle'
	| 'attention-end' // attention management
	| 'guest-multi-target-auth'
	| 'multi-target-address-gate'
	| 'multi-target-cwc'; // multi-target flow timers

// Type guard for TimerType
export function isValidTimerType(type: unknown): type is TimerType {
	return (
		typeof type === 'string' &&
		[
			// Core types
			'modal',
			'transition',
			'feedback',
			'dom',
			'gesture',
			'polling',
			'debounce',
			// UI timers
			'scroll-to-channel',
			'retry',
			'progress',
			// Navigation timers
			'override-navigation',
			'open-creator',
			'direct-navigation',
			'guest-navigation',
			// Action timers
			'detection-timeout',
			'copy-success',
			'copy-reset',
			'copy-hide',
			// System timers
			'cleanup',
			'auto-send',
			// Attention management
			'attention-stagger',
			'attention-settle',
			'attention-end',
			// Multi-target flow timers
			'guest-multi-target-auth',
			'multi-target-address-gate',
			'multi-target-cwc'
		].includes(type)
	);
}

// Type for timer callback functions
export type TimerCallback = () => void;

// Enhanced timer record interface
export interface TimerRecord {
	id: string;
	type: TimerType;
	timeoutId: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;
	duration: number;
	callback: TimerCallback;
	createdAt: number;
	isInterval: boolean;
	componentId?: string;
}

// Type guard for TimerRecord
export function isValidTimerRecord(record: unknown): record is TimerRecord {
	if (typeof record !== 'object' || record === null) return false;
	const r = record as Record<string, unknown>;

	return (
		typeof r.id === 'string' &&
		isValidTimerType(r.type) &&
		typeof r.duration === 'number' &&
		typeof r.callback === 'function' &&
		typeof r.createdAt === 'number' &&
		typeof r.isInterval === 'boolean'
	);
}

class TimerCoordinator {
	private timers = new Map<string, TimerRecord>();
	private componentTimers = new Map<string, Set<string>>();
	private nextId = 0;

	/**
	 * Set a timeout with automatic tracking and cleanup
	 */
	public setTimeout(
		callback: TimerCallback,
		duration: number,
		type: TimerType = 'dom',
		componentId?: string
	): string {
		// Input validation
		if (typeof callback !== 'function') {
			throw new Error('Timer callback must be a function');
		}

		if (typeof duration !== 'number' || duration < 0) {
			throw new Error('Timer duration must be a non-negative number');
		}

		if (!isValidTimerType(type)) {
			throw new Error(`Invalid timer type: ${type}`);
		}

		if (componentId !== undefined && typeof componentId !== 'string') {
			throw new Error('Component ID must be a string');
		}

		if (!browser) return '';

		const id = `timer_${++this.nextId}`;
		const timeoutId = setTimeout(() => {
			try {
				callback();
			} catch {
				console.error('Error occurred');
			} finally {
				this.clearTimer(id);
			}
		}, duration);

		const record: TimerRecord = {
			id,
			type,
			timeoutId,
			duration,
			callback,
			createdAt: Date.now(),
			isInterval: false,
			componentId
		};

		this.timers.set(id, record);

		// Track by component for bulk cleanup
		if (componentId) {
			if (!this.componentTimers.has(componentId)) {
				this.componentTimers.set(componentId, new Set());
			}
			this.componentTimers.get(componentId)!.add(id);
		}

		return id;
	}

	/**
	 * Set an interval with automatic tracking
	 */
	public setInterval(
		callback: TimerCallback,
		duration: number,
		type: TimerType = 'polling',
		componentId?: string
	): string {
		// Input validation (same as setTimeout)
		if (typeof callback !== 'function') {
			throw new Error('Timer callback must be a function');
		}

		if (typeof duration !== 'number' || duration < 0) {
			throw new Error('Timer duration must be a non-negative number');
		}

		if (!isValidTimerType(type)) {
			throw new Error(`Invalid timer type: ${type}`);
		}

		if (componentId !== undefined && typeof componentId !== 'string') {
			throw new Error('Component ID must be a string');
		}

		if (!browser) return '';

		const id = `interval_${++this.nextId}`;
		const intervalId = setInterval(() => {
			try {
				callback();
			} catch {
				console.error('Error occurred');
			}
		}, duration);

		const record: TimerRecord = {
			id,
			type,
			timeoutId: intervalId,
			duration,
			callback,
			createdAt: Date.now(),
			isInterval: true,
			componentId
		};

		this.timers.set(id, record);

		if (componentId) {
			if (!this.componentTimers.has(componentId)) {
				this.componentTimers.set(componentId, new Set());
			}
			this.componentTimers.get(componentId)!.add(id);
		}

		return id;
	}

	/**
	 * Clear a specific timer
	 */
	public clearTimer(id: string): void {
		if (typeof id !== 'string') {
			console.warn('Timer ID must be a string');
			return;
		}

		const timer = this.timers.get(id);
		if (!timer) return;

		try {
			if (timer.isInterval) {
				clearInterval(timer.timeoutId);
			} else {
				clearTimeout(timer.timeoutId);
			}
		} catch {
			console.error('Error occurred');
		}

		this.timers.delete(id);

		// Remove from component tracking
		if (timer.componentId) {
			const componentSet = this.componentTimers.get(timer.componentId);
			if (componentSet) {
				componentSet.delete(id);
				if (componentSet.size === 0) {
					this.componentTimers.delete(timer.componentId);
				}
			}
		}
	}

	/**
	 * Clear all timers for a component (call on unmount)
	 */
	clearComponentTimers(componentId: string): void {
		const timerIds = this.componentTimers.get(componentId);
		if (!timerIds) return;

		timerIds.forEach((id) => this.clearTimer(id));
		this.componentTimers.delete(componentId);
	}

	/**
	 * Clear all timers of a specific type
	 */
	clearTimersByType(type: TimerType): void {
		const toDelete: string[] = [];
		this.timers.forEach((timer, id) => {
			if (timer.type === type) {
				toDelete.push(id);
			}
		});
		toDelete.forEach((id) => this.clearTimer(id));
	}

	/**
	 * Clear all timers (for app cleanup)
	 */
	clearAll(): void {
		this.timers.forEach((timer, _id) => {
			if (timer.isInterval) {
				clearInterval(timer.timeoutId);
			} else {
				clearTimeout(timer.timeoutId);
			}
		});
		this.timers.clear();
		this.componentTimers.clear();
	}

	/**
	 * Get active timer count
	 */
	getActiveCount(): number {
		return this.timers.size;
	}

	/**
	 * Get timer stats for debugging
	 */
	getStats(): Record<TimerType, number> {
		const stats: Record<string, number> = {};
		this.timers.forEach((timer) => {
			stats[timer.type] = (stats[timer.type] || 0) + 1;
		});
		return stats as Record<TimerType, number>;
	}
}

// Singleton instance
export const timerCoordinator = new TimerCoordinator();

// Convenience exports
export const coordinated = {
	/**
	 * setTimeout with automatic tracking
	 */
	setTimeout(
		callback: () => void,
		duration: number,
		type: TimerType = 'dom',
		componentId?: string
	): string {
		return timerCoordinator.setTimeout(callback, duration, type, componentId);
	},

	/**
	 * setInterval with automatic tracking
	 */
	setInterval(
		callback: () => void,
		duration: number,
		type: TimerType = 'polling',
		componentId?: string
	): string {
		return timerCoordinator.setInterval(callback, duration, type, componentId);
	},

	/**
	 * DOM update delay (like nextTick)
	 */
	nextTick(callback: () => void, componentId?: string): string {
		return timerCoordinator.setTimeout(callback, 0, 'dom', componentId);
	},

	/**
	 * Modal auto-close timer
	 */
	autoClose(callback: () => void, duration: number, componentId?: string): string {
		return timerCoordinator.setTimeout(callback, duration, 'modal', componentId);
	},

	/**
	 * Feedback message timer (copy success, etc)
	 */
	feedback(callback: () => void, duration = 2000, componentId?: string): string {
		return timerCoordinator.setTimeout(callback, duration, 'feedback', componentId);
	},

	/**
	 * Transition delay
	 */
	transition(callback: () => void, duration = 300, componentId?: string): string {
		return timerCoordinator.setTimeout(callback, duration, 'transition', componentId);
	},

	/**
	 * Gesture detection timer
	 */
	gesture(callback: () => void, duration: number, componentId?: string): string {
		return timerCoordinator.setTimeout(callback, duration, 'gesture', componentId);
	},

	/**
	 * Polling interval
	 */
	poll(callback: () => void, interval: number, componentId?: string): string {
		return timerCoordinator.setInterval(callback, interval, 'polling', componentId);
	},

	/**
	 * Debounced function
	 */
	debounce<TArgs extends readonly unknown[]>(
		func: (...args: TArgs) => void,
		delay: number,
		componentId?: string
	): (...args: TArgs) => void {
		let timerId: string | null = null;

		return (...args: TArgs) => {
			if (timerId) {
				timerCoordinator.clearTimer(timerId);
			}
			timerId = timerCoordinator.setTimeout(
				() => {
					func(...args);
					timerId = null;
				},
				delay,
				'debounce',
				componentId
			);
		};
	}
};

// Component cleanup helper for Svelte onDestroy
export function useTimerCleanup(componentId: string) {
	return () => {
		timerCoordinator.clearComponentTimers(componentId);
	};
}

// Global cleanup on page unload
if (browser) {
	window.addEventListener('beforeunload', () => {
		timerCoordinator.clearAll();
	});
}

// Server-safe timer functions (for non-browser environments)
export const serverSafeTimers = {
	setTimeout: (callback: () => void, duration: number): string => {
		if (browser) {
			return timerCoordinator.setTimeout(callback, duration);
		} else {
			// Server-side: use native setTimeout but return string ID
			const id = setTimeout(callback, duration);
			return `server_${id}`;
		}
	},

	clearTimeout: (id: string): void => {
		if (browser) {
			timerCoordinator.clearTimer(id);
		} else if (id.startsWith('server_')) {
			const numericId = id.replace('server_', '');
			clearTimeout(parseInt(numericId));
		}
	}
};
