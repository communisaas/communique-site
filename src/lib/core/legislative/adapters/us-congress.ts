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
import type { CongressionalOffice } from '$lib/core/congress/cwc-client';
import type { Jurisdiction, Chamber } from '../models';
import { addressLookupService } from '$lib/core/congress/address-lookup';
import { cwcClient } from '$lib/core/congress/cwc-client';

export class USCongressAdapter extends LegislativeAdapter {
	readonly country_code = 'US';
	readonly name = 'United States Congress';
	readonly supported_methods = ['email', 'form', 'api'];

	constructor(private cwcApiKey: string) {
		super();
	}

	async getSystemInfo(): Promise<LegislativeSystem> {
		return {
			country_code: 'US',
			name: 'United States Congress',
			type: 'congressional',
			chambers: [
				{
					id: 'us-house',
					jurisdiction_id: 'us-federal',
					name: 'House of Representatives',
					type: 'lower',
					seat_count: 435,
					term_length: 2,
					external_ids: { cwc: 'house' }
				},
				{
					id: 'us-senate',
					jurisdiction_id: 'us-federal',
					name: 'Senate',
					type: 'upper',
					seat_count: 100,
					term_length: 6,
					external_ids: { cwc: 'senate' }
				}
			],
			primary_language: 'en',
			supported_languages: ['en', 'es']
		};
	}

	async getCapabilities(): Promise<DeliveryCapability> {
		return {
			country_code: 'US',
			methods: ['form', 'api'],
			tier: 2,
			provider: 'CWC',
			config: {
				api_key: this.cwcApiKey ? 'configured' : 'missing',
				base_url: 'https://cwc.house.gov'
			}
		};
	}

	async lookupRepresentativesByAddress(address: Address): Promise<Representative[]> {
		try {
			// Use existing address lookup service

			const properAddress = {
				street: address.street || '',
				city: address.city || '',
				state: address.state || '',
				zip: address.postal_code || ''
			};

			const userReps = await addressLookupService.lookupRepsByAddress(properAddress);

			return [
				{
					id: `us-house-${userReps.district.state}-${userReps.district.district}`,
					office_id: `us-house-${userReps.district.state}-${userReps.district.district}`,
					name: userReps.house.name,
					party: userReps.house.party,
					bioguide_id: userReps.house.bioguide_id,
					external_ids: {
						cwc_office_code: userReps.house.office_code,
						bioguide: userReps.house.bioguide_id
					},
					is_current: true
				},
				...userReps.senate.map((senator) => ({
					id: `us-senate-${senator.bioguide_id}`,
					office_id: `us-senate-${senator.state}`,
					name: senator.name,
					party: senator.party,
					bioguide_id: senator.bioguide_id,
					external_ids: {
						cwc_office_code: senator.office_code,
						bioguide: senator.bioguide_id
					},
					is_current: true
				}))
			];
		} catch (_error) {
			console.error('US Congressional lookup failed:', _error);
			return [];
		}
	}

	async validateRepresentative(representative: Representative): Promise<boolean> {
		if (!representative.bioguide_id) return false;

		try {
			const userReps = {
				house: { bioguide_id: representative.bioguide_id, name: representative.name },
				senate: [{ bioguide_id: representative.bioguide_id, name: representative.name }]
			};

			const validation = await addressLookupService.validateReps(userReps as any);
			return validation.valid;
		} catch {
			return false;
		}
	}

	async deliverMessage(request: DeliveryRequest): Promise<DeliveryResult> {
		try {

			// Convert to CWC format
			const congressionalOffice: CongressionalOffice = {
				bioguideId: request.representative.bioguide_id || '',
				name: request.representative.name,
				chamber: this.getChamberFromOffice(request.office) as 'house' | 'senate',
				officeCode: request.representative.external_ids?.cwc_office_code || '',
				state: request.user.address?.state || '',
				district: this.getDistrictFromRepresentative(request.representative),
				party: request.representative.party || 'Unknown'
			};

			const templateForSubmission = {
				id: request.template.id,
				subject: request.template.subject,
				message_body: request.personalized_message,
				delivery_config: {},
				cwc_config: {}
			};

			let submissionResult;
			if (congressionalOffice.chamber === 'senate') {
				submissionResult = await cwcClient.submitToSenate(
					templateForSubmission as any,
					request.user as any,
					congressionalOffice,
					request.personalized_message
				);
			} else {
				submissionResult = await cwcClient.submitToHouse(
					templateForSubmission as any,
					request.user as any,
					congressionalOffice,
					request.personalized_message
				);
			}

			return {
				success: submissionResult.success,
				message_id: submissionResult.messageId,
				error: submissionResult.error,
				metadata: {
					provider: 'CWC',
					chamber: congressionalOffice.chamber,
					representative: request.representative.name
				}
			};
		} catch (_error) {
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'CWC submission failed',
				metadata: {
					provider: 'CWC',
					representative: request.representative.name
				}
			};
		}
	}

	formatRepresentativeName(rep: Representative): string {
		const chamber = rep.office_id.includes('house') ? 'Rep.' : 'Sen.';
		return `${chamber} ${rep.name}`;
	}

	formatOfficeTitle(office: Office): string {
		if (office.id.includes('house')) {
			const district = office.id.split('-').pop();
			const state = office.id.split('-')[2];
			return `U.S. Representative for ${state}-${district}`;
		} else if (office.id.includes('senate')) {
			const state = office.id.split('-').pop();
			return `U.S. Senator from ${state}`;
		}
		return office.title;
	}

	private getChamberFromOffice(office: Office): 'house' | 'senate' {
		return office.id.includes('house') ? 'house' : 'senate';
	}

	private getDistrictFromRepresentative(rep: Representative): string {
		if (rep.office_id.includes('senate')) return '00';
		return rep.office_id.split('-').pop() || '01';
	}
}
