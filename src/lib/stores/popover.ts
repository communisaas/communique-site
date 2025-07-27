import { writable, get } from 'svelte/store';
import { coordinated } from '$lib/utils/timerCoordinator';

interface Popover {
	id: string;
	state: 'opening' | 'open' | 'closing' | 'closed';
}

const createPopoverStore = () => {
	const { subscribe, update } = writable<Popover | null>(null);

	const open = (id: string) => {
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
		update((current) => {
			if (current && current.id === id && (current.state === 'open' || current.state === 'opening')) {
				return { ...current, state: 'closing' };
			}
			return current;
		});
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
		closed
	};
};

export const popover = createPopoverStore();