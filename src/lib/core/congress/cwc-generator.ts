import type { Template } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';

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

// CWC-specific User interface
// Address fields come from DeliveryAddress (ephemeral, not stored on User model)
interface User {
	id: string;
	name: string;
	email: string;
	phone?: string; // Optional, from DeliveryAddress
	address: UserAddress; // Ephemeral delivery address
	representatives: {
		house: UserRepresentative;
		senate: UserRepresentative[];
	};
}

interface CWCMessage {
	template: Template;
	user: User;
	_targetRep: UserRepresentative; // Which specific rep to send to
	personalizedMessage?: string; // Custom message to include in the body
}

// Get delivery agent config from environment variables
// IMPORTANT: House and Senate have different registered DeliveryAgent names and emails
// House: Uses CWC_DELIVERY_AGENT_NAME (registered with House CWC vendor program)
// Senate: Uses CWC_SENATE_DELIVERY_AGENT_NAME (Company Legal Name in SOAPBox)
function getDeliveryAgentConfig(chamber: 'house' | 'senate' = 'house') {
	const baseName = process.env.CWC_DELIVERY_AGENT_NAME || 'Communique';
	const senateName = process.env.CWC_SENATE_DELIVERY_AGENT_NAME || baseName;
	const baseAckEmail = process.env.CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL || 'noreply@communi.email';
	const senateAckEmail = process.env.CWC_SENATE_ACK_EMAIL || baseAckEmail;

	return {
		id: process.env.CWC_DELIVERY_AGENT_ID || 'COMMUNIQUE',
		name: chamber === 'senate' ? senateName : baseName,
		contact: process.env.CWC_DELIVERY_AGENT_CONTACT || 'hello@communi.email',
		ackEmail: chamber === 'senate' ? senateAckEmail : baseAckEmail,
		ack: (process.env.CWC_DELIVERY_AGENT_ACK || 'Y') as 'Y' | 'N'
	};
}

// Cache for Senate bioguide → office code mapping
let senateOfficeCodeCache: Map<string, string> | null = null;
let senateOfficeCacheExpiry: number = 0;
const SENATE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Senate office codes from SOAPBox API and create bioguide→officeCode mapping
 * This is needed because Senate uses class-based codes (01, 02, 03) not sequential
 */
async function fetchSenateOfficeCodeMap(): Promise<Map<string, string>> {
	// Return cached if still valid
	if (senateOfficeCodeCache && Date.now() < senateOfficeCacheExpiry) {
		return senateOfficeCodeCache;
	}

	const apiKey = process.env.CWC_API_KEY;
	if (!apiKey) {
		console.warn('[CWC] No Senate API key, using fallback office code generation');
		return new Map();
	}

	try {
		const response = await fetch(
			`https://soapbox.senate.gov/api/active_offices/?apikey=${apiKey}`,
			{ headers: { Accept: 'application/json' } }
		);

		if (!response.ok) {
			console.warn(`[CWC] Failed to fetch Senate offices: ${response.status}`);
			return senateOfficeCodeCache || new Map();
		}

		const offices = (await response.json()) as Array<{ name: string; office_code: string }>;

		// Parse bioguide IDs from name field: "Name [bioguide_id: X000000]"
		const mapping = new Map<string, string>();
		for (const office of offices) {
			const match = office.name.match(/\[bioguide_id:\s*(\w+)\]/);
			if (match) {
				mapping.set(match[1], office.office_code);
			}
		}

		senateOfficeCodeCache = mapping;
		senateOfficeCacheExpiry = Date.now() + SENATE_CACHE_TTL;

		console.log(`[CWC] Cached ${mapping.size} Senate office codes`);
		return mapping;
	} catch (error) {
		console.error('[CWC] Error fetching Senate offices:', error);
		return senateOfficeCodeCache || new Map();
	}
}

export class CWCGenerator {
	/**
	 * Generate proper CWC office code from representative data
	 * House: H{STATE}{DISTRICT} format (e.g., HCA13 for CA-13)
	 * Senate: S{STATE}{CLASS} format where CLASS is 01, 02, or 03 based on seat class
	 *
	 * NOTE: For Senate, use generateOfficeCodeAsync() for accurate codes.
	 * This sync version uses a fallback heuristic.
	 */
	static generateOfficeCode(rep: UserRepresentative): string {
		if (rep.chamber === 'senate') {
			const state = rep.state.toUpperCase();

			// Check if we have cached mapping
			if (senateOfficeCodeCache && senateOfficeCodeCache.has(rep.bioguideId)) {
				return senateOfficeCodeCache.get(rep.bioguideId)!;
			}

			// Fallback: Use first char of bioguide + alphabetical heuristic
			// This is imperfect but better than nothing when cache isn't available
			// Most bioguide IDs start with first letter of last name
			const suffix = rep.bioguideId.charCodeAt(0) % 3 === 0 ? '01' : rep.bioguideId.charCodeAt(0) % 3 === 1 ? '02' : '03';
			console.warn(`[CWC] Using fallback Senate office code for ${rep.bioguideId}: S${state}${suffix}`);
			return `S${state}${suffix}`;
		} else {
			// House uses H{STATE}{DISTRICT} format
			const state = rep.state.toUpperCase();
			const district = rep.district.padStart(2, '0'); // Ensure 2-digit format
			return `H${state}${district}`;
		}
	}

