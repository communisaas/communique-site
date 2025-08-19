import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import Button from '$lib/components/ui/Button.svelte';

describe('Button Component', () => {
	it('renders button with text', () => {
		render(Button, { text: 'Click me' });

		const button = screen.getByRole('button', { name: /click me/i });
		expect(button).toBeInTheDocument();
	});

	it('handles click events', async () => {
		const mockClick = vi.fn();
		render(Button, { onclick: mockClick, text: 'Click me' });

		const button = screen.getByRole('button', { name: /click me/i });
		await fireEvent.click(button);

		expect(mockClick).toHaveBeenCalledOnce();
	});

	it('applies variant classes correctly', () => {
		render(Button, { variant: 'primary', text: 'Primary Button' });

		const button = screen.getByRole('button', { name: /primary button/i });
		expect(button).toHaveClass('bg-blue-600');
	});

	it('applies secondary variant classes correctly', () => {
		render(Button, { variant: 'secondary', text: 'Secondary Button' });

		const button = screen.getByRole('button', { name: /secondary button/i });
		expect(button).toHaveClass('bg-white', 'text-blue-600', 'border');
	});

	it('applies default classes', () => {
		render(Button, { text: 'Default Button' });

		const button = screen.getByRole('button', { name: /default button/i });
		expect(button).toHaveClass('px-6', 'py-3', 'cursor-pointer');
	});

	it('applies custom class names', () => {
		render(Button, { classNames: 'custom-class', text: 'Custom Button' });

		const button = screen.getByRole('button', { name: /custom button/i });
		expect(button).toHaveClass('custom-class');
	});
});