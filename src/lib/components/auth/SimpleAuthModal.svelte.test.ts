import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import SimpleAuthModal from './SimpleAuthModal.svelte';

// Mock window.location
delete window.location;
window.location = { href: 'https://example.com/test-page' } as any;

describe('SimpleAuthModal', () => {
  const congressionalTemplate = {
    id: 'climate-action',
    title: 'Climate Action Now',
    slug: 'climate-action',
    deliveryMethod: 'both',
    subject: 'Support Climate Action'
  };

  const emailTemplate = {
    id: 'healthcare-reform',
    title: 'Healthcare Reform',
    slug: 'healthcare-reform',
    deliveryMethod: 'email',
    subject: 'Healthcare Reform Support'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = 'https://example.com/test-page';
  });

  describe('Modal Visibility', () => {
    it('renders when isOpen is true', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      expect(screen.getByText('Sign in to continue')).toBeTruthy();
      expect(screen.getByText('Continue with Google')).toBeTruthy();
      expect(screen.getByText('Continue with Facebook')).toBeTruthy();
    });

    it('does not render when isOpen is false', () => {
      const { container } = render(SimpleAuthModal, {
        props: {
          isOpen: false,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      expect(container.querySelector('.fixed.inset-0')).toBeFalsy();
    });

    it('renders with null template', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: null
        }
      });

      expect(screen.getByText('Sign in to continue')).toBeTruthy();
      expect(screen.getByText('Continue with Google')).toBeTruthy();
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const mockOnClose = vi.fn();
      
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: mockOnClose,
          template: congressionalTemplate
        }
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('displays close button with X icon', () => {
      const { container } = render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const closeButton = container.querySelector('button svg');
      expect(closeButton).toBeTruthy();
    });
  });

  describe('OAuth Authentication', () => {
    it('redirects to Google OAuth with current URL as return', async () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      const expectedReturnUrl = encodeURIComponent('https://example.com/test-page');
      expect(window.location.href).toBe(`/auth/google?returnTo=${expectedReturnUrl}`);
    });

    it('redirects to Facebook OAuth with current URL as return', async () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const facebookButton = screen.getByText('Continue with Facebook');
      await fireEvent.click(facebookButton);

      const expectedReturnUrl = encodeURIComponent('https://example.com/test-page');
      expect(window.location.href).toBe(`/auth/facebook?returnTo=${expectedReturnUrl}`);
    });

    it('handles different current URLs correctly', async () => {
      window.location.href = 'https://example.com/different-page?param=value';

      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      const expectedReturnUrl = encodeURIComponent('https://example.com/different-page?param=value');
      expect(window.location.href).toBe(`/auth/google?returnTo=${expectedReturnUrl}`);
    });
  });

  describe('OAuth Button Styling', () => {
    it('displays Google button with correct styling', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const googleButton = screen.getByText('Continue with Google').closest('button');
      expect(googleButton?.className).toContain('w-full');
      expect(googleButton?.className).toContain('bg-blue-600');
      expect(googleButton?.className).toContain('hover:bg-blue-700');
      expect(googleButton?.className).toContain('text-white');
    });

    it('displays Facebook button with correct styling', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const facebookButton = screen.getByText('Continue with Facebook').closest('button');
      expect(facebookButton?.className).toContain('w-full');
      expect(facebookButton?.className).toContain('bg-[#1877F2]');
      expect(facebookButton?.className).toContain('hover:bg-[#166FE5]');
      expect(facebookButton?.className).toContain('text-white');
    });

    it('displays Google SVG icon', () => {
      const { container } = render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const googleButton = screen.getByText('Continue with Google').closest('button');
      const svg = googleButton?.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('class')).toContain('h-4 w-4 mr-2');
    });

    it('displays Facebook SVG icon', () => {
      const { container } = render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const facebookButton = screen.getByText('Continue with Facebook').closest('button');
      const svg = facebookButton?.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('class')).toContain('h-4 w-4 mr-2');
    });
  });

  describe('Next Step Messaging', () => {
    it('shows congressional-specific next step for both delivery method', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      expect(screen.getByText('Next: Add your address to contact Congress')).toBeTruthy();
    });

    it('shows email-specific next step for email delivery method', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: emailTemplate
        }
      });

      expect(screen.getByText('Next: Send your message')).toBeTruthy();
    });

    it('shows default next step when template has no delivery method', () => {
      const templateWithoutMethod = {
        ...congressionalTemplate,
        deliveryMethod: undefined
      };

      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: templateWithoutMethod
        }
      });

      expect(screen.getByText('Next: Send your message')).toBeTruthy();
    });

    it('shows default next step when template is null', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: null
        }
      });

      expect(screen.getByText('Next: Send your message')).toBeTruthy();
    });

    it('shows default next step for unknown delivery method', () => {
      const templateWithUnknownMethod = {
        ...congressionalTemplate,
        deliveryMethod: 'unknown-method'
      };

      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: templateWithUnknownMethod
        }
      });

      expect(screen.getByText('Next: Send your message')).toBeTruthy();
    });
  });

  describe('Modal Structure', () => {
    it('has correct modal structure and classes', () => {
      const { container } = render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      // Backdrop
      const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/60');
      expect(backdrop).toBeTruthy();
      expect(backdrop?.className).toContain('backdrop-blur-sm');
      expect(backdrop?.className).toContain('z-50');

      // Modal content
      const modal = container.querySelector('.bg-white.rounded-2xl.shadow-2xl');
      expect(modal).toBeTruthy();
      expect(modal?.className).toContain('w-full');
      expect(modal?.className).toContain('max-w-md');
    });

    it('displays correct header text', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const header = screen.getByText('Sign in to continue');
      expect(header).toBeTruthy();
      expect(header.tagName).toBe('H2');
    });

    it('has proper spacing and layout classes', () => {
      const { container } = render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      // OAuth buttons container
      const buttonsContainer = container.querySelector('.space-y-3');
      expect(buttonsContainer).toBeTruthy();

      // Next step hint container
      const hintContainer = container.querySelector('.mt-4.p-3.bg-slate-50');
      expect(hintContainer).toBeTruthy();
    });
  });

  describe('Authentication Integration', () => {
    it('properly encodes URLs with special characters', async () => {
      window.location.href = 'https://example.com/test?param=value&other=test+data';

      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const googleButton = screen.getByText('Continue with Google');
      await fireEvent.click(googleButton);

      const expectedReturnUrl = encodeURIComponent('https://example.com/test?param=value&other=test+data');
      expect(window.location.href).toBe(`/auth/google?returnTo=${expectedReturnUrl}`);
    });

    it('handles authentication flow for different providers', async () => {
      const providers = ['google', 'facebook'];
      
      for (const provider of providers) {
        // Reset location
        window.location.href = 'https://example.com/test-page';
        
        render(SimpleAuthModal, {
          props: {
            isOpen: true,
            onClose: vi.fn(),
            template: congressionalTemplate
          }
        });

        const button = screen.getByText(`Continue with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
        await fireEvent.click(button);

        const expectedReturnUrl = encodeURIComponent('https://example.com/test-page');
        expect(window.location.href).toBe(`/auth/${provider}?returnTo=${expectedReturnUrl}`);
      }
    });
  });

  describe('Accessibility', () => {
    it('has proper button accessibility attributes', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      const googleButton = screen.getByText('Continue with Google').closest('button');
      const facebookButton = screen.getByText('Continue with Facebook').closest('button');
      const closeButton = screen.getByRole('button', { name: /close/i });

      expect(googleButton).toBeTruthy();
      expect(facebookButton).toBeTruthy();
      expect(closeButton).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('handles missing onClose prop gracefully', () => {
      render(SimpleAuthModal, {
        props: {
          isOpen: true,
          // onClose not provided, should use default empty function
          template: congressionalTemplate
        }
      });

      expect(screen.getByText('Sign in to continue')).toBeTruthy();
    });

    it('handles template prop variations', () => {
      const testCases = [
        { template: null, expectedText: 'Next: Send your message' },
        { template: undefined, expectedText: 'Next: Send your message' },
        { template: {}, expectedText: 'Next: Send your message' },
        { template: { deliveryMethod: 'both' }, expectedText: 'Next: Add your address to contact Congress' }
      ];

      testCases.forEach(({ template, expectedText }) => {
        const { unmount } = render(SimpleAuthModal, {
          props: {
            isOpen: true,
            onClose: vi.fn(),
            template
          }
        });

        expect(screen.getByText(expectedText)).toBeTruthy();
        unmount();
      });
    });
  });

  describe('Props Integration', () => {
    it('reacts to isOpen prop changes', () => {
      const { rerender, container } = render(SimpleAuthModal, {
        props: {
          isOpen: false,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      // Initially closed
      expect(container.querySelector('.fixed.inset-0')).toBeFalsy();

      // Open the modal
      rerender({
        isOpen: true,
        onClose: vi.fn(),
        template: congressionalTemplate
      });

      expect(screen.getByText('Sign in to continue')).toBeTruthy();

      // Close the modal
      rerender({
        isOpen: false,
        onClose: vi.fn(),
        template: congressionalTemplate
      });

      expect(container.querySelector('.fixed.inset-0')).toBeFalsy();
    });

    it('reacts to template prop changes', () => {
      const { rerender } = render(SimpleAuthModal, {
        props: {
          isOpen: true,
          onClose: vi.fn(),
          template: congressionalTemplate
        }
      });

      expect(screen.getByText('Next: Add your address to contact Congress')).toBeTruthy();

      rerender({
        isOpen: true,
        onClose: vi.fn(),
        template: emailTemplate
      });

      expect(screen.getByText('Next: Send your message')).toBeTruthy();
    });
  });
});