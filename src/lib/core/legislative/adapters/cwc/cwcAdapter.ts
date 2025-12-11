/**
 * CWC (Congressional Web Contact) Adapter
 * Implements legislative adapter for certified congressional message delivery
 */

import { LegislativeAdapter } from '../base.js';
import type {
	DeliveryRequest,
	DeliveryResult,
	Address,
	LegislativeSystem,
	DeliveryCapability,
	Representative,
	Office
} from '../base.js';
import type { CWCEnvironmentConfig, CommuniqueMessageInput } from './types.js';
import { CWCFieldMapper } from './fieldMapper.js';
import { CWCXMLBuilder } from './xmlBuilder.js';
import type { LegislativeProvider, Representative as ProviderRepresentative } from '../../types.js';

export class CWCAdapter extends LegislativeAdapter implements LegislativeProvider {
	readonly country_code = 'US';
	readonly name = 'Congressional Web Contact (CWC)';
	readonly supported_methods = ['certified_delivery'];

	private fieldMapper: CWCFieldMapper;
	private _apiKey: string;

	constructor(config: CWCEnvironmentConfig) {
		super();
		this.fieldMapper = new CWCFieldMapper(config);
		this._apiKey = config.CWC_API_KEY;
	}

	/**
	 * Get system information
	 */
	async getSystemInfo(): Promise<LegislativeSystem> {
		return {
			country_code: 'US',
			name: 'United States Congress',
			type: 'congressional',
			description: 'US Congressional Web Contact System for certified message delivery',
			chambers: [
				{
					id: 'us-house',
					jurisdiction_id: 'us-federal',
					name: 'House of Representatives',
					type: 'lower',
					code: 'HOUSE',
					seat_count: 435,
					total_seats: 435
				},
				{
					id: 'us-senate',
					jurisdiction_id: 'us-federal',
					name: 'Senate',
					type: 'upper',
					code: 'SENATE',
					seat_count: 100,
					total_seats: 100
				}
			]
		};
	}

	/**
	 * Get delivery capabilities
	 */
	async getCapabilities(): Promise<DeliveryCapability> {
		return {
			certified_delivery: true,
			delivery_receipt: true,
			bulk_delivery: true,
			message_formatting: ['plain_text', 'xml'],
			address_validation: false, // We skip this due to USPS licensing requirements
			personalization: true
		};
	}

	/**
	 * Look up representatives by address
	 * This would typically integrate with existing congressional district lookup
	 */
	async lookupRepresentativesByAddress(_address: Address): Promise<Representative[]> {
		// TODO: Integrate with existing congressional district lookup system
		// For now, this is a placeholder that would be implemented using
		// the existing database and district mapping logic
		throw new Error(
			'Representative lookup not yet implemented - integrate with existing district lookup'
		);
	}

	/**
	 * Validate _representative
	 */
	async validateRepresentative(_representative: Representative): Promise<boolean> {
		// TODO: Validate against CWC office codes
		// This would check if the _representative has a valid CWC office identifier
		return true; // Placeholder
	}

