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
import type { Template } from '$lib/types/template';
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
		} catch {
			console.error('Error occurred');
			return [];
		}
	}

	async validateRepresentative(_representative: Representative): Promise<boolean> {
		if (!_representative.bioguide_id) return false;

		try {
			const userReps = {
				house: {
					bioguide_id: _representative.bioguide_id,
					name: _representative.name,
					party: _representative.party || 'Unknown',
					state: 'US', // Default since state not available on Representative
					district: '01', // Default since district not available on Representative
					chamber: 'house' as const,
					office_code: _representative.external_ids?.cwc_office_code || ''
				},
				senate: [
					{
						bioguide_id: _representative.bioguide_id,
						name: _representative.name,
						party: _representative.party || 'Unknown',
						state: 'US', // Default since state not available on Representative
						district: '00',
						chamber: 'senate' as const,
						office_code: _representative.external_ids?.cwc_office_code || ''
					}
				],
				district: { district: '01', state: 'US' } // Default values as district info not available on Representative
			};

			const validation = await addressLookupService.validateReps(userReps);
			return validation.valid;
		} catch {
			return false;
		}
	}

	async deliverMessage(request: DeliveryRequest): Promise<DeliveryResult> {
		try {
			// Convert to CWC format
			const congressionalOffice: CongressionalOffice = {
				bioguideId: request._representative.bioguide_id || '',
				name: request._representative.name,
				chamber: this.getChamber(request.office) as 'house' | 'senate',
				officeCode: request._representative.external_ids?.cwc_office_code || '',
				state: request.user.address?.state || '',
				district: this.getDistrictFromRepresentative(request._representative),
				party: request._representative.party || 'Unknown'
			};

			const templateForSubmission: Template = {
				id: request.template.id,
				slug: `template-${request.template.id}`,
				title: 'Congressional Message',
				description: 'Message to Congress',
				category: 'advocacy',
				type: 'advocacy',
				deliveryMethod: 'cwc',
				subject: request.template.title,
				message_body: request.personalized_message,
				delivery_config: {},
				cwc_config: {},
				recipient_config: {},
				metrics: {},
				status: 'active',
				is_public: true,
				applicable_countries: ['US'],
				specific_locations: [],
				preview: request.personalized_message.substring(0, 200)
			};

			let submissionResult;
			if (congressionalOffice.chamber === 'senate') {
				submissionResult = await cwcClient.submitToSenate(
					templateForSubmission,
					{
						id: request.user.id,
						name: request.user.name || 'Anonymous User',
						email: request.user.email,
						street: request.user.address?.street,
						city: request.user.address?.city,
						state: request.user.address?.state,
						zip: request.user.address?.postal_code
					},
					congressionalOffice,
					request.personalized_message
				);
			} else {
				submissionResult = await cwcClient.submitToHouse(
					templateForSubmission,
					{
						id: request.user.id,
						name: request.user.name || 'Anonymous User',
						email: request.user.email,
						street: request.user.address?.street,
						city: request.user.address?.city,
						state: request.user.address?.state,
						zip: request.user.address?.postal_code
					},
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
					_representative: request._representative.name
				}
			};
		} catch {
			return {
				success: false,
				error: 'CWC submission failed',
				metadata: {
					provider: 'CWC',
					_representative: request._representative.name
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

	private getChamber(office: Office): 'house' | 'senate' {
		return office.id.includes('house') ? 'house' : 'senate';
	}

	private getDistrictFromRepresentative(rep: Representative): string {
		if (rep.office_id.includes('senate')) return '00';
		return rep.office_id.split('-').pop() || '01';
	}
}
