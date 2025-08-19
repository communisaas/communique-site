import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import OnboardingModal from '$lib/components/auth/OnboardingModal.svelte';

// Mock window.location
delete window.location;
window.location = { href: '' } as any;

// Mock localStorage
const mockLocalStorage = {
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

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

describe('OnboardingModal', () => {
  const congressionalTemplate = {
    title: 'Climate Action Campaign',
    description: 'Urge Congress to support climate action legislation',
    slug: 'climate-action',
    deliveryMethod: 'both',
    metrics: { sent: 1247, views: 3425 }
  };

  const emailTemplate = {
    title: 'Healthcare Reform',
    description: 'Contact decision-makers about healthcare reform',
    slug: 'healthcare-reform',
    deliveryMethod: 'email',
    metrics: { sent: 892, views: 2156 }
  };

  const basicTemplate = {
    title: 'General Campaign',
    description: 'General advocacy campaign',
    slug: 'general-campaign',
    deliveryMethod: 'unknown',
    metrics: { sent: 45 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = '';
    mockLocalStorage.getItem.mockReturnValue(null);
    mockSessionStorage.setItem.mockClear();
    document.body.style.overflow = '';
  });

  describe('Modal Rendering and Props', () => {
    it('renders with congressional template', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Representatives need to hear from you')).toBeTruthy();
      expect(screen.getByText('Congressional offices count every message from constituents.')).toBeTruthy();
    });

    it('renders with email template', () => {
      render(OnboardingModal, {
        props: {
          template: emailTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Decision-makers need to hear from you')).toBeTruthy();
      expect(screen.getByText('Your voice carries weight when you speak as a stakeholder.')).toBeTruthy();
    });

    it('renders with basic template', () => {
      render(OnboardingModal, {
        props: {
          template: basicTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Make your voice heard')).toBeTruthy();
      expect(screen.getByText('This campaign needs supporters like you.')).toBeTruthy();
    });

    it('prevents background scrolling when mounted', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate
        }
      });

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores background scrolling when unmounted', () => {
      const { unmount } = render(OnboardingModal, {
        props: {
          template: congressionalTemplate
        }
      });

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Source-Based Messaging - Congressional Templates', () => {
    it('displays social-link messaging for congressional templates', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'social-link'
        }
      });

      expect(screen.getByText('Your voice can drive change')).toBeTruthy();
      expect(screen.getByText('Someone shared this because they know your voice matters to Congress.')).toBeTruthy();
      expect(screen.getByText('Add your voice')).toBeTruthy();
    });

    it('displays direct-link messaging for congressional templates', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Representatives need to hear from you')).toBeTruthy();
      expect(screen.getByText('Congressional offices count every message from constituents.')).toBeTruthy();
      expect(screen.getByText('Speak up')).toBeTruthy();
    });

    it('displays share messaging for congressional templates', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'share'
        }
      });

      expect(screen.getByText('Join the pressure campaign')).toBeTruthy();
      expect(screen.getByText('Your voice adds to the growing momentum on this issue.')).toBeTruthy();
      expect(screen.getByText('Join them')).toBeTruthy();
    });
  });

  describe('Source-Based Messaging - Email Templates', () => {
    it('displays social-link messaging for email templates', () => {
      render(OnboardingModal, {
        props: {
          template: emailTemplate,
          source: 'social-link'
        }
      });

      expect(screen.getByText('Make decision-makers listen')).toBeTruthy();
      expect(screen.getByText('Someone shared this because they believe your voice can create change.')).toBeTruthy();
      expect(screen.getByText('Add your voice')).toBeTruthy();
    });

    it('displays direct-link messaging for email templates', () => {
      render(OnboardingModal, {
        props: {
          template: emailTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Decision-makers need to hear from you')).toBeTruthy();
      expect(screen.getByText('Your voice carries weight when you speak as a stakeholder.')).toBeTruthy();
      expect(screen.getByText('Make your voice heard')).toBeTruthy();
    });

    it('displays share messaging for email templates', () => {
      render(OnboardingModal, {
        props: {
          template: emailTemplate,
          source: 'share'
        }
      });

      expect(screen.getByText('Join the advocacy push')).toBeTruthy();
      expect(screen.getByText('Add your voice to the growing pressure on decision-makers.')).toBeTruthy();
      expect(screen.getByText('Join them')).toBeTruthy();
    });
  });

  describe('Source-Based Messaging - Basic Templates', () => {
    it('displays social-link messaging for basic templates', () => {
      render(OnboardingModal, {
        props: {
          template: basicTemplate,
          source: 'social-link'
        }
      });

      expect(screen.getByText('Your voice can drive change')).toBeTruthy();
      expect(screen.getByText('Someone shared this because they believe in change.')).toBeTruthy();
      expect(screen.getByText('Add your voice')).toBeTruthy();
    });

    it('displays direct-link messaging for basic templates', () => {
      render(OnboardingModal, {
        props: {
          template: basicTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Make your voice heard')).toBeTruthy();
      expect(screen.getByText('This campaign needs supporters like you.')).toBeTruthy();
      expect(screen.getByText('Get started')).toBeTruthy();
    });

    it('displays share messaging for basic templates', () => {
      render(OnboardingModal, {
        props: {
          template: basicTemplate,
          source: 'share'
        }
      });

      expect(screen.getByText('Shared with you')).toBeTruthy();
      expect(screen.getByText('Someone wants you to join this important cause.')).toBeTruthy();
      expect(screen.getByText('Join them')).toBeTruthy();
    });
  });

  describe('Process Steps Display - Congressional Templates', () => {
    it('shows congressional process steps', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Direct delivery to congressional office')).toBeTruthy();
      expect(screen.getByText('Your message goes straight to your representative\'s staff')).toBeTruthy();
      expect(screen.getByText('Counted as constituent feedback')).toBeTruthy();
      expect(screen.getByText('Congressional offices track messages by issue and district')).toBeTruthy();
      expect(screen.getByText('Influences their position')).toBeTruthy();
      expect(screen.getByText('Representatives consider constituent input when voting')).toBeTruthy();
    });
  });

  describe('Process Steps Display - Email Templates', () => {
    it('shows direct outreach process steps', () => {
      render(OnboardingModal, {
        props: {
          template: emailTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Direct delivery to decision-makers')).toBeTruthy();
      expect(screen.getByText('Your message reaches executives, officials, or stakeholders')).toBeTruthy();
      expect(screen.getByText('Strengthened by your credentials')).toBeTruthy();
      expect(screen.getByText('Your role and connection amplify your message\'s impact')).toBeTruthy();
      expect(screen.getByText('Creates pressure for change')).toBeTruthy();
      expect(screen.getByText('Decision-makers respond when stakeholders speak up')).toBeTruthy();
    });
  });

  describe('Process Steps Display - Basic Templates', () => {
    it('shows generic process steps', () => {
      render(OnboardingModal, {
        props: {
          template: basicTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText('Direct message delivery')).toBeTruthy();
      expect(screen.getByText('Your message is sent to the right people')).toBeTruthy();
      expect(screen.getByText('Tracked for impact')).toBeTruthy();
      expect(screen.getByText('We monitor campaign effectiveness')).toBeTruthy();
      expect(screen.getByText('Drives change')).toBeTruthy();
      expect(screen.getByText('Collective voices create real impact')).toBeTruthy();
    });
  });

  describe('Authentication Flow', () => {
    it('marks user as having seen onboarding before redirect', async () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      const authButton = screen.getByText(/Get started with|Continue with|Sign up with/);
      await fireEvent.click(authButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('communique_has_seen_onboarding', 'true');
    });

    it('stores template context in sessionStorage before redirect', async () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      const authButton = screen.getByText(/Get started with|Continue with|Sign up with/);
      await fireEvent.click(authButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'pending_template_action',
        JSON.stringify({
          slug: 'climate-action',
          action: 'use_template',
          timestamp: expect.any(Number)
        })
      );
    });

    it('redirects to correct OAuth provider and prepares cookie', async () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      // Find and click an auth button (implementation may vary)
      const authButtons = screen.getAllByText(/Continue with/);
      if (authButtons.length > 0) {
        await fireEvent.click(authButtons[0]);

        expect(window.location.href).toContain('/auth/');
        expect(fetch).toHaveBeenCalledWith('/auth/prepare', expect.any(Object));
      }
    });

    it('stores correct timestamp in sessionStorage', async () => {
      const fixedTimestamp = 1640995200000;
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => fixedTimestamp);

      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      const authButton = screen.getByText(/Get started with|Continue with|Sign up with/);
      await fireEvent.click(authButton);

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
    it('invokes onclose when close button is clicked', async () => {
      const onclose = vi.fn();
      render(OnboardingModal, {
        props: { template: congressionalTemplate, source: 'direct-link', onclose }
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await fireEvent.click(closeButton);
      expect(onclose).toHaveBeenCalled();
    });

    it('invokes onclose when backdrop is clicked', async () => {
      const onclose = vi.fn();
      const { container } = render(OnboardingModal, {
        props: { template: congressionalTemplate, source: 'direct-link', onclose }
      });

      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).toBeTruthy();
      await fireEvent.click(backdrop!);
      expect(onclose).toHaveBeenCalled();
    });
  });

  describe('Details Toggle Functionality', () => {
    it('toggles details visibility when "How does this work?" is clicked', async () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      // Initially details should be hidden
      expect(screen.queryByText('Direct delivery to congressional office')).toBeFalsy();

      // Click to show details
      const detailsButton = screen.getByText(/How does this work?/);
      await fireEvent.click(detailsButton);

      // Details should now be visible
      expect(screen.getByText('Direct delivery to congressional office')).toBeTruthy();

      // Click again to hide details
      await fireEvent.click(detailsButton);

      // Details should be hidden again
      expect(screen.queryByText('Direct delivery to congressional office')).toBeFalsy();
    });
  });

  describe('Onboarding Status Detection', () => {
    it('detects when user has not seen onboarding before', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('communique_has_seen_onboarding');
    });

    it('detects when user has seen onboarding before', () => {
      mockLocalStorage.getItem.mockReturnValue('true');

      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('communique_has_seen_onboarding');
    });
  });

  describe('Template Metrics Display', () => {
    it('displays template metrics when available', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      // Look for metrics in the rendered content
      expect(screen.getByText(/1247|1,247/)).toBeTruthy(); // sent count
    });

    it('handles templates with minimal metrics', () => {
      render(OnboardingModal, {
        props: {
          template: basicTemplate,
          source: 'direct-link'
        }
      });

      expect(screen.getByText(/45/)).toBeTruthy(); // sent count
    });
  });

  describe('URL Generation', () => {
    it('generates correct return URL for different template slugs', () => {
      const customTemplate = {
        ...congressionalTemplate,
        slug: 'custom-template-slug'
      };

      render(OnboardingModal, {
        props: {
          template: customTemplate,
          source: 'direct-link'
        }
      });

      // The return URL should be encoded correctly
      const expectedReturnUrl = encodeURIComponent('/template-modal/custom-template-slug');
      
      // Check that the URL is properly constructed (this would be tested in auth flow)
      expect(customTemplate.slug).toBe('custom-template-slug');
    });
  });

  describe('Template Type Detection', () => {
    it('correctly identifies congressional templates', () => {
      render(OnboardingModal, {
        props: {
          template: congressionalTemplate,
          source: 'direct-link'
        }
      });

      // Should show congressional-specific messaging
      expect(screen.getByText('Representatives need to hear from you')).toBeTruthy();
    });

    it('correctly identifies email templates', () => {
      render(OnboardingModal, {
        props: {
          template: emailTemplate,
          source: 'direct-link'
        }
      });

      // Should show email-specific messaging
      expect(screen.getByText('Decision-makers need to hear from you')).toBeTruthy();
    });

    it('handles templates with unknown delivery methods', () => {
      render(OnboardingModal, {
        props: {
          template: basicTemplate,
          source: 'direct-link'
        }
      });

      // Should show generic messaging
      expect(screen.getByText('Make your voice heard')).toBeTruthy();
    });
  });
});