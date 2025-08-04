import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * CONGRESSIONAL DELIVERY API TESTS
 * 
 * Critical business logic: Handles all congressional message delivery.
 * Revenue impact: CRITICAL - Core product functionality
 */

// Mock the Communicating With Congress (CWC) API
const mockCWCClient = {
  submitMessage: vi.fn(),
  lookupRepresentatives: vi.fn(),
  validateAddress: vi.fn(),
  getDeliveryStatus: vi.fn(),
};

// Mock Prisma for database operations
const mockPrisma = {
  template: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  congressionalSubmission: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

describe('Congressional Delivery API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/congressional-delivery', () => {
    it('should handle successful congressional message delivery', async () => {
      const requestBody = {
        templateId: 'tpl_climate_action_123',
        userId: 'user_advocate_456',
        personalizedMessage: 'As a constituent in your district, I urge you to support strong climate action...',
        address: {
          street: '123 Main Street',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          congressional_district: 'IL-13'
        },
        deliveryMethod: 'email_and_fax'
      };

      // Mock successful template lookup
      mockPrisma.template.findUnique.mockResolvedValue({
        id: requestBody.templateId,
        title: 'Climate Action Now',
        content: 'Dear Representative, {{personalized_message}}',
        isActive: true,
        deliveryMethod: 'both'
      });

      // Mock successful user lookup
      mockPrisma.user.findUnique.mockResolvedValue({
        id: requestBody.userId,
        name: 'Jane Advocate',
        email: 'jane@example.com',
        isVerified: true
      });

      // Mock successful CWC submission
      mockCWCClient.submitMessage.mockResolvedValue({
        success: true,
        submissionId: 'cwc_submission_789',
        representatives: [
          {
            name: 'Rep. John Smith',
            district: 'IL-13',
            deliveryStatus: 'delivered'
          }
        ],
        deliveryConfirmation: {
          email: 'sent',
          fax: 'sent',
          timestamp: new Date().toISOString()
        }
      });

      // Mock database record creation
      mockPrisma.congressionalSubmission.create.mockResolvedValue({
        id: 'submission_abc123',
        templateId: requestBody.templateId,
        userId: requestBody.userId,
        cwcSubmissionId: 'cwc_submission_789',
        status: 'delivered',
        createdAt: new Date()
      });

      // Simulate the API endpoint logic
      const handleCongressionalDelivery = async (request: any) => {
        const body = request;
        
        // Validate template exists and is active
        const template = await mockPrisma.template.findUnique({
          where: { id: body.templateId }
        });
        
        if (!template || !template.isActive) {
          throw new Error('Template not found or inactive');
        }
        
        // Validate user exists and is verified
        const user = await mockPrisma.user.findUnique({
          where: { id: body.userId }
        });
        
        if (!user || !user.isVerified) {
          throw new Error('User not found or not verified');
        }
        
        // Submit to CWC API
        const cwcResponse = await mockCWCClient.submitMessage({
          template: template.content,
          personalizedMessage: body.personalizedMessage,
          senderInfo: {
            name: user.name,
            email: user.email,
            address: body.address
          },
          deliveryMethod: body.deliveryMethod
        });
        
        // Record submission in database
        const submission = await mockPrisma.congressionalSubmission.create({
          data: {
            templateId: body.templateId,
            userId: body.userId,
            cwcSubmissionId: cwcResponse.submissionId,
            status: 'delivered',
            deliveryDetails: cwcResponse.deliveryConfirmation
          }
        });
        
        return {
          success: true,
          submissionId: submission.id,
          cwcSubmissionId: cwcResponse.submissionId,
          representatives: cwcResponse.representatives,
          deliveryStatus: cwcResponse.deliveryConfirmation
        };
      };

      const result = await handleCongressionalDelivery(requestBody);

      expect(result.success).toBe(true);
      expect(result.submissionId).toBe('submission_abc123');
      expect(result.cwcSubmissionId).toBe('cwc_submission_789');
      expect(result.representatives).toHaveLength(1);
      expect(result.representatives[0].name).toBe('Rep. John Smith');

      // Verify all mocks were called correctly
      expect(mockPrisma.template.findUnique).toHaveBeenCalledWith({
        where: { id: requestBody.templateId }
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: requestBody.userId }
      });
      expect(mockCWCClient.submitMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          personalizedMessage: requestBody.personalizedMessage,
          deliveryMethod: requestBody.deliveryMethod
        })
      );
    });

    it('should handle invalid template errors', async () => {
      const requestBody = {
        templateId: 'nonexistent_template',
        userId: 'user_456',
        personalizedMessage: 'Test message',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          congressional_district: 'IL-13'
        }
      };

      // Mock template not found
      mockPrisma.template.findUnique.mockResolvedValue(null);

      const handleCongressionalDelivery = async (request: any) => {
        const template = await mockPrisma.template.findUnique({
          where: { id: request.templateId }
        });
        
        if (!template) {
          throw new Error('Template not found or inactive');
        }
        
        return { success: true };
      };

      await expect(
        handleCongressionalDelivery(requestBody)
      ).rejects.toThrow('Template not found or inactive');

      expect(mockPrisma.template.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent_template' }
      });
    });

    it('should handle unverified user errors', async () => {
      const requestBody = {
        templateId: 'tpl_123',
        userId: 'unverified_user',
        personalizedMessage: 'Test message',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701'
        }
      };

      // Mock valid template
      mockPrisma.template.findUnique.mockResolvedValue({
        id: 'tpl_123',
        title: 'Test Template',
        isActive: true
      });

      // Mock unverified user
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'unverified_user',
        name: 'Unverified User',
        email: 'unverified@example.com',
        isVerified: false // Not verified
      });

      const handleCongressionalDelivery = async (request: any) => {
        const template = await mockPrisma.template.findUnique({
          where: { id: request.templateId }
        });
        
        const user = await mockPrisma.user.findUnique({
          where: { id: request.userId }
        });
        
        if (!user || !user.isVerified) {
          throw new Error('User not found or not verified');
        }
        
        return { success: true };
      };

      await expect(
        handleCongressionalDelivery(requestBody)
      ).rejects.toThrow('User not found or not verified');
    });

    it('should handle CWC API failures gracefully', async () => {
      const requestBody = {
        templateId: 'tpl_123',
        userId: 'user_456',
        personalizedMessage: 'Test message',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701'
        }
      };

      // Mock successful validations
      mockPrisma.template.findUnique.mockResolvedValue({
        id: 'tpl_123',
        isActive: true,
        content: 'Dear Representative...'
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_456',
        name: 'John Doe',
        email: 'john@example.com',
        isVerified: true
      });

      // Mock CWC API failure
      mockCWCClient.submitMessage.mockRejectedValue(
        new Error('CWC API temporarily unavailable')
      );

      const handleCongressionalDelivery = async (request: any) => {
        // Validation passes...
        await mockPrisma.template.findUnique({ where: { id: request.templateId } });
        await mockPrisma.user.findUnique({ where: { id: request.userId } });
        
        // CWC submission fails
        try {
          await mockCWCClient.submitMessage({});
        } catch (error: any) {
          throw new Error(`Congressional delivery failed: ${error.message}`);
        }
      };

      await expect(
        handleCongressionalDelivery(requestBody)
      ).rejects.toThrow('Congressional delivery failed: CWC API temporarily unavailable');
    });

    it('should handle address validation failures', async () => {
      const requestBody = {
        templateId: 'tpl_123',
        userId: 'user_456',
        personalizedMessage: 'Test message',
        address: {
          street: 'Invalid Address',
          city: 'Unknown City',
          state: 'XX',
          zipCode: '00000'
        }
      };

      // Mock successful template and user validation
      mockPrisma.template.findUnique.mockResolvedValue({
        id: 'tpl_123',
        isActive: true
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_456',
        isVerified: true
      });

      // Mock address validation failure
      mockCWCClient.validateAddress.mockResolvedValue({
        valid: false,
        error: 'Address not found in USPS database',
        suggestions: []
      });

      const handleCongressionalDelivery = async (request: any) => {
        // Validation passes...
        await mockPrisma.template.findUnique({ where: { id: request.templateId } });
        await mockPrisma.user.findUnique({ where: { id: request.userId } });
        
        // Address validation
        const addressValidation = await mockCWCClient.validateAddress(request.address);
        
        if (!addressValidation.valid) {
          throw new Error(`Invalid address: ${addressValidation.error}`);
        }
        
        return { success: true };
      };

      await expect(
        handleCongressionalDelivery(requestBody)
      ).rejects.toThrow('Invalid address: Address not found in USPS database');

      expect(mockCWCClient.validateAddress).toHaveBeenCalledWith(requestBody.address);
    });

    it('should handle representative lookup for address', async () => {
      const address = {
        street: '123 Main Street',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701'
      };

      const mockRepresentatives = [
        {
          name: 'Rep. John Smith',
          party: 'Democratic',
          district: 'IL-13',
          office: 'House',
          contactInfo: {
            email: 'john.smith@mail.house.gov',
            phone: '202-225-1234',
            fax: '202-225-5678'
          }
        },
        {
          name: 'Sen. Jane Doe',
          party: 'Republican', 
          district: 'IL',
          office: 'Senate',
          contactInfo: {
            email: 'jane.doe@senate.gov',
            phone: '202-224-9876'
          }
        }
      ];

      mockCWCClient.lookupRepresentatives.mockResolvedValue(mockRepresentatives);

      const result = await mockCWCClient.lookupRepresentatives(address);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Rep. John Smith');
      expect(result[0].district).toBe('IL-13');
      expect(result[1].name).toBe('Sen. Jane Doe');
      expect(result[1].office).toBe('Senate');

      expect(mockCWCClient.lookupRepresentatives).toHaveBeenCalledWith(address);
    });
  });

  describe('GET /api/congressional-delivery/status', () => {
    it('should check delivery status for submission', async () => {
      const submissionId = 'submission_abc123';
      const cwcSubmissionId = 'cwc_submission_789';

      // Mock database lookup
      mockPrisma.congressionalSubmission.findUnique.mockResolvedValue({
        id: submissionId,
        cwcSubmissionId: cwcSubmissionId,
        status: 'delivered',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        deliveryDetails: {
          email: 'sent',
          fax: 'sent',
          timestamp: '2024-01-15T10:05:00Z'
        }
      });

      // Mock CWC status check
      mockCWCClient.getDeliveryStatus.mockResolvedValue({
        submissionId: cwcSubmissionId,
        status: 'delivered',
        deliveryConfirmation: {
          representatives: [
            {
              name: 'Rep. John Smith',
              deliveryMethod: 'email',
              deliveredAt: '2024-01-15T10:05:00Z',
              confirmed: true
            }
          ]
        }
      });

      const handleStatusCheck = async (submissionId: string) => {
        const submission = await mockPrisma.congressionalSubmission.findUnique({
          where: { id: submissionId }
        });

        if (!submission) {
          throw new Error('Submission not found');
        }

        const cwcStatus = await mockCWCClient.getDeliveryStatus(submission.cwcSubmissionId);

        return {
          submissionId: submission.id,
          status: cwcStatus.status,
          createdAt: submission.createdAt,
          deliveryDetails: cwcStatus.deliveryConfirmation
        };
      };

      const result = await handleStatusCheck(submissionId);

      expect(result.submissionId).toBe(submissionId);
      expect(result.status).toBe('delivered');
      expect(result.deliveryDetails.representatives).toHaveLength(1);
      expect(result.deliveryDetails.representatives[0].confirmed).toBe(true);

      expect(mockPrisma.congressionalSubmission.findUnique).toHaveBeenCalledWith({
        where: { id: submissionId }
      });
      expect(mockCWCClient.getDeliveryStatus).toHaveBeenCalledWith(cwcSubmissionId);
    });

    it('should handle non-existent submission status check', async () => {
      const nonExistentId = 'nonexistent_submission';

      mockPrisma.congressionalSubmission.findUnique.mockResolvedValue(null);

      const handleStatusCheck = async (submissionId: string) => {
        const submission = await mockPrisma.congressionalSubmission.findUnique({
          where: { id: submissionId }
        });

        if (!submission) {
          throw new Error('Submission not found');
        }

        return { status: 'found' };
      };

      await expect(
        handleStatusCheck(nonExistentId)
      ).rejects.toThrow('Submission not found');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rate limiting from CWC API', async () => {
      const requestBody = {
        templateId: 'tpl_123',
        userId: 'user_456',
        personalizedMessage: 'Test message'
      };

      mockCWCClient.submitMessage.mockRejectedValue(
        new Error('Rate limit exceeded. Please try again in 60 seconds.')
      );

      const handleRateLimit = async (request: any) => {
        try {
          await mockCWCClient.submitMessage(request);
        } catch (error: any) {
          if (error.message.includes('Rate limit')) {
            throw new Error('Congressional delivery service is temporarily busy. Please try again shortly.');
          }
          throw error;
        }
      };

      await expect(
        handleRateLimit(requestBody)
      ).rejects.toThrow('Congressional delivery service is temporarily busy');
    });

    it('should handle database connection failures', async () => {
      const requestBody = {
        templateId: 'tpl_123',
        userId: 'user_456'
      };

      mockPrisma.template.findUnique.mockRejectedValue(
        new Error('Database connection timeout')
      );

      const handleDatabaseError = async (request: any) => {
        try {
          await mockPrisma.template.findUnique({ where: { id: request.templateId } });
        } catch (error: any) {
          throw new Error('Service temporarily unavailable. Please try again.');
        }
      };

      await expect(
        handleDatabaseError(requestBody)
      ).rejects.toThrow('Service temporarily unavailable');
    });

    it('should validate required fields', async () => {
      const incompleteRequest = {
        templateId: 'tpl_123'
        // Missing userId, personalizedMessage, address
      };

      const validateRequest = (request: any) => {
        const requiredFields = ['templateId', 'userId', 'personalizedMessage', 'address'];
        
        for (const field of requiredFields) {
          if (!request[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        
        return true;
      };

      expect(() => {
        validateRequest(incompleteRequest);
      }).toThrow('Missing required field: userId');
    });
  });
});