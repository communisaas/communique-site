import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import SimpleAuthModal from '$lib/components/auth/SimpleAuthModal.svelte';

// Mock window.location
delete (window as any).location;
(window as any).location = { href: '' } as any;

describe('SimpleAuthModal', () => {
  beforeEach(() => {
    (window as any).location.href = '';
  });

  it('OAuth Authentication redirects to Google with current URL as return (cookie-based now)', async () => {
    render(SimpleAuthModal, { isOpen: true, template: { id: 't1', deliveryMethod: 'email' } });
    const google = screen.getAllByText('Continue with Google')[0];
    await fireEvent.click(google);
    expect((window as any).location.href).toBe('/auth/google');
  });

  it('displays Google SVG icon (order-insensitive)', () => {
    render(SimpleAuthModal, { isOpen: true, template: { id: 't1', deliveryMethod: 'email' } });
    const googleBtn = screen.getAllByText('Continue with Google')[0].closest('button');
    const svg = googleBtn?.querySelector('svg');
    expect(svg).toBeTruthy();
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-4');
  });

  it('displays Facebook SVG icon (order-insensitive)', () => {
    render(SimpleAuthModal, { isOpen: true, template: { id: 't1', deliveryMethod: 'email' } });
    const btn = screen.getAllByText('Continue with Facebook')[0].closest('button');
    const svg = btn?.querySelector('svg');
    expect(svg).toBeTruthy();
    const cls = svg?.getAttribute('class') || '';
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-4');
  });
});