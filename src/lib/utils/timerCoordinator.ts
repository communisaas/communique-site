/**
 * TIMER COORDINATION SYSTEM
 * 
 * Centralized management for all setTimeout/setInterval calls
 * Prevents memory leaks, race conditions, and provides cleanup
 */

import { browser } from '$app/environment';

type TimerType = 'modal' | 'transition' | 'feedback' | 'dom' | 'gesture' | 'polling' | 'debounce';

interface TimerRecord {
	id: string;
	type: TimerType;
	timeoutId: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;
	duration: number;
	callback: () => void;
	createdAt: number;
	isInterval: boolean;
	componentId?: string;
}

class TimerCoordinator {
	private timers = new Map<string, TimerRecord>();
	private componentTimers = new Map<string, Set<string>>();
	private nextId = 0;

	/**
	 * Set a timeout with automatic tracking and cleanup
	 */
	setTimeout(
		callback: () => void,
		duration: number,
		type: TimerType = 'dom',
		componentId?: string
	): string {
		if (!browser) return '';

		const id = `timer_${++this.nextId}`;
		const timeoutId = setTimeout(() => {
			callback();
			this.clearTimer(id);
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
	setInterval(
		callback: () => void,
		duration: number,
		type: TimerType = 'polling',
		componentId?: string
	): string {
		if (!browser) return '';

		const id = `interval_${++this.nextId}`;
		const intervalId = setInterval(callback, duration);

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
	clearTimer(id: string): void {
		const timer = this.timers.get(id);
		if (!timer) return;

		if (timer.isInterval) {
			clearInterval(timer.timeoutId);
		} else {
			clearTimeout(timer.timeoutId);
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

		timerIds.forEach(id => this.clearTimer(id));
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
		toDelete.forEach(id => this.clearTimer(id));
	}

	/**
	 * Clear all timers (for app cleanup)
	 */
	clearAll(): void {
		this.timers.forEach((timer, id) => {
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
		this.timers.forEach(timer => {
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
	setTimeout(callback: () => void, duration: number, type: TimerType = 'dom', componentId?: string): string {
		return timerCoordinator.setTimeout(callback, duration, type, componentId);
	},

	/**
	 * setInterval with automatic tracking
	 */
	setInterval(callback: () => void, duration: number, type: TimerType = 'polling', componentId?: string): string {
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
	debounce<T extends (...args: any[]) => void>(
		func: T,
		delay: number,
		componentId?: string
	): (...args: Parameters<T>) => void {
		let timerId: string | null = null;

		return (...args: Parameters<T>) => {
			if (timerId) {
				timerCoordinator.clearTimer(timerId);
			}
			timerId = timerCoordinator.setTimeout(() => {
				func(...args);
				timerId = null;
			}, delay, 'debounce', componentId);
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