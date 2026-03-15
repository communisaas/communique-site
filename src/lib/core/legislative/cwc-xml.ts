/**
 * CWC XML Generator
 *
 * Generates XML payloads for the US CWC (Communicating With Congress) system.
 * Both House and Senate use the same RELAX NG schema (CWC v2.0).
 * House has additional required fields (Organization, AddressValidation, etc.).
 *
 * This is the only US-specific module — other country adapters would have
 * their own payload generators.
 */

import type { CwcTemplate as Template } from '$lib/types/template';

interface UserRepresentative {
	bioguideId: string;
	name: string;
	party: string;
	state: string;
	district: string;
	chamber: 'house' | 'senate';
	officeCode: string;
}

interface UserAddress {
	street: string;
	city: string;
	state: string;
	zip: string;
}

interface CWCUser {
	id: string;
	name: string;
	email: string;
	phone?: string;
	address: UserAddress;
	representatives: {
		house: UserRepresentative;
		senate: UserRepresentative[];
	};
}

export interface CWCMessage {
	template: Template;
	user: CWCUser;
	_targetRep: UserRepresentative;
	personalizedMessage?: string;
}

/** Delivery agent configuration — sourced from env vars by the caller. */
export interface DeliveryAgentConfig {
	name: string;
	email: string;
	contactName: string;
	contactEmail: string;
	contactPhone: string;
	/** Organization name (House CWC requires this in Delivery block). */
	organization: string;
	/** Brief org description (House CWC requires OrganizationAbout). */
	organizationAbout: string;
}

/** Build delivery agent config from env vars, with sensible defaults. */
function getDefaultAgent(): DeliveryAgentConfig {
	return {
		name: process.env.CWC_DELIVERY_AGENT_NAME || 'Commons',
		email: process.env.CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL || process.env.CWC_DELIVERY_AGENT_ACK_EMAIL || 'noreply@commons.email',
		contactName: process.env.CWC_DELIVERY_AGENT_CONTACT_NAME || process.env.CWC_DELIVERY_AGENT_CONTACT || 'Commons Support',
		contactEmail: process.env.CWC_DELIVERY_AGENT_CONTACT_EMAIL || 'hello@commons.email',
		contactPhone: process.env.CWC_DELIVERY_AGENT_CONTACT_PHONE || '555-123-4567',
		organization: process.env.CWC_ORGANIZATION_NAME || 'Commons Platform',
		organizationAbout: process.env.CWC_ORGANIZATION_ABOUT || 'Civic engagement platform'
	};
}

/** Build Senate-specific delivery agent config. Senate uses different registered name. */
function getSenateAgent(): DeliveryAgentConfig {
	const base = getDefaultAgent();
	return {
		...base,
		name: process.env.CWC_SENATE_DELIVERY_AGENT_NAME || base.name,
		email: process.env.CWC_SENATE_ACK_EMAIL || base.email
	};
}

export class CWCXmlGenerator {
	/**
	 * Generate proper CWC office code from representative data.
	 * House: H{STATE}{DISTRICT} (e.g., HCA13)
	 * Senate: SOAPBox office code (e.g., SCA03) — must come from rep.officeCode
	 *         (sourced from Shadow Atlas cwc_code or SOAPBox active_offices endpoint)
	 */
	static generateOfficeCode(rep: UserRepresentative): string {
		if (rep.chamber === 'senate') {
			return rep.officeCode || rep.bioguideId;
		}
		const state = rep.state.toUpperCase();
		const district = rep.district.padStart(2, '0');
		return `H${state}${district}`;
	}

	/**
	 * Generate CWC XML — routes to chamber-specific generator.
	 */
	static generateUserAdvocacyXML(message: CWCMessage, agent?: DeliveryAgentConfig): string {
		if (message._targetRep.chamber === 'senate') {
			return this.generateSenateXML(message, agent);
		}
		return this.generateHouseXML(message, agent);
	}

