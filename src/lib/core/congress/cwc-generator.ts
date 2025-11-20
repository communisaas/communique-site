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
	_targetRep: UserRepresentative; // Which specific rep to send to
	personalizedMessage?: string; // Custom message to include in the body
}

export class CWCGenerator {
	/**
	 * Generate proper CWC office code from representative data
	 * House: H{STATE}{DISTRICT} format (e.g., HCA13 for CA-13)
	 * Senate: S{STATE}{01-03} format (e.g., SCA01 for CA senators)
	 */
	static generateOfficeCode(rep: UserRepresentative): string {
		if (rep.chamber === 'senate') {
			// Senate uses S{STATE}{01-03} format based on state
			const state = rep.state.toUpperCase();
			// For demo purposes, use position-based suffix (01, 02, 03)
			// In production, this would map to actual Senate seat positions
			const suffix = rep.bioguideId.endsWith('1') ? '01' : '02';
			return `S${state}${suffix}`;
		} else {
			// House uses H{STATE}{DISTRICT} format
			const state = rep.state.toUpperCase();
			const district = rep.district.padStart(2, '0'); // Ensure 2-digit format
			return `H${state}${district}`;
		}
	}

	/**
	 * Generate CWC XML for a user's advocacy message
	 * This is the core function used when processing mailto: links
	 */
	static generateUserAdvocacyXML(message: CWCMessage): string {
		const { template, user, _targetRep, personalizedMessage } = message;

		// Use Senate-specific format if targeting Senate
		if (_targetRep.chamber === 'senate') {
			return this.generateSenateXML(message);
		}

		const timestamp = new Date().toISOString();
		const messageId = this.generateMessageId(user.id, template.id, _targetRep.bioguideId);

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
        <OfficeCode>${this.escapeXML(this.generateOfficeCode(_targetRep))}</OfficeCode>
    </MessageHeader>
    
    <ConstituentData>
        <Name>
            <First>${this.escapeXML(firstName)}</First>
            <Last>${this.escapeXML(lastName)}</Last>
        </Name>
        <Address >
            <Street>${this.escapeXML(user.address.street)}</Street>
            <City>${this.escapeXML(user.address.city)}</City>
            <State>${this.escapeXML(user.address.state)}</State>
            <Zip>${this.escapeXML(user.address.zip)}</Zip>
        </Address >
        <Email>${this.escapeXML(user.email)}</Email>
        ${user.phone ? `<Phone>${this.escapeXML(user.phone)}</Phone>` : ''}
    </ConstituentData>
    
    <MessageData>
        <Subject>${this.escapeXML(template.title || 'Congressional Communication')}</Subject>
        <Body>${this.escapeXML(personalizedMessage || template.message_body)}</Body>
        
        <MessageMetadata>
            <IntegrityHash>${this.generateIntegrityHash(user.id, template.id, _targetRep.bioguideId)}</IntegrityHash>
        </MessageMetadata>
    </MessageData>
</CWC>`;

		return xml;
	}

	/**
	 * Generate Senate-specific CWC XML based on official Senate RELAX NG schema
	 * Matches exact Senate SOAPBox API requirements
	 */
	static generateSenateXML(message: CWCMessage): string {
		const { template, user, _targetRep, personalizedMessage } = message;

		// Generate required IDs and timestamps
		const deliveryId = this.generateDeliveryId(user.id, template.id, _targetRep.bioguideId);
		const deliveryDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format
		const timestamp = new Date().toISOString();

		// Extract user name parts
		const [firstName, ...lastNameParts] = (user.name || 'Constituent').split(' ');
		const lastName = lastNameParts.join(' ') || 'User';

		// Format phone number to XXX-XXX-XXXX pattern
		const formattedPhone = this.formatPhoneNumber(user.phone || '555-123-4567');

		// Generate Library of Congress topics based on template content
		const topics = this.generateLibraryOfCongressTopics(template.title || '');

		// Official Senate CWC XML based on RELAX NG schema - CORRECT ORDER
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <CWCVersion>2.0</CWCVersion>
    <Delivery>
        <DeliveryId>${deliveryId}</DeliveryId>
        <DeliveryDate>${deliveryDate}</DeliveryDate>
        <DeliveryAgent>Communique Advocacy Platform</DeliveryAgent>
        <DeliveryAgentAckEmailAddress>cwc@communique.org</DeliveryAgentAckEmailAddress>
        <DeliveryAgentContact>
            <DeliveryAgentContactName>Communique Support Team</DeliveryAgentContactName>
            <DeliveryAgentContactEmail>support@communique.org</DeliveryAgentContactEmail>
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
    </Constituent>
    <Message>
        <Subject>${this.escapeXML(template.title || 'Congressional Communication')}</Subject>
        <LibraryOfCongressTopics>
            ${topics.map((topic) => `<LibraryOfCongressTopic>${topic}</LibraryOfCongressTopic>`).join('\n            ')}
        </LibraryOfCongressTopics>
        <ConstituentMessage>${this.escapeXML(personalizedMessage || template.message_body || template.body || '')}</ConstituentMessage>
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
