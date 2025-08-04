import { describe, it, expect } from 'vitest';
import { CWCGenerator } from './cwc-generator';

describe('CWCGenerator', () => {
	const testTemplate = {
		id: 'test-template',
		subject: 'Test Congressional Message',
		message_body: 'Dear [Representative Name], This is a test message. Sincerely, [Name]',
		delivery_config: {},
		cwc_config: {}
	};

	const testUser = {
		id: 'test-user-123',
		name: 'John Doe',
		email: 'john@example.com',
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
				chamber: 'house' as const,
				officeCode: 'P000197'
			},
			senate: [{
				bioguideId: 'P000145',
				name: 'Alex Padilla',
				party: 'Democratic',
				state: 'CA',
				district: '00',
				chamber: 'senate' as const,
				officeCode: 'P000145'
			}]
		}
	};

	describe('generateUserAdvocacyXML', () => {
		it('should generate House CWC XML with correct structure', () => {
			// Arrange
			const message = {
				template: testTemplate,
				user: testUser,
				targetRep: testUser.representatives.house
			};

			// Act
			const xml = CWCGenerator.generateUserAdvocacyXML(message as any);

			// Assert
			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain('<CWC version="2.0">');
			expect(xml).toContain('<MessageHeader>');
			expect(xml).toContain('<MessageId>');
			expect(xml).toContain('<DeliveryAgent>');
			expect(xml).toContain('<Name>Communique Advocacy Platform</Name>');
			expect(xml).toContain('<OfficeCode>P000197</OfficeCode>');
			expect(xml).toContain('<ConstituentData>');
			expect(xml).toContain('<First>John</First>');
			expect(xml).toContain('<Last>Doe</Last>');
			expect(xml).toContain('<Street>123 Main Street</Street>');
			expect(xml).toContain('<MessageData>');
			expect(xml).toContain('<Subject>Test Congressional Message</Subject>');
		});

		it('should generate Senate CWC XML with correct structure', () => {
			// Arrange
			const message = {
				template: testTemplate,
				user: testUser,
				targetRep: testUser.representatives.senate[0]
			};

			// Act
			const xml = CWCGenerator.generateUserAdvocacyXML(message as any);

			// Assert
			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain('<CWC>');
			expect(xml).not.toContain('version="2.0"'); // Senate format
			expect(xml).toContain('<DeliveryId>');
			expect(xml).toContain('<DeliveryAgent>');
			expect(xml).toContain('<Constituent>');
			expect(xml).toContain('<FirstName>John</FirstName>');
			expect(xml).toContain('<LastName>Doe</LastName>');
			expect(xml).toContain('<ConstituentAddress>');
			expect(xml).toContain('<Address1>123 Main Street</Address1>');
			expect(xml).toContain('<StateAbbreviation>CA</StateAbbreviation>');
			expect(xml).toContain('<Message>');
			expect(xml).toContain('<ConstituentMessage>');
			expect(xml).toContain('<OfficeCode>P000145</OfficeCode>');
		});

		it('should handle single name correctly', () => {
			// Arrange
			const userWithSingleName = {
				...testUser,
				name: 'Madonna'
			};

			const message = {
				template: testTemplate,
				user: userWithSingleName,
				targetRep: testUser.representatives.house
			};

			// Act
			const xml = CWCGenerator.generateUserAdvocacyXML(message as any);

			// Assert
			expect(xml).toContain('<First>Madonna</First>');
			expect(xml).toContain('<Last>User</Last>'); // Default last name
		});

		it('should handle missing user name', () => {
			// Arrange
			const userWithoutName = {
				...testUser,
				name: ''
			};

			const message = {
				template: testTemplate,
				user: userWithoutName,
				targetRep: testUser.representatives.house
			};

			// Act
			const xml = CWCGenerator.generateUserAdvocacyXML(message as any);

			// Assert
			expect(xml).toContain('<First>Constituent</First>');
			expect(xml).toContain('<Last>User</Last>');
		});

		it('should escape XML special characters', () => {
			// Arrange
			const userWithSpecialChars = {
				...testUser,
				name: 'John <script> & Doe',
				email: 'john+test@example.com',
				address: {
					...testUser.address,
					street: '123 "Main" Street & Avenue'
				}
			};

			const templateWithSpecialChars = {
				...testTemplate,
				subject: 'Test & <important> Message',
				message_body: 'Dear [Representative], This message contains "quotes" & <tags>.'
			};

			const message = {
				template: templateWithSpecialChars,
				user: userWithSpecialChars,
				targetRep: testUser.representatives.house
			};

			// Act
			const xml = CWCGenerator.generateUserAdvocacyXML(message as any);

			// Assert
			expect(xml).toContain('&lt;script&gt;');
			expect(xml).toContain('&amp;');
			expect(xml).toContain('&quot;quotes&quot;');
			expect(xml).toContain('&lt;important&gt;');
			expect(xml).toContain('&lt;tags&gt;');
		});

		it('should handle missing phone number', () => {
			// Arrange
			const userWithoutPhone = {
				...testUser,
				phone: undefined
			};

			const message = {
				template: testTemplate,
				user: userWithoutPhone,
				targetRep: testUser.representatives.house
			};

			// Act
			const xml = CWCGenerator.generateUserAdvocacyXML(message as any);

			// Assert
			expect(xml).not.toContain('<Phone>+1-555-123-4567</Phone>');
		});
	});

	describe('generateMultiRepXML', () => {
		it('should generate XML for all representatives', () => {
			// Act
			const xmlArray = CWCGenerator.generateMultiRepXML(testTemplate as any, testUser as any);

			// Assert
			expect(xmlArray).toHaveLength(2); // 1 House + 1 Senate
			expect(xmlArray[0]).toContain('P000197'); // House rep
			expect(xmlArray[1]).toContain('P000145'); // Senate rep
		});
	});

	describe('generateMessageId', () => {
		it('should generate consistently formatted message IDs', () => {
			// Act
			const id = CWCGenerator.generateMessageId('user1', 'template1', 'rep1');

			// Assert - Test format, not uniqueness (timing-dependent)
			expect(id).toMatch(/^CWC-templa-\w+$/);
			expect(id).toContain('templa'); // Template prefix
		});

		it('should generate different IDs for different inputs', () => {
			// Act
			const id1 = CWCGenerator.generateMessageId('user1', 'template1', 'rep1');
			const id2 = CWCGenerator.generateMessageId('user2', 'template1', 'rep1');
			const id3 = CWCGenerator.generateMessageId('user1', 'template2', 'rep1');

			// Assert - Different inputs should produce different IDs
			expect(id1).not.toBe(id2); // Different users
			expect(id1).not.toBe(id3); // Different templates
		});
	});

	describe('generateIntegrityHash', () => {
		it('should generate consistent hash for same inputs', () => {
			// Act
			const hash1 = CWCGenerator.generateIntegrityHash('user1', 'template1', 'rep1');
			const hash2 = CWCGenerator.generateIntegrityHash('user1', 'template1', 'rep1');

			// Assert
			expect(hash1).toBe(hash2);
			expect(hash1).toMatch(/^\w{1,8}$/); // Should be alphanumeric, max 8 chars
		});

		it('should generate different hashes for different inputs', () => {
			// Act
			const hash1 = CWCGenerator.generateIntegrityHash('user1', 'template1', 'rep1');
			const hash2 = CWCGenerator.generateIntegrityHash('user2', 'template1', 'rep1');

			// Assert
			expect(hash1).not.toBe(hash2);
		});
	});

	describe('validateXML', () => {
		it('should validate House XML correctly', () => {
			// Arrange
			const houseXML = `<?xml version="1.0" encoding="UTF-8"?>
<CWC version="2.0">
    <MessageHeader>
        <MessageId>test-123</MessageId>
        <DeliveryAgent><Name>Test</Name></DeliveryAgent>
        <OfficeCode>P000197</OfficeCode>
    </MessageHeader>
    <ConstituentData><Name><First>John</First></Name></ConstituentData>
    <MessageData><Subject>Test</Subject></MessageData>
</CWC>`;

			// Act
			const validation = CWCGenerator.validateXML(houseXML);

			// Assert
			expect(validation.valid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});

		it('should validate Senate XML correctly', () => {
			// Arrange
			const senateXML = `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <DeliveryId>test-123</DeliveryId>
    <DeliveryAgent><Name>Test</Name></DeliveryAgent>
    <Constituent><FirstName>John</FirstName></Constituent>
    <Message><Subject>Test</Subject></Message>
    <OfficeCode>P000145</OfficeCode>
</CWC>`;

			// Act
			const validation = CWCGenerator.validateXML(senateXML);

			// Assert
			expect(validation.valid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});

		it('should detect missing required House elements', () => {
			// Arrange
			const invalidXML = `<?xml version="1.0" encoding="UTF-8"?>
<CWC version="2.0">
    <MessageHeader>
        <MessageId>test-123</MessageId>
    </MessageHeader>
</CWC>`;

			// Act
			const validation = CWCGenerator.validateXML(invalidXML);

			// Assert
			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Missing required House element: <DeliveryAgent>');
			expect(validation.errors).toContain('Missing required House element: <OfficeCode>');
			expect(validation.errors).toContain('Missing required House element: <ConstituentData>');
			expect(validation.errors).toContain('Missing required House element: <MessageData>');
		});

		it('should detect missing required Senate elements', () => {
			// Arrange
			const invalidXML = `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <DeliveryId>test-123</DeliveryId>
</CWC>`;

			// Act
			const validation = CWCGenerator.validateXML(invalidXML);

			// Assert
			expect(validation.valid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);
			expect(validation.errors.some(e => e.includes('DeliveryAgent'))).toBe(true);
			expect(validation.errors.some(e => e.includes('Constituent'))).toBe(true);
			expect(validation.errors.some(e => e.includes('Message'))).toBe(true);
			expect(validation.errors.some(e => e.includes('OfficeCode'))).toBe(true);
		});
	});

	describe('getDeliveryMethod', () => {
		it('should return cwc for default configuration', () => {
			// Act
			const method = CWCGenerator.getDeliveryMethod(
				testTemplate as any,
				testUser.representatives.house as any
			);

			// Assert
			expect(method).toBe('cwc');
		});

		it('should return email for direct_email configuration', () => {
			// Arrange
			const emailTemplate = {
				...testTemplate,
				delivery_config: { method: 'direct_email' }
			};

			// Act
			const method = CWCGenerator.getDeliveryMethod(
				emailTemplate as any,
				testUser.representatives.house as any
			);

			// Assert
			expect(method).toBe('email');
		});

		it('should return hybrid for hybrid configuration', () => {
			// Arrange
			const hybridTemplate = {
				...testTemplate,
				delivery_config: { method: 'hybrid' }
			};

			// Act
			const method = CWCGenerator.getDeliveryMethod(
				hybridTemplate as any,
				testUser.representatives.house as any
			);

			// Assert
			expect(method).toBe('hybrid');
		});
	});

	describe('generatePreviewXML', () => {
		it('should generate preview XML with mock data', () => {
			// Act
			const xml = CWCGenerator.generatePreviewXML(testTemplate as any);

			// Assert
			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain('<CWC version="2.0">'); // Uses House format for preview
			expect(xml).toContain('<First>Jane</First>'); // Mock user name
			expect(xml).toContain('<Last>Doe</Last>'); // Mock user name
			expect(xml).toContain('San Francisco'); // Mock address
			expect(xml).toContain('P000197'); // Mock House rep
		});
	});
});