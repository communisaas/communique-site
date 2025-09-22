import type {
	LegislativeJurisdiction,
	Office,
	Representative,
	LegislativeSystem,
	DeliveryCapability
} from '../models';

// Re-export types for adapters
export type {
	LegislativeJurisdiction as Jurisdiction,
	Office,
	Representative,
	LegislativeSystem,
	DeliveryCapability
};

export interface Address {
	street?: string;
	city?: string;
	state?: string;
	postal_code?: string;
	country_code: string;
}

export interface LegislativeUser {
	id: string;
	name?: string;
	email: string;
	address?: Address;
}

export interface LegislativeTemplate {
	id: string;
	subject: string;
	message_body: string;
	variables?: Record<string, unknown>;
}

export interface DeliveryRequest {
	template: LegislativeTemplate;
	user: LegislativeUser;
	_representative: Representative;
	office: Office;
	personalized_message: string;
}

export interface DeliveryResult {
	success: boolean;
	message_id?: string;
	error?: string;
	metadata?: Record<string, unknown>;
}

export abstract class LegislativeAdapter {
	abstract readonly country_code: string;
	abstract readonly name: string;
	abstract readonly supported_methods: string[];

	abstract getSystemInfo(): Promise<LegislativeSystem>;
	abstract getCapabilities(): Promise<DeliveryCapability>;

	abstract lookupRepresentativesByAddress(address: Address): Promise<Representative[]>;
	abstract validateRepresentative(_representative: Representative): Promise<boolean>;

	abstract deliverMessage(request: DeliveryRequest): Promise<DeliveryResult>;

	abstract formatRepresentativeName(rep: Representative): string;
	abstract formatOfficeTitle(office: Office): string;
}
