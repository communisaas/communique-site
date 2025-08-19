import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
// Mock the modal system before importing component
const createModalStoreSpy = vi.fn();
vi.mock('$lib/stores/modalSystem', () => ({
  createModalStore: createModalStoreSpy
}));

import AuthModal from '$lib/components/auth/AuthModal.svelte';

// Helper to build a subscribe mock that emits a single state
function makeSubscribe(state: { isOpen: boolean; data: any; zIndex?: number }) {
  return vi.fn((fn: any) => {
    fn({ isOpen: state.isOpen, data: state.data, zIndex: state.zIndex ?? 1000 });
    return () => {};
  });
}

// Mock the modal store and spy on factory
const mockModalStore: any = {
  subscribe: makeSubscribe({ isOpen: true, data: null }),
  close: vi.fn()
};
createModalStoreSpy.mockImplementation(() => mockModalStore);

// Mock window.location
delete (window as any).location;
(window as any).location = { href: '' } as any;

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

// Mock fetch for /auth/prepare
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true } as any)) as any);

describe('AuthModal', () => {
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
    mockModalStore.subscribe = makeSubscribe({ isOpen: true, data: { template: congressionalTemplate, source: 'direct-link' } });
    (window as any).location.href = '';
    mockSessionStorage.setItem.mockClear();
  });

  it('renders when modal is open and has congressional template', () => {
    render(AuthModal);
    expect(screen.getByText('Contact your representatives')).toBeInTheDocument();
    expect(screen.getByText(/delivered directly to your representative/)).toBeInTheDocument();
  });

  it('renders email messaging for direct email templates', () => {
    mockModalStore.subscribe = makeSubscribe({ isOpen: true, data: { template: emailTemplate, source: 'direct-link' } });
    render(AuthModal);
    expect(screen.getByText('Send your message')).toBeInTheDocument();
    expect(screen.getByText(/sent directly to decision-makers/)).toBeInTheDocument();
  });

  it('does not render when modal is closed', () => {
    mockModalStore.subscribe = makeSubscribe({ isOpen: false, data: { template: congressionalTemplate } });
    const { container } = render(AuthModal);
    expect(container.querySelector('.fixed.inset-0')).toBeFalsy();
  });

  it('stores template context and redirects to provider without returnTo in URL', async () => {
    mockModalStore.subscribe = makeSubscribe({ isOpen: true, data: { template: congressionalTemplate, source: 'direct-link' } });
    render(AuthModal);
    const googleButton = screen.getByText('Continue with Google');
    await fireEvent.click(googleButton);

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'pending_template_action',
      JSON.stringify({ slug: 'climate-action', action: 'use_template', timestamp: expect.any(Number) })
    );
    expect(fetch).toHaveBeenCalledWith('/auth/prepare', expect.any(Object));
    expect((window as any).location.href).toBe('/auth/google');
  });

  it('closes when close button or backdrop is clicked', async () => {
    mockModalStore.subscribe = makeSubscribe({ isOpen: true, data: { template: congressionalTemplate } });
    const { container } = render(AuthModal);
    const closeButtons = container.querySelectorAll('button');
    // First button should be close in header
    await fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(mockModalStore.close).toHaveBeenCalledTimes(1);
    const backdrop = container.querySelector('.fixed.inset-0');
    if (backdrop) {
      await fireEvent.click(backdrop);
      expect(mockModalStore.close).toHaveBeenCalled();
    }
  });

  it('connects to modal system with correct type and ID', () => {
    render(AuthModal);
    expect(createModalStoreSpy).toHaveBeenCalledWith('auth-modal', 'auth');
  });
});