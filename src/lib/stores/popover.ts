import { writable, get } from 'svelte/store';
import { coordinated } from '$lib/utils/timerCoordinator';

interface Popover {
	id: string;
	state: 'opening' | 'open' | 'closing' | 'closed';
}

const createPopoverStore = () => {
	const { subscribe, update } = writable<Popover | null>(null);
	
	// Track pending close timeouts
	const pendingCloseTimeouts = new Map<string, number>();

	const open = (id: string) => {
		// Cancel any pending close for this popover
		cancelClose(id);
		
		update((current) => {
			if (current && current.id !== id && current.state !== 'closing') {
				// Close the current popover before opening the new one
				return { id: current.id, state: 'closing' };
			}
			return { id, state: 'opening' };
		});

		// A short delay to allow the closing animation of the previous popover
		coordinated.transition(() => {
			update((current) => {
				if (current?.id === id && current.state === 'opening') {
					return { id, state: 'open' };
				}
				return current;
			});
		}, 50, `popover_${id}`);
	};

	const close = (id: string) => {
		// Cancel any pending close timeout first
		cancelClose(id);
		
		update((current) => {
			if (current && current.id === id && (current.state === 'open' || current.state === 'opening')) {
				return { ...current, state: 'closing' };
			}
			return current;
		});
	};

	const closeWithDelay = (id: string, delay: number = 150) => {
		// Cancel any existing timeout for this popover
		cancelClose(id);
		
		// Set a new timeout
		const timeoutId = setTimeout(() => {
			pendingCloseTimeouts.delete(id);
			close(id);
		}, delay) as unknown as number;
		
		pendingCloseTimeouts.set(id, timeoutId);
	};

	const cancelClose = (id: string) => {
		const timeoutId = pendingCloseTimeouts.get(id);
		if (timeoutId) {
			clearTimeout(timeoutId);
			pendingCloseTimeouts.delete(id);
		}
	};

	const closed = (id: string) => {
		update((current) => {
			if (current && current.id === id && current.state === 'closing') {
				return null;
			}
			return current;
		});
	};

	return {
		subscribe,
		open,
		close,
		closeWithDelay,
		cancelClose,
		closed
	};
};

export const popover = createPopoverStore();