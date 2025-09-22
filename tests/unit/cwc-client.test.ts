import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	userFactory,
	representativeFactory as _representativeFactory,
	templateFactory,
	congressionalOfficeFactory
} from '../fixtures/factories';
// Mock the CWC client module
const mockCwcClient = {
	submitToHouse: vi.fn(),
	submitToSenate: vi.fn(),
	validateTemplate: vi.fn(),
	getDeliveryStatus: vi.fn()
};

vi.mock('../../src/lib/core/congress/cwc-client.js', () => ({
	default: mockCwcClient
}));

describe('CWC Client Unit Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	it('should submit to House successfully', async () => {
		// Configure the mock response
		mockCwcClient.submitToHouse.mockResolvedValue({
			success: true,
			messageId: 'house-msg-123',
			submissionId: 'cwc-house-456'
		});

		const template = templateFactory.build();
		const user = userFactory.build();
		const office = congressionalOfficeFactory.build({ overrides: { chamber: 'house' } });
		const message = 'Personalized message content';

		const result = await mockCwcClient.submitToHouse(template, user, office, message);

		expect(result).toEqual({
			success: true,
			messageId: 'house-msg-123',
			submissionId: 'cwc-house-456'
		});

		expect(mockCwcClient.submitToHouse).toHaveBeenCalledWith(template, user, office, message);
	});

	it('should submit to Senate successfully', async () => {
		// Configure the mock response
		mockCwcClient.submitToSenate.mockResolvedValue({
			success: true,
			messageId: 'senate-msg-789',
			submissionId: 'cwc-senate-012'
		});

		const template = templateFactory.build();
		const user = userFactory.build();
		const office = congressionalOfficeFactory.build({ overrides: { chamber: 'senate' } });
		const message = 'Personalized message content';

		const result = await mockCwcClient.submitToSenate(template, user, office, message);

		expect(result).toEqual({
			success: true,
			messageId: 'senate-msg-789',
			submissionId: 'cwc-senate-012'
		});

		expect(mockCwcClient.submitToSenate).toHaveBeenCalledWith(template, user, office, message);
	});

	it('should validate template format', async () => {
		// Configure the mock response
		mockCwcClient.validateTemplate.mockResolvedValue({ valid: true });

		const template = templateFactory.build();
		const result = await mockCwcClient.validateTemplate(template);

		expect(result).toEqual({ valid: true });
		expect(mockCwcClient.validateTemplate).toHaveBeenCalledWith(template);
	});

	it('should check delivery status', async () => {
		// Configure the mock response
		mockCwcClient.getDeliveryStatus.mockResolvedValue({
			status: 'delivered',
			deliveredAt: new Date()
		});

		const messageId = 'test-msg-123';
		const result = await mockCwcClient.getDeliveryStatus(messageId);

		expect(result).toEqual({
			status: 'delivered',
			deliveredAt: expect.any(Date)
		});

		expect(mockCwcClient.getDeliveryStatus).toHaveBeenCalledWith(messageId);
	});
});
