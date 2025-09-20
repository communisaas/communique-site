/**
 * Portal utilities for rendering components outside their normal DOM hierarchy
 * 
 * This solves transform context issues by rendering floating elements directly
 * to document.body, escaping any transformed ancestors.
 */

import { tick } from 'svelte';

export interface PortalTarget {
	element: HTMLElement;
	cleanup: () => void;
}

/**
 * Create a portal target element in document.body
 */
export function createPortal(id?: string): PortalTarget {
	const element = document.createElement('div');
	
	if (id) {
		element.id = id;
	}
	
	// Style the portal container
	element.style.cssText = `
		position: absolute;
		top: 0;
		left: 0;
		z-index: 9999;
	`;
	
	// Add to body
	document.body.appendChild(element);
	
	const cleanup = () => {
		if (element.parentNode) {
			element.parentNode.removeChild(element);
		}
	};
	
	return { element, cleanup };
}

/**
 * Portal action for Svelte components
 * Usage: <div use:portal>Content to portal</div>
 */
export function portal(node: HTMLElement, target?: HTMLElement | string) {
	let portalTarget: HTMLElement;
	let originalParent: HTMLElement | null = null;
	let originalNextSibling: Node | null = null;
	
	function mount() {
		// Determine target
		if (typeof target === 'string') {
			portalTarget = document.querySelector(target) || document.body;
		} else if (target instanceof HTMLElement) {
			portalTarget = target;
		} else {
			portalTarget = document.body;
		}
		
		// Store original position
		originalParent = node.parentElement;
		originalNextSibling = node.nextSibling;
		
		// Move to portal target
		portalTarget.appendChild(node);
	}
	
	function unmount() {
		// Restore original position
		if (originalParent) {
			if (originalNextSibling) {
				originalParent.insertBefore(node, originalNextSibling);
			} else {
				originalParent.appendChild(node);
			}
		}
	}
	
	// Mount immediately if in browser
	if (typeof document !== 'undefined') {
		mount();
	}
	
	return {
		update(newTarget?: HTMLElement | string) {
			if (newTarget !== target) {
				unmount();
				target = newTarget;
				mount();
			}
		},
		destroy() {
			unmount();
		}
	};
}

/**
 * Svelte 5 compatible portal using runes
 * 
 * Usage in component:
 * ```
 * let portalContainer: HTMLElement;
 * 
 * onMount(() => {
 *   const portal = createPortal('my-tooltip-portal');
 *   portalContainer = portal.element;
 *   
 *   return portal.cleanup;
 * });
 * 
 * {#if portalContainer}
 *   <div bind:this={tooltipElement} style="position: fixed; ...">
 *     Tooltip content
 *   </div>
 * {/if}
 * ```
 */
export class PortalManager {
	private portals = new Map<string, PortalTarget>();
	
	/**
	 * Get or create a portal with the given ID
	 */
	getPortal(id: string): PortalTarget {
		let portal = this.portals.get(id);
		
		if (!portal) {
			portal = createPortal(id);
			this.portals.set(id, portal);
		}
		
		return portal;
	}
	
	/**
	 * Remove a portal
	 */
	removePortal(id: string): void {
		const portal = this.portals.get(id);
		if (portal) {
			portal.cleanup();
			this.portals.delete(id);
		}
	}
	
	/**
	 * Clean up all portals
	 */
	cleanup(): void {
		for (const [id, portal] of this.portals) {
			portal.cleanup();
		}
		this.portals.clear();
	}
}

// Global portal manager instance
export const portalManager = new PortalManager();

/**
 * Render component content to a portal
 * 
 * This is a simpler alternative to the portal action for cases where
 * you want to conditionally render to a portal target.
 */
export function renderToPortal(
	sourceElement: HTMLElement,
	portalId: string,
	shouldPortal: boolean = true
): () => void {
	if (!shouldPortal) {
		return () => {}; // No-op if not portaling
	}
	
	const portal = portalManager.getPortal(portalId);
	const originalParent = sourceElement.parentElement;
	const originalNextSibling = sourceElement.nextSibling;
	
	// Move to portal
	portal.element.appendChild(sourceElement);
	
	// Return cleanup function
	return () => {
		if (originalParent) {
			if (originalNextSibling) {
				originalParent.insertBefore(sourceElement, originalNextSibling);
			} else {
				originalParent.appendChild(sourceElement);
			}
		}
	};
}