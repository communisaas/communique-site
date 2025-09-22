/**
 * CWC Field Mapper
 * Transforms Communiqué data structures to CWC XML format
 */

import type { CWCXMLMessage, CommuniqueMessageInput, CWCEnvironmentConfig } from './types.js';
import { CWCXMLBuilder } from './xmlBuilder.js';

export class CWCFieldMapper {
	private config: CWCEnvironmentConfig;

	constructor(config: CWCEnvironmentConfig) {
		this.config = config;
	}

	/**
	 * Transform Communiqué message data to CWC XML structure
	 */
	mapToCWCMessage(input: CommuniqueMessageInput): CWCXMLMessage {
		return {
			DeliveryAgent: this.buildDeliveryAgent(),
			Recipient: this.buildRecipient(input),
			Constituent: this.buildConstituent(input),
			Message: this.buildMessage(input),
			Campaign: this.buildCampaign()
		};
	}

	/**
	 * Build DeliveryAgent section from environment config
	 */
	private buildDeliveryAgent(): CWCXMLMessage['DeliveryAgent'] {
		return {
			DeliveryAgentId: this.config.CWC_DELIVERY_AGENT_ID,
			DeliveryAgentName: this.config.CWC_DELIVERY_AGENT_NAME,
			DeliveryAgentContact: this.config.CWC_DELIVERY_AGENT_CONTACT,
			DeliveryAgentAcknowledgementEmail: this.config.CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL,
			DeliveryAgentAcknowledgement: this.config.CWC_DELIVERY_AGENT_ACK
		};
	}

	/**
	 * Build Recipient section
	 */
	private buildRecipient(input: CommuniqueMessageInput): CWCXMLMessage['Recipient'] {
		return {
			MemberOffice: input.recipientOffice,
			IsResponseRequested: 'N', // Default: constituents don't expect direct response
			Newsletter: 'N' // Default: no newsletter signup
		};
	}

	/**
	 * Build Constituent section from user data
	 */
	private buildConstituent(input: CommuniqueMessageInput): CWCXMLMessage['Constituent'] {
		const nameParts = this.parseFullName(input.user.name || '');
		const address = input.user.address;

		if (!address) {
			throw new Error('User address is required for CWC message delivery');
		}

		return {
			FirstName: nameParts.firstName,
			MiddleName: nameParts.middleName,
			LastName: nameParts.lastName,
			Address: address.address1,
			City: address.city,
			StateAbbreviation: address.state,
			Zip: address.zip,
			Zip4: address.zip4,
			Phone: input.user.phone,
			Email: input.user.email,
			EmailType: 'HOME' // Default email type
		};
	}

	/**
	 * Build Message section combining organization template and constituent personalization
	 */
	private buildMessage(input: CommuniqueMessageInput): CWCXMLMessage['Message'] {
		// Combine personal connection (constituent message) with template (organization message)
		let messageText = input.template.message_body;

		if (input.personalConnection && input.personalConnection.trim()) {
			// Personal connection as prefix, followed by organization message
			messageText = `${input.personalConnection.trim()}\n\n---\n\n${input.template.message_body}`;
		}

		return {
			MessageId: CWCXMLBuilder.generateMessageId(input.template.id, input.user.id),
			Subject: input.template.title,
			MessageText: messageText,
			Topic: this.mapCategoryToTopic(input.template.category)
		};
	}

	/**
	 * Build Campaign section
	 */
	private buildCampaign(): CWCXMLMessage['Campaign'] {
		return {
			CampaignId: this.config.CWC_CAMPAIGN_ID,
			OrganizationName: this.config.CWC_DELIVERY_AGENT_NAME
		};
	}

	/**
	 * Parse full name into components
	 */
	private parseFullName(fullName: string): {
		firstName: string;
		middleName?: string;
		lastName: string;
	} {
		const parts = fullName.trim().split(/\s+/);

		if (parts.length === 0) {
			throw new Error('User name is required');
		}

		if (parts.length === 1) {
			return {
				firstName: parts[0],
				lastName: parts[0] // Use same name for both if only one provided
			};
		}

		if (parts.length === 2) {
			return {
				firstName: parts[0],
				lastName: parts[1]
			};
		}

		// 3+ parts: first, middle(s), last
		return {
			firstName: parts[0],
			middleName: parts.slice(1, -1).join(' '),
			lastName: parts[parts.length - 1]
		};
	}

	/**
	 * Map template category to CWC topic codes
	 */
	private mapCategoryToTopic(category?: string): string | undefined {
		if (!category) return undefined;

		const topicMap: Record<string, string> = {
			agriculture: 'AGRICULTURE',
			budget: 'BUDGET',
			defense: 'DEFENSE',
			economy: 'ECONOMY',
			education: 'EDUCATION',
			energy: 'ENERGY',
			environment: 'ENVIRONMENT',
			healthcare: 'HEALTH',
			immigration: 'IMMIGRATION',
			infrastructure: 'TRANSPORTATION',
			justice: 'CIVIL_RIGHTS',
			labor: 'LABOR',
			taxation: 'TAXATION',
			technology: 'TECHNOLOGY',
			trade: 'TRADE'
		};

		const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, '');
		return topicMap[normalizedCategory];
	}
}
