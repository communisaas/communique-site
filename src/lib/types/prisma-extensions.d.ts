import type {
	template_campaign as TemplateCampaign,
	user_representatives as _UserRepresentatives,
	representative as _Representative
} from '@prisma/client';

declare module '@prisma/client' {
	interface template {
		template_campaign?: TemplateCampaign[];
	}

	interface user {
		coordinates?: unknown;
		preferences?: unknown;
	}
}

// Export empty object to make this a module
export {};
