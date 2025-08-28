import { writable } from 'svelte/store';

export interface ToastData {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title?: string;
	message: string;
	duration?: number;
	dismissible?: boolean;
}

interface ToastStore {
	toasts: ToastData[];
}

function createToastStore() {
	const { subscribe, update } = writable<ToastStore>({ toasts: [] });

	function addToast(toast: Omit<ToastData, 'id'>): string {
		const id = crypto.randomUUID();
		const newToast: ToastData = {
			id,
			duration: 5000,
			dismissible: true,
			...toast
		};

		update(state => ({
			toasts: [...state.toasts, newToast]
		}));

		return id;
	}

	function removeToast(id: string) {
		update(state => ({
			toasts: state.toasts.filter(toast => toast.id !== id)
		}));
	}

	function clearAll() {
		update(() => ({ toasts: [] }));
	}

	// Convenience methods
	function success(message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) {
		return addToast({ type: 'success', message, ...options });
	}

	function error(message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) {
		return addToast({ type: 'error', message, duration: 7000, ...options });
	}

	function warning(message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) {
		return addToast({ type: 'warning', message, ...options });
	}

	function info(message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'message'>>) {
		return addToast({ type: 'info', message, ...options });
	}

	return {
		subscribe,
		addToast,
		removeToast,
		clearAll,
		success,
		error,
		warning,
		info
	};
}

export const toast = createToastStore();