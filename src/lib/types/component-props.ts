/**
 * Component-specific type definitions
 *
 * These interfaces define the shape of props expected by UI components,
 * which may be simpler than the full database models.
 */

import type { UnknownRecord, ComponentEvent } from '$lib/types/any-replacements';

/**
 * Minimal user interface for components that only need basic info
 */
export interface ComponentUser {
	id: string;
	name: string;
	address?: string;
}

/**
 * Convert a full user object to component user format
 */
export function toComponentUser(user: unknown): ComponentUser | null {
	if (!user || typeof user !== 'object') return null;

	const userObj = user as {
		id?: string;
		name?: string;
		street?: string;
		city?: string;
		state?: string;
		zip?: string;
	};

	if (!userObj.id || typeof userObj.id !== 'string') return null;

	return {
		id: userObj.id,
		name: userObj.name || 'Anonymous',
		address:
			userObj.street && userObj.city && userObj.state && userObj.zip
				? `${userObj.street}, ${userObj.city}, ${userObj.state} ${userObj.zip}`
				: undefined
	};
}

/**
 * Type guard to check if an object is a ComponentUser
 */
export function isComponentUser(obj: unknown): obj is ComponentUser {
	return (
		obj !== null &&
		typeof obj === 'object' &&
		'id' in obj &&
		'name' in obj &&
		typeof (obj as ComponentUser).id === 'string' &&
		typeof (obj as ComponentUser).name === 'string'
	);
}

/**
 * Badge component variants
 */
export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

/**
 * Button component variants
 */
export type ButtonVariant =
	| 'primary'
	| 'secondary'
	| 'outline'
	| 'ghost'
	| 'link'
	| 'magical'
	| 'direct';

/**
 * Animation states for flight animations
 */
export type FlightState = 'sent' | 'ready' | 'taking-off' | 'flying' | 'departing' | undefined;

/**
 * Spring animation type (from svelte/motion) with proper generic constraint
 */
export interface SpringValue<T extends number | string | object = number> {
	set: (value: T) => void;
	update: (fn: (value: T) => T) => void;
	subscribe: (fn: (value: T) => void) => () => void;
}

/**
 * Standard modal component interface for external binding
 * Ensures all modal components provide consistent open/close methods
 */
export interface ModalComponent {
	/** Optional Svelte component event binding */
	$on?(type: string, callback: (e: ComponentEvent) => void): () => void;
	/** Optional Svelte component props setting */
	$set?(props: Partial<UnknownRecord>): void;
	/** Open the modal with optional data */
	open: (data?: unknown) => void;
	/** Close the modal */
	close: () => void;
}

/**
 * Type guard to check if an object implements the ModalComponent interface
 */
export function isModalComponent(obj: unknown): obj is ModalComponent {
	return (
		obj !== null &&
		typeof obj === 'object' &&
		'open' in obj &&
		'close' in obj &&
		typeof (obj as ModalComponent).open === 'function' &&
		typeof (obj as ModalComponent).close === 'function'
	);
}

/**
 * Component template interface that extends Template with index signature
 * This allows components to accept Template objects while being flexible about extra properties
 */
export interface ComponentTemplate {
	id: string;
	slug: string;
	title: string;
	description: string;
	deliveryMethod: string;
	type?: string;
	message_body?: string;
	recipient_config?: UnknownRecord;
	recipientEmails?: string[];
	metrics: { sent?: number; delivered?: number; views?: number };
	[key: string]: unknown;
}
