/**
 * CWC API Integration
 * Handles submission of messages to Congressional Web Contact API
 */

import axios from 'axios';
import config from './config';
import type {
	MessageData,
	DeliveryResult,
	UserProfileData,
	TemplateData,
	ErrorWithCode
} from '$lib/types/any-replacements.js';

/**
 * CWC API Client
 */
class CWCClient {
	private apiKey: string;
	private apiUrl: string;
	private deliveryAgent: {
		id: string;
		name: string;
		contact: string;
		acknowledgementEmail: string;
		ack: string;
	};
	private campaignId: string;

	constructor() {
		this.apiKey = config.cwc.apiKey;
		this.apiUrl = config.cwc.apiUrl;
		this.deliveryAgent = config.cwc.deliveryAgent;
		this.campaignId = config.cwc.campaignId;
	}

	/**
	 * Submit message to CWC API
	 */
	async submitMessage(messageData: MessageData) {
		try {
			const xmlMessage = this.buildCWCXML(messageData);

			const response = await axios.post(`${this.apiUrl}/submit`, xmlMessage, {
				headers: {
					'Content-Type': 'application/xml',
					Authorization: `Bearer ${this.apiKey}`,
					'User-Agent': 'Delivery-Platform/1.0'
				},
				timeout: 30000 // 30 second timeout
			});

			return {
				success: true,
				submissionId: response.data.submissionId || `CWC_${Date.now()}`,
				messageId: `CWC_MSG_${Date.now()}`,
				response: response.data
			};
		} catch (error) {
			const axiosError = error as ErrorWithCode & { 
				response?: { 
					data?: { message?: string }; 
					status?: number; 
				} 
			};
			console.error(
				'CWC API submission failed:',
				axiosError.response?.data || (error ? 'Unknown error' : 'Unknown error')
			);

			return {
				success: false,
				error: axiosError.response?.data?.message || axiosError.message,
				messageId: `ERROR_${messageData.templateId}_${Date.now()}`,
				statusCode: axiosError.response?.status
			};
		}
	}

	/**
	 * Build CWC XML from parsed message data
	 */
	buildCWCXML(
		messageData: MessageData & {
			userProfile?: UserProfileData;
			recipientOffice?: string;
			personalConnection?: string;
		}
	) {
		const { templateId, userId, subject, body, personalConnection, userProfile, recipientOffice } =
			messageData;

		// Generate unique message ID
		const cwcMessageId = `DELIVERY_${templateId}_${userId}_${Date.now()}`;

		// Combine personal connection with template content
		let messageText = body;
		if (personalConnection) {
			messageText = `${personalConnection}\n\n---\n\n${body}`;
		}

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CWC_Message>
	<DeliveryAgent>
		<DeliveryAgentId>${this.escapeXML(this.deliveryAgent.id)}</DeliveryAgentId>
		<DeliveryAgentName>${this.escapeXML(this.deliveryAgent.name)}</DeliveryAgentName>
		<DeliveryAgentContact>${this.escapeXML(this.deliveryAgent.contact)}</DeliveryAgentContact>
		<DeliveryAgentAcknowledgementEmail>${this.escapeXML(this.deliveryAgent.acknowledgementEmail)}</DeliveryAgentAcknowledgementEmail>
		<DeliveryAgentAcknowledgement>${this.deliveryAgent.ack}</DeliveryAgentAcknowledgement>
	</DeliveryAgent>
	<Recipient>
		<MemberOffice>${this.escapeXML(recipientOffice || 'AUTO_DETECT')}</MemberOffice>
		<IsResponseRequested>N</IsResponseRequested>
		<Newsletter>N</Newsletter>
	</Recipient>
	<Constituent>
		<FirstName>${this.escapeXML(userProfile?.name?.split(' ')[0] || '')}</FirstName>
		<LastName>${this.escapeXML(userProfile?.name?.split(' ').slice(1).join(' ') || '')}</LastName>
		<Address >${this.escapeXML(userProfile?.street || '')}</Address >
		<City>${this.escapeXML(userProfile?.city || '')}</City>
		<StateAbbreviation>${this.escapeXML(userProfile?.state || '')}</StateAbbreviation>
		<Zip>${this.escapeXML(userProfile?.zip || '')}</Zip>
		<Email>${this.escapeXML(userProfile?.email || '')}</Email>
	</Constituent>
	<Message>
		<MessageId>${this.escapeXML(cwcMessageId)}</MessageId>
		<Subject>${this.escapeXML(subject)}</Subject>
		<MessageText>${this.escapeXML(messageText)}</MessageText>
	</Message>
	<Campaign>
		<CampaignId>${this.escapeXML(this.campaignId)}</CampaignId>
		<OrganizationName>${this.escapeXML(this.deliveryAgent.name)}</OrganizationName>
	</Campaign>
</CWC_Message>`;

		return xml;
	}

	/**
	 * Escape XML special characters
	 */
	escapeXML(text: string) {
		if (typeof text !== 'string') return '';

		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}
}

/**
 * Fetch user profile from API
 */
async function fetchUserProfile(userId: string): Promise<UserProfileData | null> {
	try {
		const response = await axios.get(`${config.communique.apiUrl}/users/${userId}`, {
			headers: {
				Authorization: `Bearer ${config.communique.apiKey}`,
				'Content-Type': 'application/json'
			},
			timeout: 10000
		});

		return response.data.user;
	} catch (error) {
		const errorMessage = error ? 'Unknown error' : 'Unknown error';
		console.error('Failed to fetch user profile:', errorMessage);
		return null;
	}
}

/**
 * Fetch template data from API
 */
async function fetchTemplate(templateId: string): Promise<TemplateData | null> {
	try {
		const response = await axios.get(`${config.communique.apiUrl}/templates/${templateId}`, {
			headers: {
				Authorization: `Bearer ${config.communique.apiKey}`,
				'Content-Type': 'application/json'
			},
			timeout: 10000
		});

		return response.data.template;
	} catch (error) {
		const errorMessage = error ? 'Unknown error' : 'Unknown error';
		console.error('Failed to fetch template:', errorMessage);
		return null;
	}
}

/**
 * Notify API of delivery result
 */
async function notifyDeliveryResult(templateId: string, userId: string, result: DeliveryResult) {
	try {
		await axios.post(
			`${config.communique.apiUrl}/delivery/notify`,
			{
				templateId,
				userId,
				deliveryMethod: 'certified',
				success: result.success,
				submissionId: result.messageId,
				error: result.error,
				timestamp: new Date().toISOString()
			},
			{
				headers: {
					Authorization: `Bearer ${config.communique.apiKey}`,
					'Content-Type': 'application/json'
				},
				timeout: 10000
			}
		);

		console.log('Delivery result notification sent successfully');
	} catch (error) {
		const errorMessage = error ? 'Unknown error' : 'Unknown error';
		console.error('Failed to notify delivery result:', errorMessage);
	}
}

export { CWCClient, fetchUserProfile, fetchTemplate, notifyDeliveryResult };
