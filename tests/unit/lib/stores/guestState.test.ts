import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { guestState } from './guestState';

/**
 * GUEST STATE STORE TESTS
 * 
 * Critical business logic: Manages anonymous user state and conversion tracking.
 * Revenue impact: CRITICAL - Entire conversion funnel depends on guest state management
 */
describe('Guest State Store', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
    
    // Reset guest state
    guestState.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Template Selection Tracking', () => {
    it('should track selected template', () => {
      const templateId = 'climate-action-123';
      const templateData = {
        id: templateId,
        title: 'Climate Action Now',
        slug: 'climate-action',
        deliveryMethod: 'both' as const
      };
      
      guestState.selectTemplate(templateData);
      
      const state = get(guestState.store);
      expect(state.selectedTemplate).toEqual(templateData);
      expect(state.conversionStep).toBe('template_selected');
    });

    it('should persist template selection to localStorage', () => {
      const templateData = {
        id: '123',
        title: 'Test Template',
        slug: 'test',
        deliveryMethod: 'email' as const
      };
      
      guestState.selectTemplate(templateData);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'guest_selected_template',
        JSON.stringify(templateData)
      );
    });

    it('should clear template selection', () => {
      const templateData = {
        id: '123',
        title: 'Test Template', 
        slug: 'test',
        deliveryMethod: 'email' as const
      };
      
      guestState.selectTemplate(templateData);
      guestState.clearTemplate();
      
      const state = get(guestState.store);
      expect(state.selectedTemplate).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('guest_selected_template');
    });
  });

  describe('Conversion Funnel Tracking', () => {
    it('should track conversion steps correctly', () => {
      const steps = [
        'landing',
        'template_selected',
        'auth_initiated',
        'address_collected',
        'message_sent'
      ] as const;
      
      steps.forEach(step => {
        guestState.setConversionStep(step);
        const state = get(guestState.store);
        expect(state.conversionStep).toBe(step);
      });
    });

    it('should track conversion timestamp', () => {
      const beforeTime = Date.now();
      guestState.setConversionStep('template_selected');
      const afterTime = Date.now();
      
      const state = get(guestState.store);
      expect(state.lastActivity).toBeGreaterThanOrEqual(beforeTime);
      expect(state.lastActivity).toBeLessThanOrEqual(afterTime);
    });

    it('should track conversion source attribution', () => {
      const source = 'twitter-link';
      const campaign = 'climate-week-2024';
      
      guestState.setSource(source, campaign);
      
      const state = get(guestState.store);
      expect(state.source).toBe(source);
      expect(state.campaign).toBe(campaign);
    });
  });

  describe('Form Data Management', () => {
    it('should save form data progressively', () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        address: '123 Main St',
        city: 'Anytown'
      };
      
      Object.entries(formData).forEach(([key, value]) => {
        guestState.saveFormData(key, value);
      });
      
      const state = get(guestState.store);
      expect(state.formData).toEqual(formData);
    });

    it('should persist form data to sessionStorage', () => {
      guestState.saveFormData('email', 'test@example.com');
      
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'guest_form_data',
        JSON.stringify({ email: 'test@example.com' })
      );
    });

    it('should handle form data validation', () => {
      const validEmail = 'valid@example.com';
      const invalidEmail = 'invalid-email';
      
      guestState.validateFormField('email', validEmail);
      let state = get(guestState.store);
      expect(state.validation.email).toBe(true);
      
      guestState.validateFormField('email', invalidEmail);
      state = get(guestState.store);
      expect(state.validation.email).toBe(false);
    });
  });

  describe('Address Collection State', () => {
    it('should manage address collection flow', () => {
      const addressData = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '90210',
        congressional_district: 'CA-30'
      };
      
      guestState.setAddress(addressData);
      
      const state = get(guestState.store);
      expect(state.address).toEqual(addressData);
      expect(state.conversionStep).toBe('address_collected');
    });

    it('should handle address verification status', () => {
      const addressData = {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '90210'
      };
      
      guestState.setAddress(addressData);
      guestState.setAddressVerified(true);
      
      const state = get(guestState.store);
      expect(state.addressVerified).toBe(true);
    });
  });

  describe('Authentication State Tracking', () => {
    it('should track auth initiation', () => {
      guestState.initiateAuth('google');
      
      const state = get(guestState.store);
      expect(state.authProvider).toBe('google');
      expect(state.conversionStep).toBe('auth_initiated');
    });

    it('should store pending action context', () => {
      const templateData = {
        id: '123',
        title: 'Test Template',
        slug: 'test',
        deliveryMethod: 'email' as const
      };
      
      guestState.selectTemplate(templateData);
      guestState.initiateAuth('facebook');
      
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'pending_template_action',
        expect.stringContaining('use_template')
      );
    });
  });

  describe('Analytics and Metrics', () => {
    it('should calculate session duration', () => {
      const startTime = Date.now();
      guestState.startSession();
      
      // Simulate some time passing
      vi.advanceTimersByTime(5000);
      
      const duration = guestState.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(5000);
    });

    it('should track page views and interactions', () => {
      guestState.trackPageView('/template/climate-action');
      guestState.trackInteraction('template_click', { templateId: '123' });
      
      const state = get(guestState.store);
      expect(state.analytics.pageViews).toContain('/template/climate-action');
      expect(state.analytics.interactions).toHaveLength(1);
      expect(state.analytics.interactions[0].event).toBe('template_click');
    });

    it('should calculate conversion probability', () => {
      // Simulate a high-probability conversion path
      guestState.setSource('email-campaign');
      guestState.selectTemplate({
        id: '123',
        title: 'High Converting Template',
        slug: 'test',
        deliveryMethod: 'both'
      });
      guestState.saveFormData('email', 'engaged@user.com');
      
      const probability = guestState.getConversionProbability();
      expect(probability).toBeGreaterThan(0.5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle localStorage failures gracefully', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      expect(() => {
        guestState.selectTemplate({
          id: '123',
          title: 'Test',
          slug: 'test',
          deliveryMethod: 'email'
        });
      }).not.toThrow();
    });

    it('should handle invalid form data', () => {
      expect(() => {
        guestState.saveFormData('', '');
        guestState.saveFormData(null as any, undefined as any);
      }).not.toThrow();
    });

    it('should restore state from storage on initialization', () => {
      const storedTemplate = {
        id: '123',
        title: 'Stored Template',
        slug: 'stored',
        deliveryMethod: 'email' as const
      };
      
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(storedTemplate));
      
      guestState.restoreFromStorage();
      
      const state = get(guestState.store);
      expect(state.selectedTemplate).toEqual(storedTemplate);
    });
  });

  describe('State Cleanup and Privacy', () => {
    it('should clear sensitive data on demand', () => {
      guestState.saveFormData('email', 'sensitive@data.com');
      guestState.saveFormData('phone', '555-1234');
      
      guestState.clearSensitiveData();
      
      const state = get(guestState.store);
      expect(state.formData.email).toBeUndefined();
      expect(state.formData.phone).toBeUndefined();
    });

    it('should expire session after timeout', () => {
      guestState.startSession();
      
      // Simulate session timeout (24 hours)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
      
      const isExpired = guestState.isSessionExpired();
      expect(isExpired).toBe(true);
    });

    it('should reset state completely', () => {
      // Set up some state
      guestState.selectTemplate({
        id: '123',
        title: 'Test',
        slug: 'test',
        deliveryMethod: 'email'
      });
      guestState.saveFormData('email', 'test@example.com');
      guestState.initiateAuth('google');
      
      guestState.reset();
      
      const state = get(guestState.store);
      expect(state.selectedTemplate).toBeNull();
      expect(state.formData).toEqual({});
      expect(state.authProvider).toBeNull();
      expect(state.conversionStep).toBe('landing');
    });
  });
});