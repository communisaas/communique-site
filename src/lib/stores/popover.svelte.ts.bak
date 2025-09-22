import { coordinated } from '$lib/utils/timerCoordinator';

interface Popover {
	id: string;
	state: 'opening' | 'open' | 'closing' | 'closed';
}

function createPopoverStore() {
	let currentPopover = $state<Popover | null>(null);

	// Track pending close timeouts
	const pendingCloseTimeouts = new Map<string, number>();

	const open = (id: string): void => {
		// Cancel any pending close for this popover
		cancelClose(id);

		if (currentPopover && currentPopover.id !== id && currentPopover.state !== 'closing') {
			// Close the current popover before opening the new one
			currentPopover = { id: currentPopover.id, state: 'closing' };
		} else {
			currentPopover = { id, state: 'opening' };
		}

		// A very short delay to allow the closing animation of the previous popover
		coordinated.transition(
			() => {
				if (currentPopover?.id === id && currentPopover.state === 'opening') {
					currentPopover = { id, state: 'open' };
				}
			},
			10,
			`popover_${id}`
		);
	};

	const close = (id: string): void => {
		// Cancel any pending close timeout first
		cancelClose(id);

		if (
			currentPopover &&
			currentPopover.id === id &&
			(currentPopover.state === 'open' || currentPopover.state === 'opening')
		) {
			currentPopover = { ...currentPopover, state: 'closing' };
		}
	};

	const closeWithDelay = (id: string, delay: number = 150): void => {
		// Cancel any existing timeout for this popover
		cancelClose(id);

		// Set a new timeout
		const timeoutId = setTimeout(() => {
			pendingCloseTimeouts.delete(id);
			close(id);
		}, delay) as unknown as number;

		pendingCloseTimeouts.set(id, timeoutId);
	};

	const cancelClose = (id: string): void => {
		const timeoutId = pendingCloseTimeouts.get(id);
		if (timeoutId) {
			clearTimeout(timeoutId);
			pendingCloseTimeouts.delete(id);
		}
	};

	const closed = (id: string): void => {
		if (currentPopover && currentPopover.id === id && currentPopover.state === 'closing') {
			currentPopover = null;
		}
	};

	return {
		get popover() {
			return currentPopover;
		},
		open,
		close,
		closeWithDelay,
		cancelClose,
		closed
	};
}

export const popover = createPopoverStore();
