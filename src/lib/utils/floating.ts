/**
 * Floating UI utilities for tooltips, popovers, and other positioned elements
 * 
 * This is a thin wrapper around @floating-ui/dom that provides:
 * - Consistent configuration for our design system
 * - Arrow positioning middleware
 * - Auto-update functionality for dynamic content
 */

import {
	computePosition,
	flip,
	shift,
	offset,
	arrow,
	autoUpdate,
	type Placement,
	type ComputePositionReturn,
	type Middleware
} from '@floating-ui/dom';
import DOMPurify from 'dompurify';

export interface TooltipPosition {
	x: number;
	y: number;
	placement: Placement;
	arrow?: {
		x: number;
		y: number;
	};
}

export interface PositionOptions {
	placement?: Placement;
	offset?: number;
	margin?: number;
	allowFlip?: boolean;
	allowShift?: boolean;
	arrowElement?: HTMLElement;
}

/**
 * Compute tooltip position using Floating UI with transform-aware logic
 */
export async function computeTooltipPosition(
	triggerElement: Element,
	tooltipElement: HTMLElement,
	options: PositionOptions = {}
): Promise<TooltipPosition> {
	const {
		placement = 'top',
		offset: offsetValue = 8,
		margin = 16,
		allowFlip = true,
		allowShift = true,
		arrowElement
	} = options;

	// Check for problematic transform contexts
	const triggerStyles = window.getComputedStyle(triggerElement);
	const hasTransform = triggerStyles.transform !== 'none';
	
	if (hasTransform) {
		console.warn('Detected transform on trigger element, this may affect positioning');
	}

	// Build middleware stack with proper offset for arrow
	const middleware: Middleware[] = [
		// Increase offset to account for arrow size (6px) plus desired spacing
		offset(offsetValue + 6)
	];

	if (allowFlip) {
		middleware.push(flip({
			padding: margin
		}));
	}

	if (allowShift) {
		middleware.push(shift({
			padding: margin
		}));
	}

	if (arrowElement) {
		middleware.push(arrow({
			element: arrowElement
		}));
	}

	// Compute position with enhanced error handling
	let result: ComputePositionReturn;
	try {
		result = await computePosition(triggerElement, tooltipElement, {
			placement,
			middleware,
			// Use viewport-relative strategy for better cross-context positioning
			strategy: 'fixed'
		});
	} catch (error) {
		console.error('Floating UI computation failed:', error);
		
		// Fallback to manual positioning
		const triggerRect = triggerElement.getBoundingClientRect();
		result = {
			x: triggerRect.left + triggerRect.width / 2 - tooltipElement.offsetWidth / 2,
			y: triggerRect.top - tooltipElement.offsetHeight - offsetValue,
			placement: 'top',
			middlewareData: {},
			strategy: 'fixed'
		};
	}

	// Extract arrow data if available
	const arrowData = arrowElement && result.middlewareData.arrow ? {
		x: result.middlewareData.arrow.x ?? 0,
		y: result.middlewareData.arrow.y ?? 0
	} : undefined;

	return {
		x: result.x,
		y: result.y,
		placement: result.placement,
		arrow: arrowData
	};
}

/**
 * Setup auto-update for dynamic positioning
 */
export function setupAutoUpdate(
	triggerElement: Element,
	tooltipElement: HTMLElement,
	updateFn: () => void
): () => void {
	return autoUpdate(triggerElement, tooltipElement, updateFn);
}

/**
 * Apply position to tooltip element using transform for performance
 */
export function applyTooltipPosition(
	tooltipElement: HTMLElement,
	position: TooltipPosition
): void {
	// Use transform for better performance
	tooltipElement.style.transform = `translate(${position.x}px, ${position.y}px)`;
	tooltipElement.style.left = '0';
	tooltipElement.style.top = '0';

	// Set placement for arrow orientation FIRST (critical for CSS selectors)
	tooltipElement.dataset.placement = position.placement;

	// Apply arrow position via CSS custom properties AND direct positioning
	if (position.arrow) {
		tooltipElement.style.setProperty('--arrow-x', `${position.arrow.x}px`);
		tooltipElement.style.setProperty('--arrow-y', `${position.arrow.y}px`);
		
		// Find arrow element and position it directly for better visibility
		const arrowElement = tooltipElement.querySelector('.tooltip-arrow') as HTMLElement;
		if (arrowElement) {
			// Ensure arrow is visible
			arrowElement.style.display = 'block';
			arrowElement.style.position = 'absolute';
		}
	}
}

/**
 * Sanitize tooltip content to prevent XSS
 */
export function sanitizeTooltipContent(content: string): string {
	// Use DOMPurify for robust HTML sanitization to prevent XSS
	return DOMPurify.sanitize(content);
}