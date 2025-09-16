import type { Template } from '$lib/types/template';

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

interface User {
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

interface CWCMessage {
	template: Template;
	user: User;
	targetRep: UserRepresentative; // Which specific rep to send to
}

export class CWCGenerator {
	/**
	 * Generate CWC XML for a user's advocacy message
	 * This is the core function used when processing mailto: links
	 */
	static generateUserAdvocacyXML(message: CWCMessage): string {
		const { template, user, targetRep } = message;

		// Use Senate-specific format if targeting Senate
		if (targetRep.chamber === 'senate') {
			return this.generateSenateXML(message);
		}

		const timestamp = new Date().toISOString();
		const messageId = this.generateMessageId(user.id, template.id, targetRep.bioguideId);

		// Extract user name parts
		const [firstName, ...lastNameParts] = (user.name || 'Constituent').split(' ');
		const lastName = lastNameParts.join(' ') || 'User';

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CWC version="2.0">
    <MessageHeader>
        <MessageId>${this.escapeXML(messageId)}</MessageId>
        <Timestamp>${timestamp}</Timestamp>
        <DeliveryAgent>
            <Name>Communique Advocacy Platform</Name>
            <Email>cwc@communique.org</Email>
            <Phone>+1-555-CWC-MAIL</Phone>
        </DeliveryAgent>
        <OfficeCode>${this.escapeXML(targetRep.officeCode)}</OfficeCode>
    </MessageHeader>
    
    <ConstituentData>
        <Name>
            <First>${this.escapeXML(firstName)}</First>
            <Last>${this.escapeXML(lastName)}</Last>
        </Name>
        <Address>
            <Street>${this.escapeXML(user.address.street)}</Street>
            <City>${this.escapeXML(user.address.city)}</City>
            <State>${this.escapeXML(user.address.state)}</State>
            <Zip>${this.escapeXML(user.address.zip)}</Zip>
        </Address>
        <Email>${this.escapeXML(user.email)}</Email>
        ${user.phone ? `<Phone>${this.escapeXML(user.phone)}</Phone>` : ''}
    </ConstituentData>
    
    <MessageData>
        <Subject>${this.escapeXML(template.subject || 'Congressional Communication')}</Subject>
        <Body>${this.escapeXML(template.message_body)}</Body>
        
        <MessageMetadata>
            <IntegrityHash>${this.generateIntegrityHash(user.id, template.id, targetRep.bioguideId)}</IntegrityHash>
        </MessageMetadata>
    </MessageData>
</CWC>`;

		return xml;
	}

	/**
	 * Generate Senate-specific CWC XML
	 * The Senate uses a different XML schema than the House
	 */
	static generateSenateXML(message: CWCMessage): string {
		const { template, user, targetRep } = message;

		const messageId = this.generateMessageId(user.id, template.id, targetRep.bioguideId);

		// Extract user name parts
		const [firstName, ...lastNameParts] = (user.name || 'Constituent').split(' ');
		const lastName = lastNameParts.join(' ') || 'User';

		// Simplified Senate XML format based on error feedback
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <DeliveryId>${this.escapeXML(messageId)}</DeliveryId>
    <DeliveryAgent>
        <Name>Communique Advocacy Platform</Name>
        <Email>cwc@communique.org</Email>
        <Phone>+1-555-CWC-MAIL</Phone>
    </DeliveryAgent>
    <Constituent>
        <Prefix></Prefix>
        <FirstName>${this.escapeXML(firstName)}</FirstName>
        <MiddleName></MiddleName>
        <LastName>${this.escapeXML(lastName)}</LastName>
        <Suffix></Suffix>
        <Title></Title>
        <ConstituentAddress>
            <Address1>${this.escapeXML(user.address.street)}</Address1>
            <Address2></Address2>
            <City>${this.escapeXML(user.address.city)}</City>
            <StateAbbreviation>${this.escapeXML(user.address.state)}</StateAbbreviation>
            <Zip>${this.escapeXML(user.address.zip)}</Zip>
        </ConstituentAddress>
        <ConstituentEmail>${this.escapeXML(user.email)}</ConstituentEmail>
        <ConstituentPhone>${this.escapeXML(user.phone || '')}</ConstituentPhone>
    </Constituent>
    <Message>
        <Subject>${this.escapeXML(template.subject || 'Congressional Communication')}</Subject>
        <LibraryOfCongressTopics></LibraryOfCongressTopics>
        <BillNumber></BillNumber>
        <ProOrCon></ProOrCon>
        <OrganizationAcronym></OrganizationAcronym>
        <ConstituentMessage>${this.escapeXML(template.message_body)}</ConstituentMessage>
    </Message>
    <OfficeCode>${this.escapeXML(targetRep.officeCode)}</OfficeCode>
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
				targetRep: rep
			})
		);
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
			// Senate-specific validation
			const senateRequiredElements = [
				'<CWC>',
				'<DeliveryId>',
				'<DeliveryAgent>',
				'<Constituent>',
				'<Message>',
				'<OfficeCode>'
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
		targetRep: UserRepresentative
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
			targetRep: mockUser.representatives.house
		});
	}
}
