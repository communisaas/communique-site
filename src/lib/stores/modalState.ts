/**
 * Modal State Store - Persistent across navigation
 * 
 * Manages modal state that survives page transitions for seamless UX
 */

import { writable, derived } from 'svelte/store';
import type { Template } from '$lib/types/template';

export type ModalState = 'closed' | 'auth_required' | 'loading' | 'confirmation' | 'celebration';

interface ModalContext {
	template: Template | null;
	user: any;
	state: ModalState;
	mailtoUrl?: string;
	sendConfirmed: boolean;
	showModal: boolean;
}

const initialContext: ModalContext = {
	template: null,
	user: null,
	state: 'closed',
	sendConfirmed: false,
	showModal: false
};

export const modalContext = writable<ModalContext>(initialContext);

// Derived stores for cleaner component access
export const modalState = derived(modalContext, ($context) => $context.state);
export const isModalOpen = derived(modalContext, ($context) => $context.showModal);
export const currentTemplate = derived(modalContext, ($context) => $context.template);

// Modal actions
export const modalActions = {
	open(template: Template, user: any) {
		modalContext.update(ctx => ({
			...ctx,
			template,
			user,
			state: user ? 'loading' : 'auth_required',
			showModal: true,
			sendConfirmed: false
		}));
	},

	setState(state: ModalState) {
		modalContext.update(ctx => ({
			...ctx,
			state
		}));
	},

	setMailtoUrl(url: string) {
		modalContext.update(ctx => ({
			...ctx,
			mailtoUrl: url
		}));
	},

	confirmSend() {
		modalContext.update(ctx => ({
			...ctx,
			sendConfirmed: true,
			state: 'celebration'
		}));
	},

	close() {
		modalContext.update(ctx => ({
			...ctx,
			showModal: false,
			state: 'closed'
		}));
	},

	reset() {
		modalContext.set(initialContext);
	}
};