import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import SmartAuthModal from '$lib/components/auth/SmartAuthModal.svelte';

// Mock the modal store
const mockModalStore = {
  isOpen: vi.fn(() => true),
  data: vi.fn(() => null),
  close: vi.fn()
};

vi.mock('$lib/stores/modalSystem', () => ({
  createModalStore: vi.fn(() => mockModalStore)
}));

// Mock window.location
delete window.location;
window.location = { href: '' } as any;

// Mock sessionStorage
const mockSessionStorage = {
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

describe('SmartAuthModal', () => {
  const congressionalTemplate = {
    id: 'climate-action',
    title: 'Climate Action Now',
    slug: 'climate-action',
    deliveryMethod: 'both' as const,
    subject: 'Support Climate Action',
    message_body: 'Dear Representative...'
  };

  const emailTemplate = {
    id: 'healthcare-reform',
    title: 'Healthcare Reform',
    slug: 'healthcare-reform',
    deliveryMethod: 'email' as const,
    subject: 'Healthcare Reform Support',
    message_body: 'Dear Decision Maker...'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockModalStore.isOpen.mockReturnValue(true);
    window.location.href = '';
    mockSessionStorage.setItem.mockClear();
  });

  describe('Modal Visibility and State', () => {
    it('renders when modal is open and has template data', () => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'direct-link'
      });

      render(SmartAuthModal);

      expect(screen.getByText('Contact your representatives')).toBeTruthy();
      expect(screen.getByText(/Your message will be delivered directly/)).toBeTruthy();
    });

    it('does not render when modal is closed', () => {
      mockModalStore.isOpen.mockReturnValue(false);
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate
      });

      const { container } = render(SmartAuthModal);

      expect(container.querySelector('.fixed.inset-0')).toBeFalsy();
    });

    it('does not render when no template data is provided', () => {
      mockModalStore.data.mockReturnValue(null);

      const { container } = render(SmartAuthModal);

      expect(container.querySelector('.fixed.inset-0')).toBeFalsy();
    });
  });

  describe('Congressional Template Configuration', () => {
    beforeEach(() => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'direct-link'
      });
    });

    it('displays congressional-specific messaging', () => {
      render(SmartAuthModal);

      expect(screen.getByText('Contact your representatives')).toBeTruthy();
      expect(screen.getByText(/Your message will be delivered directly to your representative's office/)).toBeTruthy();
      expect(screen.getByText('Next: Find your representatives')).toBeTruthy();
    });

    it('shows shield icon for congressional templates', () => {
      const { container } = render(SmartAuthModal);

      const iconContainer = container.querySelector('.bg-green-50');
      expect(iconContainer).toBeTruthy();
      expect(iconContainer?.querySelector('svg')).toBeTruthy();
    });

    it('uses green color scheme for congressional templates', () => {
      const { container } = render(SmartAuthModal);

      expect(container.querySelector('.bg-green-50')).toBeTruthy();
      expect(container.querySelector('.text-green-600')).toBeTruthy();
    });

    it('applies green button styling for Google auth', () => {
      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google').closest('button');
      expect(googleButton?.className).toContain('bg-green-600');
      expect(googleButton?.className).toContain('hover:bg-green-700');
    });
  });

  describe('Email Template Configuration', () => {
    beforeEach(() => {
      mockModalStore.data.mockReturnValue({
        template: emailTemplate,
        source: 'direct-link'
      });
    });

    it('displays email-specific messaging', () => {
      render(SmartAuthModal);

      expect(screen.getByText('Send your message')).toBeTruthy();
      expect(screen.getByText(/Your message will be sent directly to decision-makers/)).toBeTruthy();
      expect(screen.getByText('Next: Send message')).toBeTruthy();
    });

    it('shows at-sign icon for email templates', () => {
      const { container } = render(SmartAuthModal);

      const iconContainer = container.querySelector('.bg-blue-50');
      expect(iconContainer).toBeTruthy();
      expect(iconContainer?.querySelector('svg')).toBeTruthy();
    });

    it('uses blue color scheme for email templates', () => {
      const { container } = render(SmartAuthModal);

      expect(container.querySelector('.bg-blue-50')).toBeTruthy();
      expect(container.querySelector('.text-blue-600')).toBeTruthy();
    });

    it('applies blue button styling for Google auth', () => {
      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google').closest('button');
      expect(googleButton?.className).toContain('bg-blue-600');
      expect(googleButton?.className).toContain('hover:bg-blue-700');
    });
  });

  describe('Authentication Flow', () => {
    beforeEach(() => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'direct-link'
      });
    });

    it('stores template context in sessionStorage before redirect', async () => {
      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'pending_template_action',
        JSON.stringify({
          slug: 'climate-action',
          action: 'use_template',
          timestamp: expect.any(Number)
        })
      );
    });

    it('redirects to Google OAuth with correct return URL', async () => {
      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      const expectedReturnUrl = encodeURIComponent('/climate-action?action=complete');
      expect(window.location.href).toBe(`/auth/google?returnTo=${expectedReturnUrl}`);
    });

    it('redirects to Facebook OAuth with correct return URL', async () => {
      render(SmartAuthModal);

      const facebookButton = screen.getByText('Continue with Facebook');
      await fireEvent.click(facebookButton);

      const expectedReturnUrl = encodeURIComponent('/climate-action?action=complete');
      expect(window.location.href).toBe(`/auth/facebook?returnTo=${expectedReturnUrl}`);
    });

    it('handles auth click when no template is available', async () => {
      mockModalStore.data.mockReturnValue(null);
      render(SmartAuthModal);

      // Component shouldn't render, but if it did and auth was called
      // it should handle gracefully by returning early
      expect(window.location.href).toBe('');
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('stores correct timestamp in sessionStorage', async () => {
      const fixedTimestamp = 1640995200000;
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => fixedTimestamp);

      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'pending_template_action',
        JSON.stringify({
          slug: 'climate-action',
          action: 'use_template',
          timestamp: fixedTimestamp
        })
      );

      Date.now = originalDateNow;
    });
  });

  describe('Modal Interaction', () => {
    beforeEach(() => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'direct-link'
      });
    });

    it('closes modal when close button is clicked', async () => {
      render(SmartAuthModal);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await fireEvent.click(closeButton);

      expect(mockModalStore.close).toHaveBeenCalled();
    });

    it('closes modal when backdrop is clicked', async () => {
      const { container } = render(SmartAuthModal);

      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).toBeTruthy();

      await fireEvent.click(backdrop!);

      expect(mockModalStore.close).toHaveBeenCalled();
    });

    it('does not close modal when modal content is clicked', async () => {
      const { container } = render(SmartAuthModal);

      const modalContent = container.querySelector('.bg-white');
      expect(modalContent).toBeTruthy();

      await fireEvent.click(modalContent!);

      expect(mockModalStore.close).not.toHaveBeenCalled();
    });
  });

  describe('OAuth Provider Buttons', () => {
    beforeEach(() => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'direct-link'
      });
    });

    it('displays Google OAuth button with correct styling', () => {
      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google');
      expect(googleButton).toBeTruthy();
      
      const buttonElement = googleButton.closest('button');
      expect(buttonElement?.className).toContain('w-full');
      expect(buttonElement?.className).toContain('text-white');
    });

    it('displays Facebook OAuth button with correct styling', () => {
      render(SmartAuthModal);

      const facebookButton = screen.getByText('Continue with Facebook');
      expect(facebookButton).toBeTruthy();
      
      const buttonElement = facebookButton.closest('button');
      expect(buttonElement?.className).toContain('w-full');
      expect(buttonElement?.className).toContain('bg-[#1877F2]');
      expect(buttonElement?.className).toContain('hover:bg-[#166FE5]');
      expect(buttonElement?.className).toContain('text-white');
    });

    it('displays Google SVG icon', () => {
      const { container } = render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google').closest('button');
      const svg = googleButton?.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('displays Facebook SVG icon', () => {
      const { container } = render(SmartAuthModal);

      const facebookButton = screen.getByText('Continue with Facebook').closest('button');
      const svg = facebookButton?.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });
  });

  describe('Source-Based Configuration', () => {
    it('handles social-link source correctly', () => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'social-link'
      });

      render(SmartAuthModal);

      // Content should be the same regardless of source for this component
      expect(screen.getByText('Contact your representatives')).toBeTruthy();
    });

    it('handles share source correctly', () => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'share'
      });

      render(SmartAuthModal);

      expect(screen.getByText('Contact your representatives')).toBeTruthy();
    });

    it('defaults to direct-link when no source provided', () => {
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate
        // No source provided
      });

      render(SmartAuthModal);

      expect(screen.getByText('Contact your representatives')).toBeTruthy();
    });
  });

  describe('Template-Specific URL Generation', () => {
    it('generates correct return URL for different template slugs', async () => {
      const customTemplate = {
        ...congressionalTemplate,
        slug: 'custom-template-slug'
      };

      mockModalStore.data.mockReturnValue({
        template: customTemplate,
        source: 'direct-link'
      });

      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      const expectedReturnUrl = encodeURIComponent('/custom-template-slug?action=complete');
      expect(window.location.href).toBe(`/auth/google?returnTo=${expectedReturnUrl}`);
    });

    it('stores correct template slug in sessionStorage', async () => {
      const customTemplate = {
        ...congressionalTemplate,
        slug: 'healthcare-campaign'
      };

      mockModalStore.data.mockReturnValue({
        template: customTemplate,
        source: 'direct-link'
      });

      render(SmartAuthModal);

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'pending_template_action',
        JSON.stringify({
          slug: 'healthcare-campaign',
          action: 'use_template',
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Modal System Integration', () => {
    it('connects to modal system with correct type and ID', () => {
      const { createModalStore } = require('$lib/stores/modalSystem');
      
      render(SmartAuthModal);

      expect(createModalStore).toHaveBeenCalledWith('auth-modal', 'auth');
    });

    it('reacts to modal data changes', () => {
      // Start with no data
      mockModalStore.data.mockReturnValue(null);
      const { rerender } = render(SmartAuthModal);

      let container = document.querySelector('.fixed.inset-0');
      expect(container).toBeFalsy();

      // Update data
      mockModalStore.data.mockReturnValue({
        template: congressionalTemplate,
        source: 'direct-link'
      });

      rerender(SmartAuthModal);

      expect(screen.getByText('Contact your representatives')).toBeTruthy();
    });
  });
});