	/**
	 * Generate office code asynchronously with accurate Senate class lookup
	 */
	static async generateOfficeCodeAsync(rep: UserRepresentative): Promise<string> {
		if (rep.chamber === 'senate') {
			const mapping = await fetchSenateOfficeCodeMap();
			if (mapping.has(rep.bioguideId)) {
				return mapping.get(rep.bioguideId)!;
			}
			// Fallback to sync version
			return this.generateOfficeCode(rep);
		}
		return this.generateOfficeCode(rep);
	}

	/**
	 * Preload Senate office code cache
	 * Call this at application startup for accurate Senate codes
	 */
	static async preloadSenateOfficeCodeCache(): Promise<void> {
		await fetchSenateOfficeCodeMap();
	}

	/**
	 * Generate CWC XML for a user's advocacy message
	 * This is the core function used when processing mailto: links
	 *
	 * Both House and Senate use the same CWC 2.0 XML format with slight variations
	 */
	static generateUserAdvocacyXML(message: CWCMessage): string {
		const { template, user, _targetRep, personalizedMessage } = message;

		// Use Senate-specific format if targeting Senate
		if (_targetRep.chamber === 'senate') {
			return this.generateSenateXML(message);
		}

		// House uses CWC 2.0 format (same schema as Senate)
		return this.generateHouseXML(message);
	}

	/**
	 * Generate House-specific CWC XML based on official House CWC 2.0 schema
	 * The House uses the same CWC 2.0 format as Senate
	 */
	static generateHouseXML(message: CWCMessage): string {
		const { template, user, _targetRep, personalizedMessage } = message;
		const config = getDeliveryAgentConfig('house');

		// Generate required IDs and timestamps
		const deliveryId = this.generateDeliveryId(user.id, template.id, _targetRep.bioguideId);
		const deliveryDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format

		// Extract user name parts
		const [firstName, ...lastNameParts] = (user.name || 'Constituent').split(' ');
		const lastName = lastNameParts.join(' ') || 'User';

		// Format phone number to XXX-XXX-XXXX pattern
		const formattedPhone = this.formatPhoneNumber(user.phone || '555-123-4567');

		// Generate Library of Congress topics based on template content
		const topics = this.generateLibraryOfCongressTopics(template.title || '');

		// Official House CWC 2.0 XML format
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <CWCVersion>2.0</CWCVersion>
    <Delivery>
        <DeliveryId>${deliveryId}</DeliveryId>
        <DeliveryDate>${deliveryDate}</DeliveryDate>
        <DeliveryAgent>${this.escapeXML(config.name)}</DeliveryAgent>
        <DeliveryAgentAckEmailAddress>${this.escapeXML(config.ackEmail)}</DeliveryAgentAckEmailAddress>
        <DeliveryAgentContact>
            <DeliveryAgentContactName>${this.escapeXML(config.name)} Support</DeliveryAgentContactName>
            <DeliveryAgentContactEmail>${this.escapeXML(config.contact)}</DeliveryAgentContactEmail>
            <DeliveryAgentContactPhone>555-123-4567</DeliveryAgentContactPhone>
        </DeliveryAgentContact>
        <CampaignId>${template.id || 'communique-campaign'}</CampaignId>
        <Organization>${this.escapeXML(config.name)}</Organization>
        <OrganizationContact>
            <OrganizationContactName>${this.escapeXML(config.name)} Support</OrganizationContactName>
            <OrganizationContactEmail>${this.escapeXML(config.contact)}</OrganizationContactEmail>
            <OrganizationContactPhone>555-123-4567</OrganizationContactPhone>
        </OrganizationContact>
        <OrganizationAbout>Civic engagement platform enabling citizens to communicate with their elected representatives</OrganizationAbout>
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
        <Phone>${formattedPhone}</Phone>
    </Constituent>
    <Message>
        <Subject>${this.escapeXML(template.title || 'Congressional Communication')}</Subject>
        <LibraryOfCongressTopics>
            ${topics.map((topic) => `<LibraryOfCongressTopic>${topic}</LibraryOfCongressTopic>`).join('\n            ')}
        </LibraryOfCongressTopics>
        <ProOrCon>Pro</ProOrCon>
        <OrganizationStatement>${this.escapeXML(template.title || 'Message from constituent')}</OrganizationStatement>
        <ConstituentMessage>${this.escapeXML(personalizedMessage || template.message_body || '')}</ConstituentMessage>
    </Message>
</CWC>`;

		return xml;
	}

	/**
	 * Generate Senate-specific CWC XML based on official Senate RELAX NG schema
	 * Matches exact Senate SOAPBox API requirements
	 */
	static generateSenateXML(message: CWCMessage): string {
		const { template, user, _targetRep, personalizedMessage } = message;
		const config = getDeliveryAgentConfig('senate');

		// Generate required IDs and timestamps
		const deliveryId = this.generateDeliveryId(user.id, template.id, _targetRep.bioguideId);
		const deliveryDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format

		// Extract user name parts
		const [firstName, ...lastNameParts] = (user.name || 'Constituent').split(' ');
		const lastName = lastNameParts.join(' ') || 'User';

		// Format phone number to XXX-XXX-XXXX pattern
		const formattedPhone = this.formatPhoneNumber(user.phone || '555-123-4567');

		// Generate Library of Congress topics based on template content
		const topics = this.generateLibraryOfCongressTopics(template.title || '');

		// Official Senate CWC XML based on RELAX NG schema
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <CWCVersion>2.0</CWCVersion>
    <Delivery>
        <DeliveryId>${deliveryId}</DeliveryId>
        <DeliveryDate>${deliveryDate}</DeliveryDate>
        <DeliveryAgent>${this.escapeXML(config.name)}</DeliveryAgent>
        <DeliveryAgentAckEmailAddress>${this.escapeXML(config.ackEmail)}</DeliveryAgentAckEmailAddress>
        <DeliveryAgentContact>
            <DeliveryAgentContactName>${this.escapeXML(config.name)} Support</DeliveryAgentContactName>
            <DeliveryAgentContactEmail>${this.escapeXML(config.contact)}</DeliveryAgentContactEmail>
            <DeliveryAgentContactPhone>555-123-4567</DeliveryAgentContactPhone>
        </DeliveryAgentContact>
        <CampaignId>${template.id || 'communique-campaign'}</CampaignId>
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
        <Phone>${formattedPhone}</Phone>
    </Constituent>
    <Message>
        <Subject>${this.escapeXML(template.title || 'Congressional Communication')}</Subject>
        <LibraryOfCongressTopics>
            ${topics.map((topic) => `<LibraryOfCongressTopic>${topic}</LibraryOfCongressTopic>`).join('\n            ')}
        </LibraryOfCongressTopics>
        <ConstituentMessage>${this.escapeXML(personalizedMessage || template.message_body || '')}</ConstituentMessage>
    </Message>
</CWC>`;

		return xml;
	}

