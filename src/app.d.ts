// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
			status?: number;
		}
		interface Locals {
			user: {
				id: string;
				email: string;
				name: string | null;
				street: string | null;
				city: string | null;
				state: string | null;
				zip: string | null;
				congressional_district: string | null;
				is_verified: boolean;
				is_active: boolean;
				is_banned: boolean;
				is_admin: boolean;
				avatar: string | null;
				phone: string | null;
				role: string | null;
				organization: string | null;
				location: string | null;
				connection: string | null;
				connection_details: string | null;
				profile_completed_at: Date | null;
				profile_visibility: string;
				verification_method: string | null;
				verified_at: Date | null;
				createdAt: Date;
				updatedAt: Date;
			} | null;
			session: {
				id: string;
				createdAt: Date;
				userId: string;
				expiresAt: Date;
			} | null;
		}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface PageData {}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface PageState {}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface Platform {}
	}

	interface Window {
		analytics?: {
			track: (event: string, properties?: Record<string, unknown>) => void;
			identify: (userId: string, traits?: Record<string, unknown>) => void;
			page: (name?: string, properties?: Record<string, unknown>) => void;
		};
	}
}

export {};
