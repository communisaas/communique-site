/**
 * CENTRALIZED MODAL STATE MANAGEMENT SYSTEM
 * 
 * Eliminates scattered modal states across 12+ components.
 * Single source of truth for all modal coordination.
 */

import { writable, derived } from 'svelte/store';
import { toggleBodyScroll } from '$lib/utils/browserUtils';
import { coordinated } from '$lib/utils/timerCoordinator';
import type { Template } from '$lib/types/template';

// Modal Type Registry - All possible modals in the system
export type ModalType = 
	| 'auth'
	| 'address' 
	| 'email_loading'
	| 'mobile_preview'
	| 'template_creator'
	| 'onboarding'
	| 'template_modal'
	| 'share_menu'
	| 'copied_feedback'
	| 'error_dialog'
	| 'confirmation_dialog';

// Modal State Interface
interface ModalState {
	type: ModalType;
	isOpen: boolean;
	data?: unknown; // Modal-specific payload
	zIndex: number;
	closeOnBackdrop?: boolean;
	closeOnEscape?: boolean;
}

// Central Modal Store
interface ModalSystemState {
	activeModals: Map<string, ModalState>;
	modalStack: string[]; // Z-index management
	baseZIndex: number;
}

const initialState: ModalSystemState = {
	activeModals: new Map(),
	modalStack: [],
	baseZIndex: 1000
};

// Core Store
const modalSystem = writable<ModalSystemState>(initialState);

// Derived Stores for Easy Access
export const activeModals = derived(modalSystem, ($state) => $state.activeModals);
export const topModal = derived(modalSystem, ($state) => {
	const topId = $state.modalStack[$state.modalStack.length - 1];
	return topId ? $state.activeModals.get(topId) : null;
});
export const hasActiveModal = derived(modalSystem, ($state) => $state.modalStack.length > 0);

// Original Modal Management Actions (will be replaced by enhanced version)
const originalModalActions = {
	/**
	 * Open a modal with proper z-index management
	 */
	open(id: string, type: ModalType, data?: unknown, options?: {
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		autoClose?: number; // Auto-close after N milliseconds
	}) {
		modalSystem.update(state => {
			// Close existing modal of same type to prevent conflicts
			const existingId = this.findModalByType(type);
			if (existingId && existingId !== id) {
				this.close(existingId);
			}

			const zIndex = state.baseZIndex + state.modalStack.length;
			
			const modalState: ModalState = {
				type,
				isOpen: true,
				data,
				zIndex,
				closeOnBackdrop: options?.closeOnBackdrop ?? true,
				closeOnEscape: options?.closeOnEscape ?? true
			};

			state.activeModals.set(id, modalState);
			state.modalStack.push(id);

			// DOM body scroll lock using unified utility
			toggleBodyScroll(true);

			// Auto-close timer
			if (options?.autoClose) {
				coordinated.autoClose(() => {
					this.close(id);
				}, options.autoClose, `modal_${id}`);
			}

			return state;
		});
	},

	/**
	 * Close specific modal
	 */
	close(id: string) {
		modalSystem.update(state => {
			const modal = state.activeModals.get(id);
			if (!modal) return state;

			state.activeModals.delete(id);
			state.modalStack = state.modalStack.filter(stackId => stackId !== id);

			// Restore body scroll if no modals remain
			if (state.modalStack.length === 0) {
				toggleBodyScroll(false);
			}

			return state;
		});
	},

	/**
	 * Close all modals
	 */
	closeAll() {
		modalSystem.update(state => {
			state.activeModals.clear();
			state.modalStack = [];
			
			toggleBodyScroll(false);

			return state;
		});
	},

	/**
	 * Close top modal (ESC key behavior)
	 */
	closeTop() {
		modalSystem.update(state => {
			const topId = state.modalStack[state.modalStack.length - 1];
			if (topId) {
				this.close(topId);
			}
			return state;
		});
	},

	/**
	 * Find modal ID by type
	 */
	findModalByType(type: ModalType): string | null {
		let foundId: string | null = null;
		modalSystem.subscribe(state => {
			for (const [id, modal] of state.activeModals) {
				if (modal.type === type) {
					foundId = id;
					break;
				}
			}
		})();
		return foundId;
	},

	/**
	 * Check if modal is open
	 */
	isOpen(id: string): boolean {
		let open = false;
		modalSystem.subscribe(state => {
			const modal = state.activeModals.get(id);
			open = modal?.isOpen ?? false;
		})();
		return open;
	},

	/**
	 * Get modal data
	 */
	getData(id: string): unknown {
		let data = null;
		modalSystem.subscribe(state => {
			const modal = state.activeModals.get(id);
			data = modal?.data ?? null;
		})();
		return data;
	}
};

