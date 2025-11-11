/**
 * ProofGenerator Component Unit Tests
 *
 * Tests the 8-state state machine, event dispatching, error recovery,
 * and educational messaging in the ProofGenerator Svelte component.
 *
 * Testing strategy:
 * - Mock all async operations (prover, witness encryption, submission)
 * - Test state transitions between all 8 states
 * - Verify event dispatching (complete, cancel, error)
 * - Test error recovery flows
 * - Verify educational message cycling
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ProofGenerator from '$lib/components/template/ProofGenerator.svelte';

// Mock modules
vi.mock('$lib/core/identity/session-credentials', () => ({
	getSessionCredential: vi.fn()
}));

vi.mock('$lib/core/proof/prover', () => ({
	initializeProver: vi.fn(),
	generateProof: vi.fn()
}));

vi.mock('$lib/core/proof/witness-encryption', () => ({
	encryptWitness: vi.fn()
}));

describe('ProofGenerator Component', () => {
	// Mock data
	const mockUserId = 'test-user-id';
	const mockTemplateId = 'test-template-id';
	const mockTemplateData = {
		subject: 'Test Subject',
		message: 'Test Message',
		recipientOffices: ['CA-12', 'CA-13']
	};

	const mockCredential = {
		identityCommitment: '0x123',
		leafIndex: 0,
		merklePath: Array(12).fill('0x000'),
		merkleRoot: '0xabc'
	};

	const mockProofResult = {
		success: true,
		proof: new Uint8Array([1, 2, 3]),
		publicInputs: {
			districtRoot: '0xabc',
			nullifier: '0xdef',
			actionId: mockTemplateId
		},
		nullifier: '0xdef'
	};

	const mockEncryptedWitness = {
		ciphertext: new Uint8Array([4, 5, 6]),
		nonce: new Uint8Array([7, 8, 9]),
		ephemeralPublicKey: new Uint8Array([10, 11, 12]),
		teeKeyId: 'tee-key-1'
	};

	const mockSubmissionResponse = {
		success: true,
		submissionId: 'submission-123'
	};

	beforeEach(async () => {
		// Reset all mocks
		vi.clearAllMocks();

		// Setup default mock implementations
		const { getSessionCredential } = await import('$lib/core/identity/session-credentials');
		(getSessionCredential as Mock).mockResolvedValue(mockCredential);

		const { initializeProver, generateProof } = await import('$lib/core/proof/prover');
		(initializeProver as Mock).mockImplementation(async (progressCallback?: (p: number) => void) => {
			// Simulate prover initialization with progress
			if (progressCallback) {
				for (let i = 0; i <= 100; i += 25) {
					await new Promise((resolve) => setTimeout(resolve, 10));
					progressCallback(i);
				}
			}
			return { initialized: true };
		});

		(generateProof as Mock).mockImplementation(async (_witness, progressCallback?: (p: number) => void) => {
			// Simulate proof generation with progress
			if (progressCallback) {
				for (let i = 0; i <= 100; i += 25) {
					await new Promise((resolve) => setTimeout(resolve, 10));
					progressCallback(i);
				}
			}
			return mockProofResult;
		});

		const { encryptWitness } = await import('$lib/core/proof/witness-encryption');
		(encryptWitness as Mock).mockResolvedValue(mockEncryptedWitness);

		// Mock fetch for submission
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockSubmissionResponse
		} as Response);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial State', () => {
		it('should render idle state with privacy protection info', () => {
			const { getByText, container } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			// Verify heading
			expect(getByText('Ready to send')).toBeTruthy();

			// Verify subject is displayed
			expect(getByText('Test Subject')).toBeTruthy();

			// Verify recipient count
			expect(getByText('2 congressional offices')).toBeTruthy();

			// Verify privacy protection info
			expect(getByText('Privacy Protection:')).toBeTruthy();
			expect(getByText('Your message will be delivered anonymously')).toBeTruthy();

			// Verify buttons
			expect(getByText('Cancel')).toBeTruthy();
			expect(getByText('Send to Representative')).toBeTruthy();
		});

		it('should show fallback if userId is missing', () => {
			const { getByText } = render(ProofGenerator, {
				props: {
					userId: '',
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			expect(getByText('User authentication required')).toBeTruthy();
			expect(getByText('Sign in to continue')).toBeTruthy();
		});
	});

	describe('State Machine Flow', () => {
		it('should transition through all states successfully', async () => {
			const { getByText, container, component } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			// Track event dispatches
			const completeEvents: Array<{ submissionId: string }> = [];
			component.$on('complete', (event) => {
				completeEvents.push(event.detail);
			});

			// Click "Send to Representative" button
			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// State 1: loading-credential
			await waitFor(() => {
				expect(getByText('Loading credentials...')).toBeTruthy();
			});

			// State 2: initializing-prover
			await waitFor(() => {
				expect(getByText('Initializing secure delivery...')).toBeTruthy();
			});

			// State 3: generating-proof
			await waitFor(() => {
				expect(getByText('Preparing secure delivery...')).toBeTruthy();
				expect(
					getByText("Proving you're a constituent without revealing your identity")
				).toBeTruthy();
			});

			// State 4: encrypting-witness
			await waitFor(() => {
				expect(getByText('Encrypting delivery...')).toBeTruthy();
			});

			// State 5: submitting
			await waitFor(() => {
				expect(getByText('Submitting...')).toBeTruthy();
			});

			// State 6: complete
			await waitFor(() => {
				expect(getByText('Message Delivered!')).toBeTruthy();
			});

			// Verify complete event was dispatched
			expect(completeEvents).toHaveLength(1);
			expect(completeEvents[0].submissionId).toBe('submission-123');
		}, 10000);

		it('should handle credential not found error', async () => {
			const { getSessionCredential } = await import('$lib/core/identity/session-credentials');
			(getSessionCredential as Mock).mockResolvedValue(null);

			const { getByText, component } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			// Track cancel events
			let cancelCalled = false;
			component.$on('cancel', () => {
				cancelCalled = true;
			});

			// Click send button
			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// Should show error state
			await waitFor(() => {
				expect(getByText('Something went wrong')).toBeTruthy();
				expect(
					getByText('Session credential not found. Please verify your identity first.')
				).toBeTruthy();
			});

			// Clicking cancel should dispatch cancel event
			const cancelButton = getByText('Cancel');
			await fireEvent.click(cancelButton);
			expect(cancelCalled).toBe(true);
		}, 5000);

		it('should handle proof generation failure', async () => {
			const { generateProof } = await import('$lib/core/proof/prover');
			(generateProof as Mock).mockResolvedValue({
				success: false
			});

			const { getByText, component } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			// Track error events
			const errorEvents: Array<{ message: string }> = [];
			component.$on('error', (event) => {
				errorEvents.push(event.detail);
			});

			// Click send button
			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// Should show error state
			await waitFor(() => {
				expect(getByText('Proof generation failed. Please try again.')).toBeTruthy();
			});

			// Error event should have been dispatched
			expect(errorEvents).toHaveLength(1);
			expect(errorEvents[0].message).toBe('Proof generation failed. Please try again.');
		}, 5000);

		it('should handle submission failure', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ error: 'Submission failed due to network error' })
			} as Response);

			const { getByText, component } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			// Track error events
			const errorEvents: Array<{ message: string }> = [];
			component.$on('error', (event) => {
				errorEvents.push(event.detail);
			});

			// Click send button
			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// Should show error state
			await waitFor(() => {
				expect(getByText('Submission failed due to network error')).toBeTruthy();
			});

			// Error event should have been dispatched
			expect(errorEvents).toHaveLength(1);
		}, 5000);
	});

	describe('Educational Messaging', () => {
		it('should cycle through educational messages during proof generation', async () => {
			const { getByText, queryByText } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			// Start proof generation
			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// Wait for generating-proof state
			await waitFor(() => {
				expect(getByText('Preparing secure delivery...')).toBeTruthy();
			});

			// Educational messages should be present
			// (Note: In real browser, these would cycle every 3s via $effect)
			const expectedMessages = [
				'Your exact address stays private',
				'Congressional staff see: "Verified constituent from your district"',
				'Building your civic reputation on-chain'
			];

			// At least one message should be visible
			const visibleMessages = expectedMessages.filter((msg) => queryByText(msg));
			expect(visibleMessages.length).toBeGreaterThan(0);
		}, 5000);
	});

	describe('Error Recovery', () => {
		it('should allow retry after recoverable error', async () => {
			const { generateProof } = await import('$lib/core/proof/prover');
			let callCount = 0;
			(generateProof as Mock).mockImplementation(async () => {
				callCount++;
				if (callCount === 1) {
					return { success: false }; // First call fails
				}
				return mockProofResult; // Second call succeeds
			});

			const { getByText } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			// First attempt - should fail
			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			await waitFor(() => {
				expect(getByText('Proof generation failed. Please try again.')).toBeTruthy();
			});

			// Retry button should be available
			const retryButton = getByText('Try Again');
			expect(retryButton).toBeTruthy();

			// Click retry
			await fireEvent.click(retryButton);

			// Should succeed on second attempt
			await waitFor(() => {
				expect(getByText('Message Delivered!')).toBeTruthy();
			});

			expect(callCount).toBe(2);
		}, 10000);
	});

	describe('Event Dispatching', () => {
		it('should dispatch complete event with submissionId', async () => {
			const { getByText, component } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			const completeEvents: Array<{ submissionId: string }> = [];
			component.$on('complete', (event) => {
				completeEvents.push(event.detail);
			});

			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			await waitFor(() => {
				expect(completeEvents).toHaveLength(1);
				expect(completeEvents[0].submissionId).toBe('submission-123');
			}, 5000);
		}, 10000);

		it('should dispatch cancel event when user cancels', async () => {
			const { getByText, component } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			let cancelCalled = false;
			component.$on('cancel', () => {
				cancelCalled = true;
			});

			const cancelButton = getByText('Cancel');
			await fireEvent.click(cancelButton);

			expect(cancelCalled).toBe(true);
		});

		it('should dispatch error event on failure', async () => {
			const { generateProof } = await import('$lib/core/proof/prover');
			(generateProof as Mock).mockRejectedValue(new Error('Network error'));

			const { getByText, component } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			const errorEvents: Array<{ message: string }> = [];
			component.$on('error', (event) => {
				errorEvents.push(event.detail);
			});

			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			await waitFor(() => {
				expect(errorEvents).toHaveLength(1);
				expect(errorEvents[0].message).toContain('Network error');
			}, 5000);
		}, 10000);
	});

	describe('Progress Tracking', () => {
		it('should track prover initialization progress', async () => {
			const { getByText, container } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// Wait for initializing state
			await waitFor(() => {
				expect(getByText('Initializing secure delivery...')).toBeTruthy();
			});

			// Progress bar should exist (checking for presence, not exact value)
			const progressBars = container.querySelectorAll('[style*="width"]');
			expect(progressBars.length).toBeGreaterThan(0);
		}, 5000);

		it('should track proof generation progress', async () => {
			const { getByText, container } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData
				}
			});

			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// Wait for generating-proof state
			await waitFor(() => {
				expect(getByText('Preparing secure delivery...')).toBeTruthy();
			});

			// Progress bar should exist
			const progressBars = container.querySelectorAll('[style*="width"]');
			expect(progressBars.length).toBeGreaterThan(0);
		}, 5000);
	});

	describe('Skip Credential Check Flag', () => {
		it('should skip credential check when flag is true', async () => {
			const { getSessionCredential } = await import('$lib/core/identity/session-credentials');
			(getSessionCredential as Mock).mockResolvedValue(null);

			const { getByText } = render(ProofGenerator, {
				props: {
					userId: mockUserId,
					templateId: mockTemplateId,
					templateData: mockTemplateData,
					skipCredentialCheck: true // Skip check
				}
			});

			const sendButton = getByText('Send to Representative');
			await fireEvent.click(sendButton);

			// Should NOT show credential error
			await waitFor(() => {
				// Should proceed to next state instead of erroring
				expect(getByText('Initializing secure delivery...')).toBeTruthy();
			});
		}, 5000);
	});
});