	/**
	 * Generate CWC XML for all of a user's representatives
	 * Used when template targets "all reps"
	 */
	static generateMultiRepXML(template: Template, user: User): string[] {
		const allReps = [user.representatives.house, ...user.representatives.senate];

		return allReps.map((rep) =>
			this.generateUserAdvocacyXML({
				template,
				user,
				_targetRep: rep
			})
		);
	}

	/**
	 * Generate unique delivery ID for Senate submissions (must be valid token format)
	 */
	static generateDeliveryId(userId: string, templateId: string, repBioguideId: string): string {
		// Senate requires numeric format only, max 10 digits
		const timestamp = Date.now().toString().slice(-8);
		return `${timestamp}`;
	}

	/**
	 * Generate unique message ID for CWC submission
	 */
	static generateMessageId(userId: string, templateId: string, repBioguideId: string): string {
		const timestamp = Date.now();
		const hash = this.simpleHash(`${userId}-${templateId}-${repBioguideId}-${timestamp}`);
		return `CWC-${templateId.substring(0, 6)}-${hash}`;
	}

	/**
	 * Generate integrity hash for duplicate prevention
	 */
	static generateIntegrityHash(userId: string, templateId: string, repBioguideId: string): string {
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const dataString = `${userId}:${templateId}:${repBioguideId}:${today}`;
		return this.simpleHash(dataString);
	}

	/**
	 * Format phone number to XXX-XXX-XXXX pattern
	 */
	static formatPhoneNumber(phone: string): string {
		// Remove all non-digits
		const digits = phone.replace(/\D/g, '');

		// If we have 10 digits, format as XXX-XXX-XXXX
		if (digits.length === 10) {
			return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
		}

		// Default fallback
		return '555-123-4567';
	}

