import { LegislativeAdapter } from './base';
import type {
	Address,
	DeliveryRequest,
	DeliveryResult,
	Representative,
	LegislativeSystem,
	DeliveryCapability,
	Office
} from './base';

export class GenericLegislativeAdapter extends LegislativeAdapter {
	readonly country_code: string;
	readonly name: string;
	readonly supported_methods = ['none'];

	constructor(countryCode: string, countryName: string) {
		super();
		this.country_code = countryCode;
		this.name = `${countryName} Legislative System`;
	}

	async getSystemInfo(): Promise<LegislativeSystem> {
		return {
			country_code: this.country_code,
			name: this.name,
			type: 'other',
			chambers: [],
			primary_language: 'en',
			supported_languages: ['en']
		};
	}

	async getCapabilities(): Promise<DeliveryCapability> {
		return {
			country_code: this.country_code,
			methods: [],
			tier: 3,
			provider: 'None',
			config: {
				note: 'No delivery methods available for this country'
			}
		};
	}

	async lookupRepresentativesByAddress(address: Address): Promise<Representative[]> {
		// Generic adapter cannot look up representatives
		console.warn(`No representative lookup available for ${this.country_code}`);
		return [];
	}

	async validateRepresentative(representative: Representative): Promise<boolean> {
		// Cannot validate without specific country integration
		return false;
	}

	async deliverMessage(request: DeliveryRequest): Promise<DeliveryResult> {
		return {
			success: false,
			error: `No delivery method available for ${this.country_code}`,
			metadata: {
				provider: 'Generic',
				country: this.country_code,
				representative: request.representative.name
			}
		};
	}

	formatRepresentativeName(rep: Representative): string {
		return rep.name;
	}

	formatOfficeTitle(office: Office): string {
		return office.title || 'Representative';
	}
}
