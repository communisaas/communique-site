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
				profile_picture: string | null;
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
		interface PageData {}
		interface PageState {}
		interface Platform {}
	}

	interface Window {
		analytics?: {
			track: (event: string, properties?: Record<string, any>) => void;
			identify: (userId: string, traits?: Record<string, any>) => void;
			page: (name?: string, properties?: Record<string, any>) => void;
		};
	}
}

export {};
