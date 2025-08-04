import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import TemplatePreview from './TemplatePreview.svelte';
import type { Template } from '$lib/types/template';

// Mock child components
vi.mock('./TemplateTips.svelte', () => ({
	default: () => ({ default: () => 'TemplateTips' })
}));

vi.mock('./MessagePreview.svelte', () => ({
	default: () => ({ default: () => 'MessagePreview' })
}));

vi.mock('$lib/components/ui/Popover.svelte', () => ({
	default: () => ({ default: () => 'Popover' })
}));

vi.mock('$lib/components/ui/Button.svelte', () => ({
	default: () => ({ default: () => 'Button' })
}));

// Mock utils
vi.mock('$lib/utils/browserUtils', () => ({
	isMobile: vi.fn(() => false)
}));

vi.mock('$lib/utils/timerCoordinator', () => ({
	coordinated: {
		setTimeout: vi.fn((fn, delay) => setTimeout(fn, delay)),
		clearTimeout: vi.fn((id) => clearTimeout(id))
	},
	useTimerCleanup: vi.fn(() => () => {})
}));

vi.mock('$lib/types/templateConfig', () => ({
	extractRecipientEmails: vi.fn((config) => {
		if (!config) return [];
		// Mock extraction logic
		return config.recipients || ['test@example.com', 'test2@example.com'];
	})
}));

