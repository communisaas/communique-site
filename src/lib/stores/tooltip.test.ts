import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { activeTooltipId } from './tooltip.ts';

describe('Tooltip Store', () => {
  beforeEach(() => {
    // Reset tooltip state
    activeTooltipId.set(null);
  });

  describe('Basic Operations', () => {
    it('initializes with null value', () => {
      const value = get(activeTooltipId);
      expect(value).toBe(null);
    });

    it('sets tooltip ID correctly', () => {
      activeTooltipId.set('test-tooltip');
      
      const value = get(activeTooltipId);
      expect(value).toBe('test-tooltip');
    });

    it('clears tooltip ID', () => {
      activeTooltipId.set('test-tooltip');
      activeTooltipId.set(null);
      
      const value = get(activeTooltipId);
      expect(value).toBe(null);
    });
  });

  describe('State Updates', () => {
    it('updates tooltip ID multiple times', () => {
      activeTooltipId.set('tooltip1');
      expect(get(activeTooltipId)).toBe('tooltip1');
      
      activeTooltipId.set('tooltip2');
      expect(get(activeTooltipId)).toBe('tooltip2');
      
      activeTooltipId.set('tooltip3');
      expect(get(activeTooltipId)).toBe('tooltip3');
    });

    it('handles empty string', () => {
      activeTooltipId.set('');
      
      const value = get(activeTooltipId);
      expect(value).toBe('');
    });

    it('handles same ID multiple times', () => {
      activeTooltipId.set('same-id');
      activeTooltipId.set('same-id');
      activeTooltipId.set('same-id');
      
      const value = get(activeTooltipId);
      expect(value).toBe('same-id');
    });
  });

  describe('Store Subscription', () => {
    it('notifies subscribers of changes', () => {
      let receivedValues: (string | null)[] = [];
      
      const unsubscribe = activeTooltipId.subscribe(value => {
        receivedValues.push(value);
      });
      
      activeTooltipId.set('tooltip1');
      activeTooltipId.set('tooltip2');
      activeTooltipId.set(null);
      
      expect(receivedValues).toEqual([null, 'tooltip1', 'tooltip2', null]);
      
      unsubscribe();
    });

    it('provides current value to new subscribers', () => {
      activeTooltipId.set('current-tooltip');
      
      let receivedValue: string | null = 'not-set';
      const unsubscribe = activeTooltipId.subscribe(value => {
        receivedValue = value;
      });
      
      expect(receivedValue).toBe('current-tooltip');
      
      unsubscribe();
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid updates', () => {
      const updates = ['a', 'b', 'c', 'd', 'e'];
      
      updates.forEach(id => activeTooltipId.set(id));
      
      const value = get(activeTooltipId);
      expect(value).toBe('e');
    });

    it('handles null to string to null sequence', () => {
      expect(get(activeTooltipId)).toBe(null);
      
      activeTooltipId.set('test');
      expect(get(activeTooltipId)).toBe('test');
      
      activeTooltipId.set(null);
      expect(get(activeTooltipId)).toBe(null);
    });
  });
});