import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import AddressRequirementModal from '$lib/components/auth/AddressRequirementModal.svelte';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-12345')
  },
  writable: true
});

describe('AddressRequirementModal', () => {
  const defaultProps = {
    template: {
      title: 'Climate Action Template',
      deliveryMethod: 'congressional',
      slug: 'climate-action'
    },
    user: {
      name: 'John Doe',
      is_verified: false
    },
    isOpen: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    // Reset document body overflow
    document.body.style.overflow = '';
  });

  describe('Initial Render and UI', () => {
    it('renders when isOpen is true', () => {
      const { container } = render(AddressRequirementModal, {
        props: defaultProps
      });

      expect(container.querySelector('.modal-backdrop')).toBeTruthy();
      expect(screen.getByText('Enter Your Address')).toBeTruthy();
      expect(screen.getByText('Climate Action Template')).toBeTruthy();
    });

    it('does not render when isOpen is false', () => {
      const { container } = render(AddressRequirementModal, {
        props: {
          ...defaultProps,
          isOpen: false
        }
      });

      expect(container.querySelector('.modal-backdrop')).toBeFalsy();
    });

    it('displays template context correctly', () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      expect(screen.getByText(/You're sending:/)).toBeTruthy();
      expect(screen.getByText('Climate Action Template')).toBeTruthy();
    });

    it('prevents background scrolling when open', () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('shows all address input fields', () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      expect(screen.getByLabelText('Street Address')).toBeTruthy();
      expect(screen.getByLabelText('City')).toBeTruthy();
      expect(screen.getByLabelText('State')).toBeTruthy();
      expect(screen.getByLabelText('ZIP Code')).toBeTruthy();
    });
  });

  describe('Address Form Validation', () => {
    it('validates required street address', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      expect(screen.getByText('Please enter your street address')).toBeTruthy();
    });

    it('validates required city', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      expect(screen.getByText('Please enter your city')).toBeTruthy();
    });

    it('validates required state', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Anytown' } });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      expect(screen.getByText('Please enter your state')).toBeTruthy();
    });

    it('validates ZIP code format', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Anytown' } });
      await fireEvent.input(stateInput, { target: { value: 'CA' } });
      await fireEvent.input(zipInput, { target: { value: 'invalid' } });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      expect(screen.getByText('Please enter a valid ZIP code')).toBeTruthy();
    });

    it('accepts valid ZIP+4 format', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Anytown' } });
      await fireEvent.input(stateInput, { target: { value: 'CA' } });
      await fireEvent.input(zipInput, { target: { value: '12345-6789' } });

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            correctedAddress: '123 Main St, Anytown, CA 12345-6789',
            representatives: [
              { name: 'Rep. John Smith', office: 'House Representative' }
            ]
          }
        })
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      // Should not show ZIP code error
      expect(screen.queryByText('Please enter a valid ZIP code')).toBeFalsy();
    });
  });

  describe('Address Verification Process', () => {
    it('calls address verification API with correct data', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            correctedAddress: '123 Main St, Austin, TX 78701'
          }
        })
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/address/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701'
        })
      });
    });

    it('shows loading state during verification', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      // Mock a slow response
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      expect(screen.getByText('Verifying address...')).toBeTruthy();
    });

    it('moves to verification step on successful address verification', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            correctedAddress: '123 Main St, Austin, TX 78701',
            representatives: [
              { name: 'Rep. Lloyd Doggett', office: 'House Representative' },
              { name: 'Sen. John Cornyn', office: 'Senate' }
            ]
          }
        })
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm your address')).toBeTruthy();
        expect(screen.getByText('Verified Address:')).toBeTruthy();
        expect(screen.getByText('123 Main St, Austin, TX 78701')).toBeTruthy();
      });
    });

    it('handles verification API errors', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Address not found'
        })
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Address not found')).toBeTruthy();
      });
    });

    it('handles network errors gracefully', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Verification service temporarily unavailable. Please try again.')).toBeTruthy();
      });
    });
  });

  describe('Self.xyz Integration', () => {
    it('initiates Self.xyz verification process', async () => {
      render(AddressRequirementModal, {
        props: {
          ...defaultProps,
          user: {
            name: 'John Doe',
            is_verified: false
          }
        }
      });

      // First, verify an address to get to the verify step
      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            correctedAddress: '123 Main St, Austin, TX 78701'
          }
        })
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Looks Good')).toBeTruthy();
      });

      // Now click "Looks Good" which should trigger Self.xyz flow for unverified users
      const looksGoodButton = screen.getByText('Looks Good');
      await fireEvent.click(looksGoodButton);

      await waitFor(() => {
        expect(screen.getByText('Boost Your Impact')).toBeTruthy();
        expect(screen.getByText(/Verify your identity with Self.xyz/)).toBeTruthy();
      });
    });

    it('calls Self.xyz API when verification is initiated', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      // Navigate to Self.xyz step
      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              verified: true,
              correctedAddress: '123 Main St, Austin, TX 78701'
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            qrCodeData: 'mock-qr-code-data'
          })
        });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Looks Good')).toBeTruthy();
      });

      const looksGoodButton = screen.getByText('Looks Good');
      await fireEvent.click(looksGoodButton);

      await waitFor(() => {
        expect(screen.getByText('Verify with Self.xyz')).toBeTruthy();
      });

      const selfXyzButton = screen.getByText('Verify with Self.xyz');
      await fireEvent.click(selfXyzButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/identity/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'mock-uuid-12345',
          templateSlug: 'climate-action',
          requireAddress: true,
          disclosures: {
            nationality: true,
            issuing_state: true,
            name: true,
            minimumAge: 18,
            ofac: true
          }
        })
      });
    });

    it('shows QR code when Self.xyz verification is initiated', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      // Set up the component to be in Self.xyz step with QR code
      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              verified: true,
              correctedAddress: '123 Main St, Austin, TX 78701'
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            qrCodeData: 'mock-qr-code-12345'
          })
        });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        const looksGoodButton = screen.getByText('Looks Good');
        fireEvent.click(looksGoodButton);
      });

      await waitFor(() => {
        const selfXyzButton = screen.getByText('Verify with Self.xyz');
        fireEvent.click(selfXyzButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/QR Code: mock-qr-code-12345/)).toBeTruthy();
        expect(screen.getByText('Waiting for verification...')).toBeTruthy();
      });
    });
  });

  describe('Event Handling and Dispatching', () => {
    it('dispatches close event when close button is clicked', async () => {
      const { component } = render(AddressRequirementModal, {
        props: defaultProps
      });

      const closeDispatch = vi.fn();
      component.$on('close', closeDispatch);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await fireEvent.click(closeButton);

      expect(closeDispatch).toHaveBeenCalled();
    });

    it('dispatches complete event when address is accepted', async () => {
      const { component } = render(AddressRequirementModal, {
        props: {
          ...defaultProps,
          user: {
            name: 'John Doe',
            is_verified: true  // Verified user skips Self.xyz
          }
        }
      });

      const completeDispatch = vi.fn();
      component.$on('complete', completeDispatch);

      // Complete address verification flow
      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            correctedAddress: '123 Main St, Austin, TX 78701'
          }
        })
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        const looksGoodButton = screen.getByText('Looks Good');
        fireEvent.click(looksGoodButton);
      });

      expect(completeDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            address: '123 Main St, Austin, TX 78701',
            verified: true
          }
        })
      );
    });

    it('restores body overflow when component is destroyed', () => {
      const { unmount } = render(AddressRequirementModal, {
        props: defaultProps
      });

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Keyboard Navigation', () => {
    it('submits form on Enter key in address collection', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            correctedAddress: '123 Main St, Austin, TX 78701'
          }
        })
      });

      // Press Enter in the form
      await fireEvent.keyDown(streetInput, { key: 'Enter' });

      expect(mockFetch).toHaveBeenCalledWith('/api/address/verify', expect.any(Object));
    });

    it('does not submit on Shift+Enter', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.keyDown(streetInput, { key: 'Enter', shiftKey: true });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Representative Display', () => {
    it('displays found representatives in verification step', async () => {
      render(AddressRequirementModal, {
        props: defaultProps
      });

      const streetInput = screen.getByLabelText('Street Address');
      const cityInput = screen.getByLabelText('City');
      const stateInput = screen.getByLabelText('State');
      const zipInput = screen.getByLabelText('ZIP Code');
      
      await fireEvent.input(streetInput, { target: { value: '123 Main St' } });
      await fireEvent.input(cityInput, { target: { value: 'Austin' } });
      await fireEvent.input(stateInput, { target: { value: 'TX' } });
      await fireEvent.input(zipInput, { target: { value: '78701' } });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            verified: true,
            correctedAddress: '123 Main St, Austin, TX 78701',
            representatives: [
              { name: 'Rep. Lloyd Doggett', office: 'House Representative' },
              { name: 'Sen. John Cornyn', office: 'Senate' },
              { name: 'Sen. Ted Cruz', office: 'Senate' }
            ]
          }
        })
      });

      const verifyButton = screen.getByText('Verify & Find Representatives');
      await fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText('Your Representatives:')).toBeTruthy();
        expect(screen.getByText('Rep. Lloyd Doggett (House Representative)')).toBeTruthy();
        expect(screen.getByText('Sen. John Cornyn (Senate)')).toBeTruthy();
        expect(screen.getByText('Sen. Ted Cruz (Senate)')).toBeTruthy();
      });
    });
  });
});