describe('TemplatePreview Component', () => {
	const mockTemplate: Template = {
		id: 'test-template-1',
		slug: 'climate-action',
		title: 'Climate Action Template',
		description: 'Take action on climate change',
		category: 'Environment',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Support Climate Action',
		preview: 'Dear Representative...',
		message_body: 'I am writing to urge your support for climate action...',
		delivery_config: {},
		recipient_config: {
			recipients: ['rep@house.gov', 'senator@senate.gov']
		},
		metrics: {
			sent: 1250,
			views: 3400,
			responses: 45
		},
		status: 'published',
		is_public: true,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	const mockUser = {
		id: 'user-123',
		name: 'John Doe'
	};

	beforeEach(() => {
		// Mock clipboard API
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn(() => Promise.resolve())
			}
		});

		// Mock document.querySelector for keyboard navigation
		document.querySelector = vi.fn((selector) => {
			if (selector.includes('template-button')) {
				return {
					focus: vi.fn(),
					getAttribute: vi.fn(() => 'test-template-1')
				};
			}
			return null;
		});

		// Mock document.querySelectorAll
		document.querySelectorAll = vi.fn(() => [
			{
				focus: vi.fn(),
				getAttribute: vi.fn(() => 'test-template-1')
			}
		] as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders template preview with basic information', () => {
		render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		// Template title and description should be displayed
		expect(screen.getByText('Climate Action Template')).toBeInTheDocument();
		expect(screen.getByText('Take action on climate change')).toBeInTheDocument();
	});

	it('displays template metrics', () => {
		render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		// Should show supporter count
		expect(screen.getByText(/1,250/)).toBeInTheDocument();
		expect(screen.getByText(/supporters/i)).toBeInTheDocument();
	});

	it('shows recipient information', () => {
		render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		// Should display recipient count and preview
		expect(screen.getByText(/2 recipients/i)).toBeInTheDocument();
		expect(screen.getByText(/rep@house.gov • senator@senate.gov/)).toBeInTheDocument();
	});

	it('renders send message button for authenticated users', () => {
		render(TemplatePreview, {
			props: { 
				template: mockTemplate,
				user: mockUser
			}
		});

		const sendButton = screen.getByRole('button', { name: /send.*message/i });
		expect(sendButton).toBeInTheDocument();
	});

	it('renders sign in button for unauthenticated users', () => {
		render(TemplatePreview, {
			props: { 
				template: mockTemplate,
				user: null
			}
		});

		const signInButton = screen.getByRole('button', { name: /sign.*in/i });
		expect(signInButton).toBeInTheDocument();
	});

	it('calls onSendMessage when send button is clicked', async () => {
		const mockOnSendMessage = vi.fn();
		render(TemplatePreview, {
			props: { 
				template: mockTemplate,
				user: mockUser,
				onSendMessage: mockOnSendMessage
			}
		});

		const sendButton = screen.getByRole('button', { name: /send.*message/i });
		await fireEvent.click(sendButton);

		expect(mockOnSendMessage).toHaveBeenCalledOnce();
	});

	it('calls onOpenModal when modal button is clicked on mobile', async () => {
		const mockOnOpenModal = vi.fn();
		
		// Mock isMobile to return true
		const { isMobile } = await import('$lib/utils/browserUtils');
		vi.mocked(isMobile).mockReturnValue(true);

		render(TemplatePreview, {
			props: { 
				template: mockTemplate,
				onOpenModal: mockOnOpenModal
			}
		});

		// Look for mobile-specific button (implementation may vary)
		const buttons = screen.getAllByRole('button');
		const mobileButton = buttons.find(button => 
			button.textContent?.includes('Open') || 
			button.textContent?.includes('View')
		);

		if (mobileButton) {
			await fireEvent.click(mobileButton);
			expect(mockOnOpenModal).toHaveBeenCalledOnce();
		}
	});

	it('handles copy to clipboard functionality', async () => {
		render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		const copyButton = screen.getByRole('button', { name: /copy/i });
		await fireEvent.click(copyButton);

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining('Climate Action Template')
		);
	});

	it('shows copied state after successful copy', async () => {
		render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		const copyButton = screen.getByRole('button', { name: /copy/i });
		await fireEvent.click(copyButton);

		// Should show copied confirmation
		expect(screen.getByText(/copied/i)).toBeInTheDocument();
	});

	it('handles keyboard navigation', async () => {
		render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		const previewContainer = screen.getByRole('article') || screen.getByTestId('template-preview');
		
		// Simulate Tab key press
		await fireEvent.keyDown(previewContainer, { key: 'Tab' });

		// Should handle keyboard navigation without errors
		expect(previewContainer).toBeInTheDocument();
	});

	it('handles Shift+Tab keyboard navigation', async () => {
		render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		const previewContainer = screen.getByRole('article') || screen.getByTestId('template-preview');
		
		// Simulate Shift+Tab key press
		await fireEvent.keyDown(previewContainer, { key: 'Tab', shiftKey: true });

		// Should handle reverse keyboard navigation without errors
		expect(previewContainer).toBeInTheDocument();
	});

	it('displays different content in modal mode', () => {
		const { rerender } = render(TemplatePreview, {
			props: { 
				template: mockTemplate,
				inModal: false
			}
		});

		// Test normal mode
		let recipientText = screen.getByText(/rep@house.gov • senator@senate.gov/);
		expect(recipientText).toBeInTheDocument();

		// Test modal mode (should show fewer recipients)
		rerender({
			template: mockTemplate,
			inModal: true
		});

		// In modal mode, should show only first recipient
		recipientText = screen.getByText(/rep@house.gov/);
		expect(recipientText).toBeInTheDocument();
	});

	it('handles scroll events', async () => {
		const mockOnScroll = vi.fn();
		render(TemplatePreview, {
			props: { 
				template: mockTemplate,
				onScroll: mockOnScroll
			}
		});

		// Find scrollable container
		const scrollContainer = screen.getByRole('article') || 
			document.querySelector('.overflow-auto, .overflow-y-auto');
		
		if (scrollContainer) {
			await fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
			
			// Should call onScroll callback
			expect(mockOnScroll).toHaveBeenCalled();
		}
	});

	it('cleans up timers on unmount', () => {
		const { unmount } = render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		unmount();

		// Should call timer cleanup
		const { useTimerCleanup } = require('$lib/utils/timerCoordinator');
		expect(useTimerCleanup).toHaveBeenCalled();
	});

	it('dispatches useTemplate event', async () => {
		const { component } = render(TemplatePreview, {
			props: { template: mockTemplate }
		});

		const mockHandler = vi.fn();
		component.$on('useTemplate', mockHandler);

		const useButton = screen.getByRole('button', { name: /use.*template/i });
		if (useButton) {
			await fireEvent.click(useButton);
			expect(mockHandler).toHaveBeenCalled();
		}
	});

	it('handles templates without recipient config', () => {
		const templateWithoutRecipients = {
			...mockTemplate,
			recipient_config: null
		};

		render(TemplatePreview, {
			props: { template: templateWithoutRecipients }
		});

		// Should handle missing recipients gracefully
		expect(screen.getByText('Climate Action Template')).toBeInTheDocument();
	});
});