// Global Event Listeners for Modal System
if (typeof window !== 'undefined') {
	// ESC key closes top modal
	window.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			let shouldClose = false;
			modalSystem.subscribe(state => {
				const topId = state.modalStack[state.modalStack.length - 1];
				if (topId) {
					const modal = state.activeModals.get(topId);
					shouldClose = modal?.closeOnEscape ?? true;
				}
			})();
			
			if (shouldClose) {
				modalActions.closeTop();
			}
		}
	});

	// Click outside closes modal (if enabled)
	window.addEventListener('click', (e) => {
		const target = e.target as Element;
		if (target.classList.contains('modal-backdrop')) {
			let shouldClose = false;
			modalSystem.subscribe(state => {
				const topId = state.modalStack[state.modalStack.length - 1];
				if (topId) {
					const modal = state.activeModals.get(topId);
					shouldClose = modal?.closeOnBackdrop ?? true;
				}
			})();
			
			if (shouldClose) {
				modalActions.closeTop();
			}
		}
	});
}

// Modal Component Utilities
export function createModalStore(id: string, type: ModalType) {
	const value = derived(activeModals, ($modals) => {
		const modal = $modals.get(id);
		return {
			isOpen: modal?.isOpen ?? false,
			data: modal?.data ?? null,
			zIndex: modal?.zIndex ?? 1000
		};
	});

	return {
		subscribe: value.subscribe,
		open: (data?: unknown, options?: { closeOnBackdrop?: boolean; closeOnEscape?: boolean; autoClose?: number }) =>
			originalModalActions.open(id, type, data, options),
		close: () => originalModalActions.close(id)
	};
}

export default originalModalActions;

// =============================================================================
// BACKWARD COMPATIBILITY LAYER for modalState.ts
// =============================================================================

// Legacy modal state types from modalState.ts
export type LegacyModalState = 'closed' | 'auth_required' | 'loading' | 'confirmation' | 'celebration';
export type ModalState = LegacyModalState; // Export with original name for backward compatibility

interface LegacyModalContext {
	template: Template | null;
	user: any;
	state: LegacyModalState;
	mailtoUrl?: string;
	sendConfirmed: boolean;
	showModal: boolean;
}

const legacyInitialContext: LegacyModalContext = {
	template: null,
	user: null,
	state: 'closed',
	sendConfirmed: false,
	showModal: false
};

// Legacy store for template modal state
const legacyModalContext = writable<LegacyModalContext>(legacyInitialContext);

// Legacy derived stores (exact API compatibility)
export const modalContext = legacyModalContext;
export const modalState = derived(legacyModalContext, ($context) => $context.state);
export const isModalOpen = derived(legacyModalContext, ($context) => $context.showModal);
export const currentTemplate = derived(legacyModalContext, ($context) => $context.template);

// Enhanced modalActions that includes both new API and legacy compatibility
const enhancedModalActions = {
	// =========================================================================
	// NEW UNIFIED API (from original modalSystem.ts)
	// =========================================================================
	
	openModal(id: string, type: ModalType, data?: unknown, options?: {
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		autoClose?: number;
	}) {
		return originalModalActions.open(id, type, data, options);
	},

	closeModal(id: string) {
		return originalModalActions.close(id);
	},

	closeAll() {
		return originalModalActions.closeAll();
	},

	closeTop() {
		return originalModalActions.closeTop();
	},

	findModalByType(type: ModalType): string | null {
		return originalModalActions.findModalByType(type);
	},

	isModalOpen(id: string): boolean {
		return originalModalActions.isOpen(id);
	},

	getModalData(id: string): unknown {
		return originalModalActions.getData(id);
	},

	// =========================================================================
	// LEGACY API COMPATIBILITY (from modalState.ts)
	// =========================================================================

	// Legacy template modal API - preserves exact behavior
	open(template: Template, user: any) {
		// Update legacy store to maintain backward compatibility
		legacyModalContext.update(ctx => ({
			...ctx,
			template,
			user,
			state: user ? 'loading' : 'auth_required',
			showModal: true,
			sendConfirmed: false
		}));

		// Also register in new unified system for consistency
		originalModalActions.open('legacy-template-modal', 'template_modal', { template, user });
	},

	// Legacy template modal state management
	setState(state: ModalState) {
		legacyModalContext.update(ctx => ({
			...ctx,
			state
		}));
	},

	setMailtoUrl(url: string) {
		legacyModalContext.update(ctx => ({
			...ctx,
			mailtoUrl: url
		}));
	},

	confirmSend() {
		legacyModalContext.update(ctx => ({
			...ctx,
			sendConfirmed: true,
			state: 'celebration'
		}));
	},

	// Legacy close method
	close() {
		// Legacy template modal close
		legacyModalContext.update(ctx => ({
			...ctx,
			showModal: false,
			state: 'closed'
		}));
		
		// Also close in unified system
		originalModalActions.close('legacy-template-modal');
	},

	reset() {
		legacyModalContext.set(legacyInitialContext);
		originalModalActions.closeAll();
	}
};

// Replace the original modalActions export with the enhanced version
export { enhancedModalActions as modalActions };