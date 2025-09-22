/**
 * CWC (Congressional Web Contact) API Type Definitions
 * Based on Senate CWC XML API Documentation
 */

export interface CWCDeliveryAgent {
	DeliveryAgentId: string;
	DeliveryAgentName: string;
	DeliveryAgentContact: string;
	DeliveryAgentAcknowledgementEmail: string;
	DeliveryAgentAcknowledgement: 'Y' | 'N';
}

export interface CWCRecipient {
	MemberOffice: string;
	IsResponseRequested: 'Y' | 'N';
	Newsletter: 'Y' | 'N';
}

export interface CWCConstituent {
	Prefix?: string;
	FirstName: string;
	MiddleName?: string;
	LastName: string;
	Suffix?: string;
	Title?: string;
	OrganizationName?: string;
	Address?: string;
	City: string;
	StateAbbreviation: string;
	Zip: string;
	Zip4?: string;
	Phone?: string;
	PhoneType?: 'HOME' | 'WORK' | 'MOBILE';
	Email: string;
	EmailType?: 'HOME' | 'WORK';
}

export interface CWCMessage {
	MessageId: string;
	Subject: string;
	MessageText: string;
	Topic?: string;
	BillCongress?: string;
	BillTypeAbbreviation?: string;
	BillNumber?: string;
}

export interface CWCCampaign {
	CampaignId: string;
	OrganizationName?: string;
	OrganizationURL?: string;
}

/**
 * Complete CWC XML Message Structure
 */
export interface CWCXMLMessage {
	DeliveryAgent: CWCDeliveryAgent;
	Recipient: CWCRecipient;
	Constituent: CWCConstituent;
	Message: CWCMessage;
	Campaign: CWCCampaign;
}

/**
 * Input data structure from Communiqué system
 */
export interface CommuniqueMessageInput {
	template: {
		id: string;
		title: string;
		message_body: string;
		category?: string;
		slug: string;
	};
	user: {
		id: string;
		name: string | null;
		email: string;
		// Address  fields will be populated by address verification
		address?: {
			address1: string;
			address2?: string;
			city: string;
			state: string;
			zip: string;
			zip4?: string;
		};
		phone?: string;
	};
	personalConnection?: string;
	recipientOffice: string; // Congressional office identifier
}

/**
 * Environment configuration for CWC adapter
 */
export interface CWCEnvironmentConfig {
	CWC_API_KEY: string;
	CWC_CAMPAIGN_ID: string;
	CWC_DELIVERY_AGENT_ID: string;
	CWC_DELIVERY_AGENT_NAME: string;
	CWC_DELIVERY_AGENT_CONTACT: string;
	CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL: string;
	CWC_DELIVERY_AGENT_ACK: 'Y' | 'N';
}