	/**
	 * Generate House CWC XML (RELAX NG schema — same as Senate with additional required fields).
	 */
	static generateHouseXML(message: CWCMessage, agent?: DeliveryAgentConfig): string {
		const a = agent || getDefaultAgent();
		const { template, user, _targetRep, personalizedMessage } = message;
		const deliveryId = this.generateDeliveryId(user.id, template.id, _targetRep.bioguideId);
		const deliveryDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
		const [firstName, ...lastNameParts] = (user.name || 'Constituent').split(' ');
		const lastName = lastNameParts.join(' ') || 'User';
		const topics = this.generateLibraryOfCongressTopics(template.title || '');
		const phone = user.phone ? this.formatPhoneNumber(user.phone) : '555-123-4567';

		return `<?xml version="1.0" ?>
<CWC>
    <CWCVersion>2.0</CWCVersion>
    <Delivery>
        <DeliveryId>${deliveryId}</DeliveryId>
        <DeliveryDate>${deliveryDate}</DeliveryDate>
        <DeliveryAgent>${this.escapeXML(a.name)}</DeliveryAgent>
        <DeliveryAgentAckEmailAddress>${this.escapeXML(a.email)}</DeliveryAgentAckEmailAddress>
        <DeliveryAgentContact>
            <DeliveryAgentContactName>${this.escapeXML(a.contactName)}</DeliveryAgentContactName>
            <DeliveryAgentContactEmail>${this.escapeXML(a.contactEmail)}</DeliveryAgentContactEmail>
            <DeliveryAgentContactPhone>${this.escapeXML(a.contactPhone)}</DeliveryAgentContactPhone>
        </DeliveryAgentContact>
        <Organization>${this.escapeXML(a.organization)}</Organization>
        <OrganizationContact>
            <OrganizationContactName>${this.escapeXML(a.contactName)}</OrganizationContactName>
            <OrganizationContactEmail>${this.escapeXML(a.contactEmail)}</OrganizationContactEmail>
            <OrganizationContactPhone>${this.escapeXML(a.contactPhone)}</OrganizationContactPhone>
        </OrganizationContact>
        <OrganizationAbout>${this.escapeXML(a.organizationAbout)}</OrganizationAbout>
        <CampaignId>${(template.id || 'commons').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}</CampaignId>
    </Delivery>
    <Recipient>
        <MemberOffice>${this.generateOfficeCode(_targetRep)}</MemberOffice>
        <IsResponseRequested>N</IsResponseRequested>
        <NewsletterOptIn>N</NewsletterOptIn>
    </Recipient>
    <Constituent>
        <Prefix>Mr.</Prefix>
        <FirstName>${this.escapeXML(firstName)}</FirstName>
        <LastName>${this.escapeXML(lastName)}</LastName>
        <Address1>${this.escapeXML(user.address.street)}</Address1>
        <City>${this.escapeXML(user.address.city)}</City>
        <StateAbbreviation>${this.escapeXML(user.address.state)}</StateAbbreviation>
        <Zip>${this.escapeXML(user.address.zip)}</Zip>
        <Phone>${this.escapeXML(phone)}</Phone>
        <AddressValidation>Y</AddressValidation>
        <Email>${this.escapeXML(user.email)}</Email>
        <EmailValidation>Y</EmailValidation>
    </Constituent>
    <Message>
        <Subject>${this.escapeXML(template.title || 'Legislative Communication')}</Subject>
        <LibraryOfCongressTopics>
            ${topics.map((topic) => `<LibraryOfCongressTopic>${topic}</LibraryOfCongressTopic>`).join('\n            ')}
        </LibraryOfCongressTopics>
        <ProOrCon>Pro</ProOrCon>
        <OrganizationStatement>${this.escapeXML(template.title || 'Constituent message')}</OrganizationStatement>
        <ConstituentMessage>${this.escapeXML(personalizedMessage || template.message_body || '')}</ConstituentMessage>
    </Message>
</CWC>`;
	}

	/**
	 * Generate Senate-specific CWC XML (RELAX NG schema).
	 */
	static generateSenateXML(message: CWCMessage, agent?: DeliveryAgentConfig): string {
		const a = agent || getSenateAgent();
		const { template, user, _targetRep, personalizedMessage } = message;
		const deliveryId = this.generateDeliveryId(user.id, template.id, _targetRep.bioguideId);
		const deliveryDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
		const [firstName, ...lastNameParts] = (user.name || 'Constituent').split(' ');
		const lastName = lastNameParts.join(' ') || 'User';
		const topics = this.generateLibraryOfCongressTopics(template.title || '');

		return `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <CWCVersion>2.0</CWCVersion>
    <Delivery>
        <DeliveryId>${deliveryId}</DeliveryId>
        <DeliveryDate>${deliveryDate}</DeliveryDate>
        <DeliveryAgent>${this.escapeXML(a.name)}</DeliveryAgent>
        <DeliveryAgentAckEmailAddress>${this.escapeXML(a.email)}</DeliveryAgentAckEmailAddress>
        <DeliveryAgentContact>
            <DeliveryAgentContactName>${this.escapeXML(a.contactName)}</DeliveryAgentContactName>
            <DeliveryAgentContactEmail>${this.escapeXML(a.contactEmail)}</DeliveryAgentContactEmail>
            <DeliveryAgentContactPhone>${this.escapeXML(a.contactPhone)}</DeliveryAgentContactPhone>
        </DeliveryAgentContact>
        <CampaignId>${(template.id || 'commons').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}</CampaignId>
    </Delivery>
    <Recipient>
        <MemberOffice>${this.generateOfficeCode(_targetRep)}</MemberOffice>
        <IsResponseRequested>Y</IsResponseRequested>
        <NewsletterOptIn>N</NewsletterOptIn>
    </Recipient>
    <Constituent>
        <Prefix>Mr.</Prefix>
        <FirstName>${this.escapeXML(firstName)}</FirstName>
        <LastName>${this.escapeXML(lastName)}</LastName>
        <Address1>${this.escapeXML(user.address.street)}</Address1>
        <City>${this.escapeXML(user.address.city)}</City>
        <StateAbbreviation>${this.escapeXML(user.address.state)}</StateAbbreviation>
        <Zip>${this.escapeXML(user.address.zip)}</Zip>
        <Email>${this.escapeXML(user.email)}</Email>
    </Constituent>
    <Message>
        <Subject>${this.escapeXML(template.title || 'Legislative Communication')}</Subject>
        <LibraryOfCongressTopics>
            ${topics.map((topic) => `<LibraryOfCongressTopic>${topic}</LibraryOfCongressTopic>`).join('\n            ')}
        </LibraryOfCongressTopics>
        <ConstituentMessage>${this.escapeXML(personalizedMessage || template.message_body || '')}</ConstituentMessage>
    </Message>
</CWC>`;
	}

