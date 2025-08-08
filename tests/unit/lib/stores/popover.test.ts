import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { popover } from './popover.ts';

vi.mock('$lib/utils/timerCoordinator', () => ({
  coordinated: {
    transition: vi.fn((callback, delay, id) => {
      // Execute immediately to simulate completed timer
      callback();
    })
  }
}));

describe('Popover Store', () => {
  beforeEach(() => {
    // Reset popover to closed state by closing any active popover
    const current = get(popover);
    if (current) {
      popover.close(current.id);
      popover.closed(current.id);
    }
    vi.clearAllMocks();
  });

  describe('Basic Operations', () => {
    it('opens popover correctly', () => {
      popover.open('test-popover');
      
      const state = get(popover);
      expect(state).toEqual({
        id: 'test-popover',
        state: 'open'
      });
    });

    it('closes popover correctly', () => {
      popover.open('test-popover');
      popover.close('test-popover');
      
      const state = get(popover);
      expect(state).toEqual({
        id: 'test-popover',
        state: 'closing'
      });
    });

    it('completes closing cycle', () => {
      popover.open('test-popover');
      popover.close('test-popover');
      popover.closed('test-popover');
      
      const state = get(popover);
      expect(state).toBe(null);
    });
  });

  describe('State Transitions', () => {
    it('transitions from opening to open', () => {
      popover.open('test-popover');
      
      const state = get(popover);
      expect(state?.state).toBe('open');
    });

    it('handles close during opening state', () => {
      popover.open('test-popover');
      
      // Manually set to opening state to test transition
      const currentState = get(popover);
      if (currentState) {
        currentState.state = 'opening';
      }
      
      popover.close('test-popover');
      
      const state = get(popover);
      expect(state?.state).toBe('closing');
    });

    it('ignores close for different popover', () => {
      popover.open('popover1');
      popover.close('popover2');
      
      const state = get(popover);
      expect(state).toEqual({
        id: 'popover1',
        state: 'open'
      });
    });
  });

  describe('Multiple Popover Management', () => {
    it('handles opening different popovers', () => {
      popover.open('popover1');
      const state1 = get(popover);
      expect(state1?.id).toBe('popover1');
      
      // When opening a different popover, the first one should be marked as closing
      popover.open('popover2');
      const state2 = get(popover);
      // Initially it sets the current popover to closing, then the timer opens the new one
      expect(state2?.id).toBe('popover1');
      expect(state2?.state).toBe('closing');
    });

    it('handles same popover ID', () => {
      popover.open('same-id');
      popover.open('same-id'); // Should maintain open state
      
      const state = get(popover);
      expect(state?.id).toBe('same-id');
      expect(state?.state).toBe('open');
    });

    it('handles closing state correctly', () => {
      popover.open('popover1');
      
      // Manually set to closing to test the condition
      const current = get(popover);
      if (current) {
        current.state = 'closing';
      }
      
      popover.open('popover2');
      
      const state = get(popover);
      expect(state?.id).toBe('popover2');
      expect(state?.state).toBe('open'); // Timer executes immediately in test
    });
  });

  describe('Edge Cases', () => {
    it('handles closing non-existent popover', () => {
      popover.close('non-existent');
      
      const state = get(popover);
      expect(state).toBe(null);
    });

    it('handles completed closing for non-existent popover', () => {
      popover.closed('non-existent');
      
      const state = get(popover);
      expect(state).toBe(null);
    });

    it('handles completed closing for wrong popover', () => {
      popover.open('popover1');
      popover.close('popover1');
      popover.closed('popover2');
      
      const state = get(popover);
      expect(state?.state).toBe('closing');
    });

    it('ignores close when popover is already closed', () => {
      popover.open('test-popover');
      popover.close('test-popover');
      popover.closed('test-popover');
      
      // Try to close again
      popover.close('test-popover');
      
      const state = get(popover);
      expect(state).toBe(null);
    });
  });

  describe('State Consistency', () => {
    it('maintains consistent state during complex operations', () => {
      popover.open('popover1');
      popover.close('popover1');
      popover.open('popover2');
      popover.closed('popover1'); // Should not affect popover2
      
      const state = get(popover);
      expect(state).toEqual({
        id: 'popover2',
        state: 'open'
      });
    });

    it('handles same ID operations', () => {
      popover.open('same-id');
      popover.open('same-id'); // Should maintain open state
      
      const state = get(popover);
      expect(state).toEqual({
        id: 'same-id',
        state: 'open'
      });
    });
  });
});