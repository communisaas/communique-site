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
				avatar: string | null;
				// Verification status
				is_verified: boolean;
				verification_method: string | null;
				verified_at: Date | null;
				// Privacy-preserving district (hash only, no PII)
				district_hash: string | null;
				district_verified: boolean;
				// Profile fields
				role: string | null;
				organization: string | null;
				location: string | null;
				connection: string | null;
				profile_completed_at: Date | null;
				profile_visibility: string;
				// Reputation
				trust_score: number;
				reputation_tier: string;
				// Timestamps
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

			// Security & Authentication
			JWT_SECRET?: string; // Used for token signing
			EMAIL_VERIFICATION_SECRET?: string; // Optional, falls back to JWT_SECRET
			IDENTITY_HASH_SALT?: string; // Sybil-resistant identity hashing (NEVER regenerate in production)
			IP_HASH_SALT?: string; // Privacy-preserving IP anonymization (daily rotation)

			// Analytics Configuration
			USE_SNAPSHOT_ONLY?: string; // 'true' = use privacy-preserving snapshots only (production default)

			// Rate Limiting
			RATE_LIMIT_USE_DB?: string; // 'true' = use database for rate limit state

			// Cron Jobs
			CRON_SECRET?: string; // Authenticate cron endpoints

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

			// Congressional Integration (CWC)
			CWC_API_KEY?: string;
			CWC_API_BASE_URL?: string;
			CWC_CAMPAIGN_ID?: string;
			CWC_ENVIRONMENT?: 'test' | 'production';
			CWC_DELIVERY_AGENT_ID?: string;
			CWC_DELIVERY_AGENT_NAME?: string; // House delivery agent name (registered with House CWC)
			CWC_SENATE_DELIVERY_AGENT_NAME?: string; // Senate delivery agent name (from SOAPBox Company Legal Name)
			CWC_SENATE_ACK_EMAIL?: string; // Senate auto-messaging email (from SOAPBox)
			CWC_DELIVERY_AGENT_CONTACT?: string;
			CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL?: string;
			CWC_DELIVERY_AGENT_ACK?: 'Y' | 'N';
			HOUSE_CWC_API_KEY?: string;

			// GCP Proxy (for House CWC API - requires IP whitelisting)
			GCP_PROXY_URL?: string;
			GCP_PROXY_AUTH_TOKEN?: string;

			// VOTER Protocol
			VOTER_API_URL?: string;
			VOTER_API_KEY?: string;

			// N8N Integration
			N8N_WEBHOOK_SECRET?: string;

			// AI Services
			OPENAI_API_KEY?: string; // Used for embeddings and scope extraction (NOT moderation)
			GEMINI_API_KEY?: string; // Used for quality assessment and AI agents
			GROQ_API_KEY?: string; // Used for Llama Guard 4 safety moderation

			// Identity Verification
			DIDIT_API_KEY?: string;
			DIDIT_WORKFLOW_ID?: string;
			DIDIT_WEBHOOK_SECRET?: string;

			// Self.xyz (Zero-knowledge passport verification)
			SELF_APP_NAME?: string;
			SELF_SCOPE?: string;
			SELF_MOCK_PASSPORT?: string; // 'true' for testing
			NEXT_PUBLIC_SELF_SCOPE?: string;
			NEXT_PUBLIC_SELF_ENDPOINT?: string;

			// Email Enrichment APIs (Optional)
			HUNTER_IO_API_KEY?: string; // Email verification
			CLEARBIT_API_KEY?: string; // Email enrichment

			// Trusted Execution Environment (TEE) Configuration
			// AWS Nitro Enclaves
			AWS_REGION?: string;
			AWS_ACCESS_KEY_ID?: string;
			AWS_SECRET_ACCESS_KEY?: string;
			AWS_ACCOUNT_ID?: string;
			AWS_NITRO_INSTANCE_TYPE?: string;
			AWS_VPC_ID?: string;
			AWS_SUBNET_ID?: string;
			AWS_SECURITY_GROUP_IDS?: string;
			AWS_IAM_INSTANCE_PROFILE?: string;
			AWS_ENCLAVE_BUCKET?: string;

			// Google Cloud Confidential Computing
			GCP_REGION?: string;
			GCP_PROJECT_ID?: string;
			GCP_SERVICE_ACCOUNT_EMAIL?: string;
			GCP_WORKLOAD_IDENTITY_POOL_ID?: string;
			GCP_WORKLOAD_IDENTITY_PROVIDER_ID?: string;

			// Azure Confidential Computing (commented out - not yet implemented)
			AZURE_SUBSCRIPTION_ID?: string;
			AZURE_RESOURCE_GROUP?: string;
			AZURE_REGION?: string;

			// Logging and Monitoring
			LOG_LEVEL?: string;
		}
	}
}

export {};
