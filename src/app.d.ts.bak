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
			track: (_event: string, properties?: Record<string, unknown>) => void;
			identify: (userId: string, traits?: Record<string, unknown>) => void;
			page: (name?: string, properties?: Record<string, unknown>) => void;
			// Specialized tracking methods
			trackAuthCompleted: (templateId: string, provider: string, userId: string) => void;
			trackTemplateUsed: (templateId: string, deliveryMethod: string, userId?: string) => void;
			trackInteraction: (
				element: string,
				action: string,
				properties?: Record<string, unknown>
			) => void;
		};
	}
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			// Core Environment
			NODE_ENV: 'development' | 'production' | 'test';
			ORIGIN?: string;

			// Database
			DATABASE_URL?: string;
			SUPABASE_DATABASE_URL?: string;

			// Feature Flags
			ENABLE_BETA?: string;
			PUBLIC_ENABLE_BETA?: string;
			ENABLE_RESEARCH?: string;
			ENABLE_VOTER_CERTIFICATION?: string;
			ENABLE_CERTIFICATION?: string;

			// OAuth Configuration
			OAUTH_REDIRECT_BASE_URL?: string;
			GOOGLE_CLIENT_ID?: string;
			GOOGLE_CLIENT_SECRET?: string;
			FACEBOOK_CLIENT_ID?: string;
			FACEBOOK_CLIENT_SECRET?: string;
			LINKEDIN_CLIENT_ID?: string;
			LINKEDIN_CLIENT_SECRET?: string;
			TWITTER_CLIENT_ID?: string;
			TWITTER_CLIENT_SECRET?: string;
			DISCORD_CLIENT_ID?: string;
			DISCORD_CLIENT_SECRET?: string;

			// SMTP Configuration
			SMTP_PORT?: string;
			SMTP_HOST?: string;
			SMTP_SECURE?: string;
			SMTP_AUTH_USER?: string;
			SMTP_AUTH_PASS?: string;
			SMTP_RELAY_HOST?: string;
			SMTP_RELAY_PORT?: string;
			SMTP_RELAY_USER?: string;
			SMTP_RELAY_PASS?: string;

			// API Keys and External Services
			CWC_API_KEY?: string;
			CWC_API_URL?: string;
			CWC_API_BASE_URL?: string;
			CWC_CAMPAIGN_ID?: string;
			CWC_DELIVERY_AGENT_ID?: string;
			CWC_DELIVERY_AGENT_NAME?: string;
			CWC_DELIVERY_AGENT_CONTACT?: string;
			CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL?: string;
			CWC_DELIVERY_AGENT_ACK?: 'Y' | 'N';

			// Communique API
			COMMUNIQUE_API_URL?: string;
			COMMUNIQUE_API_KEY?: string;
			COMMUNIQUE_WEBHOOK_SECRET?: string;
			COMMUNIQUE_MAIL_SERVER_KEY?: string;
			COMMUNIQUE_CORE_ADDRESS?: string;

			// VOTER Protocol
			VOTER_API_URL?: string;
			VOTER_API_KEY?: string;
			VOTER_REGISTRY_ADDRESS?: string;

			// N8N Integration
			N8N_WEBHOOK_SECRET?: string;

			// AI Services
			OPENAI_API_KEY?: string;
			GEMINI_API_KEY?: string;
			DIDIT_API_KEY?: string;

			// Blockchain
			RPC_URL?: string;
			CERTIFIER_PRIVATE_KEY?: string;

			// Email Services
			SENDGRID_API_KEY?: string;
			EMAIL_VERIFICATION_SECRET?: string;
			JWT_SECRET?: string;

			// Logging and Monitoring
			LOG_LEVEL?: string;
			SENTRY_DSN?: string;

			// Domain Configuration
			ALLOWED_DOMAINS?: string;
			DEFAULT_FROM_DOMAIN?: string;

			// Other Configuration
			SHEAF_CONFLICT_PENALTY_WEIGHT?: string;
		}
	}
}

export {};
