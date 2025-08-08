import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button Component', () => {
	it('renders button with text', () => {
		const { container } = render(Button, {
			$$slots: {
				default: () => 'Click me'
			}
		});

		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
		expect(container.textContent).toContain('Click me');
	});

	it('handles click events', async () => {
		const mockClick = vi.fn();
		render(Button, {
			onclick: mockClick,
			children: () => 'Click me'
		});

		const button = screen.getByRole('button');
		await fireEvent.click(button);

		expect(mockClick).toHaveBeenCalledOnce();
	});

	it('applies variant classes correctly', () => {
		render(Button, {
			variant: 'primary',
			children: () => 'Primary Button'
		});

		const button = screen.getByRole('button');
		expect(button).toHaveClass('bg-blue-600');
	});

	it('applies secondary variant classes correctly', () => {
		render(Button, {
			variant: 'secondary',
			children: () => 'Secondary Button'
		});

		const button = screen.getByRole('button');
		expect(button).toHaveClass('bg-white', 'text-blue-600', 'border');
	});

	it('applies default classes', () => {
		render(Button, {
			children: () => 'Default Button'
		});

		const button = screen.getByRole('button');
		expect(button).toHaveClass('px-6', 'py-3', 'cursor-pointer');
	});

	it('applies custom class names', () => {
		render(Button, {
			classNames: 'custom-class',
			children: () => 'Custom Button'
		});

		const button = screen.getByRole('button');
		expect(button).toHaveClass('custom-class');
	});
});