	/**
	 * Deliver message via CWC API
	 */
	async deliverMessage(request: DeliveryRequest): Promise<DeliveryResult> {
		try {
			// Transform delivery request to CWC format
			const cwcInput: CommuniqueMessageInput = {
				template: {
					id: request.template.id,
					title: request.template.title || '',
					message_body: request.template.message_body,
					slug: `template-${request.template.id}` // Generate slug if needed
				},
				user: {
					id: request.user.id,
					name: request.user.name || '',
					email: request.user.email,
					address: request.user.address
						? {
								address1: request.user.address.street || '',
								city: request.user.address.city || '',
								state: request.user.address.state || '',
								zip: request.user.address.postal_code || ''
							}
						: undefined,
					phone: undefined // TODO: Add phone field to base User interface
				},
				personalConnection: request.personalized_message,
				recipientOffice: this.getOfficeIdentifier(request.office)
			};

			// Map to CWC XML structure
			const cwcMessage = this.fieldMapper.mapToCWCMessage(cwcInput);

			// Build XML
			const xmlMessage = CWCXMLBuilder.buildXMLMessage(cwcMessage);

			// Submit to CWC API
			const result = await this.submitToCWCAPI(xmlMessage);

			return {
				success: result.success,
				message_id: cwcMessage.Message.MessageId,
				metadata: {
					cwc_submission_id: result.submissionId,
					delivery_method: 'certified',
					recipient_office: cwcInput.recipientOffice
				}
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * Format _representative name
	 */
	formatRepresentativeName(rep: Representative): string {
		return `${rep.title || ''} ${rep.name}`.trim();
	}

	/**
	 * Format office title
	 */
	formatOfficeTitle(office: Office): string {
		return office.title || `${office.chamber} Office`;
	}

	// ============================================================================
	// LegislativeProvider Implementation
	// ============================================================================

	/**
	 * Get representatives for a specific address
	 */
	async getRepresentatives(address: {
		street: string;
		city: string;
		state: string;
		zip: string;
	}): Promise<ProviderRepresentative[]> {
		// In a real implementation, this would call the Google Civic Info API or similar
		// For CWC, we might rely on the user providing their rep, or use a separate lookup service
		// Since CWC is just for delivery, we might return empty or throw if we can't lookup
		// But the interface requires it.
		// For now, we'll return an empty array or mock data if needed, but ideally we connect to `src/lib/core/congress/address-lookup.ts`

		// TODO: Connect to address-lookup.ts
		return [];
	}

	/**
	 * Submit a message to a specific representative
	 */
	async submitMessage(
		representative: ProviderRepresentative,
		message: {
			subject: string;
			body: string;
			topic?: string;
		},
		constituent: {
			firstName: string;
			lastName: string;
			email: string;
			address: {
				street: string;
				city: string;
				state: string;
				zip: string;
			};
			phone?: string;
		}
	): Promise<{
		success: boolean;
		confirmationCode?: string;
		error?: string;
	}> {
		try {
			// Map to CWC input
			// We need to construct a CWC-compatible office code from the representative data
			// This is tricky if we don't have the internal office ID.
			// Ideally, the representative object passed here comes from getRepresentatives which should populate it.

			// Construct CWC Office Code (simplified logic)
			const officeCode =
				representative.bioguideId || `HON-${representative.name.replace(/\s+/g, '').toUpperCase()}`;

			const cwcInput: CommuniqueMessageInput = {
				template: {
					id: 'dynamic-submission', // No template ID in this flow?
					title: message.subject,
					message_body: message.body,
					slug: 'dynamic-submission'
				},
				user: {
					id: 'constituent', // Anonymous or transient ID
					name: `${constituent.firstName} ${constituent.lastName}`,
					email: constituent.email,
					address: {
						address1: constituent.address.street,
						city: constituent.address.city,
						state: constituent.address.state,
						zip: constituent.address.zip
					},
					phone: constituent.phone
				},
				personalConnection: '', // Not used in this direct flow?
				recipientOffice: officeCode
			};

			// Map to CWC XML structure
			const cwcMessage = this.fieldMapper.mapToCWCMessage(cwcInput);

			// Build XML
			const xmlMessage = CWCXMLBuilder.buildXMLMessage(cwcMessage);

			// Submit to CWC API
			const result = await this.submitToCWCAPI(xmlMessage);

			return {
				success: result.success,
				confirmationCode: result.submissionId,
				error: result.success ? undefined : 'Submission failed'
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	/**
	 * Get CWC office identifier from office data
	 */
	private getOfficeIdentifier(office: Office): string {
		// TODO: Map office data to CWC office codes
		// This would use the existing congressional office data to determine
		// the appropriate CWC MemberOffice identifier
		return office.cwc_office_code || `OFFICE_${office.id}`;
	}

	/**
	 * Submit XML to CWC API
	 */
	private async submitToCWCAPI(
		xmlMessage: string
	): Promise<{ success: boolean; submissionId?: string }> {
		// TODO: Implement actual CWC API submission
		// This would make an HTTP request to the CWC API endpoint
		// with proper authentication and error handling

		console.log('CWC XML Message:', xmlMessage);

		// Placeholder implementation
		return {
			success: true,
			submissionId: `CWC_${Date.now()}`
		};
	}
}

/**
 * Factory function to create CWC adapter with environment configuration
 */
export function createCWCAdapter(): CWCAdapter {
	const config: CWCEnvironmentConfig = {
		CWC_API_KEY: process.env.CWC_API_KEY || '',
		CWC_CAMPAIGN_ID: process.env.CWC_CAMPAIGN_ID || '',
		CWC_DELIVERY_AGENT_ID: process.env.CWC_DELIVERY_AGENT_ID || '',
		CWC_DELIVERY_AGENT_NAME: process.env.CWC_DELIVERY_AGENT_NAME || '',
		CWC_DELIVERY_AGENT_CONTACT: process.env.CWC_DELIVERY_AGENT_CONTACT || '',
		CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL:
			process.env.CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL || '',
		CWC_DELIVERY_AGENT_ACK: (process.env.CWC_DELIVERY_AGENT_ACK as 'Y' | 'N') || 'Y'
	};

	return new CWCAdapter(config);
}