	/**
	 * Generate Library of Congress topics based on template title/content
	 */
	static generateLibraryOfCongressTopics(title: string): string[] {
		const titleLower = title.toLowerCase();
		const topics: string[] = [];

		// Simple keyword matching for common topics
		if (
			titleLower.includes('health') ||
			titleLower.includes('medicare') ||
			titleLower.includes('medicaid')
		) {
			topics.push('Health');
		}
		if (
			titleLower.includes('environment') ||
			titleLower.includes('climate') ||
			titleLower.includes('pollution')
		) {
			topics.push('Environmental Protection');
		}
		if (
			titleLower.includes('education') ||
			titleLower.includes('school') ||
			titleLower.includes('student')
		) {
			topics.push('Education');
		}
		if (
			titleLower.includes('economy') ||
			titleLower.includes('jobs') ||
			titleLower.includes('employment')
		) {
			topics.push('Labor and Employment');
		}
		if (titleLower.includes('immigration') || titleLower.includes('border')) {
			topics.push('Immigration');
		}
		if (titleLower.includes('tax') || titleLower.includes('budget')) {
			topics.push('Taxation');
		}
		if (
			titleLower.includes('civil rights') ||
			titleLower.includes('equality') ||
			titleLower.includes('discrimination')
		) {
			topics.push('Civil Rights and Liberties, Minority Issues');
		}

		// Default topic if none matched
		if (topics.length === 0) {
			topics.push('Government Operations and Politics');
		}

		return topics;
	}

	/**
	 * Simple hash function for message integrity
	 */
	static simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36).substring(0, 8);
	}

	/**
	 * Escape XML special characters
	 */
	static escapeXML(str: string): string {
		return str.replace(/[<>&'"]/g, (char) => {
			switch (char) {
				case '<':
					return '&lt;';
				case '>':
					return '&gt;';
				case '&':
					return '&amp;';
				case '"':
					return '&quot;';
				case "'":
					return '&#39;';
				default:
					return char;
			}
		});
	}

	/**
	 * Basic XML validation
	 */
	static validateXML(xml: string): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Determine if this is Senate or House format
		const isSenateFormat = xml.includes('<DeliveryId>') && xml.includes('<Constituent>');

		if (isSenateFormat) {
			// Senate-specific validation (RELAX NG schema)
			const senateRequiredElements = [
				'<CWC>',
				'<DeliveryId>',
				'<DeliveryAgent>',
				'<Constituent>',
				'<Message>',
				'<MemberOffice>' // Senate uses MemberOffice, not OfficeCode
			];

			senateRequiredElements.forEach((element) => {
				if (!xml.includes(element)) {
					errors.push(`Missing required Senate element: ${element}`);
				}
			});
		} else {
			// House-specific validation
			const houseRequiredElements = [
				'<CWC version="2.0"',
				'<MessageId>',
				'<DeliveryAgent>',
				'<OfficeCode>',
				'<ConstituentData>',
				'<MessageData>'
			];

			houseRequiredElements.forEach((element) => {
				if (!xml.includes(element)) {
					errors.push(`Missing required House element: ${element}`);
				}
			});
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Determine delivery method based on template configuration
	 */
	static getDeliveryMethod(
		template: Template,
		_targetRep: UserRepresentative
	): 'cwc' | 'email' | 'hybrid' {
		// Check template delivery configuration
		const deliveryConfig = template.delivery_config as Record<string, unknown>;

		if (deliveryConfig?.method === 'direct_email') {
			return 'email';
		}

		if (deliveryConfig?.method === 'cwc_only') {
			return 'cwc';
		}

		if (deliveryConfig?.method === 'hybrid') {
			return 'hybrid';
		}

		// Default: Use CWC for congressional offices
		return 'cwc';
	}

	/**
	 * Preview XML without sensitive data (for testing/debugging)
	 */
	static generatePreviewXML(template: Template): string {
		const mockUser: User = {
			id: 'preview-user',
			name: 'Jane Doe',
			email: 'jane.doe@example.com',
			phone: '+1-555-123-4567',
			address: {
				street: '123 Main Street',
				city: 'San Francisco',
				state: 'CA',
				zip: '94102'
			},
			representatives: {
				house: {
					bioguideId: 'P000197',
					name: 'Nancy Pelosi',
					party: 'Democratic',
					state: 'CA',
					district: '11',
					chamber: 'house',
					officeCode: 'P000197'
				},
				senate: [
					{
						bioguideId: 'F000062',
						name: 'Dianne Feinstein',
						party: 'Democratic',
						state: 'CA',
						district: '00',
						chamber: 'senate',
						officeCode: 'F000062'
					},
					{
						bioguideId: 'P000145',
						name: 'Alex Padilla',
						party: 'Democratic',
						state: 'CA',
						district: '00',
						chamber: 'senate',
						officeCode: 'P000145'
					}
				]
			}
		};

		return this.generateUserAdvocacyXML({
			template,
			user: mockUser,
			_targetRep: mockUser.representatives.house
		});
	}
}
