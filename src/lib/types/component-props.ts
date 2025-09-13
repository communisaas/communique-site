/**
 * Component-specific type definitions
 * 
 * These interfaces define the shape of props expected by UI components,
 * which may be simpler than the full database models.
 */

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
export function toComponentUser(user: any): ComponentUser | null {
	if (!user) return null;
	
	return {
		id: user.id,
		name: user.name || 'Anonymous',
		address: user.street && user.city && user.state && user.zip
			? `${user.street}, ${user.city}, ${user.state} ${user.zip}`
			: undefined
	};
}

/**
 * Type guard to check if an object is a ComponentUser
 */
export function isComponentUser(obj: any): obj is ComponentUser {
	return obj && 
		typeof obj.id === 'string' && 
		typeof obj.name === 'string';
}

/**
 * Badge component variants
 */
export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

/**
 * Button component variants
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'magical' | 'direct';

/**
 * Animation states for flight animations
 */
export type FlightState = 'sent' | 'ready' | 'taking-off' | 'flying' | 'departing' | undefined;

/**
 * Spring animation type (from svelte/motion)
 */
export interface SpringValue<T = number> {
	set: (value: T) => void;
	update: (fn: (value: T) => T) => void;
	subscribe: (fn: (value: T) => void) => () => void;
}