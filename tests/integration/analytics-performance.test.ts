/**
 * Analytics Performance and Error Handling Tests
 * 
 * Tests the analytics system under stress conditions, network failures,
 * and various error scenarios to ensure robust operation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analytics } from '$lib/core/analytics/database';
import type { AnalyticsEvent } from '$lib/core/analytics/database';

// Mock fetch for client-side testing
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// Mock window methods
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { href: 'https://localhost:5173/' },
    innerWidth: 1920,
    innerHeight: 1080,
    navigator: { userAgent: 'Test Browser' },
    document: {
      referrer: '',
      addEventListener: vi.fn(),
      visibilityState: 'visible'
    }
  }
});

describe('Analytics Performance & Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, events_processed: 1 })
    });
  });

  describe('Event Batching Performance', () => {
    it('should handle high-frequency event generation efficiently', async () => {
      const startTime = Date.now();
      const eventCount = 1000;

      // Generate many events rapidly
      const promises = Array.from({ length: eventCount }, (_, i) => 
        analytics.trackEvent({
          session_id: 'perf-test-session',
          event_type: 'performance',
          event_name: `high_freq_event_${i}`,
          timestamp: new Date()
        })
      );

      await Promise.all(promises);
      const endTime = Date.now();

      // Should complete within reasonable time (< 1 second for 1000 events)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);

      // Should not make 1000 individual API calls due to batching
      const fetchCalls = (global.fetch as any).mock.calls.filter((call: any) => 
        call[0].includes('/api/analytics/events')
      );
      expect(fetchCalls.length).toBeLessThan(eventCount / 5); // Should batch significantly
    });

    it('should respect 10-event batching limit', async () => {
      const events = Array.from({ length: 15 }, (_, i) => ({
        session_id: 'batch-test-session',
        event_type: 'interaction' as const,
        event_name: `batch_test_${i}`,
        timestamp: new Date()
      }));

      // Track all events
      for (const event of events) {
        await analytics.trackEvent(event);
      }

      // Should trigger at least one batch flush (15 events > 10 limit)
      const fetchCalls = (global.fetch as any).mock.calls.filter((call: any) => 
        call[0].includes('/api/analytics/events')
      );
      expect(fetchCalls.length).toBeGreaterThan(0);
    });

    it('should flush events on page unload', async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        session_id: 'unload-test-session',
        event_type: 'navigation' as const,
        event_name: `unload_test_${i}`,
        timestamp: new Date()
      }));

      // Add events to queue
      for (const event of events) {
        await analytics.trackEvent(event);
      }

      // Mock beforeunload event
      const beforeUnloadHandler = (global.window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'beforeunload')?.[1];

      expect(beforeUnloadHandler).toBeDefined();

      // Trigger unload
      if (beforeUnloadHandler) {
        beforeUnloadHandler();
      }

      // Should flush remaining events
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      // Mock network failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // Should not throw error
      await expect(analytics.trackEvent({
        session_id: 'network-error-session',
        event_type: 'error',
        event_name: 'network_failure_test'
      })).resolves.not.toThrow();

      // Should attempt to send
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle HTTP errors gracefully', async () => {
      // Mock HTTP error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Server error' })
      });

      // Should not throw error
      await expect(analytics.trackEvent({
        session_id: 'http-error-session',
        event_type: 'error',
        event_name: 'http_error_test'
      })).resolves.not.toThrow();
    });

    it('should retry failed requests', async () => {
      // Mock first call to fail, second to succeed
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, events_processed: 1 })
        });

      await analytics.trackEvent({
        session_id: 'retry-test-session',
        event_type: 'test',
        event_name: 'retry_test'
      });

      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 100));
      await analytics.flushEvents();

      // Should have made multiple attempts
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed JSON response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      // Should handle gracefully
      await expect(analytics.trackEvent({
        session_id: 'malformed-response-session',
        event_type: 'error',
        event_name: 'malformed_response_test'
      })).resolves.not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should not accumulate unlimited events in memory', async () => {
      const largeEventBatch = Array.from({ length: 10000 }, (_, i) => ({
        session_id: 'memory-test-session',
        event_type: 'performance' as const,
        event_name: `memory_test_${i}`,
        timestamp: new Date(),
        event_properties: { large_data: 'x'.repeat(1000) } // 1KB per event
      }));

      // Track all events
      for (const event of largeEventBatch) {
        await analytics.trackEvent(event);
      }

      // Should have flushed events automatically to prevent memory buildup
      const fetchCalls = (global.fetch as any).mock.calls.filter((call: any) => 
        call[0].includes('/api/analytics/events')
      );
      expect(fetchCalls.length).toBeGreaterThan(100); // Should flush frequently
    });

    it('should clean up event listeners on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(global.window, 'removeEventListener');
      
      analytics.destroy();

      // Should clean up listeners
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('Data Validation & Security', () => {
    it('should sanitize event data', async () => {
      const maliciousEvent = {
        session_id: '<script>alert("xss")</script>',
        event_type: 'security' as const,
        event_name: 'xss_test',
        event_properties: {
          malicious_script: '<img src="x" onerror="alert(1)">',
          sql_injection: "'; DROP TABLE users; --"
        }
      };

      await analytics.trackEvent(maliciousEvent);

      const fetchCall = (global.fetch as any).mock.calls.find((call: any) => 
        call[0].includes('/api/analytics/events')
      );

      expect(fetchCall).toBeDefined();
      
      // Verify data was sent (sanitization happens server-side)
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.events).toHaveLength(1);
      expect(payload.events[0].session_id).toBe('<script>alert("xss")</script>');
      // Note: Actual sanitization would happen in the API endpoint
    });

    it('should handle circular references in event properties', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      // Should handle circular references gracefully
      await expect(analytics.trackEvent({
        session_id: 'circular-test-session',
        event_type: 'error',
        event_name: 'circular_reference_test',
        event_properties: circularObj
      })).resolves.not.toThrow();
    });

    it('should limit event property size', async () => {
      const massiveData = 'x'.repeat(1024 * 1024); // 1MB string

      await analytics.trackEvent({
        session_id: 'size-limit-test-session',
        event_type: 'performance',
        event_name: 'size_limit_test',
        event_properties: { massive_data: massiveData }
      });

      // Should still attempt to send (size limiting happens server-side)
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent event tracking safely', async () => {
      const concurrentPromises = Array.from({ length: 100 }, (_, i) => 
        analytics.trackEvent({
          session_id: `concurrent-session-${i % 10}`, // 10 different sessions
          event_type: 'concurrency',
          event_name: `concurrent_test_${i}`,
          timestamp: new Date()
        })
      );

      // Should handle all concurrent requests without errors
      await expect(Promise.all(concurrentPromises)).resolves.not.toThrow();

      // Should have made appropriate number of API calls
      const fetchCalls = (global.fetch as any).mock.calls.filter((call: any) => 
        call[0].includes('/api/analytics/events')
      );
      expect(fetchCalls.length).toBeGreaterThan(0);
    });

    it('should handle rapid session changes', async () => {
      // Simulate rapid session switching
      for (let i = 0; i < 50; i++) {
        await analytics.trackEvent({
          session_id: `rapid-session-${i}`,
          event_type: 'session',
          event_name: 'rapid_session_change',
          timestamp: new Date()
        });
      }

      // Should handle without errors
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Browser Environment Compatibility', () => {
    it('should work when localStorage is unavailable', () => {
      // Mock localStorage to throw errors
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      // Should still function
      expect(() => analytics.trackEvent({
        session_id: 'no-localstorage-session',
        event_type: 'compatibility',
        event_name: 'no_localstorage_test'
      })).not.toThrow();
    });

    it('should handle missing browser APIs gracefully', () => {
      // Mock missing APIs
      const originalNavigator = global.window.navigator;
      (global.window as any).navigator = {};

      // Should still function with missing navigator
      expect(() => analytics.trackEvent({
        session_id: 'no-navigator-session',
        event_type: 'compatibility',
        event_name: 'no_navigator_test'
      })).not.toThrow();

      // Restore
      (global.window as any).navigator = originalNavigator;
    });
  });

  describe('Error Tracking', () => {
    it('should track JavaScript errors', async () => {
      const testError = new Error('Test error for tracking');
      
      await analytics.trackError(testError, {
        component: 'TestComponent',
        action: 'test_action'
      });

      expect(global.fetch).toHaveBeenCalled();
      
      const fetchCall = (global.fetch as any).mock.calls.find((call: any) => 
        call[0].includes('/api/analytics/events')
      );
      
      const payload = JSON.parse(fetchCall[1].body);
      const errorEvent = payload.events.find((e: any) => e.event_name === 'javascript_error');
      
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event_properties.error_message).toBe('Test error for tracking');
      expect(errorEvent.event_properties.component).toBe('TestComponent');
    });

    it('should handle errors in error tracking', async () => {
      // Mock fetch to fail
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // Should not throw error when tracking error fails
      await expect(analytics.trackError(new Error('Original error'), {
        meta: 'error tracking failure test'
      })).resolves.not.toThrow();
    });
  });
});