	/** Generate unique delivery ID for Senate (32-char lowercase hex, UUID sans hyphens). */
	static generateDeliveryId(_userId: string, _templateId: string, _repBioguideId: string): string {
		return crypto.randomUUID().replace(/-/g, '');
	}

	/** Generate unique message ID for CWC submission. */
	static generateMessageId(userId: string, templateId: string, repBioguideId: string): string {
		const timestamp = Date.now();
		const hash = this.simpleHash(`${userId}-${templateId}-${repBioguideId}-${timestamp}`);
		return `CWC-${templateId.substring(0, 6)}-${hash}`;
	}

	/** Generate integrity hash for duplicate prevention. */
	static generateIntegrityHash(userId: string, templateId: string, repBioguideId: string): string {
		const today = new Date().toISOString().split('T')[0];
		return this.simpleHash(`${userId}:${templateId}:${repBioguideId}:${today}`);
	}

	/** Format phone number to XXX-XXX-XXXX pattern. */
	static formatPhoneNumber(phone: string): string {
		const digits = phone.replace(/\D/g, '');
		if (digits.length === 10) {
			return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
		}
		return '555-123-4567';
	}

	/** Generate Library of Congress topics from title keywords. */
	static generateLibraryOfCongressTopics(title: string): string[] {
		const t = title.toLowerCase();
		const topics: string[] = [];
		if (t.includes('health') || t.includes('medicare') || t.includes('medicaid')) topics.push('Health');
		if (t.includes('environment') || t.includes('climate') || t.includes('pollution')) topics.push('Environmental Protection');
		if (t.includes('education') || t.includes('school') || t.includes('student')) topics.push('Education');
		if (t.includes('economy') || t.includes('jobs') || t.includes('employment')) topics.push('Labor and Employment');
		if (t.includes('immigration') || t.includes('border')) topics.push('Immigration');
		if (t.includes('tax') || t.includes('budget')) topics.push('Taxation');
		if (t.includes('civil rights') || t.includes('equality') || t.includes('discrimination')) topics.push('Civil Rights and Liberties, Minority Issues');
		if (topics.length === 0) topics.push('Government Operations and Politics');
		return topics;
	}

	static simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36).substring(0, 8);
	}

	static escapeXML(str: string): string {
		return str.replace(/[<>&'"]/g, (char) => {
			switch (char) {
				case '<': return '&lt;';
				case '>': return '&gt;';
				case '&': return '&amp;';
				case '"': return '&quot;';
				case "'": return '&#39;';
				default: return char;
			}
		});
	}

	/** Basic XML validation — checks required CWC RELAX NG elements. */
	static validateXML(xml: string): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Both House and Senate use the same RELAX NG schema
		for (const el of ['<CWC>', '<CWCVersion>', '<DeliveryId>', '<DeliveryAgent>', '<Constituent>', '<Message>', '<MemberOffice>']) {
			if (!xml.includes(el)) errors.push(`Missing required CWC element: ${el}`);
		}

		return { valid: errors.length === 0, errors };
	}

	/** Determine delivery method based on template configuration. */
	static getDeliveryMethod(template: Template): 'cwc' | 'email' | 'hybrid' {
		const config = template.delivery_config as Record<string, unknown>;
		if (config?.method === 'direct_email') return 'email';
		if (config?.method === 'cwc_only') return 'cwc';
		if (config?.method === 'hybrid') return 'hybrid';
		return 'cwc';
	}

	/** Generate preview XML with mock data (for testing/debugging). */
	static generatePreviewXML(template: Template): string {
		const mockRep = {
			bioguideId: 'W000825',
			name: 'Jennifer Wexton',
			party: 'Democratic',
			state: 'VA',
			district: '01',
			chamber: 'house' as const,
			officeCode: 'HVA01'
		};

		return this.generateUserAdvocacyXML({
			template,
			user: {
				id: 'preview-user',
				name: 'Jane Doe',
				email: 'jane.doe@example.com',
				phone: '+1-555-123-4567',
				address: { street: '123 Main Street', city: 'Arlington', state: 'VA', zip: '22201' },
				representatives: {
					house: mockRep,
					senate: [{
						bioguideId: 'P000145',
						name: 'Alex Padilla',
						party: 'Democratic',
						state: 'CA',
						district: '00',
						chamber: 'senate' as const,
						officeCode: 'SCA03'
					}]
				}
			},
			_targetRep: mockRep
		});
	}
}

/** @deprecated Use CWCXmlGenerator */
export const CWCGenerator = CWCXmlGenerator;
