import { goto } from '$app/navigation';
import type { Writable } from 'svelte/store';

export default function modal(node: HTMLElement) {
	const modalRoot = document.getElementById('modal-root');
	modalRoot?.appendChild(node);

	return {
		destroy() {
			if (modalRoot?.contains(node)) {
				modalRoot.removeChild(node);
			}
		}
	};
}

export function handlePopover(
	e: CustomEvent<boolean>,
	sessionStore: Writable<UserState>,
	modal: keyof ModalState,
	callback: `/${string}`
) {
	sessionStore.update((currentValue: UserState) => ({
		...currentValue,
		show: {
			...currentValue.show,
			[modal]: e.detail
		}
	}));

	if (!e.detail) {
		return goto(callback, { noScroll: true });
	}
}
