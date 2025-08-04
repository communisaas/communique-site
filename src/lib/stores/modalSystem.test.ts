import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { modalActions, activeModals, topModal, hasActiveModal, createModalStore } from './modalSystem.ts';

vi.mock('$lib/utils/browserUtils', () => ({
  toggleBodyScroll: vi.fn()
}));

vi.mock('$lib/utils/timerCoordinator', () => ({
  coordinated: {
    autoClose: vi.fn()
  }
}));

describe('Modal System', () => {
  beforeEach(() => {
    modalActions.closeAll();
    vi.clearAllMocks();
  });

  describe('Basic Operations', () => {
    it('opens modal correctly', () => {
      modalActions.open('test-modal', 'auth', { userId: 123 });
      
      const modals = get(activeModals);
      const modal = modals.get('test-modal');
      
      expect(modal).toBeDefined();
      expect(modal?.type).toBe('auth');
      expect(modal?.isOpen).toBe(true);
      expect(modal?.data).toEqual({ userId: 123 });
      expect(modal?.zIndex).toBe(1000);
    });

    it('closes modal correctly', () => {
      modalActions.open('test-modal', 'auth');
      modalActions.close('test-modal');
      
      const modals = get(activeModals);
      expect(modals.has('test-modal')).toBe(false);
      expect(get(hasActiveModal)).toBe(false);
    });

    it('closes all modals', () => {
      modalActions.open('modal1', 'auth');
      modalActions.open('modal2', 'address');
      modalActions.open('modal3', 'template_modal');
      
      expect(get(hasActiveModal)).toBe(true);
      
      modalActions.closeAll();
      
      const modals = get(activeModals);
      expect(modals.size).toBe(0);
      expect(get(hasActiveModal)).toBe(false);
    });

    it('closes top modal', () => {
      modalActions.open('modal1', 'auth');
      modalActions.open('modal2', 'address');
      
      modalActions.closeTop();
      
      const modals = get(activeModals);
      expect(modals.has('modal2')).toBe(false);
      expect(modals.has('modal1')).toBe(true);
      expect(get(topModal)?.type).toBe('auth');
    });
  });

  describe('Z-Index Management', () => {
    it('assigns increasing z-index to stacked modals', () => {
      modalActions.open('modal1', 'auth');
      modalActions.open('modal2', 'address');
      modalActions.open('modal3', 'template_modal');
      
      const modals = get(activeModals);
      expect(modals.get('modal1')?.zIndex).toBe(1000);
      expect(modals.get('modal2')?.zIndex).toBe(1001);
      expect(modals.get('modal3')?.zIndex).toBe(1002);
    });

    it('tracks top modal correctly', () => {
      modalActions.open('modal1', 'auth');
      modalActions.open('modal2', 'address');
      
      let top = get(topModal);
      expect(top?.type).toBe('address');
      
      modalActions.close('modal2');
      
      top = get(topModal);
      expect(top?.type).toBe('auth');
    });

    it('returns null for top modal when none exist', () => {
      expect(get(topModal)).toBe(null);
    });
  });

  describe('Modal Type Conflicts', () => {
    it('closes existing modal of same type when opening new one', () => {
      modalActions.open('modal1', 'auth', { provider: 'google' });
      modalActions.open('modal2', 'auth', { provider: 'facebook' });
      
      const modals = get(activeModals);
      expect(modals.has('modal1')).toBe(false);
      expect(modals.has('modal2')).toBe(true);
      expect(modals.get('modal2')?.data).toEqual({ provider: 'facebook' });
    });

    it('allows multiple modals of different types', () => {
      modalActions.open('auth-modal', 'auth');
      modalActions.open('address-modal', 'address');
      modalActions.open('template-modal', 'template_modal');
      
      const modals = get(activeModals);
      expect(modals.size).toBe(3);
      expect(modals.has('auth-modal')).toBe(true);
      expect(modals.has('address-modal')).toBe(true);
      expect(modals.has('template-modal')).toBe(true);
    });
  });

  describe('Modal Options', () => {
    it('sets close options correctly', () => {
      modalActions.open('test-modal', 'auth', null, {
        closeOnBackdrop: false,
        closeOnEscape: true
      });
      
      const modals = get(activeModals);
      const modal = modals.get('test-modal');
      
      expect(modal?.closeOnBackdrop).toBe(false);
      expect(modal?.closeOnEscape).toBe(true);
    });

    it('uses default close options when not specified', () => {
      modalActions.open('test-modal', 'auth');
      
      const modals = get(activeModals);
      const modal = modals.get('test-modal');
      
      expect(modal?.closeOnBackdrop).toBe(true);
      expect(modal?.closeOnEscape).toBe(true);
    });
  });

  describe('Modal Utilities', () => {
    it('finds modal by type', () => {
      modalActions.open('auth-modal', 'auth');
      modalActions.open('address-modal', 'address');
      
      const authId = modalActions.findModalByType('auth');
      const addressId = modalActions.findModalByType('address');
      const nonexistentId = modalActions.findModalByType('error_dialog');
      
      expect(authId).toBe('auth-modal');
      expect(addressId).toBe('address-modal');
      expect(nonexistentId).toBe(null);
    });

    it('checks if modal is open', () => {
      modalActions.open('test-modal', 'auth');
      
      expect(modalActions.isOpen('test-modal')).toBe(true);
      expect(modalActions.isOpen('nonexistent')).toBe(false);
      
      modalActions.close('test-modal');
      expect(modalActions.isOpen('test-modal')).toBe(false);
    });

    it('gets modal data', () => {
      const testData = { userId: 123, provider: 'google' };
      modalActions.open('test-modal', 'auth', testData);
      
      expect(modalActions.getData('test-modal')).toEqual(testData);
      expect(modalActions.getData('nonexistent')).toBe(null);
    });
  });

  describe('createModalStore', () => {
    it('creates component-specific modal store', () => {
      const modalStore = createModalStore('component-modal', 'template_modal');
      
      expect(get(modalStore.isOpen)).toBe(false);
      expect(get(modalStore.data)).toBeUndefined();
      expect(get(modalStore.zIndex)).toBe(1000);
      
      modalStore.open({ templateId: 'test-123' });
      
      expect(get(modalStore.isOpen)).toBe(true);
      expect(get(modalStore.data)).toEqual({ templateId: 'test-123' });
      
      modalStore.close();
      expect(get(modalStore.isOpen)).toBe(false);
    });

    it('updates when global modal state changes', () => {
      const modalStore = createModalStore('reactive-modal', 'auth');
      
      modalActions.open('reactive-modal', 'auth', { test: true });
      
      expect(get(modalStore.isOpen)).toBe(true);
      expect(get(modalStore.data)).toEqual({ test: true });
      
      modalActions.close('reactive-modal');
      
      expect(get(modalStore.isOpen)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles closing nonexistent modal gracefully', () => {
      expect(() => modalActions.close('nonexistent')).not.toThrow();
      expect(get(hasActiveModal)).toBe(false);
    });

    it('handles closing top modal when none exist', () => {
      expect(() => modalActions.closeTop()).not.toThrow();
      expect(get(topModal)).toBe(null);
    });

    it('maintains stack integrity when closing middle modal', () => {
      modalActions.open('modal1', 'auth');
      modalActions.open('modal2', 'address');
      modalActions.open('modal3', 'template_modal');
      
      modalActions.close('modal2');
      
      const modals = get(activeModals);
      expect(modals.has('modal1')).toBe(true);
      expect(modals.has('modal2')).toBe(false);
      expect(modals.has('modal3')).toBe(true);
      
      expect(get(topModal)?.type).toBe('template_modal');
    });

    it('handles same ID different type scenarios', () => {
      modalActions.open('same-id', 'auth');
      modalActions.open('same-id', 'address');
      
      const modals = get(activeModals);
      expect(modals.get('same-id')?.type).toBe('address');
      expect(modals.size).toBe(1);
    });
  });

  describe('Derived Stores', () => {
    it('activeModals store updates correctly', () => {
      const initialModals = get(activeModals);
      expect(initialModals.size).toBe(0);
      
      modalActions.open('test-modal', 'auth');
      const updatedModals = get(activeModals);
      expect(updatedModals.size).toBe(1);
      expect(updatedModals.has('test-modal')).toBe(true);
    });

    it('hasActiveModal store reflects modal state', () => {
      expect(get(hasActiveModal)).toBe(false);
      
      modalActions.open('test-modal', 'auth');
      expect(get(hasActiveModal)).toBe(true);
      
      modalActions.close('test-modal');
      expect(get(hasActiveModal)).toBe(false);
    });
  });
});